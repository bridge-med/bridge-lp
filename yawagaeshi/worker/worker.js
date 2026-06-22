/* =========================================================================
 * やわ返 — Cloudflare Worker（自前API / Gemini 連携）
 *
 * 役割：スマホアプリ(GitHub Pages) からの返信生成リクエストを受け、
 *       サーバー側で Gemini API を呼ぶ。APIキーはここ(Secret)にだけ置く。
 *
 *   スマホアプリ → この Worker → Gemini API
 *
 * デプロイ：
 *   1) npm i -g wrangler
 *   2) cd yawagaeshi/worker
 *   3) wrangler secret put GEMINI_API_KEY   ← Google AI Studio のキーを貼る
 *   4) wrangler deploy
 *   5) 表示された https://<name>.<sub>.workers.dev を控える
 *   6) アプリ側 app/replyService.js の REPLY_ENDPOINT にその URL を設定し、
 *      REPLY_PROVIDER を 'remote' にして再デプロイ
 *      （または端末で localStorage に設定。README 参照）
 *
 * モデルは環境変数 GEMINI_MODEL で変更可（既定: gemini-2.5-flash）。
 * 速さ・安さ重視なら gemini-2.5-flash-lite も可。
 * ========================================================================= */

const SYSTEM_PROMPT =
  'あなたは日本語のコミュニケーションに強い返信文作成アシスタントです。\n' +
  '目的：ユーザーが送信前に一呼吸置き、角が立たない返信文を作れるようにしてください。\n' +
  '条件：\n' +
  '- 日本語で出力する\n' +
  '- 相手を責めない\n' +
  '- 不自然な敬語にしない\n' +
  '- 回りくどすぎない\n' +
  '- ユーザーの意図は変えない\n' +
  '- 必要以上に謝らない\n' +
  '- 返信案を3つ出す（label は「やわらかめ」「ちょうどいい」「短め」の順）\n' +
  '- それぞれトーンや長さを変える\n' +
  '- チャネルがメール以外（Slack/LINE/DM）のときは、メール特有の「お世話になっております」等は避け、その場に合った自然な書き出しにする\n' +
  '- 出力は指定された JSON 形式にする\n' +
  'riskCheck は送信前チェック：coldness(冷たさ)・pressure(圧)・length(長さ) を各 1〜3 の整数で見積もり、comment は送信前のやさしい注意を1文で。';

// 出力 JSON のスキーマ（Gemini structured output）
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    suggestions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          label: { type: 'STRING' },
          text: { type: 'STRING' },
          note: { type: 'STRING' }
        },
        required: ['label', 'text', 'note'],
        propertyOrdering: ['label', 'text', 'note']
      }
    },
    riskCheck: {
      type: 'OBJECT',
      properties: {
        coldness: { type: 'INTEGER' },
        pressure: { type: 'INTEGER' },
        length: { type: 'INTEGER' },
        comment: { type: 'STRING' }
      },
      required: ['coldness', 'pressure', 'length', 'comment'],
      propertyOrdering: ['coldness', 'pressure', 'length', 'comment']
    }
  },
  required: ['suggestions', 'riskCheck'],
  propertyOrdering: ['suggestions', 'riskCheck']
};

const LABELS = ['やわらかめ', 'ちょうどいい', '短め'];

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
  };
}

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8' }, corsHeaders())
  });
}

function buildUserPrompt(req) {
  req = req || {};
  return [
    '相手から来た文：',
    (req.originalMessage || '(なし)'),
    '',
    'ユーザーが伝えたいこと：',
    (req.userIntent || ''),
    '',
    '相手との関係：' + (req.relationship || '指定なし'),
    '使用チャネル：' + (req.channel || '指定なし'),
    '希望トーン：' + ((req.tones || []).join('、') || '指定なし'),
    '希望の長さ：' + (req.length || '普通')
  ].join('\n');
}

function clampInt(n, lo, hi) {
  n = Math.round(Number(n));
  if (!isFinite(n)) n = lo;
  return Math.max(lo, Math.min(hi, n));
}

// Gemini の応答を、アプリが期待する形へ正規化する
function normalize(parsed) {
  var out = { suggestions: [], riskCheck: null };
  var list = (parsed && Array.isArray(parsed.suggestions)) ? parsed.suggestions : [];
  for (var i = 0; i < 3; i++) {
    var s = list[i] || {};
    out.suggestions.push({
      label: LABELS[i],
      text: String(s.text || '').trim(),
      note: String(s.note || '').trim()
    });
  }
  var r = (parsed && parsed.riskCheck) || {};
  out.riskCheck = {
    coldness: clampInt(r.coldness, 1, 3),
    pressure: clampInt(r.pressure, 1, 3),
    length: clampInt(r.length, 1, 3),
    comment: String(r.comment || '送信前に、もう一度だけ確認しましょう。').trim()
  };
  return out;
}

async function callGemini(env, req) {
  var model = (env && env.GEMINI_MODEL) || 'gemini-2.5-flash';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(env.GEMINI_API_KEY);

  var payload = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: buildUserPrompt(req) }] }],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json',
      responseSchema: RESPONSE_SCHEMA
    }
  };

  var res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    var detail = await res.text();
    throw new Error('gemini ' + res.status + ': ' + detail.slice(0, 300));
  }

  var data = await res.json();
  var text = '';
  try {
    text = data.candidates[0].content.parts.map(function (p) { return p.text || ''; }).join('');
  } catch (e) {
    throw new Error('gemini: unexpected response shape');
  }
  var parsed;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error('gemini: response was not valid JSON');
  }
  return normalize(parsed);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (request.method === 'GET') {
      // 動作確認用
      return json({ ok: true, service: 'yawagaeshi-api', provider: 'gemini' });
    }
    if (request.method !== 'POST') {
      return json({ error: 'method_not_allowed' }, 405);
    }
    if (!env || !env.GEMINI_API_KEY) {
      return json({ error: 'missing_api_key', message: 'Set GEMINI_API_KEY via `wrangler secret put`.' }, 500);
    }

    var body;
    try {
      body = await request.json();
    } catch (e) {
      return json({ error: 'invalid_json' }, 400);
    }
    var req = body && body.request ? body.request : body;
    if (!req || !req.userIntent) {
      return json({ error: 'missing_user_intent' }, 400);
    }

    try {
      var result = await callGemini(env, req);
      return json(result, 200);
    } catch (e) {
      // アプリ側はこの失敗を検知してモック生成にフォールバックする
      return json({ error: 'provider_error', message: String(e && e.message || e) }, 502);
    }
  }
};

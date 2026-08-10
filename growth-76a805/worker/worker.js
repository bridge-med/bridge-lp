/* =========================================================================
 * Growth OS — Cloudflare Worker（自前API / Gemini 連携）
 *
 * 役割：Growth OS(GitHub Pages) のAI変換リクエストを受け、
 *       サーバー側で Gemini API を呼ぶ。APIキーはここ(Secret)にだけ置く。
 *       やわ返(yawagaeshi/worker)と同じ構成。
 *
 *   Growth OS → この Worker → Gemini API
 *
 * 契約（app/aiService.js の callRemote と対）:
 *   POST { templateId, system, prompt, source }
 *   → 200 { sections: [{ h: "見出し", body: "本文" }, ...] }
 *   失敗時は 4xx/5xx。アプリ側は失敗を検知してテンプレート生成へフォールバックする。
 *
 * 注意：クライアントから届く system は使わない（この Worker が持つ
 * SYSTEM_PROMPT を常に使う）。公開エンドポイントを任意プロンプトの
 * 代理実行口にしないための割り切り。
 *
 * デプロイ：worker/README.md 参照。モデルは環境変数 GEMINI_MODEL で変更可。
 * ========================================================================= */

const SYSTEM_PROMPT =
  'あなたはGrowth OSのアシスタントです。ユーザーの仕事・思考・経験を、あとで使える形に変換します。\n' +
  '方針：\n' +
  '- 抽象論で終わらせない\n' +
  '- 次にやる1アクションまで落とす\n' +
  '- 売れる可能性と作りやすさを分けて考える\n' +
  '- ユーザーの経験をコンテンツの素材として扱う\n' +
  '- きれいごとより現実的な実行案を優先する\n' +
  '- ユーザーの記録にない事実を作らない。素材が足りない箇所は「(記録なし)」と書く\n' +
  '- 日本語で書く\n' +
  '- 出力は指定された JSON 形式（sections の配列）にする。h はユーザーのプロンプトで指定された見出しをその順で使う';

// app/aiService.js の TEMPLATES と対応する既知ID（drift防止のためIDのみ検証する）
const KNOWN_TEMPLATE_IDS = [
  'learning', 'note-idea', 'note-draft', 'x-post', 'lp-outline',
  'product-design', 'tasks', 'projectize', 'revenue-plan', 'next-action', 'weekly-review'
];

// 出力 JSON のスキーマ（Gemini structured output）
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    sections: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          h: { type: 'STRING' },
          body: { type: 'STRING' }
        },
        required: ['h', 'body'],
        propertyOrdering: ['h', 'body']
      }
    }
  },
  required: ['sections'],
  propertyOrdering: ['sections']
};

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

// Gemini の応答を、アプリが期待する形へ正規化する
function normalize(parsed) {
  var list = (parsed && Array.isArray(parsed.sections)) ? parsed.sections : [];
  var out = [];
  for (var i = 0; i < list.length && out.length < 20; i++) {
    var s = list[i] || {};
    var h = String(s.h || '').trim().slice(0, 80);
    var body = String(s.body || '').trim().slice(0, 4000);
    if (h && body) out.push({ h: h, body: body });
  }
  return { sections: out };
}

async function callGemini(env, prompt) {
  var model = (env && env.GEMINI_MODEL) || 'gemini-2.5-flash';
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
    encodeURIComponent(model) + ':generateContent?key=' + encodeURIComponent(env.GEMINI_API_KEY);

  var payload = {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.6,
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
      return json({ ok: true, service: 'growth-api', provider: 'gemini' });
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
    var templateId = body && String(body.templateId || '');
    var prompt = body && String(body.prompt || '');
    if (KNOWN_TEMPLATE_IDS.indexOf(templateId) < 0) {
      return json({ error: 'unknown_template', message: 'templateId: ' + templateId }, 400);
    }
    if (!prompt.trim()) {
      return json({ error: 'missing_prompt' }, 400);
    }
    if (prompt.length > 30000) {
      return json({ error: 'prompt_too_long' }, 413);
    }

    try {
      var result = await callGemini(env, prompt);
      if (!result.sections.length) throw new Error('empty sections');
      return json(result, 200);
    } catch (e) {
      // アプリ側はこの失敗を検知してテンプレート生成にフォールバックする
      return json({ error: 'provider_error', message: String(e && e.message || e) }, 502);
    }
  }
};

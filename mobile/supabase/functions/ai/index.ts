// しごとログ — managed AI Edge Function (Supabase / Deno).
//
// The developer's AI key lives here as a Supabase secret (never in the app).
// The client posts { kind, input } and gets back structured JSON per kind.
//
// Deploy:
//   supabase functions deploy ai --no-verify-jwt
//   supabase secrets set GEMINI_API_KEY=xxxx        # Paid-tier key (Billing on)
//   supabase secrets set APP_SHARED_SECRET=xxxx     # must match EXPO_PUBLIC_APP_TOKEN
//   # optional model overrides:
//   supabase secrets set GEMINI_MODEL_LITE=gemini-2.5-flash-lite
//   supabase secrets set GEMINI_MODEL_FLASH=gemini-2.5-flash
//   supabase secrets set GEMINI_MODEL_PRO=gemini-2.5-pro
//
// IMPORTANT: use a Paid-tier key. On the free tier Google may use prompts/outputs
// to improve its products — not acceptable for real work / sensitive data.

// --- provider + model config -------------------------------------------------

const API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
// Single override (back-compat); if set, used for every kind.
const MODEL_OVERRIDE = Deno.env.get('GEMINI_MODEL') ?? '';
const M_LITE = Deno.env.get('GEMINI_MODEL_LITE') ?? 'gemini-2.5-flash-lite';
const M_FLASH = Deno.env.get('GEMINI_MODEL_FLASH') ?? 'gemini-2.5-flash';
const M_PRO = Deno.env.get('GEMINI_MODEL_PRO') ?? 'gemini-2.5-pro';

// Which model each task kind uses. Light = flash-lite, medium = flash, heavy = pro.
const KIND_MODEL: Record<string, string> = {
  tasks: M_LITE,
  memo: M_LITE,
  translate: M_LITE,
  reflection: M_FLASH,
  career: M_FLASH,
  workstyle: M_FLASH,
  // (gemini-2.5-pro available via M_PRO for future heavy kinds)
};
function modelFor(kind: string): string {
  return MODEL_OVERRIDE || KIND_MODEL[kind] || M_FLASH;
}

// --- abuse protection --------------------------------------------------------

const APP_SECRET = Deno.env.get('APP_SHARED_SECRET') ?? '';
const MAX_BODY = 200_000; // raw request bytes
const MAX_TEXT = 16_000; // per text field sent to the model

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-token',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// --- model call (single provider seam: swap here for OpenAI/Claude later) -----

interface GenOpts {
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
}

async function gemini(model: string, prompt: string, opts: GenOpts = {}): Promise<string> {
  if (!API_KEY) throw new Error('GEMINI_API_KEY is not set');
  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.4,
    maxOutputTokens: opts.maxTokens ?? 2048,
  };
  if (opts.json) generationConfig.responseMimeType = 'application/json';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(API_KEY)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
    },
  );
  if (!res.ok) throw new Error(`gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim();
  if (!text) throw new Error('empty response');
  return text;
}

/** Provider-agnostic entry point. Today: Gemini. Swap/branch here for others. */
function generate(kind: string, prompt: string, opts: GenOpts = {}): Promise<string> {
  return gemini(modelFor(kind), prompt, opts);
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/([[{][\s\S]*[\]}])/);
    if (m) return JSON.parse(m[1]) as T;
    throw new Error('could not parse model JSON');
  }
}

type Input = Record<string, unknown>;
// Clamp text fields so a huge/abusive payload can't run up cost.
const s = (v: unknown, max = 8000) => (typeof v === 'string' ? v.slice(0, max) : '');

async function handle(kind: string, input: Input): Promise<unknown> {
  switch (kind) {
    case 'tasks': {
      const prompt = [
        '以下のメモから「実行可能なタスク」を抽出し、JSON配列だけを返してください（前置き不要）。',
        `今日の日付は ${s(input.today, 12)}（YYYY-MM-DD）。`,
        '各要素は {"title": 簡潔な動詞句, "dueDate": 期限が読み取れる場合のみYYYY-MM-DD/無ければ"", "tags": 短い日本語タグ0〜3個}。雑談はタスク化しない。',
        '---',
        s(input.dump, MAX_TEXT),
      ].join('\n');
      const arr = parseJson<{ title?: string; dueDate?: string; tags?: string[] }[]>(await generate(kind, prompt, { json: true }));
      return { tasks: Array.isArray(arr) ? arr : [] };
    }
    case 'memo': {
      const prompt = [
        '以下の走り書きメモを、意味を保ったまま簡潔で読みやすい日本語に整えてください。',
        '箇条書きが適切なら - で。説明や前置きは付けず、整えた本文だけ返してください。',
        '---',
        s(input.input, MAX_TEXT),
      ].join('\n');
      return { text: await generate(kind, prompt, { maxTokens: 1500 }) };
    }
    case 'reflection': {
      const prompt = [
        'あなたはキャリア支援の専門家です。以下の仕事ログから振り返りをJSONだけで返してください（前置き不要）。',
        'キー: did, impressive, issues, improved, next, strengths, achievements。各値は日本語、誇張せずログに基づき簡潔に。',
        '---',
        s(input.logsText, MAX_TEXT),
      ].join('\n');
      const content = parseJson<Record<string, string>>(await generate(kind, prompt, { json: true, maxTokens: 3000 }));
      return { content };
    }
    case 'career': {
      const profile = (input.profile ?? {}) as Record<string, string>;
      const prompt = [
        `あなたはキャリア支援の専門家です。以下の仕事ログをもとに「${s(input.label, 40)}」の文章を日本語で作成してください。`,
        profile.profession ? `対象者の職種: ${s(profile.profession, 40)}、立場: ${s(profile.role, 40)}` : '',
        'ログに無い事実は創作しないこと。簡潔で、そのまま使える形に。',
        '---',
        s(input.logsText, MAX_TEXT),
      ].filter(Boolean).join('\n');
      return { text: await generate(kind, prompt, { maxTokens: 3000, temperature: 0.5 }) };
    }
    case 'workstyle': {
      const prompt = [
        'あなたはキャリア・組織心理の専門家です。以下の記録から本人の「働き方タイプ」を分析してください。',
        'MBTIのような決めつけは避け、次の構成で日本語で簡潔に：',
        '1) ひとことで表すタイプ名（独自で良い・15字以内） 2) 強みの傾向（3点） 3) 注意したい癖（2点） 4) 活きる環境/向く役割 5) 次に伸ばすと良い力（1つ）。',
        'ログに無い決めつけはしないこと。',
        '---',
        s(input.material, MAX_TEXT),
      ].join('\n');
      return { text: await generate(kind, prompt, { maxTokens: 1200, temperature: 0.5 }) };
    }
    case 'translate': {
      const lang = s(input.lang, 4) === 'ko' ? '韓国語' : '英語';
      const prompt = [
        `以下の日本語の文章を${lang}に自然に翻訳し、学習用の重要単語も抽出してJSONだけで返してください（前置き不要）。`,
        `形式: {"translation": "${lang}訳", "vocab": [{"term": 日本語の語, "translation": ${lang}訳, "reading": 発音(${lang}が韓国語ならローマ字/英語なら空文字)}]}`,
        'vocabは重要語を最大10個。',
        '---',
        s(input.text, 6000),
      ].join('\n');
      const out = parseJson<{ translation?: string; vocab?: unknown[] }>(await generate(kind, prompt, { json: true, maxTokens: 1500 }));
      return { translation: out.translation ?? '', vocab: Array.isArray(out.vocab) ? out.vocab : [] };
    }
    default:
      throw new Error(`unknown kind: ${kind}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);

  // Shared-secret gate (only enforced when APP_SHARED_SECRET is configured).
  if (APP_SECRET && req.headers.get('x-app-token') !== APP_SECRET) {
    return json({ error: 'forbidden' }, 403);
  }

  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return json({ error: 'bad request' }, 400);
  }
  if (raw.length > MAX_BODY) return json({ error: 'payload too large' }, 413);

  try {
    const { kind, input } = JSON.parse(raw);
    if (!kind) return json({ error: 'missing kind' }, 400);
    return json(await handle(String(kind), (input ?? {}) as Input));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});

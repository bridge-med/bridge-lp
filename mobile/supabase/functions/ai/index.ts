// BRIDGE Worklog — managed AI Edge Function (Supabase / Deno).
//
// The developer's AI key lives here as a Supabase secret (never in the app).
// The client posts { kind, input } and gets back structured JSON per kind.
//
// Deploy:
//   supabase functions deploy ai --no-verify-jwt
//   supabase secrets set GEMINI_API_KEY=xxxx   (optional: GEMINI_MODEL=gemini-2.5-flash)
//
// The client (lib/backend.ts) calls ${SUPABASE_URL}/functions/v1/ai with the
// anon key, or EXPO_PUBLIC_AI_BACKEND_URL if you host it elsewhere.

const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';
const API_KEY = Deno.env.get('GEMINI_API_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

async function gemini(prompt: string, opts: { json?: boolean; maxTokens?: number; temperature?: number } = {}): Promise<string> {
  if (!API_KEY) throw new Error('GEMINI_API_KEY is not set');
  const generationConfig: Record<string, unknown> = {
    temperature: opts.temperature ?? 0.4,
    maxOutputTokens: opts.maxTokens ?? 2048,
  };
  if (opts.json) generationConfig.responseMimeType = 'application/json';
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(API_KEY)}`,
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
const s = (v: unknown) => (typeof v === 'string' ? v : '');

async function handle(kind: string, input: Input): Promise<unknown> {
  switch (kind) {
    case 'tasks': {
      const prompt = [
        '以下のメモから「実行可能なタスク」を抽出し、JSON配列だけを返してください（前置き不要）。',
        `今日の日付は ${s(input.today)}（YYYY-MM-DD）。`,
        '各要素は {"title": 簡潔な動詞句, "dueDate": 期限が読み取れる場合のみYYYY-MM-DD/無ければ"", "tags": 短い日本語タグ0〜3個}。雑談はタスク化しない。',
        '---',
        s(input.dump),
      ].join('\n');
      const arr = parseJson<{ title?: string; dueDate?: string; tags?: string[] }[]>(await gemini(prompt, { json: true }));
      return { tasks: Array.isArray(arr) ? arr : [] };
    }
    case 'memo': {
      const prompt = [
        '以下の走り書きメモを、意味を保ったまま簡潔で読みやすい日本語に整えてください。',
        '箇条書きが適切なら - で。説明や前置きは付けず、整えた本文だけ返してください。',
        '---',
        s(input.input),
      ].join('\n');
      return { text: await gemini(prompt, { maxTokens: 1500 }) };
    }
    case 'reflection': {
      const prompt = [
        'あなたはキャリア支援の専門家です。以下の仕事ログから振り返りをJSONだけで返してください（前置き不要）。',
        'キー: did, impressive, issues, improved, next, strengths, achievements。各値は日本語、誇張せずログに基づき簡潔に。',
        '---',
        s(input.logsText),
      ].join('\n');
      const content = parseJson<Record<string, string>>(await gemini(prompt, { json: true, maxTokens: 3000 }));
      return { content };
    }
    case 'career': {
      const profile = (input.profile ?? {}) as Record<string, string>;
      const prompt = [
        `あなたはキャリア支援の専門家です。以下の仕事ログをもとに「${s(input.label)}」の文章を日本語で作成してください。`,
        profile.profession ? `対象者の職種: ${profile.profession}、立場: ${profile.role ?? ''}` : '',
        'ログに無い事実は創作しないこと。簡潔で、そのまま使える形に。',
        '---',
        s(input.logsText),
      ].filter(Boolean).join('\n');
      return { text: await gemini(prompt, { maxTokens: 3000, temperature: 0.5 }) };
    }
    case 'workstyle': {
      const prompt = [
        'あなたはキャリア・組織心理の専門家です。以下の記録から本人の「働き方タイプ」を分析してください。',
        'MBTIのような決めつけは避け、次の構成で日本語で簡潔に：',
        '1) ひとことで表すタイプ名（独自で良い・15字以内） 2) 強みの傾向（3点） 3) 注意したい癖（2点） 4) 活きる環境/向く役割 5) 次に伸ばすと良い力（1つ）。',
        'ログに無い決めつけはしないこと。',
        '---',
        s(input.material),
      ].join('\n');
      return { text: await gemini(prompt, { maxTokens: 1200, temperature: 0.5 }) };
    }
    case 'translate': {
      const lang = s(input.lang) === 'ko' ? '韓国語' : '英語';
      const prompt = [
        `以下の日本語の文章を${lang}に自然に翻訳し、学習用の重要単語も抽出してJSONだけで返してください（前置き不要）。`,
        `形式: {"translation": "${lang}訳", "vocab": [{"term": 日本語の語, "translation": ${lang}訳, "reading": 発音(${lang}が韓国語ならローマ字/英語なら空文字)}]}`,
        'vocabは重要語を最大10個。',
        '---',
        s(input.text),
      ].join('\n');
      const out = parseJson<{ translation?: string; vocab?: unknown[] }>(await gemini(prompt, { json: true, maxTokens: 1500 }));
      return { translation: out.translation ?? '', vocab: Array.isArray(out.vocab) ? out.vocab : [] };
    }
    default:
      throw new Error(`unknown kind: ${kind}`);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405);
  try {
    const { kind, input } = await req.json();
    if (!kind) return json({ error: 'missing kind' }, 400);
    return json(await handle(String(kind), (input ?? {}) as Input));
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'error' }, 500);
  }
});

// Gemini client + AI-backed helpers, each with a no-key mock fallback so the
// MVP works without any API key. Bring-your-own-key: the user supplies their
// own Gemini key (free tier). Same pattern as the web products
// (gemini-2.5-flash, v1beta generateContent, structured output).

import { CAREER_OUTPUTS, type CareerOutputType } from './constants';
import { formatDateJa, todayKey } from './date';
import type { Profile, ReflectionContent, WorkLog } from './types';

const GEMINI_MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export class AiError extends Error {}

type Json = Record<string, unknown>;

function friendlyError(status: number, raw: string): string {
  if (status === 400) return 'リクエストが不正です。APIキーが正しいか確認してください。';
  if (status === 401 || status === 403) return 'APIキーが無効か、権限がありません。キーを確認してください。';
  if (status === 429) return '無料枠のレート上限に達しました。少し時間をおいて再試行してください。';
  if (status >= 500) return 'AIサーバが一時的に混み合っています。少し待って再試行してください。';
  return `AI呼び出しに失敗しました（${status}）。${raw.slice(0, 120)}`;
}

async function callGemini(
  prompt: string,
  opts: { apiKey: string; schema?: Json; maxOutputTokens?: number; temperature?: number },
): Promise<string> {
  const genCfg: Json = { temperature: opts.temperature ?? 0.4, maxOutputTokens: opts.maxOutputTokens ?? 4000 };
  if (opts.schema) {
    genCfg.responseMimeType = 'application/json';
    genCfg.responseSchema = opts.schema;
  }
  const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: genCfg };

  let res: Response;
  try {
    res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(opts.apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new AiError('ネットワークに接続できませんでした。通信状況を確認してください。');
  }
  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw new AiError(friendlyError(res.status, raw));
  }
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  if (!text) throw new AiError('AIからの応答が空でした。もう一度お試しください。');
  return text;
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) return JSON.parse(m[1]) as T;
    throw new AiError('AIの応答を解釈できませんでした。');
  }
}

/** Lightweight key check (lists models; no generation quota spent). */
export async function validateApiKey(apiKey: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`);
  } catch {
    throw new AiError('ネットワークに接続できませんでした。');
  }
  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw new AiError(friendlyError(res.status, raw));
  }
}

// --- Brain-dump -> tasks -----------------------------------------------------

export interface DraftTask {
  title: string;
  dueDate: string | null;
  tags: string[];
}

const TASK_SCHEMA: Json = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      due: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
    },
    required: ['title'],
  },
};

export async function extractTasks(dump: string, apiKey: string): Promise<DraftTask[]> {
  const today = todayKey();
  const prompt = [
    '以下のメモから「実行可能なタスク」を抽出し、JSON配列で返してください。',
    `今日の日付は ${today}（YYYY-MM-DD）です。`,
    'title=簡潔な日本語の動詞句。due=期限が読み取れる場合のみ YYYY-MM-DD（「明日」等は今日から計算）、無ければ空文字。',
    'tags=内容を表す短い日本語タグ（任意, 0〜3個, #不要）。雑談はタスク化しない。',
    '---',
    dump,
  ].join('\n');
  const text = await callGemini(prompt, { apiKey, schema: TASK_SCHEMA, maxOutputTokens: 2000 });
  const raw = parseJson<{ title?: string; due?: string; tags?: string[] }[]>(text);
  return raw
    .filter((t) => t.title && t.title.trim())
    .map((t) => ({
      title: t.title!.trim(),
      dueDate: t.due && /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : null,
      tags: Array.isArray(t.tags) ? t.tags.map((x) => String(x).replace(/^#/, '').trim()).filter(Boolean).slice(0, 3) : [],
    }));
}

// --- Quick memo tidy ---------------------------------------------------------

export async function tidyMemo(input: string, apiKey: string): Promise<string> {
  const prompt = [
    '以下の走り書きメモを、意味を保ったまま簡潔で読みやすい日本語に整えてください。',
    '箇条書きが適切なら - で。説明や前置きは付けず、整えた本文だけ返してください。',
    '---',
    input,
  ].join('\n');
  return callGemini(prompt, { apiKey, maxOutputTokens: 1500 });
}

// --- Reflection (week/month) -------------------------------------------------

function logsToText(logs: WorkLog[]): string {
  return logs
    .map((l) => {
      const parts = [
        `# ${formatDateJa(l.date)} ${l.title}`.trim(),
        l.did && `やったこと: ${l.did}`,
        l.problem && `困ったこと: ${l.problem}`,
        l.devised && `工夫: ${l.devised}`,
        l.decision && `判断: ${l.decision}`,
        l.result && `結果: ${l.result}`,
        l.learning && `学び: ${l.learning}`,
        l.tags.length ? `タグ: ${l.tags.join(', ')}` : '',
      ].filter(Boolean);
      return parts.join('\n');
    })
    .join('\n\n');
}

const REFLECTION_SCHEMA: Json = {
  type: 'object',
  properties: {
    did: { type: 'string' },
    impressive: { type: 'string' },
    issues: { type: 'string' },
    improved: { type: 'string' },
    next: { type: 'string' },
    strengths: { type: 'string' },
    achievements: { type: 'string' },
  },
  required: ['did', 'impressive', 'issues', 'improved', 'next', 'strengths', 'achievements'],
};

/** Generate a reflection. With a key -> Gemini; without -> a deterministic mock. */
export async function generateReflection(logs: WorkLog[], apiKey: string | null): Promise<ReflectionContent> {
  if (!apiKey) return mockReflection(logs);
  const prompt = [
    'あなたはキャリア支援の専門家です。以下の仕事ログから、振り返りをJSONで返してください。',
    '各項目は日本語で簡潔に。誇張せず、ログに基づいて。',
    'did=やったこと, impressive=印象に残った出来事, issues=課題, improved=改善したこと,',
    'next=次にやること, strengths=強みとして見えてきたこと, achievements=職務経歴書に使えそうな実績候補。',
    '---',
    logsToText(logs),
  ].join('\n');
  const text = await callGemini(prompt, { apiKey, schema: REFLECTION_SCHEMA, maxOutputTokens: 3000 });
  const obj = parseJson<Partial<ReflectionContent>>(text);
  return {
    did: obj.did ?? '',
    impressive: obj.impressive ?? '',
    issues: obj.issues ?? '',
    improved: obj.improved ?? '',
    next: obj.next ?? '',
    strengths: obj.strengths ?? '',
    achievements: obj.achievements ?? '',
  };
}

function joinField(logs: WorkLog[], pick: (l: WorkLog) => string): string {
  return logs.map(pick).map((s) => s.trim()).filter(Boolean).map((s) => `・${s}`).join('\n');
}

function mockReflection(logs: WorkLog[]): ReflectionContent {
  const achievementsLogs = logs.filter((l) => l.tags.includes('成果') || l.result);
  return {
    did: joinField(logs, (l) => l.did || l.title) || '（記録された仕事ログがありません）',
    impressive: joinField(logs, (l) => l.devised) || '—',
    issues: joinField(logs, (l) => l.problem) || '—',
    improved: joinField(logs, (l) => l.devised) || '—',
    next: joinField(logs, (l) => l.nextAction) || '—',
    strengths: [...new Set(logs.flatMap((l) => l.tags))].map((t) => `・${t}`).join('\n') || '—',
    achievements: joinField(achievementsLogs, (l) => `${l.title}: ${l.result}`.replace(/: $/, '')) || '—',
  };
}

// --- Career output -----------------------------------------------------------

export async function generateCareerOutput(
  logs: WorkLog[],
  outputType: CareerOutputType,
  profile: Profile,
  apiKey: string | null,
): Promise<string> {
  if (!apiKey) return mockCareerOutput(logs, outputType, profile);
  const label = CAREER_OUTPUTS.find((o) => o.key === outputType)?.label ?? '';
  const prompt = [
    `あなたはキャリア支援の専門家です。以下の仕事ログをもとに「${label}」の文章を日本語で作成してください。`,
    profile.profession ? `対象者の職種: ${profile.profession}、立場: ${profile.role}` : '',
    'ログに無い事実は創作しないこと。簡潔で、そのまま使える形に。',
    '---',
    logsToText(logs),
  ]
    .filter(Boolean)
    .join('\n');
  return callGemini(prompt, { apiKey, maxOutputTokens: 3000, temperature: 0.5 });
}

function mockCareerOutput(logs: WorkLog[], outputType: CareerOutputType, profile: Profile): string {
  const label = CAREER_OUTPUTS.find((o) => o.key === outputType)?.label ?? '';
  const head = `【${label}（下書き）】${profile.profession ? `\n職種: ${profile.profession} / 立場: ${profile.role}` : ''}`;
  const body = logs
    .map((l) => {
      const lines = [
        `■ ${formatDateJa(l.date)} ${l.title}`.trim(),
        l.did && `- 取り組み: ${l.did}`,
        l.decision && `- 判断: ${l.decision}`,
        l.result && `- 結果: ${l.result}`,
        l.learning && `- 学び: ${l.learning}`,
      ].filter(Boolean);
      return lines.join('\n');
    })
    .join('\n\n');
  return `${head}\n\n${body || '（選択された仕事ログがありません）'}\n\n※これは選択ログをまとめた下書きです。AIキーを登録すると自動で文章化できます。`;
}

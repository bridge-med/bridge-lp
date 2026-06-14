// Provider-agnostic AI client (bring-your-own-key). Supports Google Gemini,
// OpenAI, and Anthropic Claude — the user picks a provider and supplies their
// own key. Each helper has a no-key mock fallback so the MVP works without AI.

import { AI_PROVIDERS, CAREER_OUTPUTS, type AiProvider, type CareerOutputType } from './constants';
import { formatDateJa, todayKey } from './date';
import type { Profile, ReflectionContent, WorkLog } from './types';

export class AiError extends Error {}

export interface Creds {
  provider: AiProvider;
  apiKey: string;
}

function modelFor(provider: AiProvider): string {
  return AI_PROVIDERS.find((p) => p.key === provider)!.model;
}

function friendlyError(status: number, raw: string): string {
  if (status === 400) return 'リクエストが不正です。APIキー・モデルを確認してください。';
  if (status === 401 || status === 403) return 'APIキーが無効か権限がありません。キーを確認してください。';
  if (status === 429) return 'レート上限に達しました。少し時間をおいて再試行してください。';
  if (status >= 500) return 'AIサーバが一時的に混み合っています。少し待って再試行してください。';
  return `AI呼び出しに失敗しました（${status}）。${raw.slice(0, 120)}`;
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  } catch {
    throw new AiError('ネットワークに接続できませんでした。通信状況を確認してください。');
  }
  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw new AiError(friendlyError(res.status, raw));
  }
  return res.json();
}

// Unified completion across providers. `json: true` requests JSON-only output.
async function complete(prompt: string, creds: Creds, opts: { json?: boolean; maxTokens?: number; temperature?: number } = {}): Promise<string> {
  if (!creds.apiKey) throw new AiError('APIキーが未設定です。設定 → AI で登録してください。');
  const model = modelFor(creds.provider);
  const maxTokens = opts.maxTokens ?? 2000;
  const temperature = opts.temperature ?? 0.4;
  let text = '';

  if (creds.provider === 'gemini') {
    const genCfg: Record<string, unknown> = { temperature, maxOutputTokens: maxTokens };
    if (opts.json) genCfg.responseMimeType = 'application/json';
    const data = (await post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(creds.apiKey)}`,
      {},
      { contents: [{ parts: [{ text: prompt }] }], generationConfig: genCfg },
    )) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
  } else if (creds.provider === 'openai') {
    const data = (await post(
      'https://api.openai.com/v1/chat/completions',
      { Authorization: `Bearer ${creds.apiKey}` },
      {
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [{ role: 'user', content: prompt }],
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      },
    )) as { choices?: { message?: { content?: string } }[] };
    text = data.choices?.[0]?.message?.content ?? '';
  } else {
    // anthropic
    const data = (await post(
      'https://api.anthropic.com/v1/messages',
      { 'x-api-key': creds.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      { model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] },
    )) as { content?: { type?: string; text?: string }[] };
    text = (data.content ?? []).filter((b) => b.type === 'text').map((b) => b.text ?? '').join('');
  }

  text = text.trim();
  if (!text) throw new AiError('AIからの応答が空でした。もう一度お試しください。');
  return text;
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/) || text.match(/([[{][\s\S]*[\]}])/);
    if (m) return JSON.parse(m[1]) as T;
    throw new AiError('AIの応答を解釈できませんでした。');
  }
}

/** Lightweight key check per provider (no/low generation cost). */
export async function validateApiKey(creds: Creds): Promise<void> {
  if (!creds.apiKey) throw new AiError('キーが未入力です。');
  let res: Response;
  try {
    if (creds.provider === 'gemini') {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(creds.apiKey)}`);
    } else if (creds.provider === 'openai') {
      res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${creds.apiKey}` } });
    } else {
      res = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': creds.apiKey, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      });
    }
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

export async function extractTasks(dump: string, creds: Creds): Promise<DraftTask[]> {
  const today = todayKey();
  const prompt = [
    '以下のメモから「実行可能なタスク」を抽出し、JSON配列だけを返してください（前置き不要）。',
    `今日の日付は ${today}（YYYY-MM-DD）です。`,
    '各要素は {"title": 簡潔な動詞句, "due": 期限が読み取れる場合のみYYYY-MM-DD/無ければ"", "tags": 短い日本語タグ0〜3個} 。',
    '雑談はタスク化しない。',
    '---',
    dump,
  ].join('\n');
  const raw = parseJson<{ title?: string; due?: string; tags?: string[] }[]>(await complete(prompt, creds, { json: true, maxTokens: 2000 }));
  return (Array.isArray(raw) ? raw : [])
    .filter((t) => t.title && t.title.trim())
    .map((t) => ({
      title: t.title!.trim(),
      dueDate: t.due && /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : null,
      tags: Array.isArray(t.tags) ? t.tags.map((x) => String(x).replace(/^#/, '').trim()).filter(Boolean).slice(0, 3) : [],
    }));
}

// --- Quick memo tidy ---------------------------------------------------------

export async function tidyMemo(input: string, creds: Creds): Promise<string> {
  const prompt = [
    '以下の走り書きメモを、意味を保ったまま簡潔で読みやすい日本語に整えてください。',
    '箇条書きが適切なら - で。説明や前置きは付けず、整えた本文だけ返してください。',
    '---',
    input,
  ].join('\n');
  return complete(prompt, creds, { maxTokens: 1500 });
}

// --- Reflection (week/month) -------------------------------------------------

function logsToText(logs: WorkLog[]): string {
  return logs
    .map((l) =>
      [
        `# ${formatDateJa(l.date)} ${l.title}`.trim(),
        l.did && `やったこと: ${l.did}`,
        l.problem && `困ったこと: ${l.problem}`,
        l.devised && `工夫: ${l.devised}`,
        l.decision && `判断: ${l.decision}`,
        l.result && `結果: ${l.result}`,
        l.learning && `学び: ${l.learning}`,
        l.tags.length ? `タグ: ${l.tags.join(', ')}` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
}

/** With creds -> AI; without -> a deterministic mock. */
export async function generateReflection(logs: WorkLog[], creds: Creds | null): Promise<ReflectionContent> {
  if (!creds || !creds.apiKey) return mockReflection(logs);
  const prompt = [
    'あなたはキャリア支援の専門家です。以下の仕事ログから振り返りをJSONだけで返してください（前置き不要）。',
    'キー: did(やったこと), impressive(印象に残った), issues(課題), improved(改善), next(次にやること), strengths(強み), achievements(職務経歴書に使えそうな実績候補)。各値は日本語、誇張せずログに基づいて簡潔に。',
    '---',
    logsToText(logs),
  ].join('\n');
  const obj = parseJson<Partial<ReflectionContent>>(await complete(prompt, creds, { json: true, maxTokens: 3000 }));
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
  creds: Creds | null,
): Promise<string> {
  if (!creds || !creds.apiKey) return mockCareerOutput(logs, outputType, profile);
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
  return complete(prompt, creds, { maxTokens: 3000, temperature: 0.5 });
}

function mockCareerOutput(logs: WorkLog[], outputType: CareerOutputType, profile: Profile): string {
  const label = CAREER_OUTPUTS.find((o) => o.key === outputType)?.label ?? '';
  const head = `【${label}（下書き）】${profile.profession ? `\n職種: ${profile.profession} / 立場: ${profile.role}` : ''}`;
  const body = logs
    .map((l) =>
      [
        `■ ${formatDateJa(l.date)} ${l.title}`.trim(),
        l.did && `- 取り組み: ${l.did}`,
        l.decision && `- 判断: ${l.decision}`,
        l.result && `- 結果: ${l.result}`,
        l.learning && `- 学び: ${l.learning}`,
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
  return `${head}\n\n${body || '（選択された仕事ログがありません）'}\n\n※これは選択ログをまとめた下書きです。設定でAIキーを登録すると自動で文章化できます。`;
}

// Gemini client for on-device AI features (Pro).
//
// Bring-your-own-key: the user pastes their own Gemini API key (free tier
// exists), stored locally. Mirrors the server-side pattern used by the web
// products (model gemini-2.5-flash, v1beta generateContent, structured output).

import { todayKey } from './date';
import type { Priority } from './types';

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
  const genCfg: Json = { temperature: opts.temperature ?? 0.3, maxOutputTokens: opts.maxOutputTokens ?? 4000 };
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
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
  if (!text) throw new AiError('AIからの応答が空でした。もう一度お試しください。');
  return text;
}

function parseJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    // Strip markdown fences if the model wrapped the JSON.
    const m = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (m) return JSON.parse(m[1]) as T;
    throw new AiError('AIの応答を解釈できませんでした。');
  }
}

// --- Feature: brain-dump -> structured tasks ---------------------------------

export interface DraftTask {
  title: string;
  priority: Priority;
  due: string | null;
  tags: string[];
}

const TASK_SCHEMA: Json = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      priority: { type: 'string', enum: ['low', 'normal', 'high'] },
      due: { type: 'string' },
      tags: { type: 'array', items: { type: 'string' } },
    },
    required: ['title'],
  },
};

export async function extractTasks(dump: string, apiKey: string): Promise<DraftTask[]> {
  const today = todayKey();
  const prompt = [
    'あなたは優秀なアシスタントです。以下のメモから「実行可能なタスク」を抽出し、JSON配列で返してください。',
    `今日の日付は ${today}（YYYY-MM-DD）です。`,
    '各タスク: title=簡潔な日本語の動詞句, priority=low|normal|high(緊急/重要そうなものをhigh),',
    'due=期限が読み取れる場合のみ YYYY-MM-DD（「明日」「来週」等は今日から計算）。無ければ空文字,',
    'tags=内容を表す短い日本語タグ（任意, 0〜3個, #は不要）。',
    '雑談や実行不能な記述はタスク化しないでください。',
    '---',
    dump,
  ].join('\n');

  const text = await callGemini(prompt, { apiKey, schema: TASK_SCHEMA, maxOutputTokens: 2000 });
  const raw = parseJson<{ title?: string; priority?: string; due?: string; tags?: string[] }[]>(text);
  return raw
    .filter((t) => t.title && t.title.trim())
    .map((t) => ({
      title: t.title!.trim(),
      priority: (['low', 'normal', 'high'].includes(t.priority ?? '') ? t.priority : 'normal') as Priority,
      due: t.due && /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : null,
      tags: Array.isArray(t.tags) ? t.tags.map((x) => String(x).replace(/^#/, '').trim()).filter(Boolean).slice(0, 3) : [],
    }));
}

// --- Feature: tidy a memo ----------------------------------------------------

const MEMO_SCHEMA: Json = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    body: { type: 'string' },
  },
  required: ['title', 'body'],
};

export async function tidyMemo(input: string, apiKey: string): Promise<{ title: string; body: string }> {
  const prompt = [
    '以下の走り書きメモを読みやすく整理してください。',
    'title: 内容を表す簡潔な日本語の見出し（20字以内）。',
    'body: 要点を箇条書き（- 始まり）で整理。情報は省かず、重複や言い回しだけ整える。日本語。',
    'JSONで返してください。',
    '---',
    input,
  ].join('\n');
  const text = await callGemini(prompt, { apiKey, schema: MEMO_SCHEMA, maxOutputTokens: 2000 });
  const obj = parseJson<{ title?: string; body?: string }>(text);
  return { title: (obj.title ?? '').trim(), body: (obj.body ?? '').trim() };
}

// --- Feature: weekly journal reflection --------------------------------------

export async function reflectJournal(entriesText: string, apiKey: string): Promise<string> {
  const prompt = [
    '以下は最近の日記です。やさしく前向きなトーンで、振り返りを200字程度の日本語でまとめてください。',
    '良かったこと・気分の傾向・次に活かせそうな点を、説教くさくなく簡潔に。',
    '---',
    entriesText,
  ].join('\n');
  return callGemini(prompt, { apiKey, maxOutputTokens: 1000, temperature: 0.6 });
}

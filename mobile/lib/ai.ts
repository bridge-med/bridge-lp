// AI helpers. When the managed backend is configured (lib/backend.ts) these
// call the server (developer key, server-side prompts). Otherwise they fall
// back to offline previews so the app is fully usable without a backend.

import { CAREER_OUTPUTS, type CareerOutputType } from './constants';
import { aiBackendEnabled, BackendError, callBackend } from './backend';
import { formatDateJa, todayKey } from './date';
import type { Profile, ReflectionContent, WorkLog } from './types';

export class AiError extends Error {}

function wrap(e: unknown): AiError {
  if (e instanceof BackendError) return new AiError(e.message);
  return new AiError(e instanceof Error ? e.message : '予期しないエラーが発生しました。');
}

/** Strip Markdown so AI output reads like plain Japanese (no **bold**, * bullets, # …). */
export function cleanText(s: string): string {
  return (s ?? '')
    .replace(/\*\*(.*?)\*\*/g, '$1') // **bold** -> bold
    .replace(/__(.*?)__/g, '$1')
    .replace(/`([^`]*)`/g, '$1') // `code` -> code
    .replace(/(^|\n)\s{0,3}#{1,6}\s*/g, '$1') // # heading -> remove marker
    .replace(/(^|\n)\s*[*\-•]\s+/g, '$1・') // * / - bullets -> ・
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// --- Brain-dump -> tasks -----------------------------------------------------

export interface DraftTask {
  title: string;
  dueDate: string | null;
  tags: string[];
}

export async function extractTasks(dump: string): Promise<DraftTask[]> {
  if (!aiBackendEnabled()) return localExtractTasks(dump);
  try {
    const { tasks } = await callBackend<{ tasks: DraftTask[] }>('tasks', { dump, today: todayKey() });
    return (Array.isArray(tasks) ? tasks : []).map((t) => ({
      title: String(t.title ?? '').trim(),
      dueDate: t.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(t.dueDate) ? t.dueDate : null,
      tags: Array.isArray(t.tags) ? t.tags.map((x) => String(x).replace(/^#/, '').trim()).filter(Boolean).slice(0, 3) : [],
    })).filter((t) => t.title);
  } catch (e) {
    throw wrap(e);
  }
}

export function localExtractTasks(dump: string): DraftTask[] {
  return dump
    .split(/[\n。]/)
    .map((s) => s.replace(/^[\s・\-*●]+/, '').trim())
    .filter((s) => s.length >= 2)
    .slice(0, 12)
    .map((title) => ({ title, dueDate: null, tags: [] }));
}

// --- Quick memo tidy ---------------------------------------------------------

export async function tidyMemo(input: string): Promise<string> {
  if (!aiBackendEnabled()) return localTidy(input);
  try {
    const { text } = await callBackend<{ text: string }>('memo', { input });
    return cleanText(text?.trim() || localTidy(input));
  } catch (e) {
    throw wrap(e);
  }
}

export function localTidy(input: string): string {
  return input
    .split(/\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (s.startsWith('-') ? s : `- ${s}`))
    .join('\n');
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

export async function generateReflection(logs: WorkLog[]): Promise<ReflectionContent> {
  if (!aiBackendEnabled()) return mockReflection(logs);
  try {
    const { content } = await callBackend<{ content: Partial<ReflectionContent> }>('reflection', { logsText: logsToText(logs) });
    return {
      did: cleanText(content.did ?? ''),
      impressive: cleanText(content.impressive ?? ''),
      issues: cleanText(content.issues ?? ''),
      improved: cleanText(content.improved ?? ''),
      next: cleanText(content.next ?? ''),
      strengths: cleanText(content.strengths ?? ''),
      achievements: cleanText(content.achievements ?? ''),
    };
  } catch (e) {
    throw wrap(e);
  }
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

export async function generateCareerOutput(logs: WorkLog[], outputType: CareerOutputType, profile: Profile): Promise<string> {
  if (!aiBackendEnabled()) return mockCareerOutput(logs, outputType, profile);
  const label = CAREER_OUTPUTS.find((o) => o.key === outputType)?.label ?? '';
  try {
    const { text } = await callBackend<{ text: string }>('career', { label, profile, logsText: logsToText(logs) });
    return cleanText(text?.trim() || mockCareerOutput(logs, outputType, profile));
  } catch (e) {
    throw wrap(e);
  }
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
  return `${head}\n\n${body || '（選択された仕事ログがありません）'}\n\n※これは選択ログをまとめた下書きです。`;
}

// --- Work-style / personality analysis --------------------------------------

export async function generateWorkStyle(material: string): Promise<string> {
  if (!aiBackendEnabled()) return localWorkStyle(material);
  try {
    const { text } = await callBackend<{ text: string }>('workstyle', { material });
    return cleanText(text?.trim() || localWorkStyle(material));
  } catch (e) {
    throw wrap(e);
  }
}

export function localWorkStyle(material: string): string {
  return [
    '【働き方タイプ（簡易分析）】',
    '記録から、現場の課題を見つけて動くタイプの傾向が見えます。',
    '・強み: 観察と調整 / 学びを言語化 / 周囲を巻き込む',
    '・注意: 抱え込みやすさ',
    '・向く役割: 改善の旗振り・橋渡し役',
    material ? '\n— 参照した記録 —\n' + material.slice(0, 240) : '',
  ].join('\n');
}

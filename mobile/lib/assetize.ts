// Assetization core (v1.1): turn one work log into career assets with a single
// batched AI call — achievement phrasing, skills, STAR, publish-risk, and
// external asset candidates. The user only ever writes the log once; everything
// here branches off automatically.
//
// Cost design: one flash call per log, cached as a LogInsight (re-run only on
// explicit request). Without a backend the analysis falls back to an honest
// local heuristic (marked 簡易分析), so the app works fully offline.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { aiBackendEnabled, callBackend } from './backend';
import { assetCandidates, logInsights } from './data';
import { formatDateJa } from './date';
import type { AssetCandidate, AssetKind, AssetStatus, InsightStrength, LogInsight, RiskLevel, WorkLog } from './types';

export const ASSET_KIND_LABEL: Record<AssetKind, string> = {
  x: 'X投稿',
  note: 'note記事',
  template: 'テンプレート',
  product: 'プロダクト',
  career_story: 'キャリアストーリー',
};

export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  candidate: '候補',
  developing: '作成中',
  ready: '公開OK',
  published: '公開済み',
  archived: 'アーカイブ',
};

export const ASSET_STATUS_ORDER: AssetStatus[] = ['candidate', 'developing', 'ready', 'published', 'archived'];

export const RISK_LABEL: Record<RiskLevel, string> = { low: '低', medium: '中', high: '高' };

// ---- log -> analysis input ---------------------------------------------------

function logToText(l: WorkLog): string {
  return [
    `日付: ${formatDateJa(l.date)} / タイトル: ${l.title || '（無題）'}`,
    l.did && `やったこと: ${l.did}`,
    l.problem && `困ったこと: ${l.problem}`,
    l.devised && `工夫: ${l.devised}`,
    l.decision && `判断: ${l.decision}`,
    l.people && `関わった人: ${l.people}`,
    l.result && `結果: ${l.result}`,
    l.learning && `学び: ${l.learning}`,
    l.nextAction && `次にやること: ${l.nextAction}`,
    l.memo && `メモ: ${l.memo}`,
    l.tags.length ? `タグ: ${l.tags.join(', ')}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Is there enough content to be worth analyzing? */
export function worthAnalyzing(l: WorkLog): boolean {
  const body = [l.title, l.did, l.problem, l.devised, l.decision, l.result, l.learning, l.memo].join('');
  return body.trim().length >= 20;
}

// ---- normalization of the AI response ---------------------------------------

const str = (v: unknown, max = 600): string => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const strArr = (v: unknown, maxItems: number, maxLen = 120): string[] =>
  Array.isArray(v) ? v.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems) : [];

function normStrength(v: unknown): InsightStrength {
  return v === 'weak' || v === 'strong' ? v : 'normal';
}
function normRisk(v: unknown): RiskLevel {
  return v === 'medium' || v === 'high' ? v : 'low';
}
function normKind(v: unknown): AssetKind | null {
  return v === 'x' || v === 'note' || v === 'template' || v === 'product' || v === 'career_story' ? v : null;
}

interface RawAnalysis {
  achievement?: unknown;
  strength?: unknown;
  strengthNote?: unknown;
  skills?: unknown;
  star?: { s?: unknown; t?: unknown; a?: unknown; r?: unknown; resultMissing?: unknown };
  areas?: unknown;
  risk?: { level?: unknown; notes?: unknown; anonymized?: unknown };
  candidates?: unknown[];
}

// ---- local (offline) fallback ------------------------------------------------

function localAnalysis(l: WorkLog): RawAnalysis {
  const text = logToText(l);
  const hasResult = !!l.result.trim();
  const notes: string[] = [];
  if (/病院|クリニック|株式会社|法人|施設名/.test(text)) notes.push('具体的な組織名が含まれている可能性があります');
  if (/患者|利用者|様\b|氏名/.test(text)) notes.push('個人・患者に関する情報が含まれている可能性があります');
  if (/\d+(円|万|%|％)/.test(text)) notes.push('金額・数値情報が含まれています');
  const candidates: RawAnalysis['candidates'] = [];
  if (l.learning.trim() || l.devised.trim()) {
    candidates.push({
      kind: 'note',
      title: `${(l.title || l.did || '今日の経験').slice(0, 24)}から学んだこと`,
      summary: '学び・工夫を記事として言語化できる可能性（簡易分析）',
      detail: `想定読者: 同じ課題を持つ同職種\n構成案: 背景 / 課題 / 工夫したこと / 結果と学び\n※これはオフラインの簡易分析です。AI分析でより具体的になります。`,
    });
  }
  return {
    achievement: (l.title || l.did.split(/[。\n]/)[0] || '業務を実施').slice(0, 80) + (hasResult ? `（${l.result.split(/[。\n]/)[0].slice(0, 40)}）` : ''),
    strength: hasResult ? 'normal' : 'weak',
    strengthNote: hasResult ? '結果まで記録されています。数字があるとさらに強くなります。' : '成果を確認すると実績として強くなります。',
    skills: [...new Set([...l.tags.slice(0, 3)])],
    star: {
      s: l.problem || l.title || '',
      t: l.decision || l.problem || '',
      a: [l.did, l.devised].filter(Boolean).join(' / '),
      r: l.result,
      resultMissing: !hasResult,
    },
    areas: l.tags.length ? l.tags.slice(0, 2) : ['仕事'],
    risk: { level: notes.length >= 2 ? 'medium' : notes.length ? 'medium' : 'low', notes, anonymized: [] },
    candidates,
  };
}

// ---- main entry --------------------------------------------------------------

export function insightFor(logId: string): LogInsight | undefined {
  return logInsights.getSnapshot().find((i) => i.logId === logId);
}

const inFlight = new Map<string, Promise<LogInsight>>();

/** Analyze one log (AI when available, local otherwise) and persist the result.
 *  Replaces the previous insight and any auto candidates still in 'candidate'.
 *  Concurrent calls for the same log share one run. */
export function analyzeLog(log: WorkLog): Promise<LogInsight> {
  const running = inFlight.get(log.id);
  if (running) return running;
  const p = analyzeLogImpl(log).finally(() => inFlight.delete(log.id));
  inFlight.set(log.id, p);
  return p;
}

async function analyzeLogImpl(log: WorkLog): Promise<LogInsight> {
  let raw: RawAnalysis;
  let source: LogInsight['source'] = 'local';
  if (aiBackendEnabled()) {
    try {
      const { analysis } = await callBackend<{ analysis: RawAnalysis }>('assetize', { logText: logToText(log) });
      raw = analysis ?? {};
      source = 'ai';
    } catch {
      // Backend unreachable or not yet updated with the 'assetize' kind —
      // degrade to the honest local heuristic instead of failing the flow.
      raw = localAnalysis(log);
    }
  } else {
    raw = localAnalysis(log);
  }

  const prev = insightFor(log.id);
  const insight = await logInsights.upsert({
    id: prev?.id,
    logId: log.id,
    achievement: str(raw.achievement, 200) || (log.title || '業務を実施'),
    strength: normStrength(raw.strength),
    strengthNote: str(raw.strengthNote, 200),
    skills: strArr(raw.skills, 5, 30),
    star: {
      s: str(raw.star?.s, 300),
      t: str(raw.star?.t, 300),
      a: str(raw.star?.a, 400),
      r: str(raw.star?.r, 300),
      resultMissing: raw.star?.resultMissing !== false && !str(raw.star?.r, 300),
    },
    areas: strArr(raw.areas, 3, 20),
    risk: { level: normRisk(raw.risk?.level), notes: strArr(raw.risk?.notes, 4, 100) },
    outcome: prev?.outcome,
    followUpDismissed: prev?.followUpDismissed,
    source,
  } as Partial<LogInsight>);

  // Replace auto-generated candidates that the user hasn't touched yet.
  const stale = assetCandidates
    .getSnapshot()
    .filter((a) => a.status === 'candidate' && a.sourceLogIds.length === 1 && a.sourceLogIds[0] === log.id);
  for (const a of stale) await assetCandidates.remove(a.id);

  const anonymized = strArr((raw.risk as { anonymized?: unknown })?.anonymized, 3, 60);
  for (const c of raw.candidates ?? []) {
    const cc = c as { kind?: unknown; title?: unknown; summary?: unknown; detail?: unknown };
    const kind = normKind(cc.kind);
    const title = str(cc.title, 60);
    if (!kind || !title) continue;
    await assetCandidates.upsert({
      kind,
      status: 'candidate',
      title,
      summary: str(cc.summary, 160),
      detail: str(cc.detail, 2000),
      areas: strArr(raw.areas, 3, 20),
      sourceLogIds: [log.id],
      risk: { level: normRisk(raw.risk?.level), notes: strArr(raw.risk?.notes, 4, 100), anonymized },
    } as Partial<AssetCandidate>);
  }
  return insight;
}

// ---- outcome follow-up (成果の追跡) ------------------------------------------

const FOLLOW_UP_AFTER_MS = 3 * 86_400_000;

/** The one log we'd nudge about: analyzed, result still unknown, ≥3 days old. */
export function followUpTarget(logs: WorkLog[]): { log: WorkLog; insight: LogInsight } | null {
  const now = Date.now();
  const byId = new Map(logs.map((l) => [l.id, l]));
  const due = logInsights
    .getSnapshot()
    .filter((i) => i.star.resultMissing && !i.outcome && !i.followUpDismissed && now - Date.parse(i.createdAt) >= FOLLOW_UP_AFTER_MS)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  for (const i of due) {
    const log = byId.get(i.logId);
    if (log) return { log, insight: i };
  }
  return null;
}

export async function addOutcome(insight: LogInsight, note: string): Promise<void> {
  const trimmed = note.trim().slice(0, 400);
  if (!trimmed) return;
  await logInsights.upsert({
    id: insight.id,
    outcome: { note: trimmed, addedAt: new Date().toISOString() },
    star: { ...insight.star, r: trimmed, resultMissing: false },
  } as Partial<LogInsight>);
}

export async function dismissFollowUp(insight: LogInsight): Promise<void> {
  await logInsights.upsert({ id: insight.id, followUpDismissed: true } as Partial<LogInsight>);
}

// ---- aggregations ------------------------------------------------------------

export interface SkillStat {
  name: string;
  count: number;
  lastAt: string;
}

export function skillStats(insights: LogInsight[]): SkillStat[] {
  const map = new Map<string, SkillStat>();
  for (const i of insights) {
    for (const s of i.skills) {
      const cur = map.get(s);
      if (cur) {
        cur.count += 1;
        if (i.createdAt > cur.lastAt) cur.lastAt = i.createdAt;
      } else {
        map.set(s, { name: s, count: 1, lastAt: i.createdAt });
      }
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || (a.lastAt < b.lastAt ? 1 : -1));
}

export function areaStats(insights: LogInsight[], candidates: AssetCandidate[]): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const i of insights) for (const a of i.areas) map.set(a, (map.get(a) ?? 0) + 1);
  for (const c of candidates) for (const a of c.areas) map.set(a, (map.get(a) ?? 0) + 1);
  return [...map.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

/** Skills whose first-ever appearance falls inside [startIso, endIsoExclusive). */
export function newSkillsInRange(insights: LogInsight[], startIso: string, endIsoExclusive?: string): string[] {
  const first = new Map<string, string>();
  for (const i of insights) {
    for (const s of i.skills) {
      const cur = first.get(s);
      if (!cur || i.createdAt < cur) first.set(s, i.createdAt);
    }
  }
  return [...first.entries()]
    .filter(([, at]) => at >= startIso && (!endIsoExclusive || at < endIsoExclusive))
    .map(([name]) => name);
}

// ---- weekly suggestions (AI, cached per week) --------------------------------

const WEEKLY_KEY = 'bridge-daily:weekly-suggestions:';

export async function getCachedWeeklySuggestions(weekKey: string): Promise<string[] | null> {
  try {
    const raw = await AsyncStorage.getItem(WEEKLY_KEY + weekKey);
    return raw ? (JSON.parse(raw) as string[]) : null;
  } catch {
    return null;
  }
}

/** Calls the backend for cross-log suggestions and caches them for the week.
 *  Caller is responsible for spending coins first. */
export async function generateWeeklySuggestions(weekKey: string, digest: string): Promise<string[]> {
  const { suggestions } = await callBackend<{ suggestions: unknown[] }>('weekly', { digest });
  const clean = strArr(suggestions, 4, 300);
  try {
    await AsyncStorage.setItem(WEEKLY_KEY + weekKey, JSON.stringify(clean));
  } catch {
    // cache is best-effort
  }
  return clean;
}

/** Compact one-week digest for the weekly AI call. */
export function weeklyDigest(logs: WorkLog[], insights: LogInsight[], candidates: AssetCandidate[]): string {
  const byLog = new Map(insights.map((i) => [i.logId, i]));
  const lines: string[] = [];
  for (const l of logs) {
    const i = byLog.get(l.id);
    lines.push(
      `- ${l.title || l.did.slice(0, 30) || '（無題）'}${i ? ` / 実績: ${i.achievement} / スキル: ${i.skills.join(',') || 'なし'}` : ''}`,
    );
  }
  if (candidates.length) {
    lines.push('抽出済み資産候補:');
    for (const c of candidates.slice(0, 8)) lines.push(`- [${ASSET_KIND_LABEL[c.kind]}] ${c.title}`);
  }
  return lines.join('\n').slice(0, 6000);
}

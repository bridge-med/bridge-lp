// Concrete collections + import/export helpers.

import { clearModules, exportModules, importModules, loadModules } from './modules';
import { Collection } from './store';
import type { AssetCandidate, CareerOutput, ExportBundle, LangCard, LogInsight, QuickMemo, Reflection, Task, WorkLog } from './types';

export const workLogs = new Collection<WorkLog>('work_logs');
export const quickMemos = new Collection<QuickMemo>('quick_memos');
export const tasks = new Collection<Task>('tasks');
export const reflections = new Collection<Reflection>('reflections');
export const careerOutputs = new Collection<CareerOutput>('career_outputs');
export const langCards = new Collection<LangCard>('lang_cards');
// v1.1 assetization (経験→キャリア資産)
export const logInsights = new Collection<LogInsight>('log_insights');
export const assetCandidates = new Collection<AssetCandidate>('asset_candidates');

export async function loadAll(): Promise<void> {
  await Promise.all([
    workLogs.load(),
    quickMemos.load(),
    tasks.load(),
    reflections.load(),
    careerOutputs.load(),
    langCards.load(),
    logInsights.load(),
    assetCandidates.load(),
    loadModules(),
  ]);
}

export function buildExport(): ExportBundle {
  return {
    app: 'bridge-worklog',
    version: 1,
    exportedAt: new Date().toISOString(),
    workLogs: workLogs.getSnapshot(),
    quickMemos: quickMemos.getSnapshot(),
    tasks: tasks.getSnapshot(),
    reflections: reflections.getSnapshot(),
    careerOutputs: careerOutputs.getSnapshot(),
    langCards: langCards.getSnapshot(),
    modules: exportModules(),
    logInsights: logInsights.getSnapshot(),
    assetCandidates: assetCandidates.getSnapshot(),
  };
}

/** Validate + import a bundle, replacing all local data. Throws on invalid input. */
export async function importBundle(raw: string): Promise<void> {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('JSONとして読み取れませんでした。');
  }
  const b = data as Partial<ExportBundle>;
  if (!b || b.app !== 'bridge-worklog') {
    throw new Error('BRIDGE Worklog のバックアップファイルではありません。');
  }
  await Promise.all([
    workLogs.replaceAll(Array.isArray(b.workLogs) ? b.workLogs : []),
    quickMemos.replaceAll(Array.isArray(b.quickMemos) ? b.quickMemos : []),
    tasks.replaceAll(Array.isArray(b.tasks) ? b.tasks : []),
    reflections.replaceAll(Array.isArray(b.reflections) ? b.reflections : []),
    careerOutputs.replaceAll(Array.isArray(b.careerOutputs) ? b.careerOutputs : []),
    langCards.replaceAll(Array.isArray(b.langCards) ? b.langCards : []),
    logInsights.replaceAll(Array.isArray(b.logInsights) ? b.logInsights : []),
    assetCandidates.replaceAll(Array.isArray(b.assetCandidates) ? b.assetCandidates : []),
    importModules(b.modules),
  ]);
}

export async function clearAll(): Promise<void> {
  await Promise.all([
    workLogs.clear(),
    quickMemos.clear(),
    tasks.clear(),
    reflections.clear(),
    careerOutputs.clear(),
    langCards.clear(),
    logInsights.clear(),
    assetCandidates.clear(),
    clearModules(),
  ]);
}

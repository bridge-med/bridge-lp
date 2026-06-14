// Concrete collections + import/export helpers.

import { Collection } from './store';
import type { Task, Memo, JournalEntry, ExportBundle } from './types';

export const tasks = new Collection<Task>('tasks');
export const memos = new Collection<Memo>('memos');
export const journal = new Collection<JournalEntry>('journal');

export async function loadAll(): Promise<void> {
  await Promise.all([tasks.load(), memos.load(), journal.load()]);
}

export function buildExport(): ExportBundle {
  return {
    app: 'bridge-daily',
    version: 1,
    exportedAt: new Date().toISOString(),
    tasks: tasks.getSnapshot(),
    memos: memos.getSnapshot(),
    journal: journal.getSnapshot(),
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
  const bundle = data as Partial<ExportBundle>;
  if (!bundle || bundle.app !== 'bridge-daily') {
    throw new Error('BRIDGE Daily のバックアップファイルではありません。');
  }
  await Promise.all([
    tasks.replaceAll(Array.isArray(bundle.tasks) ? bundle.tasks : []),
    memos.replaceAll(Array.isArray(bundle.memos) ? bundle.memos : []),
    journal.replaceAll(Array.isArray(bundle.journal) ? bundle.journal : []),
  ]);
}

export async function clearAll(): Promise<void> {
  await Promise.all([tasks.clear(), memos.clear(), journal.clear()]);
}

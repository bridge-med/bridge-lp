// Concrete collections + import/export helpers.

import { Collection } from './store';
import type { ExportBundle, Session } from './types';

export const sessions = new Collection<Session>('sessions');

export async function loadAll(): Promise<void> {
  await sessions.load();
}

export function buildExport(): ExportBundle {
  return {
    app: 'bridge-pomodoro',
    version: 1,
    exportedAt: new Date().toISOString(),
    sessions: sessions.getSnapshot(),
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
  if (!b || b.app !== 'bridge-pomodoro') {
    throw new Error('BRIDGE Pomodoro のバックアップファイルではありません。');
  }
  await sessions.replaceAll(Array.isArray(b.sessions) ? b.sessions : []);
}

export async function clearAll(): Promise<void> {
  await sessions.clear();
}

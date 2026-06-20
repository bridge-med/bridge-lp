// Concrete collections + import/export + first-run sample data.

import { Collection } from './store';
import { todayKey } from './date';
import type { ExportBundle, FocusSession, WorkItem } from './types';

export const workItems = new Collection<WorkItem>('work_items');
export const focusSessions = new Collection<FocusSession>('focus_sessions');

export async function loadAll(): Promise<void> {
  await Promise.all([workItems.load(), focusSessions.load()]);
}

export function buildExport(): ExportBundle {
  return {
    app: 'bridge-focus',
    version: 1,
    exportedAt: new Date().toISOString(),
    workItems: workItems.getSnapshot(),
    focusSessions: focusSessions.getSnapshot(),
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
  if (!b || b.app !== 'bridge-focus') {
    throw new Error('BRIDGE Focus のバックアップファイルではありません。');
  }
  await Promise.all([
    workItems.replaceAll(Array.isArray(b.workItems) ? b.workItems : []),
    focusSessions.replaceAll(Array.isArray(b.focusSessions) ? b.focusSessions : []),
  ]);
}

export async function clearAll(): Promise<void> {
  await Promise.all([workItems.clear(), focusSessions.clear()]);
}

// ── Sample data ──────────────────────────────────────────────────────────────
// Seeded once on first launch so the UI looks complete. `note`-free, today-dated.

function isoMinutesAgo(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString();
}

/** Insert a few work items + today's sessions if the app is empty. */
export async function seedSampleData(): Promise<void> {
  await loadAll();
  if (workItems.getSnapshot().length > 0 || focusSessions.getSnapshot().length > 0) return;

  const seeds: { title: string; category: string }[] = [
    { title: '資料づくり', category: '仕事' },
    { title: '読書・インプット', category: '学習' },
    { title: 'メール対応', category: '仕事' },
    { title: '考えごと・企画', category: '仕事' },
  ];
  const items: WorkItem[] = [];
  for (const s of seeds) {
    items.push(await workItems.upsert({ title: s.title, category: s.category, source: 'manual', sourceId: null }));
  }

  // Today's history: PRP×2, 求人票×1, メール×1, 行政×1 (25min each).
  const D = 25 * 60;
  const plan: { item: WorkItem; endedMinAgo: number }[] = [
    { item: items[0], endedMinAgo: 300 },
    { item: items[3], endedMinAgo: 250 },
    { item: items[2], endedMinAgo: 180 },
    { item: items[1], endedMinAgo: 90 },
    { item: items[0], endedMinAgo: 35 },
  ];
  for (const p of plan) {
    await focusSessions.upsert({
      workItemId: p.item.id,
      kind: 'focus',
      date: todayKey(),
      startTime: isoMinutesAgo(p.endedMinAgo + 25),
      endTime: isoMinutesAgo(p.endedMinAgo),
      duration: D,
      status: 'completed',
      note: '',
    });
  }
}

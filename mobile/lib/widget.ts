// Pushes a compact task-matrix summary into the shared App Group so the iOS
// home-screen widget (targets/widget) can render it. No-op off iOS.

import { ExtensionStorage } from '@bacons/apple-targets';
import { Platform } from 'react-native';
import { categoryColor } from './categories';
import { QUADRANTS, quadrantOf, type Quadrant } from './matrix';
import type { Task } from './types';

export const APP_GROUP = 'group.com.bridgemed.worklog';

let storage: ExtensionStorage | null = null;

/** Recompute the A/B/C/D summary from tasks and hand it to the widget. */
export function updateTaskWidget(tasks: Task[]): void {
  if (Platform.OS !== 'ios') return;
  try {
    if (!storage) storage = new ExtensionStorage(APP_GROUP);
    const byQ: Record<Quadrant, Task[]> = { A: [], B: [], C: [], D: [] };
    for (const t of tasks) {
      if (t.status === 'done') continue;
      const q = quadrantOf(t);
      if (q) byQ[q].push(t);
    }
    const quadrants = QUADRANTS.map((q) => ({
      key: q.key,
      label: q.label,
      count: byQ[q.key].length,
      items: byQ[q.key].slice(0, 3).map((t) => ({
        title: t.title.slice(0, 40),
        color: (t.category ? categoryColor(t.category) : null) ?? '',
      })),
    }));
    storage.set('matrix', JSON.stringify({ updatedAt: Date.now(), quadrants }));
    ExtensionStorage.reloadWidget();
  } catch {
    // widget/app-group not present (e.g. dev build without target) — ignore
  }
}

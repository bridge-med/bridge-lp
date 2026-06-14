// Pro feature: export everything as readable Markdown (vs the raw JSON backup).

import { formatDateJa } from './date';
import type { JournalEntry, Memo, Task } from './types';

const MOOD_EMOJI = ['', '😞', '😕', '😐', '🙂', '😄'];

export function toMarkdown(data: { tasks: Task[]; memos: Memo[]; journal: JournalEntry[] }): string {
  const lines: string[] = [];
  lines.push('# BRIDGE Daily エクスポート');
  lines.push('', `生成日時: ${new Date().toLocaleString('ja-JP')}`, '');

  lines.push('## タスク', '');
  const open = data.tasks.filter((t) => t.status === 'todo');
  const done = data.tasks.filter((t) => t.status === 'done');
  for (const t of open) {
    const due = t.due ? `（期限 ${t.due}）` : '';
    const pri = t.priority === 'high' ? ' ❗' : '';
    lines.push(`- [ ] ${t.title}${pri}${due}`);
    if (t.notes) lines.push(`  - ${t.notes}`);
  }
  for (const t of done) lines.push(`- [x] ${t.title}`);
  if (data.tasks.length === 0) lines.push('_なし_');
  lines.push('');

  lines.push('## メモ', '');
  for (const m of [...data.memos].sort((a, b) => (b.updatedAt < a.updatedAt ? -1 : 1))) {
    lines.push(`### ${m.pinned ? '📌 ' : ''}${m.title || '無題のメモ'}`);
    if (m.body) lines.push('', m.body);
    lines.push('');
  }
  if (data.memos.length === 0) lines.push('_なし_', '');

  lines.push('## 日記', '');
  for (const e of [...data.journal].sort((a, b) => (b.date < a.date ? -1 : 1))) {
    const mood = e.mood ? ` ${MOOD_EMOJI[e.mood]}` : '';
    lines.push(`### ${formatDateJa(e.date)}${mood}`, '', e.body, '');
  }
  if (data.journal.length === 0) lines.push('_なし_', '');

  return lines.join('\n');
}

// Eisenhower matrix (緊急度 × 重要度) for tasks.
//   A = 重要 高 / 緊急 高   B = 重要 高 / 緊急 低
//   C = 重要 低 / 緊急 高   D = 重要 低 / 緊急 低
// Tasks missing either axis are "unclassified".

import { parseKey, todayKey } from './date';
import type { Task } from './types';

export type Quadrant = 'A' | 'B' | 'C' | 'D';

export const QUADRANTS: {
  key: Quadrant;
  label: string;
  sub: string;
  tone: 'danger' | 'primary' | 'warn' | 'neutral';
}[] = [
  { key: 'A', label: '今すぐやる', sub: '緊急 高・重要 高', tone: 'danger' },
  { key: 'B', label: '予定に入れる', sub: '緊急 低・重要 高', tone: 'primary' },
  { key: 'C', label: '人に頼む・短時間で', sub: '緊急 高・重要 低', tone: 'warn' },
  { key: 'D', label: 'やらない・保留', sub: '緊急 低・重要 低', tone: 'neutral' },
];

/** Urgency: manual value wins; otherwise derived from the due date
 *  (overdue / today / tomorrow → 高, anything else or no due → 低). */
export function effectiveUrgency(t: Task): 'high' | 'low' {
  if (t.urgency) return t.urgency;
  if (!t.dueDate) return 'low';
  const days = Math.round((parseKey(t.dueDate).getTime() - parseKey(todayKey()).getTime()) / 86_400_000);
  return days <= 2 ? 'high' : 'low';
}

/** Quadrant for a task. Only 重要度 must be set — 緊急度 falls back to the due
 *  date — so setting importance alone auto-places the task. */
export function quadrantOf(t: Task): Quadrant | null {
  if (!t.importance) return null;
  const u = effectiveUrgency(t);
  if (t.importance === 'high') return u === 'high' ? 'A' : 'B';
  return u === 'high' ? 'C' : 'D';
}

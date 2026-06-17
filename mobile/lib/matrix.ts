// Eisenhower matrix (緊急度 × 重要度) for tasks.
//   A = 重要 高 / 緊急 高   B = 重要 高 / 緊急 低
//   C = 重要 低 / 緊急 高   D = 重要 低 / 緊急 低
// Tasks missing either axis are "unclassified".

import type { Task } from './types';

export type Quadrant = 'A' | 'B' | 'C' | 'D';

export const QUADRANTS: {
  key: Quadrant;
  label: string;
  sub: string;
  tone: 'danger' | 'primary' | 'warn' | 'neutral';
}[] = [
  { key: 'A', label: 'すぐやる', sub: '緊急 高・重要 高', tone: 'danger' },
  { key: 'B', label: '計画する', sub: '緊急 低・重要 高', tone: 'primary' },
  { key: 'C', label: 'さっと片付け', sub: '緊急 高・重要 低', tone: 'warn' },
  { key: 'D', label: 'あとで・見直し', sub: '緊急 低・重要 低', tone: 'neutral' },
];

/** Quadrant for a task, or null when not fully classified. */
export function quadrantOf(t: Task): Quadrant | null {
  if (!t.importance || !t.urgency) return null;
  if (t.importance === 'high') return t.urgency === 'high' ? 'A' : 'B';
  return t.urgency === 'high' ? 'C' : 'D';
}

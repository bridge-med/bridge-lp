// Journal analytics used by the Pro "ふりかえり" (review) screen.

import { todayKey } from './date';
import type { JournalEntry } from './types';

/** Consecutive days with an entry, ending today (or yesterday if today is blank). */
export function currentStreak(entries: JournalEntry[]): number {
  const days = new Set(entries.map((e) => e.date));
  const d = new Date();
  if (!days.has(todayKey(d))) d.setDate(d.getDate() - 1); // grace: today not written yet
  let streak = 0;
  while (days.has(todayKey(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

/** Counts of each mood value 1..5 (index 0 = mood 1). */
export function moodDistribution(entries: JournalEntry[]): number[] {
  const out = [0, 0, 0, 0, 0];
  for (const e of entries) {
    if (e.mood && e.mood >= 1 && e.mood <= 5) out[e.mood - 1]++;
  }
  return out;
}

export function averageMood(entries: JournalEntry[]): number | null {
  const withMood = entries.filter((e) => !!e.mood);
  if (withMood.length === 0) return null;
  const sum = withMood.reduce((acc, e) => acc + (e.mood ?? 0), 0);
  return Math.round((sum / withMood.length) * 10) / 10;
}

/** Last `n` days as {key, count} oldest→newest, for an activity strip. */
export function lastNDays(entries: JournalEntry[], n = 14): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of entries) counts.set(e.date, (counts.get(e.date) ?? 0) + 1);
  const out: { key: string; count: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = todayKey(d);
    out.push({ key, count: counts.get(key) ?? 0 });
  }
  return out;
}

/** Entry counts grouped by yyyy-mm, newest first. */
export function monthlyCounts(entries: JournalEntry[]): { month: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const m = e.date.slice(0, 7);
    counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([month, count]) => ({ month, count }));
}

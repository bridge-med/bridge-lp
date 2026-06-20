// Date helpers working in the device's local timezone.
// Journal/task dates are stored as `yyyy-mm-dd` strings.

const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

export function todayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** e.g. "6月14日(日)" */
export function formatDateJa(key: string): string {
  const d = parseKey(key);
  return `${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS_JA[d.getDay()]})`;
}

/** Friendly relative label for a due date. */
export function dueLabel(key: string | null): { text: string; tone: 'overdue' | 'today' | 'soon' | 'later' } | null {
  if (!key) return null;
  const today = todayKey();
  if (key < today) return { text: '期限超過', tone: 'overdue' };
  if (key === today) return { text: '今日', tone: 'today' };
  const diff = Math.round((parseKey(key).getTime() - parseKey(today).getTime()) / 86400000);
  if (diff === 1) return { text: '明日', tone: 'soon' };
  if (diff <= 7) return { text: `${diff}日後`, tone: 'soon' };
  return { text: formatDateJa(key), tone: 'later' };
}

/** Advance a date key by one repeat period. */
export function addPeriod(key: string, repeat: 'daily' | 'weekly' | 'monthly'): string {
  const d = parseKey(key);
  if (repeat === 'daily') d.setDate(d.getDate() + 1);
  else if (repeat === 'weekly') d.setDate(d.getDate() + 7);
  else d.setMonth(d.getMonth() + 1);
  return todayKey(d);
}

/** Monday-based start of the current week, as a yyyy-mm-dd key. */
export function startOfWeekKey(d: Date = new Date()): string {
  const date = new Date(d);
  const day = (date.getDay() + 6) % 7; // Mon=0 .. Sun=6
  date.setDate(date.getDate() - day);
  return todayKey(date);
}

/** First/last day of the current month as keys. */
export function monthRangeKeys(d: Date = new Date()): { start: string; end: string } {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return { start: todayKey(start), end: todayKey(end) };
}

/** "6/14" short label. */
export function formatShort(key: string): string {
  const d = parseKey(key);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatTimeJa(iso: string): string {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

/** Seconds → "1h 15m" / "25m" / "0m". */
export function formatDuration(totalSec: number): string {
  const totalMin = Math.round(totalSec / 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m`;
}

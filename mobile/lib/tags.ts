// Tag + free-text search helpers, shared by tasks and memos.

export function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, '').trim();
}

/** All distinct tags across records, sorted by frequency then name. */
export function collectTags(items: { tags?: string[] }[]): string[] {
  const counts = new Map<string, number>();
  for (const it of items) {
    for (const t of it.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).map(([t]) => t);
}

/** Case-insensitive match of a query against any of the given fields. */
export function matchesQuery(query: string, fields: (string | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f ?? '').toLowerCase().includes(q));
}

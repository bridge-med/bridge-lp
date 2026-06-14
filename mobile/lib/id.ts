// Small id + time helpers. No external uuid dependency needed.

export function newId(): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now().toString(36)}-${rand}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

// Unified colour "labels" (categories) shared across tasks / memos / logs.
// 8 fixed colour slots A..H; the user renames each (names live in prefs).

import { usePrefs } from './prefs';

export const CATEGORY_SLOTS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export type CategoryId = (typeof CATEGORY_SLOTS)[number];

// Distinct, warm-leaning palette (one per slot).
export const CATEGORY_COLORS: Record<CategoryId, string> = {
  A: '#E8833C', // amber
  B: '#6FA86A', // leaf
  C: '#5B83A6', // sky
  D: '#9A6A86', // plum
  E: '#E0A640', // gold
  F: '#4F9D8C', // teal
  G: '#C2553C', // brick
  H: '#7E8AA2', // slate
};

export const DEFAULT_CATEGORY_NAMES: string[] = [...CATEGORY_SLOTS];

export function categoryColor(id?: string | null): string | null {
  return id && id in CATEGORY_COLORS ? CATEGORY_COLORS[id as CategoryId] : null;
}

export interface Category {
  id: CategoryId;
  name: string;
  color: string;
}

/** Resolved categories (id + user name + colour), in slot order. */
export function useCategories(): Category[] {
  const { categoryNames } = usePrefs();
  return CATEGORY_SLOTS.map((id, i) => ({ id, name: (categoryNames[i] || id).trim() || id, color: CATEGORY_COLORS[id] }));
}

/** Map id -> {name, color} for quick lookups in lists. */
export function useCategoryMap(): Record<string, Category> {
  const cats = useCategories();
  const out: Record<string, Category> = {};
  for (const cc of cats) out[cc.id] = cc;
  return out;
}

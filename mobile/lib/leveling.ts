// Leveling / growth engine for the companion ("相棒").
//
// Design goals (from product):
// - Level cap 50.
// - Steady daily accumulation; later levels cost more XP (rising curve).
// - ~100 days of full daily input ≈ reaching Lv.50.
// - Daily writing grants bonus XP (handled in lib/progress.ts).
//
// This module is pure math + stage metadata. XP awarding/persistence lives in
// lib/progress.ts.

export const LEVEL_CAP = 50;

// XP needed to go from `level` -> `level+1`. Rising curve.
// Tuned so cumulative XP to Lv.50 ≈ 100 "full days" of input (see scripts).
const BASE = 20;
const K = 1.45;
const EXP = 1.35;

export function xpToNext(level: number): number {
  if (level >= LEVEL_CAP) return Infinity;
  return Math.round(BASE + K * Math.pow(level, EXP));
}

// Precompute cumulative XP thresholds. CUMULATIVE[L] = total XP to *reach* Lv.L.
const CUMULATIVE: number[] = (() => {
  const arr = [0, 0]; // index 0 unused, Lv.1 = 0 XP
  for (let l = 1; l < LEVEL_CAP; l++) arr[l + 1] = arr[l] + xpToNext(l);
  return arr;
})();

export function totalXpForLevel(level: number): number {
  return CUMULATIVE[Math.max(1, Math.min(LEVEL_CAP, level))];
}

export const MAX_XP = CUMULATIVE[LEVEL_CAP];

export interface LevelInfo {
  level: number;
  atCap: boolean;
  xpIntoLevel: number; // XP earned within the current level
  xpForLevel: number; // XP span of the current level (this->next)
  progress: number; // 0..1 within current level
  toNext: number; // XP remaining to next level
}

export function levelInfo(totalXp: number): LevelInfo {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (level < LEVEL_CAP && xp >= CUMULATIVE[level + 1]) level++;
  const atCap = level >= LEVEL_CAP;
  const base = CUMULATIVE[level];
  const span = atCap ? 0 : CUMULATIVE[level + 1] - base;
  const into = xp - base;
  return {
    level,
    atCap,
    xpIntoLevel: into,
    xpForLevel: span,
    progress: atCap ? 1 : span > 0 ? into / span : 0,
    toNext: atCap ? 0 : span - into,
  };
}

// Growth stages — the buddy visibly changes form as it levels up. `art` indexes
// the BuddySprite drawing (1..7).
export interface Stage {
  art: number;
  name: string;
  minLevel: number;
  tagline: string;
}

export const STAGES: Stage[] = [
  { art: 1, minLevel: 1, name: 'たね', tagline: 'はじまりの一粒' },
  { art: 2, minLevel: 3, name: 'め', tagline: '芽が出た' },
  { art: 3, minLevel: 7, name: 'ふたば', tagline: '双葉がひらく' },
  { art: 4, minLevel: 13, name: 'わかば', tagline: 'ぐんぐん伸びる' },
  { art: 5, minLevel: 21, name: 'つぼみ', tagline: 'つぼみがふくらむ' },
  { art: 6, minLevel: 31, name: 'はな', tagline: '花がひらいた' },
  { art: 7, minLevel: 43, name: 'みのり', tagline: '実を結ぶ' },
];

export function stageForLevel(level: number): Stage {
  let s = STAGES[0];
  for (const st of STAGES) if (level >= st.minLevel) s = st;
  return s;
}

/** The level at which the buddy's *form* next changes (or null at final stage). */
export function nextStage(level: number): Stage | null {
  for (const st of STAGES) if (st.minLevel > level) return st;
  return null;
}

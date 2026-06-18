// Spaced-repetition progress for the study decks (English / Korean courses).
// Each word carries a Leitner "box" (0=new .. 5=mastered); the box also sets the
// review interval, so well-known words resurface less often. Progress is keyed by
// `${course}:${word}` and kept local (AsyncStorage), separate from the wordbank.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import type { VocabWord } from './vocab';

const KEY = 'bridge-daily:vocabdeck';
export const MAX_BOX = 5;

// Days a word "rests" in each box before it's due again. Box 0 (new) = now.
const INTERVAL_DAYS = [0, 1, 2, 4, 8, 16];
const DAY = 86_400_000;

interface WordProg {
  box: number;
  last: number; // epoch ms of last review
}

type Data = Record<string, WordProg>;
type Listener = () => void;

const vkey = (course: string, word: string) => `${course}:${word}`;

class VocabDeck {
  private data: Data = {};
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private listeners = new Set<Listener>();

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    if (!this.loaded && !this.loadPromise) void this.load();
    return () => this.listeners.delete(fn);
  };
  getSnapshot = (): Data => this.data;

  private emit() {
    this.listeners.forEach((l) => l());
  }

  async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as Data;
          // Migrate legacy English keys (plain word -> "en:word").
          const migrated: Data = {};
          for (const [k, v] of Object.entries(parsed)) {
            migrated[k.includes(':') ? k : vkey('en', k)] = v;
          }
          this.data = migrated;
        } catch {
          this.data = {};
        }
      }
      this.loaded = true;
      this.emit();
    });
    return this.loadPromise;
  }

  private async persist() {
    await AsyncStorage.setItem(KEY, JSON.stringify(this.data));
    this.emit();
  }

  boxOf(course: string, word: string): number {
    return this.data[vkey(course, word)]?.box ?? 0;
  }

  /** Grade a card: known advances a box, unknown resets to 0. */
  async review(course: string, word: string, known: boolean): Promise<void> {
    const k = vkey(course, word);
    const cur = this.data[k]?.box ?? 0;
    const box = known ? Math.min(MAX_BOX, cur + 1) : 0;
    this.data = { ...this.data, [k]: { box, last: Date.now() } };
    await this.persist();
  }
}

export const vocabDeck = new VocabDeck();

function isDue(p: WordProg | undefined, now: number): boolean {
  if (!p) return true; // never seen
  if (p.box >= MAX_BOX) return false; // mastered
  return now - p.last >= INTERVAL_DAYS[p.box] * DAY;
}

export interface DeckStats {
  total: number;
  mastered: number;
  learning: number; // seen but not mastered
  due: number; // due right now (incl. brand-new)
}

export function deckStats(words: VocabWord[], course: string, data: Data): DeckStats {
  const now = Date.now();
  let mastered = 0, learning = 0, due = 0;
  for (const e of words) {
    const p = data[vkey(course, e.w)];
    if (p && p.box >= MAX_BOX) mastered++;
    else if (p) learning++;
    if (isDue(p, now)) due++;
  }
  return { total: words.length, mastered, learning, due };
}

export function masteredCount(words: VocabWord[], course: string, data: Data): number {
  return words.filter((e) => (data[vkey(course, e.w)]?.box ?? 0) >= MAX_BOX).length;
}

/** Build a study session: due words first (least-known, most-frequent), capped. */
export function buildSession(words: VocabWord[], course: string, data: Data, limit = 20): VocabWord[] {
  const now = Date.now();
  const due = words.filter((e) => isDue(data[vkey(course, e.w)], now));
  due.sort((a, b) => (data[vkey(course, a.w)]?.box ?? 0) - (data[vkey(course, b.w)]?.box ?? 0) || a.r - b.r);
  return due.slice(0, limit);
}

export function useVocabDeck(): Data {
  return useSyncExternalStore(vocabDeck.subscribe, vocabDeck.getSnapshot, vocabDeck.getSnapshot);
}

// Word bank: vocabulary that accumulates from what the user actually writes
// (logs / memos / tasks) plus a daily suggested word. Words carry a simple
// spaced-repetition "box" (0..5) used by the flashcard study mode. The dream:
// every day's writing quietly builds a personal study deck ("ながら勉強").

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { ALL_TERMS, DICT, matchTerms } from './dict';
import { todayKey } from './date';

const KEY = 'bridge-daily:wordbank';
export const MAX_BOX = 5;

export interface SavedWord {
  term: string;
  addedAt: string; // ISO
  box: number; // 0 (new) .. MAX_BOX (mastered)
  last: string | null; // last reviewed ISO
}

interface WordbankData {
  words: Record<string, SavedWord>;
}

type Listener = () => void;

class Wordbank {
  private data: WordbankData = { words: {} };
  private loaded = false;
  private loadPromise: Promise<void> | null = null;
  private listeners = new Set<Listener>();

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    if (!this.loaded && !this.loadPromise) void this.load();
    return () => this.listeners.delete(fn);
  };
  getSnapshot = (): WordbankData => this.data;

  private emit() {
    this.listeners.forEach((l) => l());
  }

  async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) {
        try {
          this.data = { words: (JSON.parse(raw) as WordbankData).words ?? {} };
        } catch {
          this.data = { words: {} };
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

  has(term: string): boolean {
    return !!this.data.words[term];
  }

  /** Add a dictionary term to the bank (no-op if unknown or already saved). */
  async add(term: string): Promise<boolean> {
    if (!DICT[term] || this.data.words[term]) return false;
    this.data.words = { ...this.data.words, [term]: { term, addedAt: new Date().toISOString(), box: 0, last: null } };
    await this.persist();
    return true;
  }

  /** Scan free text and bank any new known words. Returns count added. */
  async collectFrom(text: string): Promise<number> {
    if (!this.loaded) await this.load();
    let added = 0;
    const next = { ...this.data.words };
    for (const term of matchTerms(text)) {
      if (!next[term]) {
        next[term] = { term, addedAt: new Date().toISOString(), box: 0, last: null };
        added++;
      }
    }
    if (added > 0) {
      this.data.words = next;
      await this.persist();
    }
    return added;
  }

  async review(term: string, known: boolean): Promise<void> {
    const w = this.data.words[term];
    if (!w) return;
    const box = known ? Math.min(MAX_BOX, w.box + 1) : 0;
    this.data.words = { ...this.data.words, [term]: { ...w, box, last: new Date().toISOString() } };
    await this.persist();
  }

  async remove(term: string): Promise<void> {
    const next = { ...this.data.words };
    delete next[term];
    this.data.words = next;
    await this.persist();
  }
}

export const wordbank = new Wordbank();

export function useWordbank(): SavedWord[] {
  const data = useSyncExternalStore(wordbank.subscribe, wordbank.getSnapshot, wordbank.getSnapshot);
  return Object.values(data.words);
}

/** Study order: least-learned first (low box), then oldest. */
export function studyDeck(words: SavedWord[]): SavedWord[] {
  return [...words].sort((a, b) => a.box - b.box || (a.addedAt < b.addedAt ? -1 : 1));
}

/** A deterministic "word of the day" from the core dictionary. */
export function wordOfTheDay(): string {
  const key = todayKey();
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return ALL_TERMS[h % ALL_TERMS.length];
}

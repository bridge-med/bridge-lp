// App preferences (timer durations, behavior, accent theme), persisted & reactive.
// Pomodoro holds no secrets, so everything lives in a single AsyncStorage blob.

import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AccentKey } from './theme';

const KEY = 'bridge-pomodoro:prefs';

export interface Prefs {
  // durations (minutes)
  focusMinutes: number;
  shortMinutes: number;
  longMinutes: number;
  longEvery: number; // a long break after this many focus sessions
  // behavior
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  soundEnabled: boolean;
  keepAwake: boolean;
  // appearance
  accent: AccentKey;
  // daily reminder notification
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
}

const DEFAULT: Prefs = {
  focusMinutes: 25,
  shortMinutes: 5,
  longMinutes: 15,
  longEvery: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  soundEnabled: true,
  keepAwake: true,
  accent: 'ai',
  reminderEnabled: false,
  reminderHour: 21,
  reminderMinute: 0,
};

type Listener = () => void;

class PrefsStore {
  private value: Prefs = DEFAULT;
  private loaded = false;
  private listeners = new Set<Listener>();
  private loadPromise: Promise<void> | null = null;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    if (!this.loaded && !this.loadPromise) void this.load();
    return () => {
      this.listeners.delete(fn);
    };
  };

  getSnapshot = (): Prefs => this.value;

  isLoaded(): boolean {
    return this.loaded;
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = (async () => {
      const raw = await AsyncStorage.getItem(KEY);
      let parsed: Partial<Prefs> = {};
      if (raw) {
        try {
          parsed = JSON.parse(raw) as Partial<Prefs>;
        } catch {
          parsed = {};
        }
      }
      this.value = { ...DEFAULT, ...parsed };
      this.loaded = true;
      this.emit();
    })();
    return this.loadPromise;
  }

  async set(patch: Partial<Prefs>): Promise<void> {
    this.value = { ...this.value, ...patch };
    this.loaded = true;
    await AsyncStorage.setItem(KEY, JSON.stringify(this.value));
    this.emit();
  }
}

export const prefs = new PrefsStore();

export function usePrefs(): Prefs {
  return useSyncExternalStore(prefs.subscribe, prefs.getSnapshot, prefs.getSnapshot);
}

/** Duration in seconds for a given session kind. */
export function durationFor(p: Prefs, kind: 'focus' | 'short' | 'long'): number {
  const min = kind === 'focus' ? p.focusMinutes : kind === 'short' ? p.shortMinutes : p.longMinutes;
  return Math.max(1, Math.round(min)) * 60;
}

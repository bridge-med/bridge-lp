// App preferences (timer durations, behavior, theme), persisted & reactive.
// No secrets, so everything lives in a single AsyncStorage blob.

import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SoundName } from './sound';
import type { ThemeMode } from './theme';
import type { ID } from './types';

const KEY = 'bridge-focus:prefs';

export interface Prefs {
  // durations (minutes)
  focusMinutes: number;
  shortMinutes: number;
  longMinutes: number;
  longEvery: number; // a long break after this many focus sessions
  // behavior
  soundEnabled: boolean;
  soundName: SoundName;
  vibrationEnabled: boolean;
  // appearance
  theme: ThemeMode;
  // the work item currently selected on the Focus screen (remembered)
  currentWorkItemId: ID | null;
  // first-run sample data marker + which sample version was seeded
  seeded: boolean;
  sampleVersion: number;
}

const DEFAULT: Prefs = {
  focusMinutes: 25,
  shortMinutes: 5,
  longMinutes: 15,
  longEvery: 4,
  soundEnabled: true,
  soundName: 'bell',
  vibrationEnabled: true,
  theme: 'system',
  currentWorkItemId: null,
  seeded: false,
  sampleVersion: 0,
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

// App preferences (onboarding state, profile, theme, reminder), persisted & reactive.
// No user API keys: AI runs through the app's own backend (developer key), so
// users are never asked for secrets.

import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AccentKey } from './theme';

const KEY = 'bridge-daily:prefs';

export interface Prefs {
  onboardingDone: boolean;
  accent: AccentKey;
  // Profile (single local user until any future auth)
  userName: string; // 呼ばれたい名前
  profession: string;
  role: string;
  purpose: string;
  workStyleResult: string;
  // Companion
  buddyName: string;
  // Colour labels A..H — user-editable names (index = slot order)
  categoryNames: string[];
  // Daily reminder notification
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
}

const DEFAULT: Prefs = {
  onboardingDone: false,
  accent: 'ai',
  userName: '',
  profession: '',
  role: '',
  purpose: '',
  workStyleResult: '',
  buddyName: '',
  categoryNames: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
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
    this.loadPromise = AsyncStorage.getItem(KEY).then((raw) => {
      if (raw) {
        try {
          this.value = { ...DEFAULT, ...(JSON.parse(raw) as Partial<Prefs>) };
        } catch {
          this.value = DEFAULT;
        }
      }
      this.loaded = true;
      this.emit();
    });
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

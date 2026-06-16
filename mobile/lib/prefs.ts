// App preferences (onboarding state + accent theme), persisted & reactive.

import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AiProvider } from './constants';
import { secureGet, secureSet } from './secure';
import type { AccentKey } from './theme';

const KEY = 'bridge-daily:prefs';

// Secret fields kept out of the AsyncStorage blob and stored in the OS keystore.
const SECRET_FIELDS = ['geminiApiKey', 'openaiApiKey', 'anthropicApiKey'] as const;
type SecretField = (typeof SECRET_FIELDS)[number];

export interface Prefs {
  onboardingDone: boolean;
  accent: AccentKey;
  // AI: selected provider + a key per provider (bring-your-own-key)
  aiProvider: AiProvider;
  geminiApiKey: string;
  openaiApiKey: string;
  anthropicApiKey: string;
  // Profile (users table, single local user until Supabase auth)
  profession: string;
  role: string;
  purpose: string;
  workStyleResult: string;
  // Companion
  buddyName: string;
  // Daily reminder notification
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
}

const DEFAULT: Prefs = {
  onboardingDone: false,
  accent: 'ai',
  aiProvider: 'gemini',
  geminiApiKey: '',
  openaiApiKey: '',
  anthropicApiKey: '',
  profession: '',
  role: '',
  purpose: '',
  workStyleResult: '',
  buddyName: '',
  reminderEnabled: false,
  reminderHour: 21,
  reminderMinute: 0,
};

/** The API key for the currently-selected AI provider. */
export function activeAiKey(p: Prefs): string {
  return p.aiProvider === 'openai' ? p.openaiApiKey : p.aiProvider === 'anthropic' ? p.anthropicApiKey : p.geminiApiKey;
}

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
      // Legacy keys may still live in the blob — migrate them to the keystore.
      const legacy: Partial<Record<SecretField, string>> = {};
      for (const f of SECRET_FIELDS) {
        if (parsed[f]) legacy[f] = parsed[f] as string;
      }
      // Read secrets from secure storage (falling back to any legacy value).
      const secrets = {} as Record<SecretField, string>;
      for (const f of SECRET_FIELDS) {
        secrets[f] = (await secureGet(f)) ?? legacy[f] ?? '';
      }
      this.value = { ...DEFAULT, ...parsed, ...secrets };
      this.loaded = true;
      this.emit();

      if (Object.keys(legacy).length > 0) {
        for (const f of SECRET_FIELDS) {
          if (legacy[f]) await secureSet(f, legacy[f] as string);
        }
        await this.persistBlob(); // rewrite the blob without secrets
      }
    })();
    return this.loadPromise;
  }

  // Persist only non-secret fields to AsyncStorage.
  private async persistBlob(): Promise<void> {
    const blob: Record<string, unknown> = { ...this.value };
    for (const f of SECRET_FIELDS) delete blob[f];
    await AsyncStorage.setItem(KEY, JSON.stringify(blob));
  }

  async set(patch: Partial<Prefs>): Promise<void> {
    this.value = { ...this.value, ...patch };
    this.loaded = true;
    for (const f of SECRET_FIELDS) {
      if (f in patch) await secureSet(f, (patch[f] as string) ?? '');
    }
    await this.persistBlob();
    this.emit();
  }
}

export const prefs = new PrefsStore();

export function usePrefs(): Prefs {
  return useSyncExternalStore(prefs.subscribe, prefs.getSnapshot, prefs.getSnapshot);
}

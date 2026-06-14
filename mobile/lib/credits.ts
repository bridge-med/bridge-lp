// Coin (credit) system for "managed AI": users buy coins and spend them per
// generation, instead of bringing their own API key. The actual generation
// (server-side with the developer's key) is added later via a backend proxy —
// this module is the balance + economy, designed for that swap.
//
// New users get a few free coins to try. Real top-ups become consumable IAP
// (RevenueCat) that credit the balance after a server-verified receipt.

import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'bridge-daily:coins';
const STARTER = 3; // free coins on first run (registration bonus to try AI)

export const GEN_COST = 1; // coins per AI generation

export const COIN_PACKS: { id: string; coins: number; price: string; perGen: string; best?: boolean }[] = [
  { id: 'coins_10', coins: 10, price: '¥240', perGen: '24円/回' },
  { id: 'coins_30', coins: 30, price: '¥600', perGen: '20円/回', best: true },
  { id: 'coins_100', coins: 100, price: '¥1,600', perGen: '16円/回' },
];

type Listener = () => void;

class Credits {
  private balance = STARTER;
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

  getSnapshot = (): number => this.balance;

  private emit() {
    this.listeners.forEach((l) => l());
  }

  async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = AsyncStorage.getItem(KEY).then(async (raw) => {
      if (raw == null) {
        this.balance = STARTER;
        await AsyncStorage.setItem(KEY, String(STARTER));
      } else {
        this.balance = Number(raw) || 0;
      }
      this.loaded = true;
      this.emit();
    });
    return this.loadPromise;
  }

  private async persist() {
    await AsyncStorage.setItem(KEY, String(this.balance));
    this.emit();
  }

  async add(n: number): Promise<void> {
    this.balance += n;
    await this.persist();
  }

  /** Returns true if there were enough coins (and they were spent). */
  async spend(n: number): Promise<boolean> {
    if (this.balance < n) return false;
    this.balance -= n;
    await this.persist();
    return true;
  }
}

export const credits = new Credits();

export function useCoins(): number {
  return useSyncExternalStore(credits.subscribe, credits.getSnapshot, credits.getSnapshot);
}

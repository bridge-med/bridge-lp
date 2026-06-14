// Ad-free entitlement layer.
//
// Monetization = all features are free + subtle banner ads, with a one-time
// "remove ads" purchase. This module is the single source of truth for whether
// ads are removed. purchaseAdFree() is a local mock for now; swap its body for
// RevenueCat (react-native-purchases) at ship time. The rest of the app only
// depends on useAdFree().

import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'bridge-daily:entitlement:adfree';

type Listener = () => void;

class Entitlement {
  private adFree = false;
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

  getSnapshot = (): boolean => this.adFree;

  private emit() {
    this.listeners.forEach((l) => l());
  }

  async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = AsyncStorage.getItem(KEY).then((raw) => {
      this.adFree = raw === '1';
      this.loaded = true;
      this.emit();
    });
    return this.loadPromise;
  }

  async set(value: boolean): Promise<void> {
    this.adFree = value;
    this.loaded = true;
    await AsyncStorage.setItem(KEY, value ? '1' : '0');
    this.emit();
  }
}

export const entitlement = new Entitlement();

/** True when the user has removed ads. */
export function useAdFree(): boolean {
  return useSyncExternalStore(entitlement.subscribe, entitlement.getSnapshot, entitlement.getSnapshot);
}

// --- Store-facing facade (swap for RevenueCat later) ---------------------

export const ADFREE = {
  priceLabel: '¥480',
  productId: 'bridge_daily_adfree', // one-time, non-consumable
} as const;

/** Purchase the one-time ad removal. Mock implementation unlocks locally. */
export async function purchaseAdFree(): Promise<void> {
  // TODO: replace with RevenueCat Purchases.purchaseStoreProduct(...)
  await entitlement.set(true);
}

/** Restore previous purchases. Mock returns the current local state. */
export async function restorePurchases(): Promise<boolean> {
  // TODO: replace with RevenueCat Purchases.restorePurchases()
  return entitlement.getSnapshot();
}

/** Dev-only: flip the ad-free state to preview both modes without a store. */
export async function devToggleAdFree(): Promise<void> {
  await entitlement.set(!entitlement.getSnapshot());
}

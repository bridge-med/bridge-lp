// Pro entitlement layer.
//
// This is the SINGLE place that knows whether the user owns "BRIDGE Daily Pro".
// Right now it persists a local flag and `purchasePro()` unlocks it directly
// (a mock, since real IAP requires a development/EAS build + store accounts).
//
// To go live: replace the bodies of purchasePro()/restorePurchases()/load()
// with RevenueCat (`react-native-purchases`) calls and read the entitlement
// from the customer info. The rest of the app only depends on `usePro()`.

import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'bridge-daily:entitlement:pro';

type Listener = () => void;

class Entitlement {
  private pro = false;
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

  getSnapshot = (): boolean => this.pro;

  private emit() {
    this.listeners.forEach((l) => l());
  }

  async load(): Promise<void> {
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = AsyncStorage.getItem(KEY).then((raw) => {
      this.pro = raw === '1';
      this.loaded = true;
      this.emit();
    });
    return this.loadPromise;
  }

  async set(value: boolean): Promise<void> {
    this.pro = value;
    this.loaded = true;
    await AsyncStorage.setItem(KEY, value ? '1' : '0');
    this.emit();
  }
}

export const entitlement = new Entitlement();

/** Subscribe a component to the Pro entitlement. */
export function usePro(): boolean {
  return useSyncExternalStore(entitlement.subscribe, entitlement.getSnapshot, entitlement.getSnapshot);
}

// --- Store-facing facade (swap for RevenueCat later) ---------------------

export const PRO = {
  priceLabel: '¥980',
  productId: 'bridge_daily_pro', // one-time, non-consumable
} as const;

/** Purchase the one-time Pro unlock. Mock implementation unlocks locally. */
export async function purchasePro(): Promise<void> {
  // TODO: replace with RevenueCat Purchases.purchaseStoreProduct(...)
  await entitlement.set(true);
}

/** Restore previous purchases. Mock returns the current local state. */
export async function restorePurchases(): Promise<boolean> {
  // TODO: replace with RevenueCat Purchases.restorePurchases()
  return entitlement.getSnapshot();
}

/** Dev-only: flip Pro on/off to preview gated UI without a store. */
export async function devTogglePro(): Promise<void> {
  await entitlement.set(!entitlement.getSnapshot());
}

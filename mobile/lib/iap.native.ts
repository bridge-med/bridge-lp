// In-app purchase (consumable coins) via RevenueCat — native (iOS/Android).
// Metro picks this over iap.ts on native. Requires `react-native-purchases`
// (install before an EAS build) and EXPO_PUBLIC_RC_* keys.

import { Platform } from 'react-native';
import Purchases from 'react-native-purchases';
import { env, features } from './env';

export function iapEnabled(): boolean {
  return features.revenuecat;
}

let configured = false;

export function configureIap(): void {
  if (configured || !iapEnabled()) return;
  const apiKey = Platform.OS === 'ios' ? env.revenuecatIosKey : env.revenuecatAndroidKey;
  if (!apiKey) return;
  try {
    Purchases.configure({ apiKey });
    configured = true;
  } catch {
    // leave unconfigured; callers fall back to the demo path
  }
}

/** Purchase a coin pack by product id. true on a confirmed purchase, false if
 *  cancelled / unavailable. Throws on a real error. */
export async function purchasePack(productId: string): Promise<boolean> {
  if (!iapEnabled()) return false;
  configureIap();
  const offerings = await Purchases.getOfferings();
  const pkgs = offerings?.current?.availablePackages ?? [];
  const pkg = pkgs.find(
    (p: { identifier: string; product?: { identifier: string } }) =>
      p.product?.identifier === productId || p.identifier === productId,
  );
  if (!pkg) throw new Error('この商品が見つかりませんでした。');
  try {
    await Purchases.purchasePackage(pkg);
    return true;
  } catch (e) {
    if ((e as { userCancelled?: boolean })?.userCancelled) return false;
    throw e;
  }
}

/** Restore previous purchases (Apple requires a restore affordance). */
export async function restorePurchases(): Promise<void> {
  if (!iapEnabled()) return;
  configureIap();
  await Purchases.restorePurchases();
}

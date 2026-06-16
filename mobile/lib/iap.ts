// In-app purchase — DEFAULT (web / Expo Go / preview) implementation: disabled,
// so the Coins screen uses the demo path. The real RevenueCat integration lives
// in iap.native.ts and is picked up automatically on iOS/Android builds.
//
// Production setup:
//   1. npm i react-native-purchases  (then an EAS dev/production build)
//   2. set EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY
//   3. create consumable products in RevenueCat matching COIN_PACKS ids

export function iapEnabled(): boolean {
  return false;
}

export function configureIap(): void {
  // no-op on web / preview
}

export async function purchasePack(_productId: string): Promise<boolean> {
  return false;
}

export async function restorePurchases(): Promise<void> {
  // no-op on web / preview
}

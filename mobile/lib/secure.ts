// Secure storage for secrets (user-provided AI API keys). Uses the OS keystore
// on native (iOS Keychain / Android Keystore) via expo-secure-store. SecureStore
// isn't available on web, so the web preview falls back to AsyncStorage.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const WEB = Platform.OS === 'web';
const WEB_PREFIX = 'bridge-secure:';

export async function secureGet(key: string): Promise<string | null> {
  if (WEB) return AsyncStorage.getItem(WEB_PREFIX + key);
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  if (WEB) {
    if (value) await AsyncStorage.setItem(WEB_PREFIX + key, value);
    else await AsyncStorage.removeItem(WEB_PREFIX + key);
    return;
  }
  try {
    if (value) await SecureStore.setItemAsync(key, value);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // keystore unavailable — silently skip (key just won't persist)
  }
}

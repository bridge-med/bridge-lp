// Persistence layer. Everything goes through `readCollection` / `writeCollection`
// so the backend can be swapped (AsyncStorage -> Supabase/REST) in one place.

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'bridge-daily:';

export async function readCollection<T>(name: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + name);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

export async function writeCollection<T>(name: string, items: T[]): Promise<void> {
  await AsyncStorage.setItem(PREFIX + name, JSON.stringify(items));
}

export async function clearCollection(name: string): Promise<void> {
  await AsyncStorage.removeItem(PREFIX + name);
}

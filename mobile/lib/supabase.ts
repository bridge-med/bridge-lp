// Supabase client — created only when EXPO_PUBLIC_SUPABASE_* env vars are set.
// Until then the app uses local AsyncStorage (see lib/storage.ts) and this
// returns null, so nothing depends on Supabase to run.
//
// Integration path (when ready):
//   1. Create a Supabase project, run supabase/schema.sql.
//   2. Put EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.
//   3. Add auth, then implement a SupabaseStorageAdapter in lib/storage.ts
//      (per-user rows keyed by user_id) — the only place that needs changing.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env, features } from './env';

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!features.supabase) return null;
  if (!client) {
    client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: false },
    });
  }
  return client;
}

export const isSupabaseEnabled = features.supabase;

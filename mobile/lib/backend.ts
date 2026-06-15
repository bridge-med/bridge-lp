// Client for the managed-AI backend (the developer's key lives server-side).
// Configured via EXPO_PUBLIC_AI_BACKEND_URL, or derived from the Supabase
// project's Edge Function (`/functions/v1/ai`). When unset, the app falls back
// to the offline previews in lib/ai.ts and lib/lang.ts.

import { env, features } from './env';

export class BackendError extends Error {}

function backendUrl(): string {
  if (env.aiBackendUrl) return env.aiBackendUrl;
  if (features.supabase) return `${env.supabaseUrl.replace(/\/$/, '')}/functions/v1/ai`;
  return '';
}

export function aiBackendEnabled(): boolean {
  return !!backendUrl();
}

/** POST { kind, input } to the backend and return its JSON body. */
export async function callBackend<T>(kind: string, input: unknown): Promise<T> {
  const url = backendUrl();
  if (!url) throw new BackendError('backend not configured');

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  // When hitting Supabase Edge Functions, the anon key authorizes the request.
  if (!env.aiBackendUrl && features.supabase) {
    headers.Authorization = `Bearer ${env.supabaseAnonKey}`;
    headers.apikey = env.supabaseAnonKey;
  }

  let res: Response;
  try {
    res = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ kind, input }) });
  } catch {
    throw new BackendError('ネットワークに接続できませんでした。');
  }
  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    throw new BackendError(`生成に失敗しました（${res.status}）。${raw.slice(0, 120)}`);
  }
  return res.json() as Promise<T>;
}

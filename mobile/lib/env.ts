// Centralized environment configuration.
//
// All values are optional — the app runs fully on local storage with no env.
// NOTE: Metro only inlines EXPO_PUBLIC_* vars when accessed as static property
// names (process.env.EXPO_PUBLIC_X), so they must be written out literally here.

function clean(v: string | undefined): string {
  return (v ?? '').trim();
}

export const env = {
  supabaseUrl: clean(process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: clean(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY),
  aiBackendUrl: clean(process.env.EXPO_PUBLIC_AI_BACKEND_URL),
  revenuecatIosKey: clean(process.env.EXPO_PUBLIC_RC_IOS_KEY),
  revenuecatAndroidKey: clean(process.env.EXPO_PUBLIC_RC_ANDROID_KEY),
  admobBannerIos: clean(process.env.EXPO_PUBLIC_ADMOB_BANNER_IOS),
  admobBannerAndroid: clean(process.env.EXPO_PUBLIC_ADMOB_BANNER_ANDROID),
} as const;

export const features = {
  supabase: !!(env.supabaseUrl && env.supabaseAnonKey),
  // The managed-AI backend: an explicit URL, or derived from Supabase functions.
  aiBackend: !!(env.aiBackendUrl || (env.supabaseUrl && env.supabaseAnonKey)),
  revenuecat: !!(env.revenuecatIosKey || env.revenuecatAndroidKey),
  ads: !!(env.admobBannerIos || env.admobBannerAndroid),
} as const;

// BRIDGE Focus — a calm, businesslike design language.
// Off-white or dark-navy canvas, charcoal/white ink, a single clean Gothic face,
// and quiet dusty-blue / mint accents. No bright reds, no cuteness, no game feel —
// something you can open every day without fatigue.

export type ThemeMode = 'light' | 'dark' | 'system';

export const lightColors = {
  bg: '#F6F7F9', // off-white
  surface: '#FFFFFF',
  surface2: '#EEF1F5',
  line: '#E5E8EE',
  line2: '#D6DBE3',
  text: '#23272F', // charcoal
  text2: '#586072',
  muted: '#929BAB',
  primary: '#5E80A8', // dusty blue
  primary2: '#7E9CBE',
  primaryWeak: '#E7EDF4',
  accent: '#54B0A0', // mint / soft green
  accentWeak: '#E1F0EC',
  good: '#54B0A0',
  warn: '#C29B61', // muted amber (used sparingly)
  warnWeak: '#F1EADC',
  danger: '#8A93A4', // 中断 stays low-key, not red
  dangerWeak: '#ECEEF2',
  spark: '#54B0A0',
  sparkWeak: '#E1F0EC',
  leaf: '#54B0A0',
  leafWeak: '#E1F0EC',
  gold: '#C29B61',
  onAccent: '#FFFFFF',
  white: '#FFFFFF',
} as const;

export type Colors = { [K in keyof typeof lightColors]: string };

export const darkColors: Colors = {
  bg: '#121620', // dark navy
  surface: '#1A1F2B',
  surface2: '#222A38',
  line: '#2A3340',
  line2: '#39455A',
  text: '#ECEFF4',
  text2: '#AEB7C5',
  muted: '#7E8896',
  primary: '#83A8CF',
  primary2: '#6C92BD',
  primaryWeak: '#21303F',
  accent: '#5FC2AE',
  accentWeak: '#1E3531',
  good: '#5FC2AE',
  warn: '#D2A86A',
  warnWeak: '#2E2A20',
  danger: '#9AA3B2',
  dangerWeak: '#262C38',
  spark: '#5FC2AE',
  sparkWeak: '#1E3531',
  leaf: '#5FC2AE',
  leafWeak: '#1E3531',
  gold: '#D2A86A',
  onAccent: '#0E1218',
  white: '#FFFFFF',
};

// Default (static) palette for any StyleSheet that doesn't read the live theme.
export const colors: Colors = lightColors;

export function palette(mode: 'light' | 'dark'): Colors {
  return mode === 'dark' ? darkColors : lightColors;
}

// A single, clean Gothic face across the app — businesslike, not cute.
// Loaded by expo-font in app/_layout.tsx.
export const fonts = {
  // headings / numbers
  maru: 'ZenKakuGothicNew_700Bold',
  maruMed: 'ZenKakuGothicNew_500Medium',
  maruReg: 'ZenKakuGothicNew_400Regular',
  maruBlack: 'ZenKakuGothicNew_700Bold',
  // body / ui
  gothic: 'ZenKakuGothicNew_400Regular',
  gothicMed: 'ZenKakuGothicNew_500Medium',
  gothicBold: 'ZenKakuGothicNew_700Bold',
} as const;

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const shadow = {
  card: { shadowColor: '#1A2330', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
} as const;

// Type scale. Colours here are light-mode defaults; screens override with useColors().
export const type = {
  display: { fontFamily: fonts.maruBlack, fontSize: 40, color: colors.text },
  h1: { fontFamily: fonts.maru, fontSize: 24, color: colors.text },
  h2: { fontFamily: fonts.maru, fontSize: 18, color: colors.text },
  title: { fontFamily: fonts.maru, fontSize: 16, color: colors.text },
  body: { fontFamily: fonts.gothic, fontSize: 15, color: colors.text, lineHeight: 23 },
  bodyMed: { fontFamily: fonts.gothicMed, fontSize: 15, color: colors.text, lineHeight: 23 },
  label: { fontFamily: fonts.gothicBold, fontSize: 11, letterSpacing: 1.5, color: colors.muted },
  muted: { fontFamily: fonts.gothic, fontSize: 13, color: colors.muted, lineHeight: 19 },
  num: { fontFamily: fonts.maru, color: colors.text },
} as const;

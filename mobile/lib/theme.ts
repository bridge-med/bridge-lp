// BRIDGE Worklog — "Editorial Ledger" design language.
// Warm paper canvas, ink text, a Mincho display face for dates/numerals, a
// modern Gothic for UI, hairline rules over heavy boxes, and a single
// restrained accent drawn from traditional Japanese colours.

export const colors = {
  bg: '#F4F1E9', // washi paper
  surface: '#FCFBF7',
  surface2: '#EDE9DD',
  line: '#E4DFD2',
  line2: '#D7D0C0',
  text: '#23262E', // sumi ink
  text2: '#57544B',
  muted: '#8C8678',
  primary: '#34506E',
  primary2: '#476989',
  primaryWeak: '#E2E5E6',
  accent: '#4F6A3F', // moss — success/forward
  accentWeak: '#E6EBDD',
  good: '#4F6A3F',
  warn: '#9C6510',
  warnWeak: '#F1E7D3',
  danger: '#A2402F',
  dangerWeak: '#EFE0DA',
  white: '#FFFFFF',
} as const;

export type Colors = { [K in keyof typeof colors]: string };

// Loaded by expo-font in app/_layout.tsx. Weights are separate families.
export const fonts = {
  mincho: 'ShipporiMincho_800ExtraBold',
  minchoSemi: 'ShipporiMincho_600SemiBold',
  minchoReg: 'ShipporiMincho_400Regular',
  gothic: 'ZenKakuGothicNew_400Regular',
  gothicMed: 'ZenKakuGothicNew_500Medium',
  gothicBold: 'ZenKakuGothicNew_700Bold',
} as const;

// Accent themes named after traditional Japanese colours. Neutrals stay warm.
export type AccentKey = 'ai' | 'shu' | 'koke' | 'kon' | 'budo';

export const ACCENTS: Record<AccentKey, { label: string; primary: string; primary2: string; primaryWeak: string }> = {
  ai: { label: '藍', primary: '#34506E', primary2: '#476989', primaryWeak: '#E1E5E8' },
  shu: { label: '朱', primary: '#B0573C', primary2: '#C26A4C', primaryWeak: '#F0E3D9' },
  koke: { label: '苔', primary: '#4F6A3F', primary2: '#637F52', primaryWeak: '#E6ECDD' },
  kon: { label: '紺', primary: '#2C3A5A', primary2: '#43527A', primaryWeak: '#E0E2E9' },
  budo: { label: '葡萄', primary: '#6E3F5E', primary2: '#895778', primaryWeak: '#EBE0E8' },
};

export function paletteFor(accent: AccentKey): Colors {
  const a = ACCENTS[accent] ?? ACCENTS.ai;
  return { ...colors, primary: a.primary, primary2: a.primary2, primaryWeak: a.primaryWeak };
}

export const radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const shadow = {
  card: { shadowColor: '#3A3320', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
} as const;

// Type scale. Families carry weight (custom fonts ignore fontWeight on Android).
export const type = {
  display: { fontFamily: fonts.mincho, fontSize: 44, color: colors.text },
  h1: { fontFamily: fonts.gothicBold, fontSize: 23, color: colors.text },
  h2: { fontFamily: fonts.gothicBold, fontSize: 17, color: colors.text },
  title: { fontFamily: fonts.gothicBold, fontSize: 16, color: colors.text },
  body: { fontFamily: fonts.gothic, fontSize: 15, color: colors.text, lineHeight: 23 },
  bodyMed: { fontFamily: fonts.gothicMed, fontSize: 15, color: colors.text, lineHeight: 23 },
  label: { fontFamily: fonts.gothicBold, fontSize: 11, letterSpacing: 2, color: colors.muted },
  muted: { fontFamily: fonts.gothic, fontSize: 13, color: colors.muted, lineHeight: 19 },
  num: { fontFamily: fonts.minchoSemi, color: colors.text },
} as const;

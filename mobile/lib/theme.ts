// BRIDGE Worklog — "Warm Companion" design language.
// A warm cream canvas, soft brown ink, rounded Maru-Gothic display type and a
// readable Gothic for body. Friendly amber/leaf/coral accents, generous radii,
// and a growing companion ("相棒") at the heart of the experience.

export const colors = {
  bg: '#FBF3E8', // warm cream
  surface: '#FFFDF8',
  surface2: '#F3EBDD',
  line: '#EADDC9',
  line2: '#DCCDB4',
  text: '#3B3026', // warm dark brown
  text2: '#6B5D4A',
  muted: '#9A8A74',
  primary: '#E8833C', // amber — primary CTA / accent
  primary2: '#EF9A5C',
  primaryWeak: '#FBE6D2',
  accent: '#6FA86A', // leaf — growth / success
  accentWeak: '#E2EFDC',
  good: '#6FA86A',
  warn: '#C98A2E',
  warnWeak: '#F6E8CF',
  danger: '#C2553C',
  dangerWeak: '#F3DED6',
  spark: '#E8654E', // coral — celebrate / key figures
  sparkWeak: '#F7DDD4',
  leaf: '#6FA86A',
  leafWeak: '#E2EFDC',
  gold: '#E0A640', // coins / rewards
  onAccent: '#FFFDF8', // text/figures on a deep accent block
  white: '#FFFFFF',
} as const;

export type Colors = { [K in keyof typeof colors]: string };

// Loaded by expo-font in app/_layout.tsx. Weights are separate families.
export const fonts = {
  // Rounded display face — friendly headings, dates, big numbers.
  maru: 'ZenMaruGothic_700Bold',
  maruMed: 'ZenMaruGothic_500Medium',
  maruReg: 'ZenMaruGothic_400Regular',
  maruBlack: 'ZenMaruGothic_900Black',
  // Readable UI/body face.
  gothic: 'ZenKakuGothicNew_400Regular',
  gothicMed: 'ZenKakuGothicNew_500Medium',
  gothicBold: 'ZenKakuGothicNew_700Bold',
  // Kept available for special editorial moments.
  mincho: 'ShipporiMincho_800ExtraBold',
  minchoSemi: 'ShipporiMincho_600SemiBold',
  minchoReg: 'ShipporiMincho_400Regular',
} as const;

// Accent themes — a warm family. Neutrals stay warm.
export type AccentKey = 'ai' | 'shu' | 'koke' | 'kon' | 'budo';

export const ACCENTS: Record<AccentKey, { label: string; primary: string; primary2: string; primaryWeak: string }> = {
  ai: { label: '杏', primary: '#E8833C', primary2: '#EF9A5C', primaryWeak: '#FBE6D2' }, // apricot (default)
  shu: { label: '珊瑚', primary: '#E8654E', primary2: '#ED7E6B', primaryWeak: '#F7DDD4' }, // coral
  koke: { label: '若葉', primary: '#6FA86A', primary2: '#84B87F', primaryWeak: '#E2EFDC' }, // leaf
  kon: { label: '空', primary: '#5B83A6', primary2: '#739BBD', primaryWeak: '#E1E9F0' }, // soft sky
  budo: { label: '葡萄', primary: '#9A6A86', primary2: '#B0829C', primaryWeak: '#EFE3EB' }, // warm plum
};

export function paletteFor(accent: AccentKey): Colors {
  const a = ACCENTS[accent] ?? ACCENTS.ai;
  return { ...colors, primary: a.primary, primary2: a.primary2, primaryWeak: a.primaryWeak };
}

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, pill: 999 } as const;
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

export const shadow = {
  card: { shadowColor: '#7A5A2E', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
} as const;

// Type scale. Families carry weight (custom fonts ignore fontWeight on Android).
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

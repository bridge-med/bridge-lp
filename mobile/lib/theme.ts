// BRIDGE Daily — design tokens.
// Palette mirrors the web product (worklog/app/styles.css): white surfaces,
// blue-grey text, a calm blue primary and supporting status colours.

export const colors = {
  bg: '#eef2f6',
  surface: '#ffffff',
  surface2: '#f7fafc',
  line: '#e2e8f0',
  line2: '#cdd8e3',
  text: '#14293d',
  text2: '#3b5168',
  muted: '#6b7d90',
  primary: '#1f5e8c',
  primary2: '#2b78b3',
  primaryWeak: '#e8f1f8',
  accent: '#0e9f6e',
  accentWeak: '#e6f6ef',
  good: '#0e7c54',
  warn: '#b45309',
  warnWeak: '#fdf2e3',
  danger: '#b91c1c',
  dangerWeak: '#fdeaea',
  white: '#ffffff',
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
} as const;

export const shadow = {
  card: {
    shadowColor: '#14293d',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
} as const;

export const type = {
  h1: { fontSize: 26, fontWeight: '700' as const, color: colors.text },
  h2: { fontSize: 18, fontWeight: '700' as const, color: colors.text },
  body: { fontSize: 15, color: colors.text, lineHeight: 22 },
  label: { fontSize: 13, fontWeight: '600' as const, color: colors.text2 },
  muted: { fontSize: 13, color: colors.muted },
} as const;

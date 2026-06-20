// Provides the active colour palette (light or dark) to the tree. Screens read
// colours via useColors() so toggling the theme updates the whole app live.

import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { usePrefs } from '../lib/prefs';
import { lightColors, palette, type Colors } from '../lib/theme';

const ThemeContext = createContext<{ colors: Colors; isDark: boolean }>({ colors: lightColors, isDark: false });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { theme } = usePrefs();
  const system = useColorScheme();
  const isDark = theme === 'dark' || (theme === 'system' && system === 'dark');
  const value = useMemo(() => ({ colors: palette(isDark ? 'dark' : 'light'), isDark }), [isDark]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useColors(): Colors {
  return useContext(ThemeContext).colors;
}

export function useIsDark(): boolean {
  return useContext(ThemeContext).isDark;
}

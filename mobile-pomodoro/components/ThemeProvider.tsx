// Provides the active colour palette (neutrals + selected accent) to the tree.
// Screens/components read accent colours via useColors() so the Pro theme
// picker updates the whole app live.

import React, { createContext, useContext, useMemo } from 'react';
import { usePrefs } from '../lib/prefs';
import { colors as base, paletteFor, type Colors } from '../lib/theme';

const ThemeContext = createContext<Colors>(base);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { accent } = usePrefs();
  const value = useMemo(() => paletteFor(accent), [accent]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useColors(): Colors {
  return useContext(ThemeContext);
}

import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { THEMES, ThemeColors, ThemeKey } from '../theme';

interface ThemeContextType {
  C: ThemeColors;
  themeKey: ThemeKey;
  setTheme: (key: ThemeKey) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  C: THEMES.emerald,
  themeKey: 'emerald',
  setTheme: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [themeKey, setThemeKey] = useState<ThemeKey>('emerald');

  useEffect(() => {
    SecureStore.getItemAsync('app_theme').then(stored => {
      if (stored && stored in THEMES) setThemeKey(stored as ThemeKey);
    }).catch(() => {});
  }, []);

  const setTheme = (key: ThemeKey) => {
    setThemeKey(key);
    SecureStore.setItemAsync('app_theme', key).catch(() => {});
  };

  const C = useMemo(() => THEMES[themeKey], [themeKey]);

  return (
    <ThemeContext.Provider value={{ C, themeKey, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

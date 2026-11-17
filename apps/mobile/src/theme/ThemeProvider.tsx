import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useAppStore } from '@/stores/app-store';
import { palettes, type ColorScheme, type Palette, type ThemeMode } from './tokens';

export interface Theme {
  mode: ThemeMode;
  scheme: ColorScheme;
  isDark: boolean;
  colors: Palette;
}

const defaultTheme: Theme = { mode: 'dark', scheme: 'dark', isDark: true, colors: palettes.dark };

const ThemeContext = createContext<Theme>(defaultTheme);

export function resolveScheme(
  mode: ThemeMode,
  system: ColorScheme | null | undefined,
): ColorScheme {
  if (mode === 'system') return system === 'light' ? 'light' : 'dark';
  return mode;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useAppStore((s) => s.themeMode);
  const system = useColorScheme();

  const value = useMemo<Theme>(() => {
    const scheme = resolveScheme(mode, system);
    return { mode, scheme, isDark: scheme === 'dark', colors: palettes[scheme] };
  }, [mode, system]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}

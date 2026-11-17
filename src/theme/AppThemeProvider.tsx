import { useMemo, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import { useStore } from '@/store';
import { buildTheme } from './theme';

/** Builds the MUI theme from settings (light/dark/system, density, reduced motion). */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const themeMode = useStore((s) => s.settings.themeMode);
  const density = useStore((s) => s.settings.density);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', { noSsr: true });
  const jungle = themeMode === 'jungle';
  const mode = jungle ? 'dark' : themeMode === 'system' ? (prefersDark ? 'dark' : 'light') : themeMode;
  const theme = useMemo(() => buildTheme(mode, density, reducedMotion, jungle ? 'jungle' : 'classic'), [mode, density, reducedMotion, jungle]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}

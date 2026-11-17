import { useMemo, type ReactNode } from 'react';
import { CssBaseline, ThemeProvider, useMediaQuery } from '@mui/material';
import { useStore } from '@/store';
import { buildTheme } from './theme';
import { sceneOf } from './scenes';

/** Builds the MUI theme from settings (light/dark/system, density, reduced motion). */
export function AppThemeProvider({ children }: { children: ReactNode }) {
  const themeMode = useStore((s) => s.settings.themeMode);
  const density = useStore((s) => s.settings.density);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)', { noSsr: true });
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)', { noSsr: true });
  const scene = sceneOf(themeMode);
  const mode = scene ? scene.mode : themeMode === 'system' ? (prefersDark ? 'dark' : 'light') : themeMode === 'light' ? 'light' : 'dark';
  const theme = useMemo(() => buildTheme(mode, density, reducedMotion, scene?.id ?? null), [mode, density, reducedMotion, scene]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      {children}
    </ThemeProvider>
  );
}

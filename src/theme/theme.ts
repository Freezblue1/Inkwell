/**
 * Inkwell MUI theme: Material UI look (MUI for Figma v9) with an ink-blue
 * primary, warm amber secondary, light/dark modes and two densities.
 */
import { alpha, createTheme, type Theme } from '@mui/material/styles';
import type { Density } from '@/types/models';
import { SCENES, type SceneId, type SceneSpec } from './scenes';

declare module '@mui/material/styles' {
  interface Theme {
    inkwell: {
      density: Density;
      /** The illustrated theme in use (jungle, ocean…), or null for light/dark. */
      scene: SceneId | null;
      /** Navigation rail background for illustrated themes. */
      rail: string | null;
      /** Whiteboard canvas colour for illustrated themes. */
      board: string | null;
      paper: { sepiaBg: string; sepiaText: string; pageBg: string; pageText: string; deskBg: string };
    };
  }
  interface ThemeOptions {
    inkwell?: Theme['inkwell'];
  }
}

export function buildTheme(mode: 'light' | 'dark', density: Density, reducedMotion: boolean, scene: SceneId | null = null): Theme {
  if (scene && SCENES[scene]) return buildSceneTheme(SCENES[scene], density, reducedMotion);
  const dark = mode === 'dark';
  const compact = density === 'compact';

  const base = createTheme({
    palette: {
      mode,
      primary: dark
        ? { main: '#9fa8da', light: '#c5cae9', dark: '#7986cb', contrastText: '#0d1033' }
        : { main: '#283593', light: '#5f5fc4', dark: '#001064', contrastText: '#ffffff' },
      secondary: dark
        ? { main: '#ffca28', light: '#fff350', dark: '#c79a00', contrastText: '#241a00' }
        : { main: '#b26a00', light: '#ffa726', dark: '#7a4800', contrastText: '#ffffff' },
      background: dark ? { default: '#121318', paper: '#1b1c23' } : { default: '#f7f7fb', paper: '#ffffff' },
      text: dark
        ? { primary: '#e6e6ef', secondary: '#b4b6c6', disabled: '#7c7e8e' }
        : { primary: '#1b1b21', secondary: '#4a4b57', disabled: '#9a9aa6' },
      divider: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
      success: { main: dark ? '#81c784' : '#2e7d32' },
      warning: { main: dark ? '#ffb74d' : '#b45309' },
      error: { main: dark ? '#ef9a9a' : '#c62828' },
    },
    shape: { borderRadius: 8 },
    spacing: 8,
    typography: {
      fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
      fontSize: compact ? 13 : 14,
      button: { textTransform: 'none', fontWeight: 500, letterSpacing: 0.1 },
      h1: { fontSize: '2.25rem', fontWeight: 400 },
      h2: { fontSize: '1.875rem', fontWeight: 400 },
      h3: { fontSize: '1.5rem', fontWeight: 400 },
      h4: { fontSize: '1.375rem', fontWeight: 500 },
      h5: { fontSize: '1.125rem', fontWeight: 500 },
      h6: { fontSize: '1rem', fontWeight: 500 },
      overline: { letterSpacing: 1, fontWeight: 500 },
    },
    inkwell: {
      density,
      scene: null,
      rail: null,
      board: null,
      paper: {
        sepiaBg: '#f4ecd8',
        sepiaText: '#433422',
        pageBg: dark ? '#1f2029' : '#ffffff',
        pageText: dark ? '#e6e6ef' : '#1b1b21',
        deskBg: dark ? '#15161c' : '#eeeef4',
      },
    },
  });

  return createTheme(base, {
    transitions: reducedMotion ? { create: () => 'none' } : {},
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          html: { height: '100%' },
          body: { height: '100%', overflow: 'hidden' },
          '#root': { height: '100%' },
          '*:focus-visible': { outline: `2px solid ${base.palette.primary.main}`, outlineOffset: 2 },
          '::selection': { background: alpha(base.palette.primary.main, 0.3) },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              animationDuration: '0.01ms !important',
              transitionDuration: '0.01ms !important',
              scrollBehavior: 'auto !important',
            },
          },
          '.visually-hidden': {
            position: 'absolute',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
          },
        },
      },
      MuiButtonBase: { defaultProps: { disableRipple: reducedMotion } },
      MuiButton: {
        defaultProps: { size: compact ? 'small' : 'medium', disableElevation: true },
        styleOverrides: { root: { borderRadius: 20, paddingInline: 16 } },
      },
      MuiIconButton: { defaultProps: { size: compact ? 'small' : 'medium' } },
      MuiTextField: { defaultProps: { size: compact ? 'small' : 'small', variant: 'outlined' } },
      MuiSelect: { defaultProps: { size: 'small' } },
      MuiList: { defaultProps: { dense: compact } },
      MuiListItemButton: { styleOverrides: { root: { borderRadius: 8 } } },
      MuiMenuItem: { defaultProps: { dense: compact } },
      MuiToolbar: { defaultProps: { variant: compact ? 'dense' : 'regular' } },
      MuiTooltip: { defaultProps: { arrow: true, enterDelay: 400 } },
      MuiPaper: { styleOverrides: { rounded: { borderRadius: 12 } } },
      MuiCard: { defaultProps: { variant: 'outlined' }, styleOverrides: { root: { borderRadius: 12 } } },
      MuiDialog: { styleOverrides: { paper: { borderRadius: 16 } } },
      MuiChip: { styleOverrides: { root: { borderRadius: 8, fontWeight: 500 } } },
      MuiTab: { styleOverrides: { root: { textTransform: 'none', minHeight: compact ? 40 : 48 } } },
      MuiTabs: { styleOverrides: { root: { minHeight: compact ? 40 : 48 } } },
      MuiAppBar: { defaultProps: { elevation: 0, color: 'default' } },
      MuiDrawer: { styleOverrides: { paper: { backgroundImage: 'none' } } },
      MuiLinearProgress: { styleOverrides: { root: { borderRadius: 4 } } },
      MuiTableCell: { styleOverrides: { root: { paddingBlock: compact ? 4 : 8 } } },
    },
  });
}

/**
 * Illustrated themes (Jungle, Ocean, Space, Cozy Library, Sakura): a full
 * look built from a SceneSpec: palette, heading font, textured app bar,
 * rail and background, themed dialogs and buttons. Animated decorations are
 * drawn by <SceneDecor/> (features/shell/decor).
 */
function buildSceneTheme(s: SceneSpec, density: Density, reducedMotion: boolean): Theme {
  const base = buildTheme(s.mode, density, reducedMotion);
  const heading = { fontFamily: s.displayFont, fontWeight: s.headingWeight, letterSpacing: 0.3 };
  const tint = (a: number) => `rgba(${s.tint}, ${a})`;
  return createTheme(base, {
    palette: {
      primary: s.primary,
      secondary: s.secondary,
      background: { default: s.bg, paper: s.paper },
      text: s.text,
      divider: s.divider,
      action: { hover: tint(0.09), selected: tint(0.18), focus: tint(0.22) },
    },
    typography: { h1: heading, h2: heading, h3: heading, h4: heading, h5: heading },
    inkwell: {
      density,
      scene: s.id,
      rail: s.rail,
      board: s.board,
      paper: { ...s.page, deskBg: 'transparent' },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { background: s.body, backgroundAttachment: 'fixed' },
          '*': { scrollbarColor: `${s.scrollbar} transparent` },
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-thumb': { background: s.scrollbar, borderRadius: 8, border: '2px solid transparent', backgroundClip: 'padding-box' },
          '::selection': { background: s.selection },
        },
      },
      MuiAppBar: { styleOverrides: { root: { background: s.appBar, borderBottomColor: tint(0.25) } } },
      MuiPaper: { styleOverrides: { root: { backgroundImage: `linear-gradient(165deg, ${tint(0.06)}, transparent 45%)` } } },
      MuiCard: { styleOverrides: { root: { borderRadius: 14, borderColor: tint(0.22) } } },
      MuiDialog: { styleOverrides: { paper: { border: `1px solid ${tint(0.28)}`, background: s.dialog } } },
      MuiButton: {
        styleOverrides: {
          containedPrimary: {
            backgroundImage: `linear-gradient(180deg, ${s.button.from} 0%, ${s.button.to} 100%)`,
            color: s.button.text,
            boxShadow: 'inset 0 -2px 0 rgba(0,0,0,0.18)',
            '&:hover': { backgroundImage: `linear-gradient(180deg, ${s.button.from} 0%, ${s.button.from} 100%)` },
          },
        },
      },
      MuiTabs: { styleOverrides: { indicator: { backgroundColor: s.tabIndicator, height: 3, borderRadius: 3 } } },
      MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: s.tooltip, color: '#fff', border: `1px solid ${tint(0.3)}` }, arrow: { color: s.tooltip } } },
      MuiChip: { styleOverrides: { outlined: { borderColor: tint(0.35) } } },
    },
  });
}

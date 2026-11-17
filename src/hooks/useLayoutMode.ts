import { useMediaQuery, useTheme } from '@mui/material';

export type LayoutMode = 'desktop' | 'tablet' | 'mobile';

/** Desktop ≥ 1200px (three panes), tablet ≥ 600px (drawers), mobile below. */
export function useLayoutMode(): LayoutMode {
  const theme = useTheme();
  const desktop = useMediaQuery(theme.breakpoints.up('lg'), { noSsr: true });
  const tablet = useMediaQuery(theme.breakpoints.up('sm'), { noSsr: true });
  return desktop ? 'desktop' : tablet ? 'tablet' : 'mobile';
}

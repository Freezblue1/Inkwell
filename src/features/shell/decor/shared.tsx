/** Helpers shared by the illustrated-theme decorations. */
import type { ReactNode } from 'react';
import { Box, GlobalStyles, useMediaQuery } from '@mui/material';

/** Deterministic pseudo-random numbers so decorations look the same every render. */
export function rand(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function useDecorEnv() {
  const mobile = useMediaQuery('(max-width:599px)');
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  return { mobile, reduced };
}

/**
 * Full-window, click-through, screen-reader-hidden layer above the app.
 * With reduced motion every animation inside it is stopped.
 */
export function DecorLayer({ keyframes, reduced, children }: { keyframes: Record<string, Record<string, Record<string, string | number>>>; reduced: boolean; children: ReactNode }) {
  return (
    <Box
      aria-hidden
      data-decor
      sx={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 1150,
        overflow: 'hidden',
        ...(reduced && { '& *': { animation: 'none !important' } }),
      }}
    >
      <GlobalStyles styles={keyframes} />
      {children}
    </Box>
  );
}

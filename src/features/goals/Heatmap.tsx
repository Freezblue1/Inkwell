import { useMemo } from 'react';
import { Box, Stack, Tooltip, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { WritingSession } from '@/types/models';
import { addDays, dayKey, parseDayKey } from '@/lib/dates';
import { heatLevel } from '@/lib/goals';

const CELL = 12;
const GAP = 3;

/** GitHub-style calendar heatmap of daily net words (single-hue sequential scale). */
export function Heatmap({ sessions, weeks = 26, goal }: { sessions: WritingSession[]; weeks?: number; goal: number }) {
  const theme = useTheme();
  const byDate = useMemo(() => new Map(sessions.map((s) => [s.date, s.net])), [sessions]);
  const today = parseDayKey(dayKey());
  // Start on the Sunday `weeks` weeks ago.
  const start = addDays(today, -(weeks * 7 - 1) - today.getDay());
  const levels = [0.08, 0.3, 0.5, 0.72, 1];
  const color = (lvl: number) => (lvl === 0 ? alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.08 : 0.06) : alpha(theme.palette.primary.main, levels[lvl]));

  const columns: { key: string; words: number; date: Date }[][] = [];
  for (let d = new Date(start), i = 0; d <= today; d = addDays(d, 1), i++) {
    const col = Math.floor(i / 7);
    (columns[col] ??= []).push({ key: dayKey(d), words: Math.max(0, byDate.get(dayKey(d)) ?? 0), date: new Date(d) });
  }

  return (
    <Box>
      <Box sx={{ overflowX: 'auto', pb: 1 }}>
        <Box role="grid" aria-label="Daily words heatmap" sx={{ display: 'flex', gap: `${GAP}px`, width: 'max-content' }}>
          {columns.map((col, ci) => (
            <Box key={ci} role="row" sx={{ display: 'flex', flexDirection: 'column', gap: `${GAP}px` }}>
              {col.map((cell) => {
                const lvl = heatLevel(cell.words, goal);
                const label = `${cell.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}: ${cell.words.toLocaleString()} words`;
                return (
                  <Tooltip key={cell.key} title={label} disableInteractive>
                    <Box role="gridcell" aria-label={label} tabIndex={-1} sx={{ width: CELL, height: CELL, borderRadius: '3px', bgcolor: color(lvl) }} />
                  </Tooltip>
                );
              })}
            </Box>
          ))}
        </Box>
      </Box>
      <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end">
        <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
          Less
        </Typography>
        {[0, 1, 2, 3, 4].map((l) => (
          <Box key={l} sx={{ width: CELL, height: CELL, borderRadius: '3px', bgcolor: color(l) }} aria-hidden />
        ))}
        <Typography variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
          More
        </Typography>
      </Stack>
    </Box>
  );
}

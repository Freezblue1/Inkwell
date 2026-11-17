/** Recharts charts for the Goals view (lazy-loaded with the view). */
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Box, Paper, Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { CumulativePoint, DayPoint } from '@/lib/goals';

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number | null; color: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <Paper elevation={4} sx={{ px: 1.5, py: 1 }}>
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      {payload
        .filter((p) => p.value !== null && p.value !== undefined)
        .map((p) => (
          <Box key={p.name} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ width: 10, height: 3, bgcolor: p.color, borderRadius: 1 }} />
            <Typography variant="body2">
              {p.name}: <strong>{Number(p.value).toLocaleString()}</strong>
            </Typography>
          </Box>
        ))}
    </Paper>
  );
}

function useAxisStyle() {
  const t = useTheme();
  return {
    tick: { fill: t.palette.text.secondary, fontSize: 11 },
    grid: t.palette.divider,
    axisLine: { stroke: t.palette.divider },
  };
}

/** Words written per day (single series → no legend; target as dashed reference). */
export function WordsPerDayChart({ data, dailyTarget }: { data: DayPoint[]; dailyTarget: number }) {
  const t = useTheme();
  const ax = useAxisStyle();
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 16, right: 8, left: -8, bottom: 0 }} barCategoryGap={2}>
        <CartesianGrid vertical={false} stroke={ax.grid} strokeDasharray="0" />
        <XAxis dataKey="label" tick={ax.tick} axisLine={ax.axisLine} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={ax.tick} axisLine={false} tickLine={false} width={48} allowDecimals={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: t.palette.action.hover }} />
        <Bar dataKey="words" name="Words" fill={t.palette.primary.main} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
        {dailyTarget > 0 && (
          <ReferenceLine
            y={dailyTarget}
            stroke={t.palette.text.secondary}
            strokeDasharray="5 4"
            strokeWidth={1.5}
            label={{ value: `Daily target ${dailyTarget.toLocaleString()}`, position: 'insideTopRight', fill: t.palette.text.secondary, fontSize: 11 }}
          />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Cumulative words vs. the straight-line path to the target. */
export function CumulativeChart({ data, target }: { data: CumulativePoint[]; target: number }) {
  const t = useTheme();
  const ax = useAxisStyle();
  const hasTarget = data.some((d) => d.target !== null);
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 16, right: 16, left: -8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke={ax.grid} />
        <XAxis dataKey="label" tick={ax.tick} axisLine={ax.axisLine} tickLine={false} interval="preserveStartEnd" minTickGap={32} />
        <YAxis tick={ax.tick} axisLine={false} tickLine={false} width={56} tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} />
        <Tooltip content={<ChartTooltip />} />
        <Legend verticalAlign="top" align="right" height={28} iconType="plainline" wrapperStyle={{ fontSize: 12, color: t.palette.text.secondary }} />
        {hasTarget && <Line type="linear" dataKey="target" name="Target pace" stroke={t.palette.text.secondary} strokeDasharray="6 5" strokeWidth={2} dot={false} isAnimationActive={false} />}
        <Line type="monotone" dataKey="actual" name="Manuscript words" stroke={t.palette.primary.main} strokeWidth={2} dot={false} activeDot={{ r: 5, stroke: t.palette.background.paper, strokeWidth: 2 }} connectNulls isAnimationActive={false} />
        {target > 0 && <ReferenceLine y={target} stroke={t.palette.secondary.main} strokeWidth={1} label={{ value: `Goal ${target.toLocaleString()}`, position: 'insideTopLeft', fill: t.palette.text.secondary, fontSize: 11 }} />}
      </LineChart>
    </ResponsiveContainer>
  );
}

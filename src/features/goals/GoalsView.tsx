import { useMemo, useState, type ReactNode } from 'react';
import {
  Box,
  Card,
  CardContent,
  InputBase,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import LocalFireDepartmentIcon from '@mui/icons-material/LocalFireDepartmentOutlined';
import { useStore } from '@/store';
import { manuscriptSequence, manuscriptWordCount, aggregateWordCounts } from '@/lib/tree';
import { computeStreaks, cumulativeSeries, dailySeries, dailyTarget } from '@/lib/goals';
import { dayKey } from '@/lib/dates';
import { Heatmap } from './Heatmap';
import { CumulativeChart, WordsPerDayChart } from './GoalCharts';
import { SprintTimer } from './SprintTimer';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function Section({ title, children, action, span = 1 }: { title: string; children: ReactNode; action?: ReactNode; span?: 1 | 2 }) {
  return (
    <Card component="section" aria-label={title} sx={{ gridColumn: { md: `span ${span}` } }}>
      <CardContent>
        <Stack direction="row" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h6" component="h3" sx={{ flex: 1 }}>
            {title}
          </Typography>
          {action}
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

/** Writing goals: target & deadline, daily target, sprints, streaks, heatmap, charts and chapter targets. */
export default function GoalsView() {
  const goal = useStore((s) => s.goal);
  const sessions = useStore((s) => s.sessions);
  const docs = useStore((s) => s.docs);
  const updateGoal = useStore((s) => s.updateGoal);
  const [targetText, setTargetText] = useState(goal ? String(goal.targetWords) : '');

  const total = manuscriptWordCount(docs);
  const today = sessions.find((s) => s.date === dayKey())?.net ?? 0;
  const daily = useMemo(
    () => (goal ? dailyTarget({ targetWords: goal.targetWords, currentWords: total, deadline: goal.deadline, writingDays: goal.writingDays, writtenToday: today }) : null),
    [goal, total, today],
  );
  const streaks = useMemo(() => computeStreaks(sessions, new Date(), goal?.writingDays), [sessions, goal?.writingDays]);
  const perDay = useMemo(() => dailySeries(sessions, 30), [sessions]);
  const cumulative = useMemo(() => (goal ? cumulativeSeries(sessions, total, goal.targetWords, goal.deadline) : []), [sessions, total, goal]);
  const chapters = useMemo(() => manuscriptSequence(docs).filter((d) => d.type === 'chapter'), [docs]);
  const totals = aggregateWordCounts(docs);

  if (!goal || !daily) return null;
  const pct = goal.targetWords ? Math.min(100, (total / goal.targetWords) * 100) : 0;
  const todayGoal = daily.perDay || goal.sessionTarget;
  const todayPct = todayGoal ? Math.min(100, (Math.max(0, today) / todayGoal) * 100) : 0;
  const isWritingDay = goal.writingDays.includes(new Date().getDay());

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, overflow: 'auto', height: '100%' }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Goals
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
        <Section title="Project target">
          <Stack spacing={2}>
            <Box>
              <Stack direction="row" alignItems="baseline" spacing={1}>
                <Typography variant="h4" component="p">
                  {total.toLocaleString()}
                </Typography>
                <Typography color="text.secondary">of {goal.targetWords.toLocaleString()} words</Typography>
              </Stack>
              <LinearProgress variant="determinate" value={pct} color="secondary" sx={{ height: 8, mt: 1 }} aria-label="Project progress" />
              <Typography variant="caption" color="text.secondary">
                {Math.round(pct)}% · {daily.remaining.toLocaleString()} words to go
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <TextField
                label="Target words"
                value={targetText}
                inputMode="numeric"
                onChange={(e) => setTargetText(e.target.value.replace(/\D/g, ''))}
                onBlur={() => {
                  const n = parseInt(targetText, 10);
                  if (n > 0) void updateGoal({ targetWords: n });
                  else setTargetText(String(goal.targetWords));
                }}
              />
              <TextField
                label="Deadline"
                type="date"
                value={goal.deadline ?? ''}
                onChange={(e) => void updateGoal({ deadline: e.target.value || null })}
                InputLabelProps={{ shrink: true }}
              />
            </Stack>
            <Box>
              <Typography variant="body2" gutterBottom id="writing-days-label">
                Days I write
              </Typography>
              <ToggleButtonGroup
                size="small"
                value={goal.writingDays}
                onChange={(_, v: number[]) => v.length && void updateGoal({ writingDays: v.sort() })}
                aria-labelledby="writing-days-label"
              >
                {DAYS.map((d, i) => (
                  <ToggleButton key={i} value={i} aria-label={DAY_NAMES[i]} sx={{ width: 40 }}>
                    {d}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>
            </Box>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
              {goal.deadline ? (
                daily.overdue ? (
                  <Typography>The deadline has passed — pick a new date to recalculate your daily target.</Typography>
                ) : daily.remaining === 0 ? (
                  <Typography>Target reached. Congratulations! 🎉</Typography>
                ) : (
                  <Typography>
                    Write <strong>{daily.perDay.toLocaleString()} words</strong> on each of your next <strong>{daily.writingDaysLeft}</strong> writing days to finish by{' '}
                    {new Date(goal.deadline + 'T00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}.
                  </Typography>
                )
              ) : (
                <Typography color="text.secondary">Set a deadline to get a daily word target.</Typography>
              )}
            </Box>
          </Stack>
        </Section>

        <Section title="Today">
          <Stack spacing={2}>
            <Box>
              <Stack direction="row" alignItems="baseline" spacing={1}>
                <Typography variant="h4" component="p">
                  {Math.max(0, today).toLocaleString()}
                </Typography>
                <Typography color="text.secondary">
                  {todayGoal ? `of ${todayGoal.toLocaleString()} words` : 'words'} {isWritingDay ? '' : '(rest day)'}
                </Typography>
              </Stack>
              <LinearProgress variant="determinate" value={todayPct} color={todayPct >= 100 ? 'success' : 'primary'} sx={{ height: 8, mt: 1 }} aria-label="Today's progress" />
            </Box>
            <Stack direction="row" spacing={3}>
              <Stack direction="row" spacing={1} alignItems="center">
                <LocalFireDepartmentIcon color="secondary" fontSize="large" />
                <Box>
                  <Typography variant="h5" component="p">
                    {streaks.current}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    day streak
                  </Typography>
                </Box>
              </Stack>
              <Box>
                <Typography variant="h5" component="p">
                  {streaks.longest}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  longest streak
                </Typography>
              </Box>
              <Box>
                <Typography variant="h5" component="p">
                  {sessions.reduce((n, s) => n + s.sprints, 0)}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  sprints done
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </Section>

        <Section title="Writing sprint" span={2}>
          <SprintTimer />
        </Section>

        <Section title="Words per day (last 30 days)">
          <WordsPerDayChart data={perDay} dailyTarget={daily.perDay} />
        </Section>

        <Section title="Progress toward target">
          <CumulativeChart data={cumulative} target={goal.targetWords} />
        </Section>

        <Section title="Writing calendar" span={2}>
          <Heatmap sessions={sessions} goal={todayGoal || 500} />
        </Section>

        <Section title="Chapter targets" span={2}>
          {chapters.length === 0 ? (
            <Typography color="text.secondary">Add chapters to set per-chapter targets.</Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size="small" aria-label="Chapter targets">
                <TableHead>
                  <TableRow>
                    <TableCell>Chapter</TableCell>
                    <TableCell align="right">Words</TableCell>
                    <TableCell align="right" sx={{ width: 120 }}>
                      Target
                    </TableCell>
                    <TableCell sx={{ width: '35%' }}>Progress</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {chapters.map((c) => {
                    const words = totals.get(c.id) ?? 0;
                    const p = c.targetWordCount ? Math.min(100, (words / c.targetWordCount) * 100) : null;
                    return (
                      <TableRow key={c.id} hover>
                        <TableCell>{c.title}</TableCell>
                        <TableCell align="right">{words.toLocaleString()}</TableCell>
                        <TableCell align="right">
                          <InputBase
                            defaultValue={c.targetWordCount ?? ''}
                            placeholder="—"
                            inputProps={{ 'aria-label': `Target for ${c.title}`, inputMode: 'numeric', style: { textAlign: 'right' } }}
                            onBlur={(e) => {
                              const n = parseInt(e.target.value.replace(/\D/g, ''), 10);
                              void useStore.getState().updateDoc(c.id, { targetWordCount: n > 0 ? n : null });
                            }}
                            sx={{ width: 90, fontSize: 14 }}
                          />
                        </TableCell>
                        <TableCell>
                          {p !== null ? (
                            <Stack direction="row" spacing={1} alignItems="center">
                              <LinearProgress variant="determinate" value={p} color={p >= 100 ? 'success' : 'secondary'} sx={{ flex: 1, height: 6 }} />
                              <Typography variant="caption" sx={{ width: 36 }}>
                                {Math.round(p)}%
                              </Typography>
                            </Stack>
                          ) : (
                            <Typography variant="caption" color="text.secondary">
                              No target
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </Box>
          )}
        </Section>
      </Box>
    </Box>
  );
}

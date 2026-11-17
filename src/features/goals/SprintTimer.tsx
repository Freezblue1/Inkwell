import { Box, Button, CircularProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useStore } from '@/store';
import { manuscriptWordCount } from '@/lib/tree';

function mmss(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Pomodoro-style writing sprints with a session word target. */
export function SprintTimer() {
  const sprint = useStore((s) => s.sprint);
  const goal = useStore((s) => s.goal);
  const docs = useStore((s) => s.docs);
  const sessionStart = useStore((s) => s.sessionStartWords);
  const updateGoal = useStore((s) => s.updateGoal);
  const { startSprint, pauseSprint, resetSprint } = useStore.getState();
  if (!goal) return null;

  const total = manuscriptWordCount(docs);
  const sprintWords = sprint.status === 'idle' ? 0 : total - sprint.startWords;
  const sessionWords = sessionStart === null ? 0 : total - sessionStart;
  const length = (sprint.phase === 'work' ? goal.sprintMinutes : goal.breakMinutes) * 60;
  const pct = sprint.status === 'idle' ? 0 : 100 - (sprint.remainingSec / length) * 100;
  const sessionPct = goal.sessionTarget ? Math.min(100, (Math.max(0, sessionWords) / goal.sessionTarget) * 100) : 0;

  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center">
      <Box sx={{ position: 'relative', display: 'inline-flex' }}>
        <CircularProgress variant="determinate" value={100} size={140} thickness={3} sx={{ color: 'action.hover', position: 'absolute' }} />
        <CircularProgress variant="determinate" value={pct} size={140} thickness={3} color={sprint.phase === 'break' ? 'success' : 'secondary'} aria-label="Sprint progress" />
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
          <Box>
            <Typography variant="h4" component="p" sx={{ fontVariantNumeric: 'tabular-nums' }} role="timer" aria-live="off">
              {mmss(sprint.remainingSec)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {sprint.status === 'idle' ? 'Ready' : sprint.phase === 'break' ? 'Break' : sprint.status === 'paused' ? 'Paused' : 'Writing'}
            </Typography>
          </Box>
        </Box>
      </Box>
      <Stack spacing={1.5} sx={{ flex: 1, width: '100%' }}>
        <Stack direction="row" spacing={1}>
          {sprint.status === 'running' ? (
            <Button variant="contained" startIcon={<PauseIcon />} onClick={pauseSprint}>
              Pause
            </Button>
          ) : (
            <Button variant="contained" color="secondary" startIcon={<PlayArrowIcon />} onClick={startSprint}>
              {sprint.status === 'paused' ? 'Resume' : 'Start sprint'}
            </Button>
          )}
          <Button startIcon={<RestartAltIcon />} onClick={resetSprint} disabled={sprint.status === 'idle'}>
            Reset
          </Button>
        </Stack>
        <Typography variant="body2">
          This sprint: <strong>{sprintWords.toLocaleString()}</strong> words · This session: <strong>{sessionWords.toLocaleString()}</strong>
          {goal.sessionTarget ? ` of ${goal.sessionTarget.toLocaleString()} (${Math.round(sessionPct)}%)` : ''}
        </Typography>
        <Stack direction="row" spacing={1.5}>
          <TextField select size="small" label="Sprint" value={goal.sprintMinutes} onChange={(e) => void updateGoal({ sprintMinutes: Number(e.target.value) })} sx={{ minWidth: 100 }} disabled={sprint.status !== 'idle'}>
            {[10, 15, 20, 25, 30, 45, 60].map((m) => (
              <MenuItem key={m} value={m}>
                {m} min
              </MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Break" value={goal.breakMinutes} onChange={(e) => void updateGoal({ breakMinutes: Number(e.target.value) })} sx={{ minWidth: 100 }}>
            {[3, 5, 10, 15].map((m) => (
              <MenuItem key={m} value={m}>
                {m} min
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            label="Session target"
            type="number"
            value={goal.sessionTarget}
            onChange={(e) => void updateGoal({ sessionTarget: Math.max(0, Number(e.target.value) || 0) })}
            inputProps={{ min: 0, step: 100 }}
            sx={{ width: 140 }}
          />
        </Stack>
      </Stack>
    </Stack>
  );
}

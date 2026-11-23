/**
 * Desktop self-updates: mirrors the updater state from the Electron main
 * process, offers "Restart now" when a new version is downloaded, and the
 * Settings card (version, auto-check switch, Check now).
 */
import { useEffect } from 'react';
import { create } from 'zustand';
import { Alert, Box, Button, Collapse, FormControlLabel, LinearProgress, Snackbar, Stack, Switch, Typography } from '@mui/material';
import { useStore } from '@/store';
import { flushAll } from '@/features/editor/autosave';
import { desktop, type UpdateInfo } from '@/lib/desktop';

interface UpdatesState {
  info: UpdateInfo | null;
  /** The version whose "ready" notice was dismissed. */
  dismissed: string | null;
  set(info: UpdateInfo): void;
  dismiss(): void;
}

export const useUpdates = create<UpdatesState>((set, get) => ({
  info: null,
  dismissed: null,
  set: (info) => set({ info }),
  dismiss: () => set({ dismissed: get().info?.latest ?? null }),
}));

const api = () => desktop()?.updates ?? null;

/** Starts mirroring the updater state; call once in the desktop shell. */
export function useDesktopUpdates() {
  useEffect(() => {
    const u = api();
    if (!u) return;
    let prev: UpdateInfo['status'] | null = null;
    u.onStatus((info) => {
      useUpdates.getState().set(info);
      if (info.manual && prev === 'checking') {
        const s = useStore.getState();
        if (info.status === 'up-to-date') s.notify(`You have the latest version of Inkwell (${info.current}).`, 'info');
        if (info.status === 'error') s.notify(`Couldn’t check for updates: ${info.error}`, 'warning');
      }
      prev = info.status;
    });
    void u.info().then((info) => useUpdates.getState().set(info));
  }, []);
}

async function restartNow() {
  await flushAll();
  api()?.restart();
}

/** "Version X is ready" notice. */
export function UpdateReadySnackbar() {
  const info = useUpdates((s) => s.info);
  const dismissed = useUpdates((s) => s.dismissed);
  const open = info?.status === 'ready' && dismissed !== info.latest;
  return (
    <Snackbar open={open} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
      <Alert
        severity="info"
        variant="filled"
        onClose={() => useUpdates.getState().dismiss()}
        action={
          <Button color="inherit" size="small" onClick={() => void restartNow()}>
            Restart now
          </Button>
        }
        sx={{ alignItems: 'center' }}
      >
        Inkwell {info?.latest} is ready. It installs when you close Inkwell, or restart now.
      </Alert>
    </Snackbar>
  );
}

function statusText(info: UpdateInfo): string {
  switch (info.status) {
    case 'checking':
      return 'Checking for updates…';
    case 'downloading':
      return `Downloading Inkwell ${info.latest}…`;
    case 'ready':
      return `Inkwell ${info.latest} is downloaded and installs when you close Inkwell.`;
    case 'up-to-date':
      return 'You have the latest version.';
    case 'error':
      return `Couldn’t check for updates: ${info.error}`;
    default:
      return info.auto ? 'Inkwell checks for updates when it starts and every few hours.' : 'Automatic checks are off.';
  }
}

/** Settings card, desktop app only. */
export function UpdateCard() {
  const info = useUpdates((s) => s.info);
  const u = api();
  if (!u || !info) return null;
  const busy = info.status === 'checking' || info.status === 'downloading';
  return (
    <Box sx={{ mt: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        <Typography variant="body2">
          Inkwell <b>{info.current}</b>
        </Typography>
        {desktop()?.openDataFolder && (
          <Button size="small" onClick={() => void desktop()!.openDataFolder!()}>
            Open data folder
          </Button>
        )}
      </Stack>
      {!info.supported ? (
        <Typography variant="body2" color="text.secondary">
          Automatic updates work in the packaged Inkwell.exe.
        </Typography>
      ) : (
        <>
          <Typography variant="body2" color={info.status === 'error' ? 'warning.main' : 'text.secondary'} role="status">
            {statusText(info)}
          </Typography>
          <Collapse in={info.status === 'downloading'}>
            <LinearProgress variant="determinate" value={Math.round((info.progress ?? 0) * 100)} sx={{ mt: 1 }} aria-label="Download progress" />
          </Collapse>
          {info.status === 'ready' && info.notes?.trim() && (
            <Typography variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap', maxHeight: 140, overflow: 'auto', bgcolor: 'action.hover', borderRadius: 1, p: 1 }}>
              {info.notes.trim()}
            </Typography>
          )}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, flexWrap: 'wrap' }}>
            <FormControlLabel
              control={<Switch checked={info.auto} onChange={(e) => void u.setAuto(e.target.checked).then((i) => useUpdates.getState().set(i))} />}
              label="Update automatically"
            />
            {info.status === 'ready' ? (
              <Button variant="contained" size="small" onClick={() => void restartNow()}>
                Restart now
              </Button>
            ) : (
              <Button variant="outlined" size="small" disabled={busy} onClick={() => void u.check()}>
                Check now
              </Button>
            )}
          </Stack>
        </>
      )}
    </Box>
  );
}

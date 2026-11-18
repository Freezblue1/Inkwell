/** Settings → Projects folder. */
import { useEffect, useState } from 'react';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import FolderIcon from '@mui/icons-material/FolderOutlined';
import SyncIcon from '@mui/icons-material/Sync';
import WarningIcon from '@mui/icons-material/WarningAmberRounded';
import { useStore } from '@/store';
import { isDesktop } from '@/lib/desktop';
import { allowFolder, chooseFolder, folderSyncSupported, openFolder, stopFolderSync, syncNow, useFolderSync, type FolderStatus } from './folderSync';

export function timeAgo(t: number | null, now = Date.now()): string {
  if (!t) return '';
  const s = Math.round((now - t) / 1000);
  if (s < 10) return 'just now';
  if (s < 60) return `${s} seconds ago`;
  const m = Math.round(s / 60);
  if (m < 60) return m === 1 ? 'a minute ago' : `${m} minutes ago`;
  return new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function statusLine(status: FolderStatus, lastSync: number | null, error: string | null): string {
  switch (status) {
    case 'starting':
    case 'syncing':
      return 'Syncing…';
    case 'permission':
      return 'Your browser needs permission to use this folder again.';
    case 'error':
      return error ?? 'Something went wrong.';
    case 'idle':
      return `Up to date · synced ${timeAgo(lastSync)}`;
    default:
      return '';
  }
}

/** Re-renders every 15 s so "synced 2 minutes ago" stays true. */
export function useTick(ms = 15000) {
  const [, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

export function FolderSyncCard() {
  const { status, label, lastSync, error, result } = useFolderSync();
  const [busy, setBusy] = useState(false);
  useTick();
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  };

  if (!folderSyncSupported()) {
    return (
      <Typography variant="body2" color="text.secondary">
        {isDesktop()
          ? 'Update the desktop app to keep projects in a folder.'
          : 'This browser can’t save to folders on your computer. Use Chrome or Edge, or the Inkwell desktop app.'}
      </Typography>
    );
  }

  if (status === 'off') {
    return (
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Keep a copy of every project as a file in a folder you choose, such as OneDrive or Dropbox. You get real files and backups you can see. Point Inkwell on another PC, or the browser, at the same folder and your projects stay in sync.
        </Typography>
        <Button variant="outlined" startIcon={<FolderIcon />} disabled={busy} onClick={() => void run(chooseFolder)}>
          Choose folder…
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
        <FolderIcon fontSize="small" color="action" />
        <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
          {label}
        </Typography>
      </Stack>
      {status === 'error' ? (
        <Alert severity="warning" sx={{ mt: 1 }}>
          {statusLine(status, lastSync, error)}
        </Alert>
      ) : (
        <Typography variant="body2" color="text.secondary" role="status" sx={{ mt: 0.5 }}>
          {statusLine(status, lastSync, error)}
          {status === 'idle' && result ? ` · ${result.files} ${result.files === 1 ? 'file' : 'files'}` : ''}
        </Typography>
      )}
      <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 1 }}>
        {status === 'permission' ? (
          <Button variant="contained" size="small" onClick={() => void allowFolder()}>
            Allow access
          </Button>
        ) : (
          <Button size="small" variant="outlined" startIcon={<SyncIcon />} disabled={busy || status === 'syncing'} onClick={() => void run(syncNow)}>
            Sync now
          </Button>
        )}
        {isDesktop() && (
          <Button size="small" onClick={openFolder}>
            Open folder
          </Button>
        )}
        <Button size="small" disabled={busy} onClick={() => void run(chooseFolder)}>
          Change folder…
        </Button>
        <Button size="small" color="inherit" disabled={busy} onClick={() => void run(stopFolderSync)}>
          Stop using folder
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Each project is saved as “Title.inkwell”. Changes made on another device appear here within seconds. If a project changed in both places, both versions are kept. Deleted projects go to the “Deleted projects” subfolder. The sample novel, snapshots and undo history stay on this device.
      </Typography>
    </Box>
  );
}

/** One-line status on Home; opens Settings. */
export function FolderSyncStatus() {
  const { status, label, lastSync, error } = useFolderSync();
  useTick();
  if (!folderSyncSupported()) return null;
  const openSettings = () => useStore.getState().openDialog('settings');
  if (status === 'off') {
    return (
      <Button size="small" startIcon={<FolderIcon />} onClick={openSettings} sx={{ color: 'text.secondary' }}>
        Keep your projects in a folder (OneDrive, Dropbox…)
      </Button>
    );
  }
  const name = label?.split(/[\/]/).filter(Boolean).pop() ?? label;
  return (
    <Button
      size="small"
      startIcon={status === 'error' ? <WarningIcon color="warning" /> : <FolderIcon />}
      onClick={status === 'permission' ? () => void allowFolder() : openSettings}
      sx={{ color: 'text.secondary', textAlign: 'left' }}
    >
      {status === 'permission' ? `Allow access to “${name}” to keep syncing` : `Projects folder: ${name} · ${statusLine(status, lastSync, error)}`}
    </Button>
  );
}

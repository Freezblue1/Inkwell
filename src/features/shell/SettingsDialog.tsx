import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useStore } from '@/store';
import { getStorageInfo, requestPersistentStorage, type StorageInfo } from '@/db/db';
import { EditorSettingsForm } from '@/features/editor/EditorSettingsForm';
import { InstallAppCard } from '@/features/pwa/InstallAppCard';

function formatBytes(n: number) {
  if (n > 1e9) return `${(n / 1e9).toFixed(1)} GB`;
  if (n > 1e6) return `${(n / 1e6).toFixed(1)} MB`;
  return `${Math.round(n / 1e3)} KB`;
}

/** App preferences: theme, density, editor defaults and storage. */
export default function SettingsDialog() {
  const close = useStore((s) => s.closeDialog);
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const [storage, setStorage] = useState<StorageInfo | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);

  useEffect(() => {
    void getStorageInfo().then(setStorage);
    void navigator.storage?.persisted?.().then(setPersisted);
  }, []);

  return (
    <Dialog open onClose={() => close('settings')} maxWidth="sm" fullWidth aria-labelledby="settings-title">
      <DialogTitle id="settings-title">Settings</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={3}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Appearance
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 1 }}>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Theme
                </Typography>
                <ToggleButtonGroup exclusive size="small" value={settings.themeMode} onChange={(_, v) => v && update({ themeMode: v })} aria-label="Theme">
                  <ToggleButton value="light">Light</ToggleButton>
                  <ToggleButton value="dark">Dark</ToggleButton>
                  <ToggleButton value="system">System</ToggleButton>
                  <ToggleButton value="jungle">Jungle</ToggleButton>
                </ToggleButtonGroup>
                {settings.themeMode === 'jungle' && (
                  <FormControlLabel
                    sx={{ display: 'flex', mt: 1 }}
                    control={<Switch checked={settings.jungleDecor !== false} onChange={(e) => update({ jungleDecor: e.target.checked })} />}
                    label="Hanging vines, foliage & fireflies"
                  />
                )}
              </Box>
              <Box>
                <Typography variant="body2" gutterBottom>
                  Density
                </Typography>
                <ToggleButtonGroup exclusive size="small" value={settings.density} onChange={(_, v) => v && update({ density: v })} aria-label="Density">
                  <ToggleButton value="comfortable">Comfortable</ToggleButton>
                  <ToggleButton value="compact">Compact</ToggleButton>
                </ToggleButtonGroup>
              </Box>
            </Stack>
          </Box>

          <Box>
            <Typography variant="overline" color="text.secondary">
              App
            </Typography>
            <InstallAppCard />
          </Box>

          <Box>
            <Typography variant="overline" color="text.secondary">
              Editor
            </Typography>
            <EditorSettingsForm />
          </Box>

          <Box>
            <Typography variant="overline" color="text.secondary">
              Storage
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Everything is stored in this browser’s IndexedDB. Nothing is sent to a server. Export regular backups from Format &amp; Export.
            </Typography>
            {storage && (
              <Box sx={{ mb: 1 }}>
                <LinearProgress variant="determinate" value={Math.min(100, storage.ratio * 100)} aria-label="Storage used" />
                <Typography variant="caption" color="text.secondary">
                  {formatBytes(storage.usage)} used of {formatBytes(storage.quota)}
                </Typography>
              </Box>
            )}
            <FormControlLabel
              control={
                <Switch
                  checked={!!persisted}
                  onChange={async () => {
                    const ok = await requestPersistentStorage();
                    setPersisted(ok);
                  }}
                />
              }
              label={persisted ? 'Persistent storage granted' : 'Ask the browser never to evict Inkwell data'}
            />
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => close('settings')}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}

import { useEffect, useState } from 'react';
import {
  Box,
  ButtonBase,
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
import { SCENE_LIST, sceneOf } from '@/theme/scenes';
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
                </ToggleButtonGroup>
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
            <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
              Illustrated themes
            </Typography>
            <Box role="radiogroup" aria-label="Illustrated themes" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 1 }}>
              {SCENE_LIST.map((sc) => {
                const selected = settings.themeMode === sc.id;
                return (
                  <ButtonBase
                    key={sc.id}
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${sc.name}: ${sc.tagline}`}
                    onClick={() => update({ themeMode: sc.id })}
                    sx={{
                      display: 'block',
                      textAlign: 'left',
                      borderRadius: 2,
                      overflow: 'hidden',
                      border: 2,
                      borderColor: selected ? 'primary.main' : 'divider',
                      '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                    }}
                  >
                    <Box sx={{ height: 54, background: sc.preview, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', px: 1, pb: 0.5 }}>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {[sc.primary.main, sc.secondary.main, sc.page.pageBg].map((c) => (
                          <Box key={c} sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: c, border: '1px solid rgba(0,0,0,0.25)' }} />
                        ))}
                      </Box>
                    </Box>
                    <Box sx={{ px: 1, py: 0.75 }}>
                      <Typography variant="subtitle2" sx={{ fontFamily: sc.displayFont, fontWeight: sc.headingWeight, lineHeight: 1.3 }}>
                        {sc.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
                        {sc.tagline}
                      </Typography>
                    </Box>
                  </ButtonBase>
                );
              })}
            </Box>
            {sceneOf(settings.themeMode) && (
              <FormControlLabel
                sx={{ display: 'flex', mt: 1 }}
                control={<Switch checked={settings.jungleDecor !== false} onChange={(e) => update({ jungleDecor: e.target.checked })} />}
                label={`Animated decorations: ${sceneOf(settings.themeMode)!.decorLabel.toLowerCase()}`}
              />
            )}
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

import { Box, Button, Chip, Stack, Typography } from '@mui/material';
import InstallDesktopIcon from '@mui/icons-material/InstallDesktop';
import CheckCircleIcon from '@mui/icons-material/CheckCircleOutline';
import IosShareIcon from '@mui/icons-material/IosShare';
import { usePwa, isIOS } from './pwaStore';
import { isDesktop } from '@/lib/desktop';

/** "Install as an app" section (settings dialog and welcome screen). */
export function InstallAppCard({ compact = false }: { compact?: boolean }) {
  const { installEvent, standalone, offlineReady, install } = usePwa();

  if (standalone) {
    return (
      <Stack direction="row" spacing={1} alignItems="center">
        <CheckCircleIcon color="success" fontSize="small" />
        <Typography variant="body2">
          {isDesktop() ? 'Running as the Inkwell desktop app. Your data lives in your Windows profile (Settings → App → Open data folder).' : `Running as an installed app${offlineReady ? ' · available offline' : ''}.`}
        </Typography>
      </Stack>
    );
  }

  return (
    <Box>
      {!compact && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Install Inkwell to open it from your dock, home screen or Start menu in its own window. It works fully offline either way.
        </Typography>
      )}
      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 1 }}>
        {installEvent ? (
          <Button variant={compact ? 'outlined' : 'contained'} startIcon={<InstallDesktopIcon />} onClick={() => void install()}>
            Install Inkwell app
          </Button>
        ) : isIOS ? (
          <Typography variant="body2">
            On iPhone or iPad: tap <IosShareIcon fontSize="inherit" sx={{ verticalAlign: 'middle' }} /> <strong>Share</strong>, then <strong>Add to Home Screen</strong>.
          </Typography>
        ) : (
          !compact && (
            <Typography variant="body2" color="text.secondary">
              Use your browser’s “Install app” option (the icon in the address bar, or the browser menu).
            </Typography>
          )
        )}
        {offlineReady && <Chip size="small" color="success" variant="outlined" label="Ready offline" />}
      </Stack>
    </Box>
  );
}

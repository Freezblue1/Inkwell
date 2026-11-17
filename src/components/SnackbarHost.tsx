import { Alert, Button, Snackbar } from '@mui/material';
import { useStore } from '@/store';

/** Shows the oldest queued notification. */
export function SnackbarHost() {
  const snack = useStore((s) => s.snacks[0]);
  const dismiss = useStore((s) => s.dismissSnack);
  if (!snack) return null;
  return (
    <Snackbar
      key={snack.id}
      open
      autoHideDuration={snack.severity === 'error' ? 8000 : 4000}
      onClose={(_, reason) => reason !== 'clickaway' && dismiss(snack.id)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      sx={{ bottom: { xs: 80, sm: 24 } }}
    >
      <Alert
        severity={snack.severity}
        variant="filled"
        onClose={() => dismiss(snack.id)}
        action={
          snack.action ? (
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                snack.action!.run();
                dismiss(snack.id);
              }}
            >
              {snack.action.label}
            </Button>
          ) : undefined
        }
        sx={{ alignItems: 'center' }}
      >
        {snack.message}
      </Alert>
    </Snackbar>
  );
}

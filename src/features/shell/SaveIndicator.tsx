import { Box, CircularProgress, Tooltip, Typography } from '@mui/material';
import CloudDoneIcon from '@mui/icons-material/CloudDoneOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import ErrorIcon from '@mui/icons-material/ErrorOutline';
import { useStore } from '@/store';
import { formatDateTime } from '@/lib/dates';

/** "Saved" / "Saving…" / "Unsaved" / "Error" with a live region for screen readers. */
export function SaveIndicator({ compact = false }: { compact?: boolean }) {
  const status = useStore((s) => s.saveStatus);
  const lastSavedAt = useStore((s) => s.lastSavedAt);

  const map = {
    saved: { icon: <CloudDoneIcon fontSize="small" />, label: 'Saved', color: 'text.secondary' },
    saving: { icon: <CircularProgress size={14} thickness={5} />, label: 'Saving…', color: 'text.secondary' },
    unsaved: { icon: <EditIcon fontSize="small" />, label: 'Editing', color: 'text.secondary' },
    error: { icon: <ErrorIcon fontSize="small" />, label: 'Save failed', color: 'error.main' },
  }[status];

  return (
    <Tooltip title={lastSavedAt ? `Saved locally on this device · ${formatDateTime(lastSavedAt)}` : 'Everything is stored locally in your browser'}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, color: map.color, minWidth: compact ? 0 : 88 }} role="status" aria-live="polite">
        {map.icon}
        {!compact && (
          <Typography variant="caption" sx={{ fontWeight: 500 }}>
            {map.label}
          </Typography>
        )}
      </Box>
    </Tooltip>
  );
}

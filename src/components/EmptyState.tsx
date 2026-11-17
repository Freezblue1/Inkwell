import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

/** Friendly placeholder for views and lists with nothing to show yet. */
export function EmptyState({ icon, title, description, action, compact }: Props) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 1,
        p: compact ? 2 : 6,
        color: 'text.secondary',
        height: compact ? 'auto' : '100%',
        minHeight: compact ? 0 : 240,
      }}
    >
      {icon && <Box sx={{ fontSize: compact ? 32 : 56, opacity: 0.6, '& svg': { fontSize: 'inherit' } }}>{icon}</Box>}
      <Typography variant={compact ? 'subtitle2' : 'h6'} color="text.primary">
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" sx={{ maxWidth: 420 }}>
          {description}
        </Typography>
      )}
      {action && <Box sx={{ mt: 1 }}>{action}</Box>}
    </Box>
  );
}

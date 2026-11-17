import { Chip, type ChipProps } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { statusColor } from '@/lib/defaults';

/** Colored chip for a document status (Idea, Draft, Final…). */
export function StatusChip({ status, size = 'small', ...rest }: { status: string } & Omit<ChipProps, 'label' | 'color'>) {
  if (!status) return null;
  const color = statusColor(status);
  return (
    <Chip
      size={size}
      label={status}
      {...rest}
      sx={{
        height: size === 'small' ? 20 : 24,
        fontSize: 11,
        bgcolor: alpha(color, 0.16),
        color: (t) => (t.palette.mode === 'dark' ? alpha('#fff', 0.92) : color),
        border: `1px solid ${alpha(color, 0.4)}`,
        '& .MuiChip-label': { px: 0.75 },
        ...rest.sx,
      }}
    />
  );
}

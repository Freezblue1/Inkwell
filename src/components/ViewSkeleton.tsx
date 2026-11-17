import { Box, Skeleton, Stack } from '@mui/material';

/** Loading placeholder for lazily-loaded views. */
export function ViewSkeleton({ variant = 'page' }: { variant?: 'page' | 'list' | 'editor' }) {
  if (variant === 'list') {
    return (
      <Stack spacing={1} sx={{ p: 2 }} aria-busy="true" aria-label="Loading">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={28} />
        ))}
      </Stack>
    );
  }
  if (variant === 'editor') {
    return (
      <Box sx={{ maxWidth: 720, mx: 'auto', p: 6 }} aria-busy="true" aria-label="Loading document">
        <Skeleton variant="text" width="40%" height={40} />
        {Array.from({ length: 10 }).map((_, i) => (
          <Skeleton key={i} variant="text" width={i % 4 === 3 ? '70%' : '100%'} />
        ))}
      </Box>
    );
  }
  return (
    <Box sx={{ p: 3 }} aria-busy="true" aria-label="Loading">
      <Skeleton variant="text" width={240} height={40} />
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2, mt: 2 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={140} />
        ))}
      </Box>
    </Box>
  );
}

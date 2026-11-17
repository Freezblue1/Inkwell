import { memo } from 'react';
import { Avatar, Box, Card, CardActionArea, CardContent, Chip, Stack, Typography } from '@mui/material';
import type { BibleEntry } from '@/types/models';
import { useStore } from '@/store';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { bibleSubtitle } from '@/lib/bible';

/** Card for a story bible entry. */
export const BibleCard = memo(function BibleCard({ entry, sceneCount }: { entry: BibleEntry; sceneCount: number }) {
  const img = useAssetUrl(entry.imageAssetId);
  const subtitle = bibleSubtitle(entry);
  return (
    <Card sx={{ height: '100%' }}>
      <CardActionArea onClick={() => useStore.getState().openBibleEntry(entry.id)} sx={{ height: '100%', alignItems: 'stretch', display: 'flex', flexDirection: 'column' }}>
        {img ? (
          <Box component="img" src={img} alt="" sx={{ width: '100%', height: 140, objectFit: 'cover' }} />
        ) : (
          <Box sx={{ height: 72, bgcolor: entry.color || 'primary.main', opacity: 0.85, display: 'flex', alignItems: 'flex-end', px: 2 }}>
            <Avatar sx={{ width: 48, height: 48, mb: -3, border: 3, borderColor: 'background.paper', bgcolor: entry.color || 'primary.dark', fontSize: 20 }}>{entry.name.charAt(0)}</Avatar>
          </Box>
        )}
        <CardContent sx={{ flex: 1, width: '100%', pt: img ? 1.5 : 3.5 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="subtitle1" sx={{ fontWeight: 500, flex: 1 }} noWrap>
              {entry.name}
            </Typography>
            {entry.seriesId && <Chip size="small" label="Series" variant="outlined" sx={{ height: 20 }} />}
          </Stack>
          {subtitle && (
            <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
              {subtitle}
            </Typography>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {entry.summary || 'No summary yet.'}
          </Typography>
          {sceneCount > 0 && (
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Appears in {sceneCount} scene{sceneCount === 1 ? '' : 's'}
            </Typography>
          )}
        </CardContent>
      </CardActionArea>
    </Card>
  );
});

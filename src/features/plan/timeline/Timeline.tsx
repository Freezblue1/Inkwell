import { useMemo } from 'react';
import { Box, Card, CardActionArea, Chip, InputBase, Stack, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import TimelineIcon from '@mui/icons-material/Timeline';
import { useStore } from '@/store';
import { sceneSequence } from '@/lib/tree';
import { statusColor } from '@/lib/defaults';
import { EmptyState } from '@/components/EmptyState';

function formatStoryDate(date: string, time: string) {
  if (!date) return '';
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  const label = Number.isNaN(dt.getTime()) ? date : dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  return time ? `${label} · ${time}` : label;
}

/** Chronological timeline of scenes by in-story date, compared with manuscript order. */
export function Timeline() {
  const docs = useStore((s) => s.docs);
  const bible = useStore((s) => s.bible);

  const { dated, undated } = useMemo(() => {
    const seq = sceneSequence(docs);
    const withIndex = seq.map((d, i) => ({ d, pos: i + 1 }));
    const dated = withIndex
      .filter((x) => x.d.metadata.timelineDate)
      .sort((a, b) => `${a.d.metadata.timelineDate} ${a.d.metadata.timelineTime}`.localeCompare(`${b.d.metadata.timelineDate} ${b.d.metadata.timelineTime}`));
    return { dated, undated: withIndex.filter((x) => !x.d.metadata.timelineDate) };
  }, [docs]);

  const s = useStore.getState;
  const names = new Map(bible.map((b) => [b.id, b.name]));

  if (!dated.length && !undated.length) return <EmptyState icon={<TimelineIcon />} title="No scenes yet" />;

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, maxWidth: 960 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Timeline
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Scenes in story order. The number shows where each scene sits in the manuscript — scenes marked “out of order” are flashbacks or flash-forwards.
      </Typography>

      {dated.length === 0 && <EmptyState compact title="No dated scenes" description="Give scenes a story date below (or in the Inspector’s Metadata tab)." />}

      <Box component="ol" sx={{ listStyle: 'none', p: 0, m: 0, position: 'relative' }} aria-label="Scenes in chronological order">
        {dated.map(({ d, pos }, i) => {
          const prevPos = i > 0 ? dated[i - 1].pos : 0;
          const outOfOrder = pos < prevPos;
          const newDate = i === 0 || dated[i - 1].d.metadata.timelineDate !== d.metadata.timelineDate;
          return (
            <Box component="li" key={d.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '24px 1fr', sm: '150px 24px 1fr' }, gap: 1.5, alignItems: 'stretch' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, textAlign: 'right', pt: 1.5, fontWeight: newDate ? 600 : 400, opacity: newDate ? 1 : 0.6 }}>
                {formatStoryDate(d.metadata.timelineDate, d.metadata.timelineTime)}
              </Typography>
              <Box sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
                <Box sx={{ position: 'absolute', top: 0, bottom: 0, width: 2, bgcolor: 'divider' }} />
                <Box sx={{ mt: 1.75, width: 14, height: 14, borderRadius: '50%', bgcolor: statusColor(d.status || 'Idea'), border: 3, borderColor: 'background.paper', zIndex: 1 }} />
              </Box>
              <Card sx={{ mb: 1.5, borderLeft: outOfOrder ? 3 : 1, borderLeftColor: outOfOrder ? 'secondary.main' : 'divider' }}>
                <CardActionArea onClick={() => s().openDoc(d.id)} sx={{ p: 1.5 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <Tooltip title="Position in manuscript">
                      <Chip size="small" label={`#${pos}`} sx={{ height: 20 }} />
                    </Tooltip>
                    <Typography variant="subtitle2" sx={{ flex: 1 }} noWrap>
                      {d.title}
                    </Typography>
                    {outOfOrder && <Chip size="small" label="out of order" sx={{ height: 20, bgcolor: (t) => alpha(t.palette.secondary.main, 0.2) }} />}
                  </Stack>
                  <Typography variant="caption" color="text.secondary" sx={{ display: { sm: 'none' } }}>
                    {formatStoryDate(d.metadata.timelineDate, d.metadata.timelineTime)}
                  </Typography>
                  {d.synopsis && (
                    <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {d.synopsis}
                    </Typography>
                  )}
                  {(d.metadata.pov || d.metadata.locationId) && (
                    <Typography variant="caption" color="text.secondary">
                      {[d.metadata.pov && `POV: ${names.get(d.metadata.pov) ?? '?'}`, d.metadata.locationId && names.get(d.metadata.locationId)].filter(Boolean).join(' · ')}
                    </Typography>
                  )}
                </CardActionArea>
              </Card>
            </Box>
          );
        })}
      </Box>

      {undated.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" component="h3" gutterBottom>
            Not yet on the timeline ({undated.length})
          </Typography>
          <Stack spacing={1}>
            {undated.map(({ d, pos }) => (
              <Stack key={d.id} direction="row" spacing={2} alignItems="center" sx={{ p: 1, border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper' }}>
                <Chip size="small" label={`#${pos}`} />
                <Typography variant="body2" sx={{ flex: 1 }} noWrap>
                  {d.title}
                </Typography>
                <InputBase type="date" value="" onChange={(e) => void s().updateDocMeta(d.id, { timelineDate: e.target.value })} inputProps={{ 'aria-label': `Story date for ${d.title}` }} sx={{ fontSize: 13 }} />
              </Stack>
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}

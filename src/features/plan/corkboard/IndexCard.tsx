import { memo, useEffect, useState } from 'react';
import { Avatar, Box, Card, InputBase, Stack, Tooltip, Typography } from '@mui/material';
import type { InkDocument } from '@/types/models';
import { useStore } from '@/store';
import { statusColor } from '@/lib/defaults';
import { StatusChip } from '@/components/StatusChip';

interface Props {
  doc: InkDocument;
  width?: number;
  dragging?: boolean;
}

/** A corkboard index card: label stripe, title, editable synopsis, status and count. */
export const IndexCard = memo(function IndexCard({ doc, width, dragging }: Props) {
  const label = useStore((s) => s.project?.labels.find((l) => l.id === doc.label));
  const pov = useStore((s) => (doc.metadata.pov ? s.bible.find((b) => b.id === doc.metadata.pov) : undefined));
  const [editing, setEditing] = useState(false);
  const [synopsis, setSynopsis] = useState(doc.synopsis);
  useEffect(() => setSynopsis(doc.synopsis), [doc.synopsis]);

  const commit = () => {
    setEditing(false);
    if (synopsis !== doc.synopsis) void useStore.getState().updateDoc(doc.id, { synopsis });
  };

  return (
    <Card
      onDoubleClick={() => useStore.getState().openDoc(doc.id)}
      aria-label={`${doc.title}. ${doc.synopsis || 'No synopsis'}. Double-click to open.`}
      sx={(t) => ({
        width: width ?? '100%',
        height: 172,
        display: 'flex',
        flexDirection: 'column',
        borderTop: 5,
        borderTopColor: label?.color ?? statusColor(doc.status || 'Idea'),
        bgcolor: t.palette.mode === 'dark' ? '#2b2a24' : '#fffdf5',
        boxShadow: dragging ? 8 : 1,
        cursor: 'grab',
        transition: 'box-shadow 150ms',
        '&:hover': { boxShadow: 4 },
      })}
    >
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, pt: 1 }}>
        <Typography variant="subtitle2" noWrap sx={{ flex: 1 }} title={doc.title}>
          {doc.title}
        </Typography>
        {pov && (
          <Tooltip title={`POV: ${pov.name}`}>
            <Avatar sx={{ width: 22, height: 22, fontSize: 11, bgcolor: pov.color || 'primary.main' }}>{pov.name.charAt(0)}</Avatar>
          </Tooltip>
        )}
      </Stack>
      <Box sx={{ flex: 1, px: 1.5, py: 0.5, overflow: 'hidden' }} onPointerDown={(e) => editing && e.stopPropagation()}>
        {editing ? (
          <InputBase
            autoFocus
            multiline
            fullWidth
            value={synopsis}
            onChange={(e) => setSynopsis(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                setSynopsis(doc.synopsis);
                setEditing(false);
              }
            }}
            inputProps={{ 'aria-label': `Synopsis of ${doc.title}` }}
            sx={{ fontFamily: '"Courier Prime", monospace', fontSize: 13, lineHeight: 1.5 }}
          />
        ) : (
          <Typography
            variant="body2"
            onClick={() => setEditing(true)}
            sx={{
              fontFamily: '"Courier Prime", monospace',
              fontSize: 13,
              lineHeight: 1.5,
              color: doc.synopsis ? 'text.primary' : 'text.disabled',
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              cursor: 'text',
            }}
          >
            {doc.synopsis || 'Click to add a synopsis…'}
          </Typography>
        )}
      </Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, pb: 1 }}>
        <StatusChip status={doc.status} />
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          {doc.wordCount.toLocaleString()}
          {doc.targetWordCount ? ` / ${doc.targetWordCount.toLocaleString()}` : ''} w
        </Typography>
      </Stack>
    </Card>
  );
});

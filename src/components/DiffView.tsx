import { useMemo } from 'react';
import { diffWordsWithSpace } from 'diff';
import { Box, Chip, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { countWords } from '@/lib/wordCount';

/** Word-level diff between an old and a new text. */
export function DiffView({ oldText, newText, oldLabel = 'Snapshot', newLabel = 'Current', maxHeight = '60vh' }: { oldText: string; newText: string; oldLabel?: string; newLabel?: string; maxHeight?: number | string }) {
  const { parts, added, removed } = useMemo(() => {
    // Very large texts: diff paragraph-by-paragraph would be faster, but word diff is fine up to ~50k words.
    const parts = diffWordsWithSpace(oldText, newText);
    let added = 0;
    let removed = 0;
    parts.forEach((p) => {
      if (p.added) added += countWords(p.value);
      if (p.removed) removed += countWords(p.value);
    });
    return { parts, added, removed };
  }, [oldText, newText]);

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          {oldLabel} → {newLabel}
        </Typography>
        <Chip size="small" label={`+${added} words`} sx={{ bgcolor: (t) => alpha(t.palette.success.main, 0.15) }} />
        <Chip size="small" label={`−${removed} words`} sx={{ bgcolor: (t) => alpha(t.palette.error.main, 0.15) }} />
        {added === 0 && removed === 0 && <Chip size="small" label="Identical" />}
      </Stack>
      <Box
        sx={{
          maxHeight,
          overflow: 'auto',
          p: 2,
          border: 1,
          borderColor: 'divider',
          borderRadius: 2,
          whiteSpace: 'pre-wrap',
          fontFamily: '"Literata", Georgia, serif',
          fontSize: 15,
          lineHeight: 1.7,
          bgcolor: 'background.default',
        }}
        aria-label="Differences"
      >
        {parts.map((p, i) =>
          p.added ? (
            <Box key={i} component="ins" sx={{ bgcolor: (t) => alpha(t.palette.success.main, 0.22), textDecoration: 'none', borderRadius: 0.5 }} aria-label="added">
              {p.value}
            </Box>
          ) : p.removed ? (
            <Box key={i} component="del" sx={{ bgcolor: (t) => alpha(t.palette.error.main, 0.2), borderRadius: 0.5 }} aria-label="removed">
              {p.value}
            </Box>
          ) : (
            <span key={i}>{p.value}</span>
          ),
        )}
      </Box>
    </Box>
  );
}

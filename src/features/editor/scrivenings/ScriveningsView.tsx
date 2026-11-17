import { useMemo } from 'react';
import { Box, Button, Divider, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ViewStreamIcon from '@mui/icons-material/ViewStreamOutlined';
import type { ID } from '@/types/models';
import { useStore } from '@/store';
import { aggregateWordCounts, childrenOf, depthFirst, getChildIndex } from '@/lib/tree';
import { EditorSurface } from '../EditorSurface';
import { DocEditor } from '../DocEditor';
import { LazyMount } from '@/components/LazyMount';
import { StatusChip } from '@/components/StatusChip';
import { EmptyState } from '@/components/EmptyState';

/**
 * Scrivenings: every document inside a container shown as one continuous
 * text. Each section is its own editor (saved to its own document) with a
 * subtle divider; off-screen sections mount lazily.
 */
export function ScriveningsView({ rootId }: { rootId: ID }) {
  const docs = useStore((s) => s.docs);
  const es = useStore((s) => s.settings.editor);
  const root = docs[rootId];

  const sections = useMemo(() => {
    if (!root) return [];
    const index = getChildIndex(docs);
    const all = depthFirst(docs, childrenOf(docs, rootId));
    // Include leaves (text documents) and any container that has its own text.
    return all.filter((d) => !(index.get(d.id)?.length) || d.wordCount > 0);
  }, [docs, root, rootId]);

  const total = aggregateWordCounts(docs).get(rootId) ?? 0;

  if (!root) return null;

  return (
    <Box data-scroll-container sx={{ height: '100%', overflowY: 'auto', bgcolor: (t) => t.inkwell.paper.deskBg, py: { xs: 0, sm: 3 }, px: { xs: 0, sm: 2 } }}>
      <EditorSurface
        es={es}
        sx={{ maxWidth: es.pageWidth + 128, mx: 'auto', px: { xs: 2.5, sm: 8 }, py: { xs: 3, sm: 6 }, borderRadius: { xs: 0, sm: 1 }, boxShadow: { xs: 'none', sm: 1 }, minHeight: '100%' }}
      >
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
          <ViewStreamIcon sx={{ opacity: 0.6 }} />
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" component="h2" sx={{ fontFamily: es.fontFamily }}>
              {root.title}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Scrivenings · {sections.length} documents · {total.toLocaleString()} words
            </Typography>
          </Box>
          <Button size="small" startIcon={<CloseIcon />} onClick={() => useStore.getState().setScrivenings(null)} sx={{ color: 'inherit' }}>
            Exit
          </Button>
        </Stack>

        {sections.length === 0 && (
          <EmptyState compact title="Nothing inside yet" description="Add scenes to this container in the binder, then come back to read them as one text." />
        )}

        {sections.map((d, i) => (
          <Box key={d.id} component="section" aria-label={d.title}>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ my: i === 0 ? 1 : 3, opacity: 0.55, '&:hover': { opacity: 1 }, transition: 'opacity 150ms' }}
            >
              <Divider sx={{ flex: 1 }} />
              <Button
                size="small"
                onClick={() => useStore.getState().openDoc(d.id)}
                sx={{ color: 'inherit', fontSize: 12, textTransform: 'none', minWidth: 0 }}
                title="Open on its own"
              >
                {d.title}
              </Button>
              <StatusChip status={d.status} />
              <Divider sx={{ flex: 1 }} />
            </Stack>
            <LazyMount placeholderHeight={Math.max(64, (d.wordCount / 11) * es.fontSize * es.lineHeight * (680 / es.pageWidth))}>
              <DocEditor docId={d.id} variant="scrivenings" />
            </LazyMount>
          </Box>
        ))}
      </EditorSurface>
    </Box>
  );
}

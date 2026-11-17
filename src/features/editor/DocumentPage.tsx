import { Box } from '@mui/material';
import type { ID } from '@/types/models';
import { useStore } from '@/store';
import { EditorSurface } from './EditorSurface';
import { DocEditor } from './DocEditor';
import { DocumentHeader } from './DocumentHeader';
import { ErrorBoundary } from '@/components/ErrorBoundary';

/** A single document laid out as a page on a desk. */
export function DocumentPage({ docId, dense = false, autoFocus = true }: { docId: ID; dense?: boolean; autoFocus?: boolean }) {
  const es = useStore((s) => s.settings.editor);
  return (
    <Box
      data-scroll-container
      sx={{ height: '100%', overflowY: 'auto', bgcolor: (t) => t.inkwell.paper.deskBg, px: { xs: 0, sm: 2 }, py: { xs: 0, sm: 3 } }}
    >
      <EditorSurface
        es={es}
        sx={{
          maxWidth: es.pageWidth + 128,
          mx: 'auto',
          minHeight: '100%',
          px: { xs: 2.5, sm: dense ? 4 : 8 },
          py: { xs: 3, sm: dense ? 3 : 6 },
          borderRadius: { xs: 0, sm: 1 },
          boxShadow: { xs: 'none', sm: 1 },
          pb: es.typewriter ? '50vh' : undefined,
        }}
      >
        <ErrorBoundary area="Editor" resetKey={docId}>
          <DocumentHeader docId={docId} dense={dense} />
          <DocEditor docId={docId} variant={dense ? 'split' : 'page'} autoFocus={autoFocus} typewriter={es.typewriter} />
        </ErrorBoundary>
      </EditorSurface>
    </Box>
  );
}

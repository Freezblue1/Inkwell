import { useEffect, useState } from 'react';
import { Box, Button, Drawer } from '@mui/material';
import EditNoteIcon from '@mui/icons-material/EditNote';
import { useStore } from '@/store';
import { useLayoutMode } from '@/hooks/useLayoutMode';
import { ResizeHandle } from '@/components/ResizeHandle';
import { EmptyState } from '@/components/EmptyState';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Binder } from '@/features/binder/Binder';
import { Inspector } from '@/features/inspector/Inspector';
import { EditorToolbar } from './EditorToolbar';
import { StatsBar } from './StatsBar';
import { DocumentPage } from './DocumentPage';
import { ScriveningsView } from './scrivenings/ScriveningsView';
import { SplitEditor } from './split/SplitEditor';
import { FindReplaceBar } from './find/FindReplaceBar';
import { sceneSequence } from '@/lib/tree';

/** Write view: binder | editor | inspector (resizable on desktop, drawers below). */
export function WriteView() {
  const layout = useLayoutMode();
  const { binderOpen, inspectorOpen, binderWidth, inspectorWidth } = useStore((s) => s.settings.layout);
  const updateLayout = useStore((s) => s.updateLayout);
  const binderDrawer = useStore((s) => s.binderDrawerOpen);
  const inspectorDrawer = useStore((s) => s.inspectorDrawerOpen);
  const setBinderDrawer = useStore((s) => s.setBinderDrawer);
  const setInspectorDrawer = useStore((s) => s.setInspectorDrawer);
  const [bw, setBw] = useState(binderWidth);
  const [iw, setIw] = useState(inspectorWidth);
  useEffect(() => setBw(binderWidth), [binderWidth]);
  useEffect(() => setIw(inspectorWidth), [inspectorWidth]);

  const desktop = layout === 'desktop';

  return (
    <Box sx={{ display: 'flex', flex: 1, minHeight: 0, height: '100%' }}>
      {desktop && binderOpen && (
        <>
          <Box component="aside" aria-label="Binder" sx={{ width: bw, flex: `0 0 ${bw}px`, minWidth: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <ErrorBoundary area="Binder">
              <Binder />
            </ErrorBoundary>
          </Box>
          <ResizeHandle label="Resize binder" value={bw} min={200} max={520} onChange={setBw} onCommit={(v) => updateLayout({ binderWidth: v })} />
        </>
      )}
      {!desktop && (
        <Drawer open={binderDrawer} onClose={() => setBinderDrawer(false)} PaperProps={{ sx: { width: { xs: '88vw', sm: 340 } } }}>
          <ErrorBoundary area="Binder">
            <Binder />
          </ErrorBoundary>
        </Drawer>
      )}

      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <EditorToolbar />
        <FindReplaceBar />
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <ErrorBoundary area="Editor">
            <EditorCenter />
          </ErrorBoundary>
        </Box>
        <StatsBar />
      </Box>

      {desktop && inspectorOpen && (
        <>
          <ResizeHandle label="Resize inspector" value={iw} min={260} max={520} direction={-1} onChange={setIw} onCommit={(v) => updateLayout({ inspectorWidth: v })} />
          <Box component="aside" aria-label="Inspector" sx={{ width: iw, flex: `0 0 ${iw}px`, minWidth: 0, borderLeft: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
            <ErrorBoundary area="Inspector">
              <Inspector />
            </ErrorBoundary>
          </Box>
        </>
      )}
      {!desktop && (
        <Drawer anchor="right" open={inspectorDrawer} onClose={() => setInspectorDrawer(false)} PaperProps={{ sx: { width: { xs: '92vw', sm: 380 } } }}>
          <ErrorBoundary area="Inspector">
            <Inspector />
          </ErrorBoundary>
        </Drawer>
      )}
    </Box>
  );
}

/** Chooses scrivenings, split or single-document editing. */
function EditorCenter() {
  const activeDocId = useStore((s) => s.activeDocId);
  const docExists = useStore((s) => (s.activeDocId ? !!s.docs[s.activeDocId] && !s.docs[s.activeDocId].trashed : false));
  const scriveningsRootId = useStore((s) => s.scriveningsRootId);
  const splitEnabled = useStore((s) => s.split.enabled);
  const focusMode = useStore((s) => s.focusMode);
  const layout = useLayoutMode();

  // Never keep two editors on the same document: focus mode owns it while open.
  if (focusMode) return <Box sx={{ height: '100%' }} />;
  if (scriveningsRootId) return <ScriveningsView rootId={scriveningsRootId} />;
  if (splitEnabled && layout !== 'mobile') return <SplitEditor />;
  if (activeDocId && docExists) return <DocumentPage key={activeDocId} docId={activeDocId} />;
  return (
    <EmptyState
      icon={<EditNoteIcon />}
      title="Pick something to write"
      description="Choose a scene in the binder, or create a new one. Everything you type is saved automatically."
      action={
        <Button
          variant="contained"
          onClick={async () => {
            const s = useStore.getState();
            const first = sceneSequence(s.docs)[0];
            if (first) return s.openDoc(first.id);
            const d = await s.createDoc({ type: 'scene', parentId: null });
            s.openDoc(d.id);
          }}
        >
          Start writing
        </Button>
      }
    />
  );
}

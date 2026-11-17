import { Box, Chip, IconButton, Stack, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import { useStore } from '@/store';
import { useLayoutMode } from '@/hooks/useLayoutMode';
import type { InspectorTab } from '@/store/uiSlice';
import { EmptyState } from '@/components/EmptyState';
import { SynopsisTab } from './SynopsisTab';
import { MetadataTab } from './MetadataTab';
import { SnapshotsTab } from './SnapshotsTab';
import { LinksTab } from './LinksTab';
import { CommentsTab } from './CommentsTab';

const TABS: { value: InspectorTab; label: string }[] = [
  { value: 'synopsis', label: 'Synopsis' },
  { value: 'metadata', label: 'Metadata' },
  { value: 'snapshots', label: 'Snapshots' },
  { value: 'links', label: 'Links' },
  { value: 'comments', label: 'Comments' },
];

/** Right-hand inspector for the selected document. */
export function Inspector() {
  const layout = useLayoutMode();
  const docId = useStore((s) => s.activeEditorDocId && s.docs[s.activeEditorDocId] ? s.activeEditorDocId : s.activeDocId);
  const doc = useStore((s) => (docId ? s.docs[docId] : null));
  const tab = useStore((s) => s.inspectorTab);
  const setTab = useStore((s) => s.setInspectorTab);
  const openComments = useStore((s) => (docId ? s.comments.filter((c) => c.docId === docId && !c.resolved).length : 0));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2, pt: 1.5, pb: 0.5 }} spacing={1}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.4 }}>
            Inspector{doc ? ` · ${doc.type}` : ''}
          </Typography>
          <Typography variant="subtitle1" noWrap sx={{ fontWeight: 500 }}>
            {doc?.title ?? 'Nothing selected'}
          </Typography>
        </Box>
        {layout !== 'desktop' && (
          <IconButton aria-label="Close inspector" onClick={() => useStore.getState().setInspectorDrawer(false)}>
            <CloseIcon />
          </IconButton>
        )}
      </Stack>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" aria-label="Inspector sections" sx={{ borderBottom: 1, borderColor: 'divider', px: 1 }}>
        {TABS.map((t) => (
          <Tab
            key={t.value}
            value={t.value}
            label={
              t.value === 'comments' && openComments ? (
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <span>{t.label}</span>
                  <Chip size="small" label={openComments} color="secondary" sx={{ height: 18, fontSize: 11 }} />
                </Stack>
              ) : (
                t.label
              )
            }
            sx={{ minWidth: 0, px: 1.5 }}
            id={`inspector-tab-${t.value}`}
            aria-controls={`inspector-panel-${t.value}`}
          />
        ))}
      </Tabs>
      <Box role="tabpanel" id={`inspector-panel-${tab}`} aria-labelledby={`inspector-tab-${tab}`} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', p: 2 }}>
        {!doc ? (
          <EmptyState compact icon={<InfoIcon />} title="Select a document" description="The synopsis, metadata, snapshots, links and comments for the selected document appear here." />
        ) : tab === 'synopsis' ? (
          <SynopsisTab key={doc.id} docId={doc.id} />
        ) : tab === 'metadata' ? (
          <MetadataTab key={doc.id} docId={doc.id} />
        ) : tab === 'snapshots' ? (
          <SnapshotsTab key={doc.id} docId={doc.id} />
        ) : tab === 'links' ? (
          <LinksTab key={doc.id} docId={doc.id} />
        ) : (
          <CommentsTab key={doc.id} docId={doc.id} />
        )}
      </Box>
      <Box sx={{ px: 2, py: 1, borderTop: 1, borderColor: 'divider', display: tab === 'links' ? 'block' : 'none' }}>
        <Tooltip title="Type @ in the editor to mention a character, place or item">
          <Typography variant="caption" color="text.secondary">
            Tip: type @ while writing to link bible entries.
          </Typography>
        </Tooltip>
      </Box>
    </Box>
  );
}

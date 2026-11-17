import { useEffect, useMemo, useRef, useState } from 'react';
import { Autocomplete, Box, IconButton, Stack, TextField, ToggleButton, ToggleButtonGroup, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ViewColumnIcon from '@mui/icons-material/ViewColumnOutlined';
import ViewAgendaIcon from '@mui/icons-material/ViewAgendaOutlined';
import { useStore } from '@/store';
import { GROUP_LABELS, groupOfDoc } from '@/lib/tree';
import { ResizeHandle } from '@/components/ResizeHandle';
import { EmptyState } from '@/components/EmptyState';
import { DocumentPage } from '../DocumentPage';
import { ResearchViewer } from '@/features/research/ResearchViewer';

/** Two documents side by side (vertical) or stacked (horizontal). */
export function SplitEditor() {
  const activeDocId = useStore((s) => s.activeDocId);
  const split = useStore((s) => s.split);
  const docs = useStore((s) => s.docs);
  const ratio = useStore((s) => s.settings.layout.splitRatio);
  const updateLayout = useStore((s) => s.updateLayout);
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  const [r, setR] = useState(ratio);
  useEffect(() => setR(ratio), [ratio]);
  const vertical = split.orientation === 'vertical';

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(vertical ? el.clientWidth : el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, [vertical]);

  const options = useMemo(
    () =>
      Object.values(docs)
        .filter((d) => !d.trashed && !(d.type === 'research' && d.metadata.researchKind === 'folder'))
        .map((d) => ({ id: d.id, title: d.title, group: GROUP_LABELS[groupOfDoc(docs, d.id)] }))
        .sort((a, b) => a.group.localeCompare(b.group) || a.title.localeCompare(b.title)),
    [docs],
  );
  const secondary = split.docId ? docs[split.docId] : null;
  const primaryPx = Math.round(size * r);

  return (
    <Box ref={containerRef} sx={{ display: 'flex', flexDirection: vertical ? 'row' : 'column', height: '100%', minHeight: 0 }}>
      <Box sx={{ flex: `0 0 ${primaryPx || 50}${primaryPx ? 'px' : '%'}`, minWidth: 0, minHeight: 0 }}>
        {activeDocId && docs[activeDocId] ? <DocumentPage key={activeDocId} docId={activeDocId} dense /> : <EmptyState compact title="Choose a document in the binder" />}
      </Box>
      <ResizeHandle
        orientation={vertical ? 'vertical' : 'horizontal'}
        label="Resize split"
        value={primaryPx}
        min={Math.round(size * 0.2)}
        max={Math.round(size * 0.8)}
        onChange={(v) => size && setR(v / size)}
        onCommit={(v) => size && updateLayout({ splitRatio: Number((v / size).toFixed(3)) })}
      />
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1, py: 0.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          <Autocomplete
            size="small"
            options={options}
            groupBy={(o) => o.group}
            getOptionLabel={(o) => o.title}
            isOptionEqualToValue={(a, b) => a.id === b.id}
            value={options.find((o) => o.id === split.docId) ?? null}
            onChange={(_, v) => useStore.getState().setSplitDoc(v?.id ?? null)}
            renderInput={(params) => <TextField {...params} placeholder="Open a document…" inputProps={{ ...params.inputProps, 'aria-label': 'Document in second pane' }} />}
            sx={{ flex: 1, maxWidth: 420 }}
          />
          <Box sx={{ flex: 1 }} />
          <ToggleButtonGroup
            size="small"
            exclusive
            value={split.orientation}
            onChange={(_, v) => v && useStore.getState().setSplitOrientation(v)}
            aria-label="Split orientation"
          >
            <ToggleButton value="vertical" aria-label="Side by side">
              <ViewColumnIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="horizontal" aria-label="Stacked">
              <ViewAgendaIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
          <Tooltip title="Close split">
            <IconButton size="small" aria-label="Close split" onClick={() => useStore.getState().toggleSplit(false)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        <Box sx={{ flex: 1, minHeight: 0 }}>
          {!secondary ? (
            <EmptyState compact title="Pick a document" description="Notes, research or another scene — keep it open beside your draft." />
          ) : secondary.id === activeDocId ? (
            <EmptyState compact title="Already open in the other pane" description="Choose a different document to compare or reference." />
          ) : secondary.type === 'research' && secondary.metadata.researchKind !== 'note' ? (
            <ResearchViewer docId={secondary.id} />
          ) : (
            <DocumentPage key={secondary.id} docId={secondary.id} dense autoFocus={false} />
          )}
        </Box>
      </Box>
    </Box>
  );
}

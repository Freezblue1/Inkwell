import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import GridOnIcon from '@mui/icons-material/GridOnOutlined';
import type { ID, InkDocument } from '@/types/models';
import { useStore } from '@/store';
import { nearestAncestorOfType, sceneSequence } from '@/lib/tree';
import { confirmDialog, promptDialog } from '@/components/DialogHost';
import { EmptyState } from '@/components/EmptyState';
import { DOC_COLORS } from '@/features/binder/docIcons';

type Mode = 'threads' | 'characters' | 'pov';

interface GridRow {
  id: ID;
  name: string;
  color: string;
  isThread: boolean;
}

/**
 * Plot grid: scenes in columns; plot threads, characters or POV in rows.
 * Click a cell to toggle it; double-click a thread cell to add a note.
 */
export function PlotGrid() {
  const docs = useStore((s) => s.docs);
  const threads = useStore((s) => s.plotThreads);
  const bible = useStore((s) => s.bible);
  const [mode, setMode] = useState<Mode>('threads');
  const [noteCell, setNoteCell] = useState<{ threadId: ID; docId: ID; note: string } | null>(null);
  const [menu, setMenu] = useState<{ el: HTMLElement; id: ID } | null>(null);

  const scenes = useMemo(() => sceneSequence(docs), [docs]);
  const characters = bible.filter((b) => b.kind === 'character');
  const rows: GridRow[] =
    mode === 'threads'
      ? threads.map((t) => ({ id: t.id, name: t.name, color: t.color, isThread: true }))
      : characters.map((c, i) => ({ id: c.id, name: c.name, color: c.color || DOC_COLORS[i % DOC_COLORS.length], isThread: false }));

  // Chapter spans for the header row.
  const chapterSpans = useMemo(() => {
    const spans: { title: string; count: number }[] = [];
    scenes.forEach((s) => {
      const ch = s.type === 'chapter' ? s : nearestAncestorOfType(docs, s.id, 'chapter');
      const title = ch?.title ?? '—';
      if (spans.length && spans[spans.length - 1].title === title) spans[spans.length - 1].count++;
      else spans.push({ title, count: 1 });
    });
    return spans;
  }, [scenes, docs]);

  const s = useStore.getState;

  const cellState = (row: GridRow, scene: InkDocument): { on: boolean; note: string } => {
    if (mode === 'threads') {
      const c = threads.find((t) => t.id === row.id)?.cells[scene.id];
      return { on: !!c?.on, note: c?.note ?? '' };
    }
    if (mode === 'pov') return { on: scene.metadata.pov === row.id, note: '' };
    const on = scene.metadata.linkedIds.includes(row.id) || scene.metadata.mentionIds.includes(row.id) || scene.metadata.pov === row.id;
    return { on, note: scene.metadata.mentionIds.includes(row.id) ? '@' : '' };
  };

  const toggle = (row: GridRow, scene: InkDocument) => {
    const st = cellState(row, scene);
    if (mode === 'threads') void s().setPlotCell(row.id, scene.id, st.on ? null : { on: true, note: st.note });
    else if (mode === 'pov') void s().updateDocMeta(scene.id, { pov: st.on ? null : row.id });
    else {
      const linked = scene.metadata.linkedIds;
      void s().updateDocMeta(scene.id, { linkedIds: linked.includes(row.id) ? linked.filter((x) => x !== row.id) : [...linked, row.id] });
    }
  };

  const addThread = async () => {
    const name = await promptDialog({ title: 'New plot thread', label: 'Thread name (e.g. “The heist”, “Romance”)' });
    if (name?.trim()) await s().createPlotThread(name.trim());
  };

  if (!scenes.length) return <EmptyState icon={<GridOnIcon />} title="No scenes yet" description="The plot grid shows how threads and characters move through your scenes." />;

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
        <Typography variant="h5" component="h2" sx={{ flex: 1 }}>
          Plot grid
        </Typography>
        <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v) => v && setMode(v)} aria-label="Rows">
          <ToggleButton value="threads">Plot threads</ToggleButton>
          <ToggleButton value="characters">Characters</ToggleButton>
          <ToggleButton value="pov">POV</ToggleButton>
        </ToggleButtonGroup>
        {mode === 'threads' && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => void addThread()}>
            Thread
          </Button>
        )}
      </Stack>

      {rows.length === 0 ? (
        <EmptyState
          compact
          title={mode === 'threads' ? 'No plot threads' : 'No characters'}
          description={mode === 'threads' ? 'Add threads such as the main plot, a romance or a mystery, then mark the scenes where each advances.' : 'Create characters in the Story Bible to track who appears where.'}
          action={
            mode === 'threads' ? (
              <Button onClick={() => void addThread()} startIcon={<AddIcon />}>
                Add thread
              </Button>
            ) : (
              <Button onClick={() => s().setPlanTab('bible')}>Open Story Bible</Button>
            )
          }
        />
      ) : (
        <Box sx={{ overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 2, bgcolor: 'background.paper', maxHeight: '70vh' }}>
          <Box component="table" role="grid" aria-label="Plot grid" sx={{ borderCollapse: 'separate', borderSpacing: 0, minWidth: '100%' }}>
            <thead>
              <tr>
                <Box component="th" sx={{ ...stickyCorner, top: 0 }} />
                {chapterSpans.map((sp, i) => (
                  <Box component="th" key={i} colSpan={sp.count} sx={{ ...headCell, top: 0, fontSize: 11, color: 'text.secondary', borderLeft: 2, borderLeftColor: 'divider' }}>
                    {sp.title}
                  </Box>
                ))}
              </tr>
              <tr>
                <Box component="th" sx={{ ...stickyCorner, top: 28, textAlign: 'left', px: 1.5 }}>
                  {mode === 'threads' ? 'Thread' : 'Character'}
                </Box>
                {scenes.map((sc) => (
                  <Box component="th" key={sc.id} scope="col" sx={{ ...headCell, top: 28 }}>
                    <Tooltip title={`${sc.title}${sc.synopsis ? ` — ${sc.synopsis}` : ''}`}>
                      <Box component="button" onClick={() => s().openDoc(sc.id)} sx={{ all: 'unset', cursor: 'pointer', display: 'block', width: 112, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 500, '&:focus-visible': { outline: 2 } }}>
                        {sc.title}
                      </Box>
                    </Tooltip>
                  </Box>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <Box component="th" scope="row" sx={{ ...rowHead }}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: row.color, flex: '0 0 10px' }} />
                      <Typography variant="body2" noWrap sx={{ flex: 1, fontWeight: 500 }}>
                        {row.name}
                      </Typography>
                      {row.isThread && (
                        <IconButton size="small" aria-label={`Actions for ${row.name}`} onClick={(e) => setMenu({ el: e.currentTarget, id: row.id })}>
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Stack>
                  </Box>
                  {scenes.map((sc) => {
                    const st = cellState(row, sc);
                    return (
                      <Box component="td" key={sc.id} sx={{ borderBottom: 1, borderLeft: 1, borderColor: 'divider', p: 0.5, width: 120, height: 52, verticalAlign: 'middle' }}>
                        <Box
                          component="button"
                          role="gridcell"
                          aria-pressed={st.on}
                          aria-label={`${row.name} in ${sc.title}${st.note ? `: ${st.note}` : ''}`}
                          onClick={() => toggle(row, sc)}
                          onDoubleClick={() => row.isThread && setNoteCell({ threadId: row.id, docId: sc.id, note: st.note })}
                          title={row.isThread ? 'Click to toggle · double-click for a note' : 'Click to toggle'}
                          sx={{
                            all: 'unset',
                            boxSizing: 'border-box',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '100%',
                            height: '100%',
                            borderRadius: 1,
                            cursor: 'pointer',
                            fontSize: 11,
                            lineHeight: 1.2,
                            textAlign: 'center',
                            px: 0.5,
                            overflow: 'hidden',
                            bgcolor: st.on ? alpha(row.color, 0.85) : 'transparent',
                            color: st.on ? '#fff' : 'text.secondary',
                            '&:hover': { bgcolor: st.on ? row.color : 'action.hover' },
                            '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
                          }}
                        >
                          {st.on ? st.note || '●' : ''}
                        </Box>
                      </Box>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </Box>
        </Box>
      )}

      <Menu anchorEl={menu?.el} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={async () => {
            const t = threads.find((x) => x.id === menu!.id)!;
            setMenu(null);
            const name = await promptDialog({ title: 'Rename thread', initial: t.name });
            if (name?.trim()) await s().savePlotThread({ ...t, name: name.trim() });
          }}
        >
          Rename
        </MenuItem>
        <MenuItem
          onClick={async () => {
            const t = threads.find((x) => x.id === menu!.id)!;
            setMenu(null);
            const color = DOC_COLORS[(DOC_COLORS.indexOf(t.color) + 1) % DOC_COLORS.length];
            await s().savePlotThread({ ...t, color });
          }}
        >
          Next color
        </MenuItem>
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={async () => {
            const t = threads.find((x) => x.id === menu!.id)!;
            setMenu(null);
            if (await confirmDialog({ title: `Delete “${t.name}”?`, confirmLabel: 'Delete', danger: true })) await s().deletePlotThread(t.id);
          }}
        >
          Delete thread
        </MenuItem>
      </Menu>

      <Dialog open={!!noteCell} onClose={() => setNoteCell(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Cell note</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            margin="dense"
            label="What happens to this thread here?"
            value={noteCell?.note ?? ''}
            onChange={(e) => setNoteCell((c) => (c ? { ...c, note: e.target.value } : c))}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              if (noteCell) void s().setPlotCell(noteCell.threadId, noteCell.docId, null);
              setNoteCell(null);
            }}
          >
            Clear cell
          </Button>
          <Button
            variant="contained"
            onClick={() => {
              if (noteCell) void s().setPlotCell(noteCell.threadId, noteCell.docId, { on: true, note: noteCell.note.trim() });
              setNoteCell(null);
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

const headCell = {
  position: 'sticky',
  zIndex: 2,
  bgcolor: 'background.paper',
  borderBottom: 1,
  borderColor: 'divider',
  px: 0.5,
  height: 28,
  fontWeight: 500,
} as const;

const stickyCorner = { ...headCell, left: 0, zIndex: 3, minWidth: 180 } as const;

const rowHead = {
  position: 'sticky',
  left: 0,
  zIndex: 1,
  bgcolor: 'background.paper',
  borderBottom: 1,
  borderRight: 1,
  borderColor: 'divider',
  px: 1.5,
  minWidth: 180,
  maxWidth: 220,
  textAlign: 'left',
} as const;

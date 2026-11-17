import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Autocomplete, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, MenuItem, Select, Stack, TextField, Tooltip } from '@mui/material';
import ImageIcon from '@mui/icons-material/ImageOutlined';
import StyleIcon from '@mui/icons-material/StyleOutlined';
import LayersClearIcon from '@mui/icons-material/LayersClearOutlined';
import type { ID, Whiteboard } from '@/types/models';
import { useStore } from '@/store';
import { deleteWhiteboard, duplicateWhiteboard, isOpen, listWhiteboards, makeWhiteboard, putWhiteboard } from '@/db/repos/whiteboards';
import { sceneSequence } from '@/lib/tree';
import { newId } from '@/lib/ids';
import { NOTE_COLORS, textHeight } from '@/lib/whiteboard';
import { confirmDialog, promptDialog } from '@/components/DialogHost';
import { ViewSkeleton } from '@/components/ViewSkeleton';
import { registerFlusher } from '@/features/editor/autosave';
import { WhiteboardEditor, type WhiteboardHandle } from './WhiteboardEditor';
import { WhiteboardTabs, type SaveState } from './WhiteboardTabs';
import { exportWhiteboardPng } from './exportPng';

const SAVE_DELAY_MS = 600;
type Patch = Pick<Whiteboard, 'elements' | 'viewport'>;

/**
 * Whiteboards as tabs. Every open tab keeps its editor mounted (so each has
 * its own undo history); boards autosave independently and closed boards
 * stay saved under "All boards".
 */
export function WhiteboardView() {
  const projectId = useStore((s) => s.project?.id);
  const docs = useStore((s) => s.docs);
  const notify = useStore((s) => s.notify);
  const [boards, setBoards] = useState<Whiteboard[] | null>(null);
  const [activeId, setActiveId] = useState<ID | null>(null);
  const [status, setStatus] = useState<Record<ID, SaveState>>({});
  const [cardOpen, setCardOpen] = useState(false);
  const handles = useRef(new Map<ID, WhiteboardHandle>());
  const pending = useRef(new Map<ID, { board: Whiteboard; timer: ReturnType<typeof setTimeout> }>());
  const savers = useRef(new Map<ID, (patch: Patch) => void>());
  const boardsRef = useRef<Whiteboard[] | null>(null);
  boardsRef.current = boards;

  const rememberActive = (id: ID) => {
    setActiveId(id);
    if (projectId) localStorage.setItem(`inkwell:whiteboard:${projectId}`, id);
  };

  // Load boards; make sure at least one tab is open.
  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    void listWhiteboards(projectId).then(async (list) => {
      if (!list.some(isOpen)) {
        const first = makeWhiteboard(projectId, list.length ? `Board ${list.length + 1}` : 'Brainstorm', list.length);
        await putWhiteboard(first);
        list = [...list, first];
      }
      if (!alive) return;
      setBoards(list);
      const remembered = localStorage.getItem(`inkwell:whiteboard:${projectId}`);
      const open = list.filter(isOpen);
      setActiveId(open.find((b) => b.id === remembered)?.id ?? open[0].id);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  /** Writes one board's pending changes now. */
  const flushBoard = useCallback(async (id: ID) => {
    const p = pending.current.get(id);
    if (!p) return;
    clearTimeout(p.timer);
    pending.current.delete(id);
    setStatus((s) => ({ ...s, [id]: 'saving' }));
    await putWhiteboard(p.board);
    setStatus((s) => ({ ...s, [id]: pending.current.has(id) ? 'unsaved' : 'saved' }));
  }, []);

  const flushAllBoards = useCallback(async () => {
    await Promise.all([...pending.current.keys()].map((id) => flushBoard(id)));
  }, [flushBoard]);

  // Save with Ctrl+S / on tab hide / before quitting (via the editor autosave engine), and on unmount.
  useEffect(() => {
    const unregister = registerFlusher(flushAllBoards);
    return () => {
      unregister();
      void flushAllBoards();
    };
  }, [flushAllBoards]);

  /** Queues a save for a board (debounced). */
  const queueSave = useCallback(
    (board: Whiteboard) => {
      const prev = pending.current.get(board.id);
      if (prev) clearTimeout(prev.timer);
      pending.current.set(board.id, { board, timer: setTimeout(() => void flushBoard(board.id), SAVE_DELAY_MS) });
      setStatus((s) => (s[board.id] === 'unsaved' ? s : { ...s, [board.id]: 'unsaved' }));
    },
    [flushBoard],
  );

  /** A stable save callback per board (editors re-run effects when it changes). */
  const saverFor = (id: ID) => {
    let fn = savers.current.get(id);
    if (!fn) {
      fn = (patch: Patch) => {
        const cur = boardsRef.current?.find((b) => b.id === id);
        if (!cur || (cur.elements === patch.elements && cur.viewport === patch.viewport)) return;
        const next = { ...cur, ...patch, updatedAt: Date.now() };
        setBoards((list) => list?.map((b) => (b.id === id ? next : b)) ?? list);
        queueSave(next);
      };
      savers.current.set(id, fn);
    }
    return fn;
  };

  /** Updates board metadata (name, order, open, background) and saves immediately. */
  const updateBoards = async (changed: Whiteboard[]) => {
    const meta = (b: Whiteboard) => ({ name: b.name, order: b.order, open: b.open, background: b.background });
    const map = new Map(changed.map((b) => [b.id, meta(b)]));
    // Only metadata changes here; keep the newest elements/viewport from state.
    setBoards((list) => list?.map((b) => (map.has(b.id) ? { ...b, ...map.get(b.id) } : b)) ?? list);
    await Promise.all(
      changed.map((c) => {
        const p = pending.current.get(c.id);
        // A queued content save must carry the new metadata too, or it would overwrite it.
        if (p) p.board = { ...p.board, ...meta(c) };
        const latest = boardsRef.current?.find((b) => b.id === c.id) ?? c;
        return putWhiteboard({ ...(p?.board ?? latest), ...meta(c) });
      }),
    );
  };

  const openBoards = useMemo(() => (boards ?? []).filter(isOpen).sort((a, b) => a.order - b.order), [boards]);
  const closedBoards = useMemo(() => (boards ?? []).filter((b) => !isOpen(b)).sort((a, b) => b.updatedAt - a.updatedAt), [boards]);
  const active = openBoards.find((b) => b.id === activeId) ?? openBoards[0] ?? null;
  const nextOrder = () => Math.max(-1, ...(boards ?? []).map((b) => b.order)) + 1;

  const create = async () => {
    if (!projectId || !boards) return;
    const name = await promptDialog({ title: 'New whiteboard tab', label: 'Name', initial: `Board ${boards.length + 1}` });
    if (!name?.trim()) return;
    const wb = makeWhiteboard(projectId, name.trim(), nextOrder());
    await putWhiteboard(wb);
    setBoards([...boards, wb]);
    rememberActive(wb.id);
  };

  const rename = async (id: ID) => {
    const b = boards?.find((x) => x.id === id);
    if (!b) return;
    const name = await promptDialog({ title: 'Rename whiteboard', initial: b.name });
    if (name?.trim()) await updateBoards([{ ...b, name: name.trim() }]);
  };

  const duplicate = async (id: ID) => {
    await flushBoard(id);
    const b = boardsRef.current?.find((x) => x.id === id);
    if (!b) return;
    const copy = duplicateWhiteboard(b, `${b.name} (copy)`, nextOrder());
    await putWhiteboard(copy);
    setBoards((list) => (list ? [...list, copy] : list));
    rememberActive(copy.id);
    notify(`Saved a copy as “${copy.name}”`);
  };

  const move = async (id: ID, delta: -1 | 1) => {
    const i = openBoards.findIndex((b) => b.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= openBoards.length) return;
    const a = openBoards[i];
    const b = openBoards[j];
    await updateBoards([
      { ...a, order: b.order },
      { ...b, order: a.order },
    ]);
  };

  const close = async (id: ID) => {
    const b = boards?.find((x) => x.id === id);
    if (!b) return;
    await flushBoard(id);
    const rest = openBoards.filter((x) => x.id !== id);
    if (!rest.length && projectId) {
      // Always keep one tab open.
      const fresh = makeWhiteboard(projectId, `Board ${(boards?.length ?? 0) + 1}`, nextOrder());
      await putWhiteboard(fresh);
      setBoards((list) => (list ? [...list, fresh] : list));
      rest.push(fresh);
    }
    await updateBoards([{ ...(boardsRef.current?.find((x) => x.id === id) ?? b), open: false }]);
    handles.current.delete(id);
    if (activeId === id) {
      const idx = openBoards.findIndex((x) => x.id === id);
      rememberActive((rest[Math.min(idx, rest.length - 1)] ?? rest[0]).id);
    }
    notify(`Closed “${b.name}” — reopen it from All boards`, 'info', { label: 'Reopen', run: () => void reopen(id) });
  };

  const reopen = async (id: ID) => {
    const b = boardsRef.current?.find((x) => x.id === id);
    if (!b) return;
    await updateBoards([{ ...b, open: true, order: nextOrder() }]);
    rememberActive(id);
  };

  const remove = async (id: ID) => {
    const b = boards?.find((x) => x.id === id);
    if (!b || !projectId) return;
    if (!(await confirmDialog({ title: `Delete “${b.name}”?`, message: 'The board and everything on it are deleted permanently.', confirmLabel: 'Delete', danger: true }))) return;
    const p = pending.current.get(id);
    if (p) clearTimeout(p.timer);
    pending.current.delete(id);
    await deleteWhiteboard(id);
    handles.current.delete(id);
    savers.current.delete(id);
    let rest = (boardsRef.current ?? []).filter((x) => x.id !== id);
    if (!rest.some(isOpen)) {
      const fresh = makeWhiteboard(projectId, 'Brainstorm', nextOrder());
      await putWhiteboard(fresh);
      rest = [...rest, fresh];
    }
    setBoards(rest);
    if (activeId === id) rememberActive(rest.filter(isOpen)[0].id);
  };

  const saveAll = async () => {
    await flushAllBoards();
    notify('All whiteboards saved');
  };

  // Ctrl+S inside the whiteboard also confirms the board save.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') void flushAllBoards();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [flushAllBoards]);

  const setBackground = (background: Whiteboard['background']) => {
    if (active) void updateBoards([{ ...active, background }]);
  };

  const exportPng = async () => {
    const h = active ? handles.current.get(active.id) : undefined;
    const svg = h?.svg();
    if (!h || !svg || !active) return;
    try {
      await exportWhiteboardPng(svg, h.elements(), '#fbfbf8', active.name);
      notify('Whiteboard exported as PNG');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Export failed', 'error');
    }
  };

  const scenes = useMemo(() => sceneSequence(docs), [docs]);

  const addSceneCard = (docId: string) => {
    const h = active ? handles.current.get(active.id) : undefined;
    const d = docs[docId];
    if (!h || !d) return;
    const c = h.center();
    const text = d.synopsis ? `${d.title}\n${d.synopsis}` : d.title;
    const w = 220;
    h.addElement({
      id: newId(),
      type: 'note',
      x: c.x - w / 2,
      y: c.y - 70,
      w,
      // +1 line of headroom: the handwriting font may not be loaded when we measure.
      h: Math.max(110, textHeight(text, w - 24, 16) + 64),
      text,
      fill: NOTE_COLORS[scenes.findIndex((s) => s.id === docId) % NOTE_COLORS.length] ?? NOTE_COLORS[0],
      color: 'ink',
      strokeWidth: 1,
      docId,
    });
    setCardOpen(false);
  };

  if (!boards || !active) return <ViewSkeleton />;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 480 }}>
      <WhiteboardTabs
        openBoards={openBoards}
        closedBoards={closedBoards}
        activeId={active.id}
        status={status}
        onSelect={rememberActive}
        onCreate={() => void create()}
        onRename={(id) => void rename(id)}
        onDuplicate={(id) => void duplicate(id)}
        onMove={(id, d) => void move(id, d)}
        onClose={(id) => void close(id)}
        onReopen={(id) => void reopen(id)}
        onDelete={(id) => void remove(id)}
        onSaveAll={() => void saveAll()}
      />
      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2, py: 0.5, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ flex: 1 }} />
        <Button startIcon={<StyleIcon />} onClick={() => setCardOpen(true)} disabled={!scenes.length}>
          Add scene card
        </Button>
        <Select size="small" value={active.background} onChange={(e) => setBackground(e.target.value as Whiteboard['background'])} inputProps={{ 'aria-label': 'Background' }} sx={{ height: 36 }}>
          <MenuItem value="dots">Dots</MenuItem>
          <MenuItem value="grid">Grid</MenuItem>
          <MenuItem value="plain">Plain</MenuItem>
        </Select>
        <Tooltip title="Export as PNG">
          <IconButton aria-label="Export as PNG" onClick={() => void exportPng()}>
            <ImageIcon />
          </IconButton>
        </Tooltip>
        <Tooltip title="Clear board (undoable)">
          <IconButton
            aria-label="Clear board"
            onClick={async () => {
              if (await confirmDialog({ title: 'Clear this board?', message: 'Everything on it is removed. You can undo with Ctrl+Z.', confirmLabel: 'Clear' })) handles.current.get(active.id)?.clear();
            }}
          >
            <LayersClearIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {/* One editor per open tab; inactive ones are hidden but keep their undo history. */}
      {openBoards.map((b) => (
        <Box key={b.id} role="tabpanel" aria-label={b.name} sx={{ display: b.id === active.id ? 'flex' : 'none', flex: 1, minHeight: 0, flexDirection: 'column' }}>
          <WhiteboardEditor board={b} onSave={saverFor(b.id)} registerHandle={(h) => handles.current.set(b.id, h)} />
        </Box>
      ))}

      <Dialog open={cardOpen} onClose={() => setCardOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Add scene card</DialogTitle>
        <DialogContent>
          <Autocomplete
            options={scenes}
            getOptionLabel={(o) => o.title}
            onChange={(_, v) => v && addSceneCard(v.id)}
            renderInput={(p) => <TextField {...p} autoFocus margin="dense" label="Scene" helperText="The card shows the title and synopsis; click its ↗ corner to open the scene." />}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCardOpen(false)}>Cancel</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

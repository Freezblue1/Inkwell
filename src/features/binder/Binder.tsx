import { useCallback, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type ReactElement } from 'react';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragMoveEvent, type DragOverEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useVirtualizer } from '@tanstack/react-virtual';
import { Box, ButtonBase, Divider, IconButton, InputAdornment, ListItemIcon, ListItemText, ListSubheader, Menu, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAddedOutlined';
import { SPECIAL_CHAPTERS } from '@/lib/specialChapters';
import { promptDialog } from '@/components/DialogHost';
import AddIcon from '@mui/icons-material/Add';
import NoteAddIcon from '@mui/icons-material/NoteAddOutlined';
import SearchIcon from '@mui/icons-material/Search';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import RestoreIcon from '@mui/icons-material/RestoreFromTrash';
import DeleteForeverIcon from '@mui/icons-material/DeleteForeverOutlined';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import MenuBookIcon from '@mui/icons-material/MenuBookOutlined';
import AutoStoriesIcon from '@mui/icons-material/AutoStoriesOutlined';
import ArticleIcon from '@mui/icons-material/ArticleOutlined';
import StickyNote2Icon from '@mui/icons-material/StickyNote2Outlined';
import CloseIcon from '@mui/icons-material/Close';
import type { DocType, ID, InkDocument } from '@/types/models';
import { useStore } from '@/store';
import { useDebouncedValue } from '@/hooks/useDebounced';
import {
  aggregateWordCounts,
  canHaveChildren,
  childrenOf,
  flattenTree,
  GROUP_LABELS,
  groupOfDoc,
  groupRoots,
  manuscriptWordCount,
  nearestAncestorOfType,
  type BinderGroup,
  type FlatNode,
} from '@/lib/tree';
import { confirmDialog } from '@/components/DialogHost';
import { BinderRow } from './BinderRow';
import { BinderContextMenu } from './BinderContextMenu';
import { docIcon } from './docIcons';
import { getProjection, removeChildrenOf, resolveDrop } from './binderDnd';

type Row =
  | { kind: 'group'; key: string; group: BinderGroup; count: number }
  | { kind: 'node'; key: string; node: FlatNode; group: BinderGroup }
  | { kind: 'empty'; key: string; group: BinderGroup }
  | { kind: 'trash-header'; key: string; count: number }
  | { kind: 'trash'; key: string; doc: InkDocument };

const GROUPS: BinderGroup[] = ['frontmatter', 'manuscript', 'backmatter', 'notes'];

/** The binder: Front Matter, Manuscript, Back Matter, Notes and Trash. */
export function Binder() {
  const docs = useStore((s) => s.docs);
  const project = useStore((s) => s.project);
  const collapsed = useStore((s) => s.collapsed);
  const activeDocId = useStore((s) => s.activeDocId);
  const scriveningsRootId = useStore((s) => s.scriveningsRootId);
  const density = useStore((s) => s.settings.density);
  const binderWidth = useStore((s) => s.settings.layout.binderWidth);
  const rowH = density === 'compact' ? 28 : 34;

  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim().toLowerCase(), 120);
  const [groupClosed, setGroupClosed] = useState<Partial<Record<BinderGroup, boolean>>>({});
  const [trashOpen, setTrashOpen] = useState(false);
  const [renamingId, setRenamingId] = useState<ID | null>(null);
  const [focusId, setFocusId] = useState<ID | null>(null);
  const [menu, setMenu] = useState<{ id: ID; position: { top: number; left: number } } | null>(null);
  const [addAnchor, setAddAnchor] = useState<HTMLElement | null>(null);
  const [drag, setDrag] = useState<{ activeId: ID; overId: ID | null; offsetX: number } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const totals = aggregateWordCounts(docs);
  const labels = useMemo(() => new Map((project?.labels ?? []).map((l) => [l.id, l])), [project?.labels]);
  // Status chips only when there is room; titles matter more.
  const showStatus = binderWidth >= 340;

  const flatByGroup = useMemo(() => {
    const out = {} as Record<BinderGroup, FlatNode[]>;
    for (const g of GROUPS) out[g] = flattenTree(docs, groupRoots(docs, g), collapsed);
    return out;
  }, [docs, collapsed]);

  const trashed = useMemo(
    () =>
      Object.values(docs)
        .filter((d) => d.trashed && d.type !== 'research' && (!d.parentId || !docs[d.parentId]?.trashed))
        .sort((a, b) => (b.trashedAt ?? 0) - (a.trashedAt ?? 0)),
    [docs],
  );

  const rows: Row[] = useMemo(() => {
    if (q) {
      return Object.values(docs)
        .filter((d) => !d.trashed && d.type !== 'research' && (d.title.toLowerCase().includes(q) || d.synopsis.toLowerCase().includes(q)))
        .slice(0, 300)
        .map((d) => ({
          kind: 'node' as const,
          key: d.id,
          group: groupOfDoc(docs, d.id),
          node: { id: d.id, parentId: d.parentId, depth: 0, doc: d, hasChildren: false },
        }));
    }
    const out: Row[] = [];
    for (const g of GROUPS) {
      let nodes = flatByGroup[g];
      out.push({ kind: 'group', key: `g-${g}`, group: g, count: nodes.length });
      if (groupClosed[g]) continue;
      if (drag) nodes = removeChildrenOf(nodes, drag.activeId);
      if (!nodes.length) out.push({ kind: 'empty', key: `e-${g}`, group: g });
      nodes.forEach((n) => out.push({ kind: 'node', key: n.id, node: n, group: g }));
    }
    out.push({ kind: 'trash-header', key: 'trash', count: trashed.length });
    if (trashOpen) trashed.forEach((d) => out.push({ kind: 'trash', key: `t-${d.id}`, doc: d }));
    return out;
  }, [q, docs, flatByGroup, groupClosed, drag, trashed, trashOpen]);

  const nodeRows = useMemo(() => rows.filter((r): r is Extract<Row, { kind: 'node' }> => r.kind === 'node'), [rows]);
  const sortableIds = useMemo(() => nodeRows.map((r) => r.node.id), [nodeRows]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: (i) => (rows[i].kind === 'group' || rows[i].kind === 'trash-header' ? 36 : rowH),
    overscan: 16,
  });

  // --- Drag and drop ---------------------------------------------------------
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const activeGroup = drag ? groupOfDoc(docs, drag.activeId) : null;
  const groupItems = useMemo(() => (drag && activeGroup ? removeChildrenOf(flatByGroup[activeGroup], drag.activeId) : []), [drag, activeGroup, flatByGroup]);
  const projection = drag?.overId && groupItems.some((i) => i.id === drag.overId) ? getProjection(groupItems, drag.activeId, drag.overId, drag.offsetX) : null;

  const onDragStart = (e: DragStartEvent) => setDrag({ activeId: String(e.active.id), overId: String(e.active.id), offsetX: 0 });
  const onDragMove = (e: DragMoveEvent) => setDrag((d) => (d ? { ...d, offsetX: e.delta.x } : d));
  const onDragOver = (e: DragOverEvent) => setDrag((d) => (d ? { ...d, overId: e.over ? String(e.over.id) : null } : d));
  const onDragEnd = (e: DragEndEvent) => {
    const d = drag;
    setDrag(null);
    if (!d || !e.over || !projection) return;
    const res = resolveDrop(groupItems, d.activeId, String(e.over.id), projection, (pid) => childrenOf(useStore.getState().docs, pid));
    if (!res) return;
    void useStore.getState().moveDoc(d.activeId, res.parentId, res.index);
    if (res.parentId && useStore.getState().collapsed[res.parentId]) useStore.getState().toggleCollapsed(res.parentId);
  };

  // --- Actions ---------------------------------------------------------------
  const open = useCallback((id: ID) => {
    setFocusId(id);
    useStore.getState().openDoc(id);
  }, []);
  const toggle = useCallback((id: ID) => useStore.getState().toggleCollapsed(id), []);
  const onContextMenu = useCallback((id: ID, e: MouseEvent) => {
    setFocusId(id);
    setMenu({ id, position: { top: e.clientY, left: e.clientX } });
  }, []);
  const onRename = useCallback((id: ID, title: string | null) => {
    setRenamingId(null);
    const t = title?.trim();
    if (t && t !== useStore.getState().docs[id]?.title) void useStore.getState().updateDoc(id, { title: t });
  }, []);

  const createAndRename = async (type: DocType) => {
    const s = useStore.getState();
    const active = s.activeDocId ? s.docs[s.activeDocId] : null;
    let parentId: ID | null = null;
    let afterId: ID | undefined;
    if (type === 'scene') {
      if (active?.type === 'scene') {
        parentId = active.parentId;
        afterId = active.id;
      } else if (active && (active.type === 'chapter' || active.type === 'part')) parentId = active.id;
      else {
        const chapters = Object.values(s.docs).filter((d) => d.type === 'chapter' && !d.trashed);
        parentId = chapters.length ? chapters.sort((a, b) => b.updatedAt - a.updatedAt)[0].id : null;
      }
    } else if (type === 'chapter') {
      const ch = active ? nearestAncestorOfType(s.docs, active.id, 'chapter') : null;
      if (ch) {
        parentId = ch.parentId;
        afterId = ch.id;
      } else if (active?.type === 'part') parentId = active.id;
    }
    const d = await s.createDoc({ type, parentId, afterId });
    if (parentId && s.collapsed[parentId]) s.toggleCollapsed(parentId);
    s.openDoc(d.id);
    setRenamingId(d.id);
    setFocusId(d.id);
  };

  const collapseAll = (value: boolean) => {
    const map: Record<ID, boolean> = {};
    if (value) Object.values(docs).forEach((d) => childrenOf(docs, d.id).length && (map[d.id] = true));
    useStore.getState().setCollapsed(map);
  };

  // --- Keyboard navigation (aria-activedescendant tree) -----------------------
  const scrollToId = (id: ID) => {
    const i = rows.findIndex((r) => r.kind === 'node' && r.node.id === id);
    if (i >= 0) virtualizer.scrollToIndex(i, { align: 'auto' });
  };
  const onKeyDown = async (e: KeyboardEvent<HTMLDivElement>) => {
    if (renamingId) return;
    const s = useStore.getState();
    const idx = nodeRows.findIndex((r) => r.node.id === focusId);
    const cur = idx >= 0 ? nodeRows[idx].node : null;
    const move = (to: number) => {
      const r = nodeRows[Math.max(0, Math.min(nodeRows.length - 1, to))];
      if (r) {
        setFocusId(r.node.id);
        scrollToId(r.node.id);
      }
    };
    const key = e.key;
    if (key === 'ArrowDown' && !e.altKey) return e.preventDefault(), move(idx + 1);
    if (key === 'ArrowUp' && !e.altKey) return e.preventDefault(), move(idx < 0 ? 0 : idx - 1);
    if (key === 'Home') return e.preventDefault(), move(0);
    if (key === 'End') return e.preventDefault(), move(nodeRows.length - 1);
    if (!cur) {
      if (key.startsWith('Arrow')) move(0);
      return;
    }
    if (e.altKey && (key === 'ArrowUp' || key === 'ArrowDown')) {
      e.preventDefault();
      const sibs = childrenOf(docs, cur.doc.parentId);
      const i = sibs.findIndex((d) => d.id === cur.id);
      const allIdx = key === 'ArrowUp' ? i - 1 : i + 1;
      if (allIdx >= 0 && allIdx < sibs.length) await s.moveDoc(cur.id, cur.doc.parentId, allIdx);
      return;
    }
    if (e.altKey && key === 'ArrowRight') {
      e.preventDefault();
      const sibs = childrenOf(docs, cur.doc.parentId);
      const prev = sibs[sibs.findIndex((d) => d.id === cur.id) - 1];
      if (prev && canHaveChildren(prev)) await s.moveDoc(cur.id, prev.id, childrenOf(docs, prev.id).length);
      return;
    }
    if (e.altKey && key === 'ArrowLeft') {
      e.preventDefault();
      const parent = cur.doc.parentId ? docs[cur.doc.parentId] : null;
      if (parent) {
        const sibs = childrenOf(docs, parent.parentId);
        await s.moveDoc(cur.id, parent.parentId, sibs.findIndex((d) => d.id === parent.id) + 1);
      }
      return;
    }
    if (key === 'ArrowRight') {
      e.preventDefault();
      if (cur.hasChildren && collapsed[cur.id]) toggle(cur.id);
      else if (cur.hasChildren) move(idx + 1);
      return;
    }
    if (key === 'ArrowLeft') {
      e.preventDefault();
      if (cur.hasChildren && !collapsed[cur.id]) toggle(cur.id);
      else if (cur.parentId) {
        setFocusId(cur.parentId);
        scrollToId(cur.parentId);
      }
      return;
    }
    if (key === 'Enter' || key === ' ') return e.preventDefault(), open(cur.id);
    if (key === 'F2') return e.preventDefault(), setRenamingId(cur.id);
    if (key === 'Delete') {
      e.preventDefault();
      await s.trashDoc(cur.id);
      s.notify(`Moved “${cur.doc.title}” to the trash`, 'success', { label: 'Undo', run: () => void useStore.getState().restoreDoc(cur.id) });
      move(idx);
      return;
    }
    if (key === 'ContextMenu' || (key === 'F10' && e.shiftKey)) {
      e.preventDefault();
      const el = document.getElementById(`binder-row-${cur.id}`);
      const rect = el?.getBoundingClientRect();
      setMenu({ id: cur.id, position: { top: rect ? rect.bottom : 100, left: rect ? rect.left + 24 : 100 } });
    }
  };

  const manuscriptTotal = manuscriptWordCount(docs);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <Stack direction="row" alignItems="center" sx={{ px: 1.5, pt: 1, pb: 0.5, gap: 0.5 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" component="h2">
            Binder
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {manuscriptTotal.toLocaleString()} words in manuscript
          </Typography>
        </Box>
        <Tooltip title="Collapse all">
          <IconButton size="small" aria-label="Collapse all" onClick={() => collapseAll(true)}>
            <UnfoldLessIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Expand all">
          <IconButton size="small" aria-label="Expand all" onClick={() => collapseAll(false)}>
            <UnfoldMoreIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Add (Ctrl+Alt+N for a new scene)">
          <IconButton size="small" color="primary" aria-label="Add to binder" onClick={(e) => setAddAnchor(e.currentTarget)}>
            <AddIcon />
          </IconButton>
        </Tooltip>
      </Stack>
      <Box sx={{ px: 1.5, pb: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Filter binder"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && setQuery('')}
          inputProps={{ 'aria-label': 'Filter binder' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: query ? (
              <IconButton size="small" aria-label="Clear filter" onClick={() => setQuery('')}>
                <CloseIcon fontSize="small" />
              </IconButton>
            ) : undefined,
          }}
        />
      </Box>

      <Box
        ref={scrollRef}
        role="tree"
        aria-label="Binder"
        tabIndex={0}
        aria-activedescendant={focusId ? `binder-row-${focusId}` : undefined}
        onKeyDown={(e) => void onKeyDown(e)}
        onFocus={() => {
          if (!focusId && activeDocId) setFocusId(activeDocId);
        }}
        sx={{ flex: 1, minHeight: 0, overflowY: 'auto', outline: 'none', pb: 2 }}
      >
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragMove={onDragMove} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setDrag(null)}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            <Box sx={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
              {virtualizer.getVirtualItems().map((vi) => {
                const row = rows[vi.index];
                if (row.kind === 'node') {
                  const n = row.node;
                  return (
                    <BinderRow
                      key={row.key}
                      node={n}
                      top={vi.start}
                      height={vi.size}
                      selected={activeDocId === n.id || scriveningsRootId === n.id}
                      focused={focusId === n.id}
                      collapsed={!!collapsed[n.id]}
                      renaming={renamingId === n.id}
                      total={totals.get(n.id) ?? n.doc.wordCount}
                      label={n.doc.label ? labels.get(n.doc.label) : undefined}
                      projectedDepth={drag?.activeId === n.id && projection ? projection.depth : null}
                      showStatus={showStatus}
                      draggable={!q}
                      onOpen={open}
                      onToggle={toggle}
                      onContextMenu={onContextMenu}
                      onRename={onRename}
                    />
                  );
                }
                return (
                  <Box key={row.key} sx={{ position: 'absolute', top: vi.start, left: 0, right: 0, height: vi.size }}>
                    <StaticRow
                      row={row}
                      closed={row.kind === 'group' ? !!groupClosed[row.group] : row.kind === 'trash-header' ? !trashOpen : false}
                      onToggleGroup={(g) => setGroupClosed((c) => ({ ...c, [g]: !c[g] }))}
                      onToggleTrash={() => setTrashOpen((o) => !o)}
                    />
                  </Box>
                );
              })}
            </Box>
          </SortableContext>
        </DndContext>
      </Box>

      <Menu anchorEl={addAnchor} open={!!addAnchor} onClose={() => setAddAnchor(null)}>
        {(
          [
            ['scene', 'New scene', <DescriptionIcon key="s" fontSize="small" />],
            ['chapter', 'New chapter', <MenuBookIcon key="c" fontSize="small" />],
            ['part', 'New part', <AutoStoriesIcon key="p" fontSize="small" />],
            ['frontmatter', 'Front matter page', <ArticleIcon key="f" fontSize="small" />],
            ['backmatter', 'Back matter page', <ArticleIcon key="b" fontSize="small" />],
            ['note', 'Note', <StickyNote2Icon key="n" fontSize="small" />],
          ] as [DocType, string, ReactElement][]
        ).map(([type, label, icon]) => (
          <MenuItem
            key={type}
            onClick={() => {
              setAddAnchor(null);
              void createAndRename(type);
            }}
          >
            <ListItemIcon>{icon}</ListItemIcon>
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        ))}
        <Divider />
        <ListSubheader sx={{ lineHeight: '28px' }}>Special chapters</ListSubheader>
        {SPECIAL_CHAPTERS.map((sc) => (
          <MenuItem
            key={sc.value}
            onClick={async () => {
              setAddAnchor(null);
              let custom = '';
              if (sc.value === 'custom') {
                const v = await promptDialog({ title: 'Custom special chapter', label: 'Heading (e.g. Coda, Part Zero, Letters)' });
                if (!v?.trim()) return;
                custom = v.trim();
              }
              const d = await useStore.getState().createSpecialChapter(sc.value, custom);
              useStore.getState().openDoc(d.id);
              setFocusId(d.id);
            }}
          >
            <ListItemIcon>
              <BookmarkAddedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={sc.label} secondary={sc.hint} secondaryTypographyProps={{ fontSize: 11 }} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem
          onClick={() => {
            setAddAnchor(null);
            useStore.getState().openDialog('import');
          }}
        >
          <ListItemIcon>
            <NoteAddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Import manuscript…" secondary="Word, Google Docs, Reedsy, Scrivener, Markdown, PDF" secondaryTypographyProps={{ fontSize: 11 }} />
        </MenuItem>
      </Menu>

      <BinderContextMenu docId={menu?.id ?? null} position={menu?.position ?? null} onClose={() => setMenu(null)} onRename={(id) => setRenamingId(id)} />
    </Box>
  );
}

/** Group headers, empty placeholders, trash header and trash items. */
function StaticRow({
  row,
  closed,
  onToggleGroup,
  onToggleTrash,
}: {
  row: Exclude<Row, { kind: 'node' }>;
  closed: boolean;
  onToggleGroup: (g: BinderGroup) => void;
  onToggleTrash: () => void;
}) {
  const s = useStore.getState;
  if (row.kind === 'group' || row.kind === 'trash-header') {
    const isTrash = row.kind === 'trash-header';
    return (
      <Stack direction="row" alignItems="center" sx={{ height: '100%', px: 1, mt: 0.5 }}>
        <ButtonBase
          onClick={() => (isTrash ? onToggleTrash() : onToggleGroup(row.group))}
          aria-expanded={!closed}
          sx={{ flex: 1, justifyContent: 'flex-start', gap: 0.5, borderRadius: 1, px: 0.5, py: 0.25, '&:hover': { bgcolor: 'action.hover' } }}
        >
          <ExpandMoreIcon fontSize="small" sx={{ transform: closed ? 'rotate(-90deg)' : 'none', transition: 'transform 120ms', color: 'text.secondary' }} />
          {isTrash && <DeleteIcon fontSize="small" sx={{ color: 'text.secondary' }} />}
          <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.6 }}>
            {isTrash ? `Trash (${row.count})` : GROUP_LABELS[row.group]}
          </Typography>
        </ButtonBase>
        {isTrash && row.count > 0 && (
          <Tooltip title="Empty trash (permanent)">
            <IconButton
              size="small"
              aria-label="Empty trash"
              onClick={async () => {
                const ok = await confirmDialog({ title: 'Empty the trash?', message: `${row.count} item(s) and their snapshots will be deleted permanently. This cannot be undone.`, confirmLabel: 'Delete forever', danger: true });
                if (ok) {
                  await s().emptyTrash();
                  s().notify('Trash emptied');
                }
              }}
            >
              <DeleteForeverIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Stack>
    );
  }
  if (row.kind === 'empty') {
    return (
      <ButtonBase
        onClick={async () => {
          const type: DocType = row.group === 'frontmatter' ? 'frontmatter' : row.group === 'backmatter' ? 'backmatter' : row.group === 'notes' ? 'note' : 'chapter';
          const d = await s().createDoc({ type, parentId: null });
          s().openDoc(d.id);
        }}
        sx={{ height: '100%', width: '100%', justifyContent: 'flex-start', pl: 5, color: 'text.secondary', fontSize: 13, fontStyle: 'italic' }}
      >
        Empty — click to add
      </ButtonBase>
    );
  }
  const d = row.doc;
  return (
    <Stack direction="row" alignItems="center" sx={{ height: '100%', pl: 4, pr: 1, gap: 0.5, color: 'text.secondary' }}>
      <Box sx={{ fontSize: 18, display: 'flex' }} aria-hidden>
        {docIcon(d, false)}
      </Box>
      <Typography variant="body2" noWrap sx={{ flex: 1, textDecoration: 'line-through', opacity: 0.8 }}>
        {d.title}
      </Typography>
      <Tooltip title="Restore">
        <IconButton
          size="small"
          aria-label={`Restore ${d.title}`}
          onClick={async () => {
            await s().restoreDoc(d.id);
            s().notify(`Restored “${d.title}”`);
          }}
        >
          <RestoreIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Delete forever">
        <IconButton
          size="small"
          aria-label={`Delete ${d.title} forever`}
          onClick={async () => {
            const ok = await confirmDialog({ title: `Delete “${d.title}” forever?`, message: 'Its text, snapshots and comments will be removed permanently.', confirmLabel: 'Delete forever', danger: true });
            if (ok) await s().deleteDocForever(d.id);
          }}
        >
          <DeleteForeverIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Stack>
  );
}

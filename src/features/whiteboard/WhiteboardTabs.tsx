import { useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { Box, CircularProgress, Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import FolderOpenIcon from '@mui/icons-material/FolderOpenOutlined';
import EditIcon from '@mui/icons-material/DriveFileRenameOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/SaveOutlined';
import WorkspacesIcon from '@mui/icons-material/WorkspacesOutlined';
import LayersClearIcon from '@mui/icons-material/LayersClearOutlined';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import type { ID, Whiteboard, WhiteboardGroup } from '@/types/models';
import { relativeTime } from '@/lib/dates';
import { newId } from '@/lib/ids';
import { promptDialog } from '@/components/DialogHost';
import { arrange, chipKey, GROUP_COLORS, nudge, setTabGroup, stripItems, stripKeys, updateGroup, type TabSlot } from '@/lib/boardTabs';

export type SaveState = 'saved' | 'unsaved' | 'saving';

interface Props {
  projectId: ID;
  openBoards: Whiteboard[];
  closedBoards: Whiteboard[];
  activeId: ID;
  status: Record<ID, SaveState>;
  onSelect: (id: ID) => void;
  onCreate: () => void;
  onRename: (id: ID) => void;
  onDuplicate: (id: ID) => void;
  /** New tab order and groups for the open boards. */
  onArrange: (slots: TabSlot[]) => void;
  onClose: (id: ID) => void;
  onCloseMany: (ids: ID[]) => void;
  onReopen: (id: ID) => void;
  onDelete: (id: ID) => void;
  onSaveAll: () => void;
}

function StatusDot({ state }: { state: SaveState | undefined }) {
  if (state === 'saving') return <CircularProgress size={10} thickness={6} aria-label="Saving" />;
  if (state === 'unsaved')
    return (
      <Tooltip title="Unsaved changes — saving shortly (Ctrl+S to save now)">
        <Box component="span" aria-label="Unsaved changes" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'secondary.main', display: 'inline-block' }} />
      </Tooltip>
    );
  return null;
}

/** One draggable item in the strip (a tab or a group label). */
function Sortable({ id, children }: { id: string; children: (p: { setRef: (el: HTMLElement | null) => void; style: React.CSSProperties; dragProps: Record<string, unknown>; dragging: boolean }) => ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 2 : undefined, opacity: isDragging ? 0.85 : 1 };
  // dnd-kit's own role/tabindex would override ours: keep only its listeners and aria-describedby.
  const { role: _r, tabIndex: _t, ...aria } = attributes;
  void _r;
  void _t;
  return <>{children({ setRef: setNodeRef, style, dragProps: { ...aria, ...listeners }, dragging: isDragging })}</>;
}

const collapsedKey = (projectId: ID) => `inkwell:wbgroups:collapsed:${projectId}`;

/** Browser-style tabs for whiteboards: drag to reorder, group, rename, duplicate, close, reopen. */
export function WhiteboardTabs(p: Props) {
  const [menu, setMenu] = useState<{ id: ID; position: { top: number; left: number } } | null>(null);
  const [groupMenu, setGroupMenu] = useState<{ group: WhiteboardGroup; position: { top: number; left: number } } | null>(null);
  const [allAnchor, setAllAnchor] = useState<HTMLElement | null>(null);
  const [collapsed, setCollapsed] = useState<Set<ID>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(collapsedKey(p.projectId)) ?? '[]'));
    } catch {
      return new Set();
    }
  });
  const saveCollapsed = (next: Set<ID>) => {
    setCollapsed(next);
    try {
      localStorage.setItem(collapsedKey(p.projectId), JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  };

  const slots: TabSlot[] = useMemo(() => p.openBoards.map((b) => ({ id: b.id, group: b.group ?? null })), [p.openBoards]);
  const items = useMemo(() => stripItems(slots, collapsed), [slots, collapsed]);
  const keys = useMemo(() => stripKeys(items), [items]);
  const byId = useMemo(() => new Map(p.openBoards.map((b) => [b.id, b])), [p.openBoards]);
  const groups = useMemo(() => items.flatMap((i) => (i.kind === 'group' ? [i.group] : [])), [items]);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Selecting a tab inside a collapsed group (e.g. from All boards) opens the group.
  useEffect(() => {
    const g = byId.get(p.activeId)?.group;
    if (g && collapsed.has(g.id)) {
      const next = new Set(collapsed);
      next.delete(g.id);
      saveCollapsed(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.activeId]);

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    p.onArrange(arrange(slots, collapsed, String(e.active.id), String(e.over.id)));
  };

  const toggleGroup = (g: WhiteboardGroup) => {
    const next = new Set(collapsed);
    if (next.has(g.id)) next.delete(g.id);
    else {
      next.add(g.id);
      // Don't leave the selected tab hidden: move to the first tab outside the group, if any.
      if (byId.get(p.activeId)?.group?.id === g.id) {
        const outside = slots.find((s) => s.group?.id !== g.id);
        if (outside) p.onSelect(outside.id);
      }
    }
    saveCollapsed(next);
  };

  const newGroupFor = async (id: ID) => {
    const name = await promptDialog({ title: 'New tab group', label: 'Group name', initial: `Group ${groups.length + 1}` });
    if (!name?.trim()) return;
    const used = new Set(groups.map((g) => g.color));
    const color = GROUP_COLORS.find((c) => !used.has(c)) ?? GROUP_COLORS[groups.length % GROUP_COLORS.length];
    p.onArrange(setTabGroup(slots, id, { id: newId(), name: name.trim(), color }));
  };

  const renameGroup = async (g: WhiteboardGroup) => {
    const name = await promptDialog({ title: 'Rename tab group', label: 'Group name', initial: g.name });
    if (name?.trim()) p.onArrange(updateGroup(slots, g.id, { ...g, name: name.trim() }));
  };

  const act = (fn: (id: ID) => void) => () => {
    const id = menu!.id;
    setMenu(null);
    fn(id);
  };
  const openMenu = (id: ID, e: MouseEvent) => {
    e.preventDefault();
    setMenu({ id, position: { top: e.clientY, left: e.clientX } });
  };
  const keyIdx = menu ? keys.indexOf(menu.id) : -1;
  const menuBoard = menu ? byId.get(menu.id) : undefined;
  const anyUnsaved = Object.values(p.status).some((s) => s !== 'saved');

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', pr: 1, minHeight: 44 }}>
      <Box
        role="tablist"
        aria-label="Whiteboards"
        sx={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'stretch', overflowX: 'auto', overflowY: 'hidden', scrollbarWidth: 'thin', minHeight: 44, px: 0.5, gap: 0.25 }}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
          accessibility={{
            container: typeof document !== 'undefined' ? document.body : undefined,
            screenReaderInstructions: { draggable: 'Drag to reorder tabs or move them into a group. Without a mouse, use Move left or Move right in the tab menu (Shift+F10).' },
          }}
        >
          <SortableContext items={keys} strategy={horizontalListSortingStrategy}>
            {items.map((it) => {
              if (it.kind === 'group') {
                const g = it.group;
                return (
                  <Sortable key={chipKey(g.id)} id={chipKey(g.id)}>
                    {({ setRef, style, dragProps }) => (
                      <Box ref={setRef} style={style} sx={{ display: 'flex', alignItems: 'center', py: 0.75, pl: 0.5 }}>
                        <Box
                          component="button"
                          {...dragProps}
                          aria-expanded={!it.collapsed}
                          aria-label={`Tab group ${g.name}, ${it.members.length} ${it.members.length === 1 ? 'board' : 'boards'}${it.collapsed ? ', collapsed' : ''}`}
                          title={`${it.collapsed ? 'Expand' : 'Collapse'} group · drag to move the group · right-click for more`}
                          onClick={() => toggleGroup(g)}
                          onContextMenu={(e: MouseEvent) => {
                            e.preventDefault();
                            setGroupMenu({ group: g, position: { top: e.clientY, left: e.clientX } });
                          }}
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 0.5,
                            height: 26,
                            px: 1,
                            border: 0,
                            borderRadius: 13,
                            cursor: 'pointer',
                            bgcolor: g.color,
                            color: (t) => t.palette.getContrastText(g.color),
                            font: 'inherit',
                            fontSize: 13,
                            fontWeight: 600,
                            whiteSpace: 'nowrap',
                            touchAction: 'none',
                            '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                          }}
                        >
                          {g.name}
                          {it.collapsed && (
                            <Box component="span" sx={{ fontSize: 11, px: 0.6, borderRadius: 8, bgcolor: 'rgba(0,0,0,0.18)' }}>
                              {it.members.length}
                            </Box>
                          )}
                        </Box>
                      </Box>
                    )}
                  </Sortable>
                );
              }
              const b = byId.get(it.id);
              if (!b) return null;
              const selected = b.id === p.activeId;
              const gc = it.group?.color;
              return (
                <Sortable key={b.id} id={b.id}>
                  {({ setRef, style, dragProps }) => (
                    <Box
                      ref={setRef}
                      style={style}
                      {...dragProps}
                      role="tab"
                      tabIndex={selected ? 0 : -1}
                      aria-selected={selected}
                      title="Double-click to rename · drag to reorder or into a group · right-click for more"
                      onClick={() => p.onSelect(b.id)}
                      onDoubleClick={() => p.onRename(b.id)}
                      onContextMenu={(e: MouseEvent) => openMenu(b.id, e)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          p.onSelect(b.id);
                        }
                        if (e.key === 'F2') p.onRename(b.id);
                        if (e.key === 'Delete') p.onClose(b.id);
                        if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
                          e.preventDefault();
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setMenu({ id: b.id, position: { top: r.bottom, left: r.left } });
                        }
                        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                          const tabs = [...(e.currentTarget.parentElement?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [])];
                          const i = tabs.indexOf(e.currentTarget as HTMLElement);
                          tabs[i + (e.key === 'ArrowRight' ? 1 : -1)]?.focus();
                        }
                      }}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        maxWidth: 240,
                        pl: 1.5,
                        pr: 0.5,
                        cursor: 'pointer',
                        userSelect: 'none',
                        touchAction: 'none',
                        color: selected ? 'primary.main' : 'text.secondary',
                        fontWeight: selected ? 600 : 500,
                        bgcolor: gc ? alpha(gc, selected ? 0.18 : 0.08) : 'transparent',
                        borderBottom: 2,
                        borderColor: selected ? 'primary.main' : gc ?? 'transparent',
                        borderTopLeftRadius: 6,
                        borderTopRightRadius: 6,
                        '&:hover': { color: 'text.primary', bgcolor: gc ? alpha(gc, 0.16) : 'action.hover' },
                        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
                      }}
                    >
                      <Typography variant="body2" noWrap component="span" sx={{ fontWeight: 'inherit' }}>
                        {b.name}
                      </Typography>
                      <StatusDot state={p.status[b.id]} />
                      <Box
                        component="span"
                        role="button"
                        tabIndex={-1}
                        aria-label={`Close ${b.name} (stays saved)`}
                        title="Close tab (the board stays saved)"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          p.onClose(b.id);
                        }}
                        sx={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: '50%', color: 'text.secondary', '&:hover': { bgcolor: 'action.hover', color: 'text.primary' } }}
                      >
                        <CloseIcon sx={{ fontSize: 15 }} />
                      </Box>
                    </Box>
                  )}
                </Sortable>
              );
            })}
          </SortableContext>
        </DndContext>
      </Box>
      <Tooltip title="New whiteboard tab">
        <IconButton aria-label="New whiteboard tab" onClick={p.onCreate}>
          <AddIcon />
        </IconButton>
      </Tooltip>
      <Tooltip title={anyUnsaved ? 'Save all boards now (Ctrl+S)' : 'All boards saved'}>
        <span>
          <IconButton aria-label="Save all boards" onClick={p.onSaveAll} color={anyUnsaved ? 'secondary' : 'default'}>
            <SaveIcon />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="All boards (reopen closed tabs)">
        <IconButton aria-label="All boards" onClick={(e) => setAllAnchor(e.currentTarget)}>
          <FolderOpenIcon />
        </IconButton>
      </Tooltip>

      {/* Tab menu */}
      <Menu open={!!menu} onClose={() => setMenu(null)} anchorReference="anchorPosition" anchorPosition={menu?.position} MenuListProps={{ dense: true }}>
        <MenuItem onClick={act(p.onRename)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Rename</ListItemText>
        </MenuItem>
        <MenuItem onClick={act(p.onDuplicate)}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Save a copy as new tab</ListItemText>
        </MenuItem>
        <MenuItem onClick={act((id) => p.onArrange(nudge(slots, collapsed, id, -1)))} disabled={keyIdx <= 0}>
          <ListItemIcon>
            <ChevronLeftIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Move left</ListItemText>
        </MenuItem>
        <MenuItem onClick={act((id) => p.onArrange(nudge(slots, collapsed, id, 1)))} disabled={keyIdx < 0 || keyIdx >= keys.length - 1}>
          <ListItemIcon>
            <ChevronRightIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Move right</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={act((id) => void newGroupFor(id))}>
          <ListItemIcon>
            <WorkspacesIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Add to new group…</ListItemText>
        </MenuItem>
        {groups
          .filter((g) => g.id !== menuBoard?.group?.id)
          .map((g) => (
            <MenuItem key={g.id} onClick={act((id) => p.onArrange(setTabGroup(slots, id, g)))}>
              <ListItemIcon>
                <Box sx={{ width: 14, height: 14, borderRadius: '50%', bgcolor: g.color }} />
              </ListItemIcon>
              <ListItemText>Add to “{g.name}”</ListItemText>
            </MenuItem>
          ))}
        {menuBoard?.group && (
          <MenuItem onClick={act((id) => p.onArrange(setTabGroup(slots, id, null)))}>
            <ListItemIcon>
              <LayersClearIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Remove from “{menuBoard.group.name}”</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem onClick={act(p.onClose)}>
          <ListItemIcon>
            <CloseIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Close tab" secondary="Stays saved in All boards" />
        </MenuItem>
        <MenuItem onClick={act(p.onDelete)} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete board…</ListItemText>
        </MenuItem>
      </Menu>

      {/* Group menu */}
      <Menu open={!!groupMenu} onClose={() => setGroupMenu(null)} anchorReference="anchorPosition" anchorPosition={groupMenu?.position} MenuListProps={{ dense: true }}>
        {groupMenu && [
          <MenuItem
            key="rename"
            onClick={() => {
              const g = groupMenu.group;
              setGroupMenu(null);
              void renameGroup(g);
            }}
          >
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Rename group</ListItemText>
          </MenuItem>,
          <Box key="colors" sx={{ display: 'flex', gap: 0.75, px: 2, py: 1 }} role="radiogroup" aria-label="Group colour">
            {GROUP_COLORS.map((c) => (
              <Box
                key={c}
                component="button"
                role="radio"
                aria-checked={groupMenu.group.color === c}
                aria-label={`Colour ${c}`}
                onClick={() => {
                  p.onArrange(updateGroup(slots, groupMenu.group.id, { ...groupMenu.group, color: c }));
                  setGroupMenu(null);
                }}
                sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: c, border: 2, borderColor: groupMenu.group.color === c ? 'text.primary' : 'transparent', cursor: 'pointer', p: 0 }}
              />
            ))}
          </Box>,
          <MenuItem
            key="toggle"
            onClick={() => {
              toggleGroup(groupMenu.group);
              setGroupMenu(null);
            }}
          >
            <ListItemIcon>{collapsed.has(groupMenu.group.id) ? <UnfoldMoreIcon fontSize="small" /> : <UnfoldLessIcon fontSize="small" />}</ListItemIcon>
            <ListItemText>{collapsed.has(groupMenu.group.id) ? 'Expand group' : 'Collapse group'}</ListItemText>
          </MenuItem>,
          <MenuItem
            key="ungroup"
            onClick={() => {
              p.onArrange(updateGroup(slots, groupMenu.group.id, null));
              setGroupMenu(null);
            }}
          >
            <ListItemIcon>
              <LayersClearIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Ungroup</ListItemText>
          </MenuItem>,
          <Divider key="d" />,
          <MenuItem
            key="close"
            onClick={() => {
              const ids = slots.filter((s) => s.group?.id === groupMenu.group.id).map((s) => s.id);
              setGroupMenu(null);
              p.onCloseMany(ids);
            }}
          >
            <ListItemIcon>
              <CloseIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Close group" secondary="Its boards stay saved in All boards" />
          </MenuItem>,
        ]}
      </Menu>

      <Menu anchorEl={allAnchor} open={!!allAnchor} onClose={() => setAllAnchor(null)} MenuListProps={{ dense: true, 'aria-label': 'All boards' }}>
        <MenuItem disabled sx={{ opacity: '1 !important' }}>
          <Typography variant="overline" color="text.secondary">
            Open tabs
          </Typography>
        </MenuItem>
        {p.openBoards.map((b) => (
          <MenuItem
            key={b.id}
            selected={b.id === p.activeId}
            onClick={() => {
              setAllAnchor(null);
              p.onSelect(b.id);
            }}
          >
            {b.group && <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: b.group.color, mr: 1, flexShrink: 0 }} />}
            <ListItemText primary={b.name} secondary={`${b.group ? `${b.group.name} · ` : ''}${b.elements.length} items · edited ${relativeTime(b.updatedAt)}`} />
          </MenuItem>
        ))}
        <Divider />
        <MenuItem disabled sx={{ opacity: '1 !important' }}>
          <Typography variant="overline" color="text.secondary">
            Closed boards
          </Typography>
        </MenuItem>
        {p.closedBoards.length === 0 && (
          <MenuItem disabled>
            <ListItemText secondary="None — closed tabs appear here" />
          </MenuItem>
        )}
        {p.closedBoards.map((b) => (
          <MenuItem
            key={b.id}
            onClick={() => {
              setAllAnchor(null);
              p.onReopen(b.id);
            }}
          >
            <ListItemText primary={b.name} secondary={`${b.elements.length} items · click to reopen`} />
            <IconButton
              size="small"
              edge="end"
              aria-label={`Delete ${b.name}`}
              onClick={(e) => {
                e.stopPropagation();
                setAllAnchor(null);
                p.onDelete(b.id);
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

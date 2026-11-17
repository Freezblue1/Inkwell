import { useState, type MouseEvent } from 'react';
import { Box, CircularProgress, Divider, IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tab, Tabs, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import FolderOpenIcon from '@mui/icons-material/FolderOpenOutlined';
import EditIcon from '@mui/icons-material/DriveFileRenameOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import SaveIcon from '@mui/icons-material/SaveOutlined';
import type { ID, Whiteboard } from '@/types/models';
import { relativeTime } from '@/lib/dates';

export type SaveState = 'saved' | 'unsaved' | 'saving';

interface Props {
  openBoards: Whiteboard[];
  closedBoards: Whiteboard[];
  activeId: ID;
  status: Record<ID, SaveState>;
  onSelect: (id: ID) => void;
  onCreate: () => void;
  onRename: (id: ID) => void;
  onDuplicate: (id: ID) => void;
  onMove: (id: ID, delta: -1 | 1) => void;
  onClose: (id: ID) => void;
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

/** Browser-style tabs for whiteboards: open, rename, duplicate, reorder, close, reopen. */
export function WhiteboardTabs(p: Props) {
  const [menu, setMenu] = useState<{ id: ID; position: { top: number; left: number } } | null>(null);
  const [allAnchor, setAllAnchor] = useState<HTMLElement | null>(null);
  const idx = menu ? p.openBoards.findIndex((b) => b.id === menu.id) : -1;
  const act = (fn: (id: ID) => void) => () => {
    const id = menu!.id;
    setMenu(null);
    fn(id);
  };
  const openMenu = (id: ID, e: MouseEvent) => {
    e.preventDefault();
    setMenu({ id, position: { top: e.clientY, left: e.clientX } });
  };
  const anyUnsaved = Object.values(p.status).some((s) => s !== 'saved');

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', pr: 1, minHeight: 44 }}>
      <Tabs
        value={p.activeId}
        onChange={(_, v) => p.onSelect(v)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Whiteboards"
        sx={{ flex: 1, minHeight: 44, '& .MuiTab-root': { minHeight: 44, py: 0, pr: 0.5 } }}
      >
        {p.openBoards.map((b) => (
          <Tab
            key={b.id}
            value={b.id}
            onDoubleClick={() => p.onRename(b.id)}
            onContextMenu={(e) => openMenu(b.id, e)}
            onKeyDown={(e) => {
              if (e.key === 'F2') p.onRename(b.id);
              if (e.key === 'Delete') p.onClose(b.id);
            }}
            title="Double-click to rename · right-click for more"
            label={
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, maxWidth: 220 }}>
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
                  onClick={(e) => {
                    e.stopPropagation();
                    p.onClose(b.id);
                  }}
                  sx={{ display: 'grid', placeItems: 'center', width: 22, height: 22, borderRadius: '50%', color: 'text.secondary', '&:hover': { bgcolor: 'action.hover', color: 'text.primary' } }}
                >
                  <CloseIcon sx={{ fontSize: 15 }} />
                </Box>
              </Box>
            }
          />
        ))}
      </Tabs>
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
        <MenuItem onClick={act((id) => p.onMove(id, -1))} disabled={idx <= 0}>
          <ListItemIcon>
            <ChevronLeftIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Move left</ListItemText>
        </MenuItem>
        <MenuItem onClick={act((id) => p.onMove(id, 1))} disabled={idx < 0 || idx >= p.openBoards.length - 1}>
          <ListItemIcon>
            <ChevronRightIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Move right</ListItemText>
        </MenuItem>
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
            <ListItemText primary={b.name} secondary={`${b.elements.length} items · edited ${relativeTime(b.updatedAt)}`} />
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

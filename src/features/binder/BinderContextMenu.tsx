import { useState, type MouseEvent } from 'react';
import { Box, Divider, ListItemIcon, ListItemText, Menu, MenuItem, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VerticalSplitIcon from '@mui/icons-material/VerticalSplitOutlined';
import ViewStreamIcon from '@mui/icons-material/ViewStreamOutlined';
import NoteAddIcon from '@mui/icons-material/NoteAddOutlined';
import EditIcon from '@mui/icons-material/DriveFileRenameOutline';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CallSplitIcon from '@mui/icons-material/CallSplit';
import MergeIcon from '@mui/icons-material/MergeType';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import FlagIcon from '@mui/icons-material/FlagOutlined';
import LabelIcon from '@mui/icons-material/LabelOutlined';
import PaletteIcon from '@mui/icons-material/PaletteOutlined';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import CheckIcon from '@mui/icons-material/Check';
import BookmarkAddedIcon from '@mui/icons-material/BookmarkAddedOutlined';
import { SPECIAL_CHAPTERS, specialLabel } from '@/lib/specialChapters';
import type { ID } from '@/types/models';
import { useStore } from '@/store';
import { canHaveChildren, childrenOf, defaultChildType } from '@/lib/tree';
import { statusColor } from '@/lib/defaults';
import { newId } from '@/lib/ids';
import { promptDialog } from '@/components/DialogHost';
import { splitAtCursor } from '@/features/editor/editorActions';
import { CUSTOM_ICONS, DOC_COLORS } from './docIcons';

interface Props {
  docId: ID | null;
  position: { top: number; left: number } | null;
  onClose: () => void;
  onRename: (id: ID) => void;
}

type Sub = 'status' | 'label' | 'icon' | 'chapterType' | null;

/** Right-click menu for binder items. */
export function BinderContextMenu({ docId, position, onClose, onRename }: Props) {
  const docs = useStore((s) => s.docs);
  const project = useStore((s) => s.project);
  const activeEditorDocId = useStore((s) => s.activeEditorDocId);
  const [sub, setSub] = useState<{ kind: Sub; el: HTMLElement | null }>({ kind: null, el: null });
  const doc = docId ? docs[docId] : null;
  if (!doc || !project) return null;

  const s = useStore.getState;
  const act = (fn: () => void | Promise<unknown>) => () => {
    setSub({ kind: null, el: null });
    onClose();
    void fn();
  };
  const siblings = childrenOf(docs, doc.parentId);
  const hasNext = siblings[siblings.findIndex((d) => d.id === doc.id) + 1];
  const container = canHaveChildren(doc);
  const hasKids = childrenOf(docs, doc.id).length > 0;
  const openSub = (kind: Sub) => (e: MouseEvent<HTMLElement>) => setSub({ kind, el: e.currentTarget });

  return (
    <>
      <Menu
        open={!!position}
        onClose={onClose}
        anchorReference="anchorPosition"
        anchorPosition={position ?? undefined}
        MenuListProps={{ dense: true, 'aria-label': `Actions for ${doc.title}` }}
      >
        <MenuItem onClick={act(() => s().openDoc(doc.id))}>
          <ListItemIcon>
            <OpenInNewIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Open</ListItemText>
          <Typography variant="caption" color="text.secondary">
            Enter
          </Typography>
        </MenuItem>
        <MenuItem onClick={act(() => s().openDoc(doc.id, { target: 'split' }))}>
          <ListItemIcon>
            <VerticalSplitIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Open in split</ListItemText>
        </MenuItem>
        {hasKids && (
          <MenuItem onClick={act(() => s().setScrivenings(doc.id))}>
            <ListItemIcon>
              <ViewStreamIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>View as scrivenings</ListItemText>
          </MenuItem>
        )}
        <Divider />
        {container && (
          <MenuItem
            onClick={act(async () => {
              const d = await s().createDoc({ type: defaultChildType(doc), parentId: doc.id });
              if (s().collapsed[doc.id]) s().toggleCollapsed(doc.id);
              s().openDoc(d.id);
              onRename(d.id);
            })}
          >
            <ListItemIcon>
              <NoteAddIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Add {defaultChildType(doc)} inside</ListItemText>
          </MenuItem>
        )}
        <MenuItem
          onClick={act(async () => {
            const d = await s().createDoc({ type: doc.type, parentId: doc.parentId, afterId: doc.id, ...(doc.type === 'research' ? { metadata: { researchKind: 'note' } } : {}) });
            s().openDoc(d.id);
            onRename(d.id);
          })}
        >
          <ListItemIcon>
            <NoteAddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Add {doc.type} below</ListItemText>
        </MenuItem>
        <MenuItem onClick={act(() => onRename(doc.id))}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Rename</ListItemText>
          <Typography variant="caption" color="text.secondary">
            F2
          </Typography>
        </MenuItem>
        <MenuItem
          onClick={act(async () => {
            const copy = await s().duplicateDoc(doc.id);
            if (copy) s().notify(`Duplicated “${doc.title}”`);
          })}
        >
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <MenuItem
          disabled={activeEditorDocId !== doc.id}
          onClick={act(() => {
            const ed = s().activeEditor;
            if (ed) return splitAtCursor(ed, doc.id);
          })}
        >
          <ListItemIcon>
            <CallSplitIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Split at cursor" secondary={activeEditorDocId !== doc.id ? 'Open it and place the cursor first' : undefined} />
        </MenuItem>
        <MenuItem
          disabled={!hasNext || hasKids}
          onClick={act(async () => {
            const ok = await s().mergeWithNext(doc.id);
            s().notify(ok ? 'Merged with the next document (a snapshot was saved first)' : 'Cannot merge: the next item has children', ok ? 'success' : 'warning');
          })}
        >
          <ListItemIcon>
            <MergeIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Merge with next</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={openSub('status')} aria-haspopup="menu">
          <ListItemIcon>
            <FlagIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Status</ListItemText>
          <ChevronRightIcon fontSize="small" />
        </MenuItem>
        <MenuItem onClick={openSub('label')} aria-haspopup="menu">
          <ListItemIcon>
            <LabelIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Label</ListItemText>
          <ChevronRightIcon fontSize="small" />
        </MenuItem>
        <MenuItem onClick={openSub('icon')} aria-haspopup="menu">
          <ListItemIcon>
            <PaletteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Icon &amp; color</ListItemText>
          <ChevronRightIcon fontSize="small" />
        </MenuItem>
        {doc.type === 'chapter' && (
          <MenuItem onClick={openSub('chapterType')} aria-haspopup="menu">
            <ListItemIcon>
              <BookmarkAddedIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="Chapter type" secondary={specialLabel(doc) || 'Numbered'} />
            <ChevronRightIcon fontSize="small" />
          </MenuItem>
        )}
        <MenuItem
          onClick={act(async () => {
            const v = await promptDialog({ title: 'Word target', label: 'Target words (empty to clear)', initial: doc.targetWordCount ? String(doc.targetWordCount) : '' });
            if (v === null) return;
            const n = parseInt(v.replace(/\D/g, ''), 10);
            await s().updateDoc(doc.id, { targetWordCount: Number.isFinite(n) && n > 0 ? n : null });
          })}
        >
          <ListItemIcon>
            <TrackChangesIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Set word target…</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={act(async () => {
            await s().trashDoc(doc.id);
            s().notify(`Moved “${doc.title}” to the trash`, 'success', { label: 'Undo', run: () => void useStore.getState().restoreDoc(doc.id) });
          })}
        >
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Move to trash</ListItemText>
          <Typography variant="caption" color="text.secondary">
            Del
          </Typography>
        </MenuItem>
      </Menu>

      {/* Sub-menus */}
      <Menu
        open={sub.kind === 'chapterType'}
        anchorEl={sub.el}
        onClose={() => setSub({ kind: null, el: null })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        MenuListProps={{ dense: true }}
      >
        <MenuItem selected={!doc.metadata.special} onClick={act(() => s().setSpecialChapter(doc.id, null))}>
          <ListItemText primary="Numbered chapter" secondary="Chapter One, Two…" />
          {!doc.metadata.special && <CheckIcon fontSize="small" />}
        </MenuItem>
        <Divider />
        {SPECIAL_CHAPTERS.map((sc) => (
          <MenuItem
            key={sc.value}
            selected={doc.metadata.special === sc.value}
            onClick={act(async () => {
              if (sc.value !== 'custom') return s().setSpecialChapter(doc.id, sc.value);
              const v = await promptDialog({ title: 'Custom heading', label: 'Heading (e.g. Coda)', initial: doc.metadata.specialLabel });
              if (v?.trim()) await s().setSpecialChapter(doc.id, 'custom', v.trim());
            })}
          >
            <ListItemText primary={sc.label} secondary={sc.hint} />
            {doc.metadata.special === sc.value && <CheckIcon fontSize="small" />}
          </MenuItem>
        ))}
      </Menu>

      <Menu
        open={sub.kind === 'status'}
        anchorEl={sub.el}
        onClose={() => setSub({ kind: null, el: null })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        MenuListProps={{ dense: true }}
      >
        {project.statuses.map((st) => (
          <MenuItem key={st} onClick={act(() => s().updateDoc(doc.id, { status: st }))} selected={doc.status === st}>
            <ListItemIcon>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: statusColor(st) }} />
            </ListItemIcon>
            <ListItemText>{st}</ListItemText>
            {doc.status === st && <CheckIcon fontSize="small" />}
          </MenuItem>
        ))}
        <MenuItem onClick={act(() => s().updateDoc(doc.id, { status: '' }))}>No status</MenuItem>
        <Divider />
        <MenuItem
          onClick={act(async () => {
            const name = await promptDialog({ title: 'New status', label: 'Status name' });
            if (!name?.trim()) return;
            if (!project.statuses.includes(name.trim())) await s().updateProject({ statuses: [...project.statuses, name.trim()] });
            await s().updateDoc(doc.id, { status: name.trim() });
          })}
        >
          Custom status…
        </MenuItem>
      </Menu>

      <Menu
        open={sub.kind === 'label'}
        anchorEl={sub.el}
        onClose={() => setSub({ kind: null, el: null })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        MenuListProps={{ dense: true }}
      >
        {project.labels.map((l) => (
          <MenuItem key={l.id} onClick={act(() => s().updateDoc(doc.id, { label: l.id }))} selected={doc.label === l.id}>
            <ListItemIcon>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: l.color }} />
            </ListItemIcon>
            <ListItemText>{l.name}</ListItemText>
          </MenuItem>
        ))}
        <MenuItem onClick={act(() => s().updateDoc(doc.id, { label: null }))}>No label</MenuItem>
        <Divider />
        <MenuItem
          onClick={act(async () => {
            const name = await promptDialog({ title: 'New label', label: 'Label name' });
            if (!name?.trim()) return;
            const label = { id: newId(), name: name.trim(), color: DOC_COLORS[project.labels.length % DOC_COLORS.length] };
            await s().updateProject({ labels: [...project.labels, label] });
            await s().updateDoc(doc.id, { label: label.id });
          })}
        >
          New label…
        </MenuItem>
      </Menu>

      <Menu
        open={sub.kind === 'icon'}
        anchorEl={sub.el}
        onClose={() => setSub({ kind: null, el: null })}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <Box sx={{ px: 2, pt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            Icon
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 36px)', gap: 0.5, my: 1 }}>
            <Box component="button" onClick={act(() => s().updateDocMeta(doc.id, { icon: '' }))} sx={iconBtn} aria-label="Default icon" title="Default">
              ∅
            </Box>
            {Object.entries(CUSTOM_ICONS).map(([key, v]) => (
              <Box key={key} component="button" onClick={act(() => s().updateDocMeta(doc.id, { icon: key }))} sx={{ ...iconBtn, fontSize: 20 }} aria-label={v.label} title={v.label}>
                {v.el}
              </Box>
            ))}
          </Box>
          <Typography variant="caption" color="text.secondary">
            Color
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, 36px)', gap: 0.5, my: 1 }}>
            <Box component="button" onClick={act(() => s().updateDocMeta(doc.id, { color: '' }))} sx={iconBtn} aria-label="Default color" title="Default">
              ∅
            </Box>
            {DOC_COLORS.map((c) => (
              <Box key={c} component="button" onClick={act(() => s().updateDocMeta(doc.id, { color: c }))} sx={{ ...iconBtn, bgcolor: c }} aria-label={`Color ${c}`} />
            ))}
          </Box>
        </Box>
      </Menu>
    </>
  );
}

const iconBtn = {
  width: 36,
  height: 36,
  border: 1,
  borderColor: 'divider',
  borderRadius: 1,
  bgcolor: 'transparent',
  color: 'text.primary',
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
  '&:hover, &:focus-visible': { borderColor: 'primary.main' },
} as const;

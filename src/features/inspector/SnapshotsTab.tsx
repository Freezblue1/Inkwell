import { useCallback, useEffect, useState } from 'react';
import { Button, Chip, IconButton, List, ListItem, ListItemButton, ListItemText, Menu, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAltOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import type { ID, Snapshot } from '@/types/models';
import { useStore } from '@/store';
import { createDocSnapshot, deleteSnapshot, listDocSnapshots, renameSnapshot, restoreDocSnapshot } from '@/db/repos/snapshots';
import { formatDateTime, relativeTime } from '@/lib/dates';
import { flushAll } from '@/features/editor/autosave';
import { confirmDialog, promptDialog } from '@/components/DialogHost';
import { EmptyState } from '@/components/EmptyState';
import { SnapshotDialog } from './SnapshotDialog';

/** Take, compare, restore, rename and delete snapshots of a document. */
export function SnapshotsTab({ docId }: { docId: ID }) {
  const doc = useStore((s) => s.docs[docId]);
  const notify = useStore((s) => s.notify);
  const [list, setList] = useState<Snapshot[]>([]);
  const [name, setName] = useState('');
  const [viewing, setViewing] = useState<Snapshot | null>(null);
  const [menu, setMenu] = useState<{ el: HTMLElement; snap: Snapshot } | null>(null);

  const reload = useCallback(() => void listDocSnapshots(docId).then(setList), [docId]);
  useEffect(reload, [reload, doc?.updatedAt]);

  if (!doc) return null;

  const take = async () => {
    await flushAll();
    await createDocSnapshot(useStore.getState().docs[docId], name.trim() || `Snapshot ${new Date().toLocaleString()}`);
    setName('');
    reload();
    notify('Snapshot saved');
  };

  const restore = async (snap: Snapshot) => {
    const ok = await confirmDialog({
      title: 'Restore this snapshot?',
      message: 'The current text is saved as a new snapshot first, so you can switch back at any time.',
      confirmLabel: 'Restore',
    });
    if (!ok) return;
    await flushAll();
    const wc = await restoreDocSnapshot(snap);
    const s = useStore.getState();
    s.applyLocalSave(docId, wc, Date.now(), s.docs[docId]?.metadata.mentionIds ?? []);
    s.bumpContent([docId]);
    setViewing(null);
    reload();
    notify(`Restored “${snap.name}”`);
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1}>
        <TextField
          size="small"
          fullWidth
          placeholder="Snapshot name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void take()}
          inputProps={{ 'aria-label': 'Snapshot name' }}
        />
        <Tooltip title="Take snapshot (Ctrl+Shift+P)">
          <Button variant="contained" onClick={() => void take()} startIcon={<CameraAltIcon />} sx={{ flexShrink: 0 }}>
            Take
          </Button>
        </Tooltip>
      </Stack>
      <Typography variant="caption" color="text.secondary">
        Automatic snapshots are taken at the start of each writing day and after major edits.
      </Typography>
      {list.length === 0 ? (
        <EmptyState compact title="No snapshots yet" description="A snapshot freezes this document so you can experiment freely and compare or roll back later." />
      ) : (
        <List dense disablePadding aria-label="Snapshots">
          {list.map((snap) => (
            <ListItem
              key={snap.id}
              disablePadding
              secondaryAction={
                <IconButton edge="end" size="small" aria-label={`Actions for ${snap.name}`} onClick={(e) => setMenu({ el: e.currentTarget, snap })}>
                  <MoreVertIcon fontSize="small" />
                </IconButton>
              }
            >
              <ListItemButton onClick={() => setViewing(snap)}>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={0.75} alignItems="center">
                      <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>
                        {snap.name}
                      </Typography>
                      {snap.auto && <Chip size="small" label={snap.reason === 'pre-restore' ? 'safety' : 'auto'} sx={{ height: 18, fontSize: 10 }} />}
                    </Stack>
                  }
                  secondary={
                    <Tooltip title={formatDateTime(snap.createdAt)}>
                      <span>
                        {relativeTime(snap.createdAt)} · {snap.wordCount.toLocaleString()} words
                      </span>
                    </Tooltip>
                  }
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      )}
      <Menu anchorEl={menu?.el} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            setViewing(menu!.snap);
            setMenu(null);
          }}
        >
          Compare with current
        </MenuItem>
        <MenuItem
          onClick={() => {
            const s = menu!.snap;
            setMenu(null);
            void restore(s);
          }}
        >
          Restore
        </MenuItem>
        <MenuItem
          onClick={async () => {
            const s = menu!.snap;
            setMenu(null);
            const n = await promptDialog({ title: 'Rename snapshot', initial: s.name });
            if (n?.trim()) {
              await renameSnapshot(s.id, n.trim());
              reload();
            }
          }}
        >
          Rename
        </MenuItem>
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={async () => {
            const s = menu!.snap;
            setMenu(null);
            if (await confirmDialog({ title: 'Delete snapshot?', message: s.name, confirmLabel: 'Delete', danger: true })) {
              await deleteSnapshot(s.id);
              reload();
            }
          }}
        >
          Delete
        </MenuItem>
      </Menu>
      {viewing && <SnapshotDialog snapshot={viewing} onClose={() => setViewing(null)} onRestore={(s) => void restore(s)} />}
    </Stack>
  );
}

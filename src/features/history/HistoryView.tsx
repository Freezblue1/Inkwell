import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  ListSubheader,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAltOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import HistoryIcon from '@mui/icons-material/History';
import RestoreIcon from '@mui/icons-material/Restore';
import type { DocumentContent, Snapshot } from '@/types/models';
import { useStore } from '@/store';
import { useLayoutMode } from '@/hooks/useLayoutMode';
import { createProjectSnapshot, deleteSnapshot, listProjectSnapshots, restoreDocSnapshot, restoreProjectSnapshot } from '@/db/repos/snapshots';
import { getContent, listProjectContents } from '@/db/repos/documents';
import { importBundle, listRollingBackups } from '@/db/bundle';
import { formatDateTime, relativeTime } from '@/lib/dates';
import { DiffView } from '@/components/DiffView';
import { EmptyState } from '@/components/EmptyState';
import { confirmDialog, promptDialog } from '@/components/DialogHost';
import { flushAll } from '@/features/editor/autosave';
import type { Backup } from '@/types/models';

type Filter = 'all' | 'project' | 'document';

/** History: timeline of document and project snapshots with diff and restore. */
export default function HistoryView() {
  const layout = useLayoutMode();
  const project = useStore((s) => s.project);
  const docs = useStore((s) => s.docs);
  const notify = useStore((s) => s.notify);
  const [snaps, setSnaps] = useState<Snapshot[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Snapshot | null>(null);

  const reload = useCallback(async () => {
    if (!project) return;
    const [s, b] = await Promise.all([listProjectSnapshots(project.id), listRollingBackups(project.id)]);
    setSnaps(s);
    setBackups(b);
  }, [project]);
  useEffect(() => void reload(), [reload]);

  const filtered = snaps.filter((s) => filter === 'all' || s.scope === filter);
  const byDay = useMemo(() => {
    const groups = new Map<string, Snapshot[]>();
    filtered.forEach((s) => {
      const k = new Date(s.createdAt).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      groups.set(k, [...(groups.get(k) ?? []), s]);
    });
    return [...groups.entries()];
  }, [filtered]);

  if (!project) return null;

  const takeProjectSnapshot = async () => {
    const name = await promptDialog({ title: 'Project snapshot', label: 'Name', initial: `Snapshot ${new Date().toLocaleString()}` });
    if (name === null) return;
    await flushAll();
    const s = await createProjectSnapshot(project.id, name);
    await reload();
    setSelected(s);
    notify('Project snapshot saved');
  };

  const showList = layout !== 'mobile' || !selected;
  const showDetail = layout !== 'mobile' || !!selected;

  return (
    <Box sx={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {showList && (
        <Box component="aside" aria-label="Snapshot timeline" sx={{ width: layout === 'mobile' ? '100%' : 340, flexShrink: 0, borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper', display: 'flex', flexDirection: 'column' }}>
          <Stack spacing={1} sx={{ p: 2 }}>
            <Typography variant="h6" component="h2">
              History
            </Typography>
            <Button variant="contained" startIcon={<CameraAltIcon />} onClick={() => void takeProjectSnapshot()}>
              Snapshot whole project
            </Button>
            <ToggleButtonGroup size="small" exclusive value={filter} onChange={(_, v) => v && setFilter(v)} fullWidth aria-label="Filter snapshots">
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="project">Project</ToggleButton>
              <ToggleButton value="document">Documents</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Divider />
          <List dense sx={{ flex: 1, overflowY: 'auto' }} subheader={<li />} aria-label="Snapshots by day">
            {byDay.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ p: 2 }}>
                No snapshots yet. Inkwell takes one automatically each day you write and after big edits.
              </Typography>
            )}
            {byDay.map(([day, items]) => (
              <li key={day}>
                <ul style={{ padding: 0 }}>
                  <ListSubheader sx={{ lineHeight: '32px', bgcolor: 'background.paper' }}>{day}</ListSubheader>
                  {items.map((s) => (
                    <ListItemButton key={s.id} selected={selected?.id === s.id} onClick={() => setSelected(s)}>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={0.75} alignItems="center">
                            <Typography variant="body2" noWrap sx={{ maxWidth: 180 }}>
                              {s.scope === 'project' ? s.name : `${docs[s.docId ?? '']?.title ?? 'Deleted document'} — ${s.name}`}
                            </Typography>
                          </Stack>
                        }
                        secondary={`${new Date(s.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })} · ${s.wordCount.toLocaleString()} words`}
                      />
                      <Stack direction="row" spacing={0.5}>
                        <Chip size="small" label={s.scope === 'project' ? 'project' : 'doc'} color={s.scope === 'project' ? 'primary' : 'default'} variant="outlined" sx={{ height: 20, fontSize: 10 }} />
                        {s.auto && <Chip size="small" label="auto" sx={{ height: 20, fontSize: 10 }} />}
                      </Stack>
                    </ListItemButton>
                  ))}
                </ul>
              </li>
            ))}
          </List>
          {backups.length > 0 && (
            <>
              <Divider />
              <Box sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Rolling backups
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
                  Saved every 10 minutes while you work (latest 5). Restoring creates a copy of the project.
                </Typography>
                {backups.map((b) => (
                  <Stack key={b.id} direction="row" alignItems="center" spacing={1}>
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {relativeTime(b.createdAt)} · {b.wordCount.toLocaleString()} words
                    </Typography>
                    <Tooltip title="Restore as a new project">
                      <IconButton
                        size="small"
                        aria-label="Restore backup as copy"
                        onClick={async () => {
                          const id = await importBundle(JSON.parse(b.data), { titleSuffix: ` (backup ${new Date(b.createdAt).toLocaleString()})` });
                          await useStore.getState().loadProjects();
                          notify('Backup restored as a new project', 'success', { label: 'Open', run: () => void useStore.getState().openProject(id) });
                        }}
                      >
                        <RestoreIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                ))}
              </Box>
            </>
          )}
        </Box>
      )}
      {showDetail && (
        <Box sx={{ flex: 1, minWidth: 0, overflowY: 'auto', p: { xs: 2, md: 3 } }}>
          {!selected ? (
            <EmptyState icon={<HistoryIcon />} title="Pick a snapshot" description="Compare any snapshot with your current text and restore it if you like. Restoring always saves a safety snapshot first." />
          ) : selected.scope === 'document' ? (
            <DocSnapshotDetail key={selected.id} snap={selected} onBack={() => setSelected(null)} onChanged={reload} />
          ) : (
            <ProjectSnapshotDetail key={selected.id} snap={selected} onBack={() => setSelected(null)} onChanged={reload} />
          )}
        </Box>
      )}
    </Box>
  );
}

function DetailHeader({ snap, onBack, onRestore, onDelete }: { snap: Snapshot; onBack: () => void; onRestore: () => void; onDelete: () => void }) {
  const layout = useLayoutMode();
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }} sx={{ mb: 2 }}>
      {layout === 'mobile' && <Button onClick={onBack}>← Back</Button>}
      <Box sx={{ flex: 1 }}>
        <Typography variant="h6" component="h3">
          {snap.name}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatDateTime(snap.createdAt)} · {snap.wordCount.toLocaleString()} words · {snap.reason}
        </Typography>
      </Box>
      <Button startIcon={<DeleteIcon />} color="inherit" onClick={onDelete}>
        Delete
      </Button>
      <Button variant="contained" startIcon={<RestoreIcon />} onClick={onRestore}>
        Restore {snap.scope === 'project' ? 'project' : 'document'}
      </Button>
    </Stack>
  );
}

function DocSnapshotDetail({ snap, onBack, onChanged }: { snap: Snapshot; onBack: () => void; onChanged: () => Promise<void> }) {
  const [current, setCurrent] = useState<string | null>(null);
  const exists = useStore((s) => !!(snap.docId && s.docs[snap.docId]));
  useEffect(() => {
    void flushAll()
      .then(() => getContent(snap.docId!))
      .then((c) => setCurrent(c?.text ?? ''));
  }, [snap.docId]);

  const restore = async () => {
    if (!exists) return useStore.getState().notify('That document was deleted; restore is not possible.', 'warning');
    if (!(await confirmDialog({ title: 'Restore this document version?', message: 'The current text is snapshotted first.', confirmLabel: 'Restore' }))) return;
    await flushAll();
    const wc = await restoreDocSnapshot(snap);
    const s = useStore.getState();
    s.applyLocalSave(snap.docId!, wc, Date.now(), s.docs[snap.docId!]?.metadata.mentionIds ?? []);
    s.bumpContent([snap.docId!]);
    s.notify('Document restored');
    await onChanged();
  };

  return (
    <Box>
      <DetailHeader
        snap={snap}
        onBack={onBack}
        onRestore={() => void restore()}
        onDelete={async () => {
          if (await confirmDialog({ title: 'Delete snapshot?', confirmLabel: 'Delete', danger: true })) {
            await deleteSnapshot(snap.id);
            onBack();
            await onChanged();
          }
        }}
      />
      {current !== null && <DiffView oldText={snap.text} newText={current} maxHeight="none" />}
    </Box>
  );
}

function ProjectSnapshotDetail({ snap, onBack, onChanged }: { snap: Snapshot; onBack: () => void; onChanged: () => Promise<void> }) {
  const docs = useStore((s) => s.docs);
  const [current, setCurrent] = useState<Map<string, DocumentContent> | null>(null);
  const [openDoc, setOpenDoc] = useState<string | null>(null);

  useEffect(() => {
    void flushAll()
      .then(() => listProjectContents(snap.projectId))
      .then((rows) => setCurrent(new Map(rows.map((r) => [r.docId, r]))));
  }, [snap.projectId]);

  const changes = useMemo(() => {
    if (!current || !snap.projectData) return [];
    const snapTexts = new Map(snap.projectData.contents.map((c) => [c.docId, c.text]));
    const titles = new Map(snap.projectData.docs.map((d) => [d.id, d.title]));
    const ids = new Set([...snapTexts.keys(), ...[...current.keys()].filter((id) => docs[id] && !docs[id].trashed)]);
    return [...ids]
      .map((id) => {
        const before = snapTexts.get(id) ?? '';
        const after = docs[id] && !docs[id].trashed ? current.get(id)?.text ?? '' : '';
        const status = !snapTexts.has(id) ? 'added' : !docs[id] || docs[id].trashed ? 'removed' : before === after ? 'same' : 'changed';
        return { id, title: docs[id]?.title ?? titles.get(id) ?? 'Untitled', before, after, status };
      })
      .filter((c) => c.status !== 'same');
  }, [current, snap, docs]);

  const restore = async () => {
    if (!(await confirmDialog({ title: 'Restore the whole project?', message: 'Every document returns to this snapshot. Documents created since are moved to the trash. A safety snapshot of the current project is taken first.', confirmLabel: 'Restore project' }))) return;
    await flushAll();
    await restoreProjectSnapshot(snap);
    const s = useStore.getState();
    await s.reloadDocs();
    s.bumpContent(Object.keys(s.docs));
    s.notify('Project restored');
    await onChanged();
  };

  const open = changes.find((c) => c.id === openDoc);

  return (
    <Box>
      <DetailHeader
        snap={snap}
        onBack={onBack}
        onRestore={() => void restore()}
        onDelete={async () => {
          if (await confirmDialog({ title: 'Delete project snapshot?', confirmLabel: 'Delete', danger: true })) {
            await deleteSnapshot(snap.id);
            onBack();
            await onChanged();
          }
        }}
      />
      <Typography variant="subtitle2" gutterBottom>
        {current ? (changes.length ? `${changes.length} document(s) differ from now` : 'Identical to the current project') : 'Comparing…'}
      </Typography>
      <List dense sx={{ mb: 2 }}>
        {changes.map((c) => (
          <ListItemButton key={c.id} selected={openDoc === c.id} onClick={() => setOpenDoc(c.id === openDoc ? null : c.id)}>
            <ListItemText primary={c.title} />
            <Chip size="small" label={c.status} color={c.status === 'added' ? 'success' : c.status === 'removed' ? 'error' : 'default'} variant="outlined" />
          </ListItemButton>
        ))}
      </List>
      {open && <DiffView oldText={open.before} newText={open.after} oldLabel="Snapshot" newLabel="Now" maxHeight="none" />}
    </Box>
  );
}

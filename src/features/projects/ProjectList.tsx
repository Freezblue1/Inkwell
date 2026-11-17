import { useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Tooltip,
} from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBookOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined';
import NoteAddIcon from '@mui/icons-material/NoteAddOutlined';
import ScienceIcon from '@mui/icons-material/ScienceOutlined';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweepOutlined';
import { useStore } from '@/store';
import { relativeTime } from '@/lib/dates';
import { confirmDialog } from '@/components/DialogHost';
import { importBundle, isProjectBundle } from '@/db/bundle';
import type { ID } from '@/types/models';

/** Lists projects with open/duplicate/delete, sample-novel and backup-restore actions. */
export function ProjectList({ onOpened }: { onOpened?: () => void }) {
  const projects = useStore((s) => s.projects);
  const seriesList = useStore((s) => s.seriesList);
  const current = useStore((s) => s.project?.id);
  const openProject = useStore((s) => s.openProject);
  const deleteProject = useStore((s) => s.deleteProject);
  const duplicateProject = useStore((s) => s.duplicateProject);
  const createDemoProject = useStore((s) => s.createDemoProject);
  const loadProjects = useStore((s) => s.loadProjects);
  const notify = useStore((s) => s.notify);
  const [menu, setMenu] = useState<{ el: HTMLElement; id: ID } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const demo = projects.find((p) => p.isDemo);

  const open = async (id: ID) => {
    await openProject(id);
    onOpened?.();
  };

  const remove = async (id: ID) => {
    const p = projects.find((x) => x.id === id);
    if (!p) return;
    const ok = await confirmDialog({
      title: `Delete “${p.title}”?`,
      message: 'This permanently removes the project, its snapshots and research files from this browser. Export a backup first if you might need it.',
      confirmLabel: 'Delete forever',
      danger: true,
    });
    if (!ok) return;
    await deleteProject(id);
    notify('Project deleted');
  };

  const restore = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!isProjectBundle(data)) throw new Error('This file is not an Inkwell backup (.inkwell).');
      const id = await importBundle(data);
      await loadProjects();
      await open(id);
      notify(`Restored “${data.project.title}”`);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not read the backup', 'error');
    }
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap', gap: 1 }}>
        {!demo ? (
          <Button
            startIcon={<ScienceIcon />}
            variant="outlined"
            onClick={async () => {
              const id = await createDemoProject();
              await open(id);
              notify('Sample novel loaded — explore, then delete it in one click');
            }}
          >
            Open sample novel
          </Button>
        ) : (
          <Button
            startIcon={<DeleteSweepIcon />}
            color="error"
            variant="outlined"
            onClick={async () => {
              const ok = await confirmDialog({ title: 'Delete the sample novel?', message: '“The Salt Archive” and all its demo data will be removed.', confirmLabel: 'Delete demo', danger: true });
              if (ok) {
                await deleteProject(demo.id);
                notify('Demo content deleted');
              }
            }}
          >
            Delete demo content
          </Button>
        )}
        <Button startIcon={<NoteAddIcon />} variant="contained" onClick={() => useStore.getState().openDialog('import')}>
          Import manuscript…
        </Button>
        <Button startIcon={<UploadFileIcon />} variant="outlined" onClick={() => fileRef.current?.click()}>
          Restore backup…
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".inkwell,.json,application/json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void restore(f);
            e.target.value = '';
          }}
        />
      </Stack>
      <List aria-label="Projects">
        {projects.map((p) => {
          const series = seriesList.find((s) => s.id === p.seriesId);
          return (
            <ListItem
              key={p.id}
              disablePadding
              secondaryAction={
                <Tooltip title="Project actions">
                  <IconButton edge="end" aria-label={`Actions for ${p.title}`} onClick={(e) => setMenu({ el: e.currentTarget, id: p.id })}>
                    <MoreVertIcon />
                  </IconButton>
                </Tooltip>
              }
            >
              <ListItemButton selected={p.id === current} onClick={() => void open(p.id)}>
                <ListItemIcon>
                  <MenuBookIcon color={p.id === current ? 'primary' : undefined} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <span>{p.title}</span>
                      {p.isDemo && <Chip size="small" label="Demo" color="secondary" variant="outlined" />}
                      {series && <Chip size="small" label={`${series.name} #${p.seriesOrder}`} variant="outlined" />}
                    </Stack>
                  }
                  secondary={`${p.kind.replace('-', ' ')} · opened ${relativeTime(p.lastOpenedAt)}`}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Menu anchorEl={menu?.el} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem
          onClick={() => {
            const id = menu!.id;
            setMenu(null);
            void open(id);
          }}
        >
          Open
        </MenuItem>
        <MenuItem
          onClick={async () => {
            const id = menu!.id;
            setMenu(null);
            await duplicateProject(id);
            notify('Project duplicated');
          }}
        >
          Duplicate
        </MenuItem>
        <MenuItem
          sx={{ color: 'error.main' }}
          onClick={() => {
            const id = menu!.id;
            setMenu(null);
            void remove(id);
          }}
        >
          Delete…
        </MenuItem>
      </Menu>
    </Box>
  );
}

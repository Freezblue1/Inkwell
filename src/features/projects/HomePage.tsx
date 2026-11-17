/**
 * Home: shown when Inkwell opens and whenever you leave a project (Home
 * button in the top bar). A "continue writing" card for the latest book,
 * then every project as a card with its word count and goal progress.
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  ButtonBase,
  Chip,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import NoteAddIcon from '@mui/icons-material/NoteAddOutlined';
import UploadFileIcon from '@mui/icons-material/UploadFileOutlined';
import ScienceIcon from '@mui/icons-material/ScienceOutlined';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweepOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import EditNoteIcon from '@mui/icons-material/EditNote';
import ContentCopyIcon from '@mui/icons-material/ContentCopyOutlined';
import DownloadIcon from '@mui/icons-material/DownloadOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import CloseIcon from '@mui/icons-material/Close';
import { useStore } from '@/store';
import { relativeTime } from '@/lib/dates';
import { confirmDialog } from '@/components/DialogHost';
import { exportBundle, importBundle, isProjectBundle } from '@/db/bundle';
import { loadProjectStats, type ProjectStats } from '@/db/projectStats';
import { downloadBlob, fileSafe } from '@/lib/export/download';
import { InstallAppCard } from '@/features/pwa/InstallAppCard';
import type { ID, Project } from '@/types/models';
import { NewProjectForm } from './NewProjectForm';

const ImportDialog = lazy(() => import('@/features/import/ImportDialog'));
const SettingsDialog = lazy(() => import('@/features/shell/SettingsDialog'));

type SortKey = 'recent' | 'title' | 'created' | 'words';
const SORT_LABELS: Record<SortKey, string> = { recent: 'Recently opened', title: 'Title A–Z', created: 'Newest first', words: 'Most words' };
const SORT_STORAGE = 'inkwell:home:sort';

const KIND_LABEL: Record<Project['kind'], string> = { novel: 'Novel', novella: 'Novella', 'short-story': 'Short story', series: 'Series' };

/** A stable "book cover" colour per project. */
const COVERS = ['#3949ab', '#00897b', '#8e24aa', '#c2185b', '#6d4c41', '#00838f', '#5e35b1', '#2e7d32', '#ef6c00', '#455a64'];
function coverColor(p: Project): string {
  // FNV-1a over the id: well spread, and stable when the book is renamed.
  let h = 0x811c9dc5;
  for (const c of p.id) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  return COVERS[h % COVERS.length];
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Writing late';
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function readSort(): SortKey {
  try {
    const v = localStorage.getItem(SORT_STORAGE);
    if (v && v in SORT_LABELS) return v as SortKey;
  } catch {
    /* storage unavailable */
  }
  return 'recent';
}

/** The little book cover: colour, initial and title. */
function Cover({ project, size = 'small' }: { project: Project; size?: 'small' | 'large' }) {
  const large = size === 'large';
  return (
    <Box
      aria-hidden
      sx={{
        width: large ? 96 : '100%',
        height: large ? 136 : 92,
        flexShrink: 0,
        borderRadius: large ? '4px 10px 10px 4px' : '10px 10px 0 0',
        bgcolor: coverColor(project),
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'flex-end',
        p: large ? 1.25 : 1.5,
        // A spine shadow on the left edge and a soft sheen.
        backgroundImage: large
          ? 'linear-gradient(90deg, rgba(0,0,0,.28) 0, rgba(0,0,0,.08) 8px, transparent 14px), linear-gradient(160deg, rgba(255,255,255,.18), transparent 55%)'
          : 'linear-gradient(160deg, rgba(255,255,255,.16), transparent 60%)',
        boxShadow: large ? '0 6px 16px rgba(0,0,0,.25)' : 'none',
      }}
    >
      <Typography
        sx={{
          position: 'absolute',
          right: large ? 10 : 14,
          top: large ? 4 : -6,
          fontFamily: 'Georgia, "Times New Roman", serif',
          fontSize: large ? 56 : 72,
          lineHeight: 1,
          opacity: 0.22,
          fontWeight: 700,
        }}
      >
        {project.title.trim().charAt(0).toUpperCase() || 'I'}
      </Typography>
      <Typography
        sx={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 700, fontSize: large ? 14 : 15, lineHeight: 1.2, position: 'relative', textShadow: '0 1px 2px rgba(0,0,0,.25)' }}
        noWrap={!large}
      >
        {project.title}
      </Typography>
    </Box>
  );
}

function Progress({ stats }: { stats?: ProjectStats }) {
  if (!stats) return null;
  const pct = stats.targetWords ? Math.min(100, Math.round((stats.words / stats.targetWords) * 100)) : null;
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {stats.words.toLocaleString()} words
        </Typography>
        {pct !== null && (
          <Typography variant="caption" color="text.secondary">
            {pct}% of {stats.targetWords! >= 1000 ? `${(stats.targetWords! / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}k` : stats.targetWords!.toLocaleString()}
          </Typography>
        )}
      </Stack>
      {pct !== null && <LinearProgress variant="determinate" value={pct} aria-label={`${pct}% of the word goal`} sx={{ height: 6, borderRadius: 3 }} />}
    </Box>
  );
}

export function HomePage() {
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('sm'));
  const projects = useStore((s) => s.projects);
  const seriesList = useStore((s) => s.seriesList);
  const lastProjectId = useStore((s) => s.settings.lastProjectId);
  const dialogs = useStore((s) => s.dialogs);
  const [stats, setStats] = useState<Record<ID, ProjectStats>>({});
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>(readSort);
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);
  const [menu, setMenu] = useState<{ el: HTMLElement; id: ID } | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [opening, setOpening] = useState<ID | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Refresh the numbers whenever the list of projects changes (new, deleted, imported…).
  useEffect(() => {
    let alive = true;
    loadProjectStats()
      .then((s) => alive && setStats(s))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [projects]);

  const demo = projects.find((p) => p.isDemo);
  const latest = useMemo(() => [...projects].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt)[0] ?? null, [projects]);
  const todayWords = Object.values(stats).reduce((s, x) => s + x.todayWords, 0);
  const totalWords = Object.values(stats).reduce((s, x) => s + x.words, 0);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = projects.filter((p) => !q || p.title.toLowerCase().includes(q) || p.author.toLowerCase().includes(q) || (seriesList.find((s) => s.id === p.seriesId)?.name.toLowerCase().includes(q) ?? false));
    const by: Record<SortKey, (a: Project, b: Project) => number> = {
      recent: (a, b) => b.lastOpenedAt - a.lastOpenedAt,
      title: (a, b) => a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' }),
      created: (a, b) => b.createdAt - a.createdAt,
      words: (a, b) => (stats[b.id]?.words ?? 0) - (stats[a.id]?.words ?? 0),
    };
    return list.sort(by[sort]);
  }, [projects, seriesList, query, sort, stats]);

  const notify = (m: string, sev?: 'success' | 'info' | 'warning' | 'error') => useStore.getState().notify(m, sev);

  const open = async (id: ID) => {
    setOpening(id);
    try {
      await useStore.getState().openProject(id);
      useStore.getState().setView('write');
    } finally {
      setOpening(null);
    }
  };

  const restore = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      if (!isProjectBundle(data)) throw new Error('This file is not an Inkwell backup (.inkwell).');
      const id = await importBundle(data);
      await useStore.getState().loadProjects();
      notify(`Restored “${data.project.title}”`, 'success');
      await open(id);
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not read the backup', 'error');
    }
  };

  const backup = async (p: Project) => {
    try {
      const bundle = await exportBundle(p.id);
      downloadBlob(new Blob([JSON.stringify(bundle)], { type: 'application/json' }), `${fileSafe(p.title)}-${new Date().toISOString().slice(0, 10)}.inkwell`);
      notify('Backup downloaded — keep it somewhere safe');
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Backup failed', 'error');
    }
  };

  const remove = async (p: Project) => {
    const ok = await confirmDialog({
      title: `Delete “${p.title}”?`,
      message: 'This permanently removes the project, its snapshots and research files from this device. Download a backup first if you might need it.',
      confirmLabel: 'Delete forever',
      danger: true,
    });
    if (!ok) return;
    await useStore.getState().deleteProject(p.id);
    notify('Project deleted');
  };

  const sampleButton = !demo ? (
    <Button
      startIcon={<ScienceIcon />}
      onClick={async () => {
        const id = await useStore.getState().createDemoProject();
        notify('Sample novel loaded — explore, then delete it in one click');
        await open(id);
      }}
    >
      Open the sample novel
    </Button>
  ) : (
    <Button
      startIcon={<DeleteSweepIcon />}
      color="inherit"
      onClick={async () => {
        const ok = await confirmDialog({ title: 'Delete the sample novel?', message: '“The Salt Archive” and all its demo data will be removed.', confirmLabel: 'Delete demo', danger: true });
        if (ok) {
          await useStore.getState().deleteProject(demo.id);
          notify('Demo content deleted');
        }
      }}
    >
      Remove the sample novel
    </Button>
  );

  const actions = (
    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
      <Button variant="contained" startIcon={<AddIcon />} onClick={() => setNewOpen(true)}>
        New project
      </Button>
      <Button variant="outlined" startIcon={<NoteAddIcon />} onClick={() => useStore.getState().openDialog('import')}>
        Import manuscript
      </Button>
      <Button variant="outlined" startIcon={<UploadFileIcon />} onClick={() => fileRef.current?.click()}>
        Restore backup
      </Button>
      {sampleButton}
      <input
        ref={fileRef}
        type="file"
        accept=".inkwell,.json,application/json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void restore(f);
        }}
      />
    </Stack>
  );

  const menuProject = menu ? projects.find((p) => p.id === menu.id) : undefined;
  const act = (fn: (p: Project) => unknown) => () => {
    const p = menuProject;
    setMenu(null);
    if (p) void fn(p);
  };

  return (
    <Box component="main" aria-label="Home" sx={{ height: '100%', overflow: 'auto', bgcolor: (t) => (t.inkwell.scene ? 'transparent' : t.palette.background.default) }}>
      <Container maxWidth="lg" sx={{ py: { xs: 3, md: 5 }, px: { xs: 2, sm: 3 } }}>
        {/* Header */}
        <Stack direction="row" spacing={2} alignItems="center" sx={{ mb: 3 }}>
          <Box component="img" src="/favicon.svg" alt="" sx={{ width: { xs: 40, md: 48 }, height: { xs: 40, md: 48 } }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h4" component="h1" sx={{ fontSize: { xs: 26, md: 34 } }}>
              {projects.length ? greeting() : 'Welcome to Inkwell'}
            </Typography>
            <Typography color="text.secondary" variant="body2">
              {projects.length
                ? [`${projects.length} project${projects.length === 1 ? '' : 's'}`, `${totalWords.toLocaleString()} words written`, todayWords > 0 ? `${todayWords.toLocaleString()} today` : null].filter(Boolean).join(' · ')
                : 'A quiet, local-first studio for writing novels. Your words never leave this device.'}
            </Typography>
          </Box>
          <Tooltip title="Settings">
            <IconButton aria-label="Open settings" onClick={() => useStore.getState().openDialog('settings')}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <Box sx={{ mb: 3 }}>
          <InstallAppCard compact />
        </Box>

        {projects.length === 0 ? (
          // First run: start a book right here.
          <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
            <Typography variant="h5" component="h2" gutterBottom>
              Start your first book
            </Typography>
            <NewProjectForm />
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1, mt: 3, pt: 2, borderTop: 1, borderColor: 'divider' }} alignItems="center">
              <Typography variant="body2" color="text.secondary" sx={{ mr: 1 }}>
                Already writing somewhere else?
              </Typography>
              <Button startIcon={<NoteAddIcon />} onClick={() => useStore.getState().openDialog('import')}>
                Import a manuscript
              </Button>
              <Button startIcon={<UploadFileIcon />} onClick={() => fileRef.current?.click()}>
                Restore a backup
              </Button>
              {sampleButton}
            </Stack>
          </Paper>
        ) : (
          <>
            {/* Continue writing */}
            {latest && (
              <Paper
                variant="outlined"
                sx={{ p: { xs: 2, md: 2.5 }, mb: 3, display: 'flex', gap: { xs: 2, md: 3 }, alignItems: 'center', flexDirection: { xs: 'column', sm: 'row' }, textAlign: { xs: 'center', sm: 'left' } }}
              >
                <Cover project={latest} size="large" />
                <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
                  <Typography variant="overline" color="text.secondary">
                    {latest.id === lastProjectId ? 'Pick up where you left off' : 'Most recent'}
                  </Typography>
                  <Typography variant="h5" component="h2" sx={{ fontFamily: 'Georgia, "Times New Roman", serif', fontWeight: 700 }} noWrap>
                    {latest.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                    {[latest.author && `by ${latest.author}`, KIND_LABEL[latest.kind], `opened ${relativeTime(latest.lastOpenedAt)}`].filter(Boolean).join(' · ')}
                  </Typography>
                  <Box sx={{ maxWidth: 420, mx: { xs: 'auto', sm: 0 } }}>
                    <Progress stats={stats[latest.id]} />
                  </Box>
                </Box>
                <Button size="large" variant="contained" startIcon={<EditNoteIcon />} onClick={() => void open(latest.id)} disabled={opening === latest.id} sx={{ flexShrink: 0 }}>
                  Continue writing
                </Button>
              </Paper>
            )}

            <Box sx={{ mb: 3 }}>{actions}</Box>

            {/* All projects */}
            <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1.5} sx={{ mb: 2 }}>
              <Typography variant="h6" component="h2" sx={{ flex: 1 }}>
                All projects
              </Typography>
              {projects.length > 3 && (
                <TextField
                  size="small"
                  placeholder="Search projects"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  inputProps={{ 'aria-label': 'Search projects' }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" />
                      </InputAdornment>
                    ),
                    endAdornment: query ? (
                      <InputAdornment position="end">
                        <IconButton size="small" aria-label="Clear search" onClick={() => setQuery('')}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : undefined,
                  }}
                  sx={{ width: { xs: '100%', sm: 240 } }}
                />
              )}
              <Button color="inherit" size="small" onClick={(e) => setSortAnchor(e.currentTarget)} aria-label={`Sort projects: ${SORT_LABELS[sort]}`} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' } }}>
                {SORT_LABELS[sort]} ▾
              </Button>
              <Menu anchorEl={sortAnchor} open={!!sortAnchor} onClose={() => setSortAnchor(null)}>
                {(Object.keys(SORT_LABELS) as SortKey[]).map((k) => (
                  <MenuItem
                    key={k}
                    selected={k === sort}
                    onClick={() => {
                      setSort(k);
                      setSortAnchor(null);
                      try {
                        localStorage.setItem(SORT_STORAGE, k);
                      } catch {
                        /* storage unavailable */
                      }
                    }}
                  >
                    {SORT_LABELS[k]}
                  </MenuItem>
                ))}
              </Menu>
            </Stack>

            {shown.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                No projects match “{query}”.
              </Typography>
            ) : (
              <Box component="ul" aria-label="Projects" sx={{ listStyle: 'none', p: 0, m: 0, display: 'grid', gridTemplateColumns: narrow ? '1fr 1fr' : 'repeat(auto-fill, minmax(220px, 1fr))', gap: { xs: 1.5, md: 2 } }}>
                {shown.map((p) => {
                  const series = seriesList.find((s) => s.id === p.seriesId);
                  const st = stats[p.id];
                  return (
                    <Box component="li" key={p.id} sx={{ position: 'relative', minWidth: 0 }}>
                      <Paper variant="outlined" sx={{ height: '100%', overflow: 'hidden', transition: 'box-shadow 150ms, transform 150ms', '&:hover': { boxShadow: 4, transform: 'translateY(-2px)' }, '&:focus-within': { boxShadow: 4 } }}>
                        <ButtonBase
                          onClick={() => void open(p.id)}
                          disabled={opening === p.id}
                          aria-label={`Open ${p.title}`}
                          sx={{ display: 'block', width: '100%', textAlign: 'left', height: '100%', '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 } }}
                        >
                          <Cover project={p} />
                          <Box sx={{ p: 1.5 }}>
                            <Typography variant="subtitle2" noWrap title={p.title} sx={{ pr: 3 }}>
                              {p.title}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" component="div" noWrap sx={{ mb: 1 }}>
                              {p.author ? `by ${p.author}` : KIND_LABEL[p.kind]}
                            </Typography>
                            <Progress stats={st} />
                            <Stack direction="row" sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }} alignItems="center">
                              {p.isDemo && <Chip size="small" label="Sample" color="secondary" variant="outlined" sx={{ height: 20 }} />}
                              {series && <Chip size="small" label={`${series.name} #${p.seriesOrder}`} variant="outlined" sx={{ height: 20, maxWidth: '100%' }} />}
                              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                                {relativeTime(p.lastOpenedAt)}
                              </Typography>
                            </Stack>
                          </Box>
                        </ButtonBase>
                      </Paper>
                      <IconButton
                        size="small"
                        aria-label={`Actions for ${p.title}`}
                        onClick={(e) => setMenu({ el: e.currentTarget, id: p.id })}
                        sx={{ position: 'absolute', top: 6, right: 6, color: '#fff', bgcolor: 'rgba(0,0,0,.18)', '&:hover': { bgcolor: 'rgba(0,0,0,.32)' } }}
                      >
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  );
                })}
              </Box>
            )}
          </>
        )}
      </Container>

      <Menu anchorEl={menu?.el} open={!!menu} onClose={() => setMenu(null)}>
        <MenuItem onClick={act((p) => open(p.id))}>
          <ListItemIcon>
            <EditNoteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Open</ListItemText>
        </MenuItem>
        <MenuItem
          onClick={act(async (p) => {
            await useStore.getState().duplicateProject(p.id);
            notify('Project duplicated');
          })}
        >
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Duplicate</ListItemText>
        </MenuItem>
        <MenuItem onClick={act(backup)}>
          <ListItemIcon>
            <DownloadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Download backup</ListItemText>
        </MenuItem>
        <MenuItem onClick={act(remove)} sx={{ color: 'error.main' }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText>Delete…</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog open={newOpen} onClose={() => setNewOpen(false)} maxWidth="md" fullWidth fullScreen={narrow} aria-labelledby="new-project-title">
        <DialogTitle id="new-project-title" sx={{ display: 'flex', alignItems: 'center' }}>
          <Box sx={{ flex: 1 }}>New project</Box>
          <IconButton aria-label="Close" onClick={() => setNewOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <NewProjectForm
            onCreated={() => {
              setNewOpen(false);
              useStore.getState().setView('write');
            }}
          />
        </DialogContent>
      </Dialog>

      <Suspense fallback={null}>
        {dialogs.import && <ImportDialog />}
        {dialogs.settings && <SettingsDialog />}
      </Suspense>
    </Box>
  );
}

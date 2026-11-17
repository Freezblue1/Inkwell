import { useState, type ReactElement } from 'react';
import { Box, Button, Card, CardActionArea, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBookOutlined';
import AutoStoriesIcon from '@mui/icons-material/AutoStoriesOutlined';
import ArticleIcon from '@mui/icons-material/ArticleOutlined';
import CollectionsBookmarkIcon from '@mui/icons-material/CollectionsBookmarkOutlined';
import type { ProjectKind } from '@/types/models';
import { PROJECT_TEMPLATES } from '@/db/templates';
import { useStore } from '@/store';

const ICONS: Record<ProjectKind, ReactElement> = {
  novel: <MenuBookIcon />,
  novella: <AutoStoriesIcon />,
  'short-story': <ArticleIcon />,
  series: <CollectionsBookmarkIcon />,
};

/** Title/author/template form for creating a project. */
export function NewProjectForm({ onCreated }: { onCreated?: () => void }) {
  const createProject = useStore((s) => s.createProject);
  const openProject = useStore((s) => s.openProject);
  const seriesList = useStore((s) => s.seriesList);
  const notify = useStore((s) => s.notify);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [kind, setKind] = useState<ProjectKind>('novel');
  const [seriesId, setSeriesId] = useState<string>('new');
  const [seriesName, setSeriesName] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    try {
      const id = await createProject({
        title: title.trim() || 'Untitled Novel',
        author: author.trim(),
        kind,
        seriesId: kind === 'series' && seriesId !== 'new' ? seriesId : null,
        seriesName: seriesName.trim(),
      });
      await openProject(id);
      notify('Project created');
      onCreated?.();
    } catch (e) {
      notify(e instanceof Error ? e.message : 'Could not create project', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack
      spacing={2}
      component="form"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} fullWidth autoFocus placeholder="Untitled Novel" />
        <TextField label="Author" value={author} onChange={(e) => setAuthor(e.target.value)} fullWidth placeholder="Your name or pen name" />
      </Stack>
      <Box role="radiogroup" aria-label="Template" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
        {PROJECT_TEMPLATES.map((t) => {
          const selected = kind === t.kind;
          return (
            <Card
              key={t.kind}
              sx={{ borderColor: selected ? 'primary.main' : 'divider', borderWidth: selected ? 2 : 1, bgcolor: selected ? 'action.selected' : undefined }}
            >
              <CardActionArea role="radio" aria-checked={selected} onClick={() => setKind(t.kind)} sx={{ height: '100%' }}>
                <CardContent sx={{ p: 1.5 }}>
                  <Box sx={{ color: 'primary.main', mb: 0.5 }}>{ICONS[t.kind]}</Box>
                  <Typography variant="subtitle2">{t.name}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    {t.description}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>
      {kind === 'series' && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField select label="Series" value={seriesId} onChange={(e) => setSeriesId(e.target.value)} sx={{ minWidth: 220 }}>
            <MenuItem value="new">New series…</MenuItem>
            {seriesList.map((s) => (
              <MenuItem key={s.id} value={s.id}>
                {s.name}
              </MenuItem>
            ))}
          </TextField>
          {seriesId === 'new' && (
            <TextField label="Series name" value={seriesName} onChange={(e) => setSeriesName(e.target.value)} fullWidth />
          )}
        </Stack>
      )}
      <Box>
        <Button type="submit" variant="contained" disabled={busy}>
          Create project
        </Button>
      </Box>
    </Stack>
  );
}

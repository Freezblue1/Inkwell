import { useMemo, useState } from 'react';
import { Box, Button, Divider, IconButton, InputAdornment, ListItemText, ListSubheader, Menu, MenuItem, Stack, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import PeopleIcon from '@mui/icons-material/PeopleOutline';
import BadgeIcon from '@mui/icons-material/BadgeOutlined';
import type { BibleKind } from '@/types/models';
import { useStore } from '@/store';
import { BIBLE_KIND_LABELS, bibleSearchText } from '@/lib/bible';
import { EmptyState } from '@/components/EmptyState';
import { deleteCustomTemplate, templatesFor, type BibleTemplate } from '@/lib/bibleTemplates';
import { BibleCard } from './BibleCard';

const KINDS: BibleKind[] = ['character', 'location', 'item', 'lore'];

/** Story bible: characters, locations, items and world/lore notes. */
export function StoryBible() {
  const bible = useStore((s) => s.bible);
  const docs = useStore((s) => s.docs);
  const project = useStore((s) => s.project);
  const [kind, setKind] = useState<BibleKind>('character');
  const [query, setQuery] = useState('');
  const [newAnchor, setNewAnchor] = useState<HTMLElement | null>(null);
  const [, refresh] = useState(0);
  const templates = templatesFor(kind);

  const appearances = useMemo(() => {
    const map = new Map<string, number>();
    Object.values(docs).forEach((d) => {
      if (d.trashed || d.type !== 'scene') return;
      new Set([...d.metadata.linkedIds, ...d.metadata.mentionIds, d.metadata.pov ?? '', d.metadata.locationId ?? '']).forEach((id) => id && map.set(id, (map.get(id) ?? 0) + 1));
    });
    return map;
  }, [docs]);

  const q = query.trim().toLowerCase();
  const list = bible.filter((b) => b.kind === kind && (!q || bibleSearchText(b).toLowerCase().includes(q))).sort((a, b) => a.name.localeCompare(b.name));

  /** New entry, blank or from a template. */
  const create = async (template?: BibleTemplate) => {
    setNewAnchor(null);
    const e = await useStore.getState().createBibleEntry(kind, (template?.fields ?? {}) as never);
    useStore.getState().openBibleEntry(e.id);
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 } }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }} sx={{ mb: 1 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h5" component="h2">
            Story Bible
          </Typography>
          {project?.seriesId && (
            <Typography variant="caption" color="text.secondary">
              Entries marked “Series” are shared with every book in the series.
            </Typography>
          )}
        </Box>
        <TextField
          size="small"
          placeholder="Search the bible"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          inputProps={{ 'aria-label': 'Search the story bible' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Button variant="outlined" startIcon={<BadgeIcon />} onClick={() => useStore.getState().openDialog('nameGen')}>
          Name generator
        </Button>
        <Button variant="contained" startIcon={<AddIcon />} endIcon={<ArrowDropDownIcon />} aria-haspopup="menu" onClick={(e) => setNewAnchor(e.currentTarget)}>
          New {BIBLE_KIND_LABELS[kind].singular.toLowerCase()}
        </Button>
      </Stack>
      <Menu anchorEl={newAnchor} open={!!newAnchor} onClose={() => setNewAnchor(null)} MenuListProps={{ 'aria-label': `New ${BIBLE_KIND_LABELS[kind].singular.toLowerCase()} from a template`, dense: true }}>
        <MenuItem onClick={() => void create()}>
          <ListItemText primary="Blank" secondary="Empty fields" />
        </MenuItem>
        <Divider />
        <ListSubheader sx={{ lineHeight: '32px' }}>Templates</ListSubheader>
        {templates.builtin.map((t) => (
          <MenuItem key={t.id} onClick={() => void create(t)}>
            <ListItemText primary={t.name} secondary={t.description} />
          </MenuItem>
        ))}
        {templates.custom.length > 0 && <Divider />}
        {templates.custom.length > 0 && <ListSubheader sx={{ lineHeight: '32px' }}>Your templates</ListSubheader>}
        {templates.custom.map((t) => (
          <MenuItem key={t.id} onClick={() => void create(t)}>
            <ListItemText primary={t.name} secondary={t.description} />
            <Tooltip title="Delete this template">
              <IconButton
                size="small"
                edge="end"
                aria-label={`Delete template ${t.name}`}
                onClick={(e) => {
                  e.stopPropagation();
                  deleteCustomTemplate(t.id);
                  refresh((n) => n + 1);
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </MenuItem>
        ))}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', px: 2, py: 1, maxWidth: 300 }}>
          Save any entry as a template from its editor (“Save as template”).
        </Typography>
      </Menu>
      <Tabs value={kind} onChange={(_, v) => setKind(v)} aria-label="Bible sections" sx={{ mb: 2 }}>
        {KINDS.map((k) => (
          <Tab key={k} value={k} label={`${BIBLE_KIND_LABELS[k].plural} (${bible.filter((b) => b.kind === k).length})`} />
        ))}
      </Tabs>
      {list.length === 0 ? (
        <EmptyState
          icon={<PeopleIcon />}
          title={q ? 'No matches' : `No ${BIBLE_KIND_LABELS[kind].plural.toLowerCase()} yet`}
          description={q ? 'Try another search.' : 'Build your cast and world here. Mention entries in your text with @ to link them to scenes.'}
          action={
            !q && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={() => void create()}>
                Create one
              </Button>
            )
          }
        />
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 2 }}>
          {list.map((e) => (
            <BibleCard key={e.id} entry={e} sceneCount={appearances.get(e.id) ?? 0} />
          ))}
        </Box>
      )}
    </Box>
  );
}

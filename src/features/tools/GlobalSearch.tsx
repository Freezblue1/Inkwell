import { useEffect, useState } from 'react';
import {
  Box,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  InputAdornment,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  ToggleButton,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { useStore } from '@/store';
import { useDebouncedValue } from '@/hooks/useDebounced';
import { searchContents, makeSnippet, type Snippet } from '@/db/repos/search';
import { buildFindRegex, findAll, DEFAULT_FIND_OPTIONS, type FindOptions } from '@/lib/findRegex';
import { GROUP_LABELS, groupOfDoc, type BinderGroup } from '@/lib/tree';
import { BIBLE_KIND_LABELS, bibleSearchText } from '@/lib/bible';
import { flushAll } from '@/features/editor/autosave';

type Scope = BinderGroup | 'bible';

interface Hit {
  key: string;
  scope: Scope;
  title: string;
  count: number;
  snippets: Snippet[];
  open: () => void;
}

const SCOPES: { value: Scope; label: string }[] = [
  { value: 'manuscript', label: 'Manuscript' },
  { value: 'frontmatter', label: 'Front matter' },
  { value: 'backmatter', label: 'Back matter' },
  { value: 'notes', label: 'Notes' },
  { value: 'research', label: 'Research' },
  { value: 'bible', label: 'Story bible' },
];

function Highlight({ s }: { s: Snippet }) {
  return (
    <>
      {s.before}
      <Box component="mark" sx={{ bgcolor: 'secondary.light', color: 'text.primary', borderRadius: 0.5, px: 0.25 }}>
        {s.match}
      </Box>
      {s.after}
    </>
  );
}

/** Project-wide search across manuscript, notes, research and the story bible. */
export default function GlobalSearch() {
  const close = () => useStore.getState().closeDialog('search');
  const projectId = useStore((s) => s.project?.id);
  const docs = useStore((s) => s.docs);
  const bible = useStore((s) => s.bible);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [query, setQuery] = useState('');
  const [opts, setOpts] = useState<FindOptions>(DEFAULT_FIND_OPTIONS);
  const [scopes, setScopes] = useState<Set<Scope>>(new Set(SCOPES.map((s) => s.value)));
  const [hits, setHits] = useState<Hit[]>([]);
  const [busy, setBusy] = useState(false);
  const q = useDebouncedValue(query.trim(), 200);

  useEffect(() => {
    if (!projectId || q.length < 2) {
      setHits([]);
      return;
    }
    let alive = true;
    setBusy(true);
    (async () => {
      await flushAll();
      const s = useStore.getState();
      const out: Hit[] = [];
      const content = await searchContents(projectId, q, opts);
      for (const h of content) {
        const d = docs[h.docId];
        if (!d || d.trashed) continue;
        const scope = groupOfDoc(docs, d.id);
        out.push({ key: d.id, scope, title: d.title, count: h.count, snippets: h.snippets, open: () => s.openDoc(d.id) });
      }
      // Titles & synopses that didn't match body text.
      const re = buildFindRegex(q, opts);
      if (re) {
        for (const d of Object.values(docs)) {
          if (d.trashed || out.some((o) => o.key === d.id)) continue;
          const text = `${d.title}\n${d.synopsis}`;
          const m = findAll(text, re);
          if (m.length) out.push({ key: d.id, scope: groupOfDoc(docs, d.id), title: d.title, count: m.length, snippets: [makeSnippet(text, m[0].index, m[0].length)], open: () => s.openDoc(d.id) });
        }
        for (const b of bible) {
          const text = bibleSearchText(b);
          const m = findAll(text, re);
          if (m.length)
            out.push({
              key: b.id,
              scope: 'bible',
              title: `${b.name} (${BIBLE_KIND_LABELS[b.kind].singular})`,
              count: m.length,
              snippets: m.slice(0, 2).map((x) => makeSnippet(text, x.index, x.length)),
              open: () => s.openBibleEntry(b.id),
            });
        }
      }
      if (alive) {
        setHits(out.sort((a, b) => b.count - a.count));
        setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [projectId, q, opts, docs, bible]);

  const visible = hits.filter((h) => scopes.has(h.scope));
  const toggleScope = (s: Scope) =>
    setScopes((cur) => {
      const next = new Set(cur);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  return (
    <Dialog open onClose={close} fullWidth maxWidth="md" fullScreen={fullScreen} aria-labelledby="search-title">
      <DialogTitle id="search-title" sx={{ display: 'flex', alignItems: 'center' }}>
        <Box sx={{ flex: 1 }}>Search project</Box>
        <IconButton aria-label="Close" onClick={close}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          placeholder="Words, names, phrases…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
          inputProps={{ 'aria-label': 'Search' }}
        />
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, my: 1.5 }}>
          {SCOPES.map((s) => (
            <Chip key={s.value} label={`${s.label} (${hits.filter((h) => h.scope === s.value).length})`} variant={scopes.has(s.value) ? 'filled' : 'outlined'} color={scopes.has(s.value) ? 'primary' : 'default'} onClick={() => toggleScope(s.value)} aria-pressed={scopes.has(s.value)} />
          ))}
          <Box sx={{ flex: 1 }} />
          {(
            [
              ['caseSensitive', 'Aa', 'Match case'],
              ['wholeWord', 'ab', 'Whole word'],
              ['regex', '.*', 'Regex'],
            ] as const
          ).map(([k, short, label]) => (
            <ToggleButton key={k} size="small" value={k} selected={opts[k]} onChange={() => setOpts((o) => ({ ...o, [k]: !o[k] }))} aria-label={label} title={label} sx={{ px: 1, py: 0, fontFamily: 'monospace' }}>
              {short}
            </ToggleButton>
          ))}
        </Stack>
        {busy && <LinearProgress />}
        {q.length >= 2 && !busy && visible.length === 0 && (
          <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
            No results for “{q}”.
          </Typography>
        )}
        <List aria-label="Results">
          {visible.map((h) => (
            <ListItemButton
              key={`${h.scope}-${h.key}`}
              onClick={() => {
                close();
                h.open();
                if (h.scope !== 'bible') useStore.getState().setFind({ open: true, replace: false });
              }}
              sx={{ alignItems: 'flex-start' }}
            >
              <ListItemText
                primary={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Typography variant="subtitle2">{h.title}</Typography>
                    <Chip size="small" label={h.scope === 'bible' ? 'Bible' : GROUP_LABELS[h.scope]} variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                    <Typography variant="caption" color="text.secondary">
                      {h.count} match{h.count === 1 ? '' : 'es'}
                    </Typography>
                  </Stack>
                }
                secondary={h.snippets.map((s, i) => (
                  <Box component="span" key={i} sx={{ display: 'block' }}>
                    <Highlight s={s} />
                  </Box>
                ))}
              />
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}

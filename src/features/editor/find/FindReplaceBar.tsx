import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Collapse,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useStore } from '@/store';
import { DEFAULT_FIND_OPTIONS, isInvalidRegex, type FindOptions } from '@/lib/findRegex';
import { useDebouncedValue } from '@/hooks/useDebounced';
import { getSearchState } from '../extensions/SearchHighlight';
import { searchContents, type ContentHit } from '@/db/repos/search';
import { replaceInProject } from './projectReplace';
import { confirmDialog } from '@/components/DialogHost';
import { flushAll } from '../autosave';

type Scope = 'document' | 'project';

/** Find & Replace bar (case, whole word, regex; document or project scope). */
export function FindReplaceBar() {
  const find = useStore((s) => s.find);
  const editor = useStore((s) => s.activeEditor);
  const docs = useStore((s) => s.docs);
  const projectId = useStore((s) => s.project?.id);
  const [term, setTerm] = useState('');
  const [replacement, setReplacement] = useState('');
  const [opts, setOpts] = useState<FindOptions>(DEFAULT_FIND_OPTIONS);
  const [scope, setScope] = useState<Scope>('document');
  const [, force] = useState(0);
  const [hits, setHits] = useState<ContentHit[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounced = useDebouncedValue(term, 150);
  const invalid = isInvalidRegex(term, opts);

  // Focus the field whenever the bar opens.
  useEffect(() => {
    if (find.open) setTimeout(() => inputRef.current?.select(), 30);
  }, [find.open]);

  // Apply the query to the active editor (document scope).
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    if (!find.open || scope !== 'document') {
      editor.commands.setSearchQuery(null);
      return;
    }
    editor.commands.setSearchQuery(debounced ? { term: debounced, options: opts } : null);
    const rerender = () => force((n) => n + 1);
    editor.on('transaction', rerender);
    return () => {
      editor.off('transaction', rerender);
    };
  }, [editor, debounced, opts, find.open, scope]);

  // Project scope: search stored contents.
  useEffect(() => {
    if (!find.open || scope !== 'project' || !projectId || !debounced || invalid) {
      setHits([]);
      return;
    }
    let alive = true;
    void flushAll()
      .then(() => searchContents(projectId, debounced, opts))
      .then((h) => alive && setHits(h.filter((x) => docs[x.docId] && !docs[x.docId].trashed)));
    return () => {
      alive = false;
    };
  }, [find.open, scope, projectId, debounced, opts, invalid, docs]);

  if (!find.open) return null;

  const st = editor && !editor.isDestroyed ? getSearchState(editor.state) : undefined;
  const count = scope === 'document' ? st?.matches.length ?? 0 : hits.reduce((s, h) => s + h.count, 0);
  const current = st && st.current >= 0 ? st.current + 1 : 0;

  const close = () => {
    useStore.getState().setFind({ open: false });
    editor?.commands.setSearchQuery(null);
    editor?.commands.focus();
  };
  const go = (delta: number) => {
    if (!editor || !st?.matches.length) return;
    editor.commands.gotoSearchMatch((st.current < 0 ? 0 : st.current) + delta);
  };

  const replaceAllProject = async () => {
    const ids = hits.map((h) => h.docId);
    const ok = await confirmDialog({
      title: `Replace ${count} matches in ${ids.length} documents?`,
      message: `“${term}” → “${replacement}”. A snapshot of every changed document is saved first, so you can undo this from History.`,
      confirmLabel: 'Replace all',
    });
    if (!ok) return;
    const res = await replaceInProject(ids, { term, options: opts }, replacement);
    useStore.getState().notify(`Replaced ${res.replacements} matches in ${res.docs} documents`);
    setHits([]);
  };

  const toggle = (key: keyof FindOptions, label: string, short: string) => (
    <Tooltip title={label}>
      <ToggleButton
        size="small"
        value={key}
        selected={opts[key]}
        onChange={() => setOpts((o) => ({ ...o, [key]: !o[key] }))}
        aria-label={label}
        sx={{ px: 1, py: 0.25, fontFamily: 'monospace', fontSize: 12 }}
      >
        {short}
      </ToggleButton>
    </Tooltip>
  );

  return (
    <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', px: 1, py: 1 }} role="search" aria-label="Find and replace">
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} alignItems={{ md: 'center' }}>
        <TextField
          inputRef={inputRef}
          size="small"
          placeholder="Find"
          value={term}
          error={invalid}
          onChange={(e) => setTerm(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              go(e.shiftKey ? -1 : 1);
            }
            if (e.key === 'Escape') close();
          }}
          inputProps={{ 'aria-label': 'Find' }}
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                <Typography variant="caption" color={invalid ? 'error' : 'text.secondary'} aria-live="polite">
                  {invalid ? 'Bad regex' : term ? (scope === 'document' ? `${current}/${count}` : `${count}`) : ''}
                </Typography>
              </InputAdornment>
            ),
          }}
          sx={{ minWidth: 220, flex: 1 }}
        />
        {find.replace && (
          <TextField
            size="small"
            placeholder="Replace with"
            value={replacement}
            onChange={(e) => setReplacement(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && close()}
            inputProps={{ 'aria-label': 'Replace with' }}
            sx={{ minWidth: 200, flex: 1 }}
          />
        )}
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexWrap: 'wrap' }}>
          {toggle('caseSensitive', 'Match case', 'Aa')}
          {toggle('wholeWord', 'Whole word', 'ab')}
          {toggle('regex', 'Regular expression', '.*')}
          <Select size="small" value={scope} onChange={(e) => setScope(e.target.value as Scope)} inputProps={{ 'aria-label': 'Scope' }} sx={{ height: 32, fontSize: 13 }}>
            <MenuItem value="document">This document</MenuItem>
            <MenuItem value="project">Whole project</MenuItem>
          </Select>
          {scope === 'document' && (
            <>
              <IconButton size="small" aria-label="Previous match (Shift+Enter)" onClick={() => go(-1)} disabled={!count}>
                <KeyboardArrowUpIcon fontSize="small" />
              </IconButton>
              <IconButton size="small" aria-label="Next match (Enter)" onClick={() => go(1)} disabled={!count}>
                <KeyboardArrowDownIcon fontSize="small" />
              </IconButton>
            </>
          )}
          {find.replace && scope === 'document' && (
            <>
              <Button size="small" disabled={!count} onClick={() => editor?.commands.replaceCurrentMatch(replacement)}>
                Replace
              </Button>
              <Button size="small" disabled={!count} onClick={() => editor?.commands.replaceAllMatches(replacement)}>
                All
              </Button>
            </>
          )}
          {find.replace && scope === 'project' && (
            <Button size="small" disabled={!count} onClick={() => void replaceAllProject()}>
              Replace all in project
            </Button>
          )}
          {!find.replace && (
            <Button size="small" onClick={() => useStore.getState().setFind({ replace: true })}>
              Replace…
            </Button>
          )}
          <IconButton size="small" aria-label="Close find (Esc)" onClick={close}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>
      <Collapse in={scope === 'project' && !!term}>
        <List dense sx={{ maxHeight: 240, overflow: 'auto', mt: 1 }} aria-label="Matches in project">
          {hits.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ px: 2, py: 1 }}>
              No matches.
            </Typography>
          )}
          {hits.map((h) => (
            <ListItemButton
              key={h.docId}
              onClick={() => {
                setScope('document');
                useStore.getState().openDoc(h.docId);
              }}
            >
              <ListItemText
                primary={`${docs[h.docId]?.title ?? 'Untitled'} — ${h.count} match${h.count === 1 ? '' : 'es'}`}
                secondary={
                  <>
                    {h.snippets[0]?.before}
                    <Box component="mark" sx={{ bgcolor: 'secondary.light', color: 'inherit', px: 0.25 }}>
                      {h.snippets[0]?.match}
                    </Box>
                    {h.snippets[0]?.after}
                  </>
                }
              />
            </ListItemButton>
          ))}
        </List>
      </Collapse>
    </Box>
  );
}

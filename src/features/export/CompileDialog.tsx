import { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { ID } from '@/types/models';
import { useStore } from '@/store';
import { depthFirst, groupRoots, manuscriptSequence } from '@/lib/tree';
import { isIncluded, selectedMatter } from '@/lib/compile/compile';
import { buildBook, exportBook, EXPORT_FORMATS, type ExportFormat } from '@/lib/export';
import { flushAll } from '@/features/editor/autosave';
import { statusColor } from '@/lib/defaults';
import { useExportProfile } from './profileStore';

/** Scrivener-style Compile: choose format, contents (by status/label/checklist) and front/back matter. */
export default function CompileDialog() {
  const close = () => useStore.getState().closeDialog('compile');
  const project = useStore((s) => s.project);
  const docs = useStore((s) => s.docs);
  const notify = useStore((s) => s.notify);
  const profile = useExportProfile((s) => s.profile);
  const update = useExportProfile((s) => s.update);
  const load = useExportProfile((s) => s.load);
  const [format, setFormat] = useState<ExportFormat>('docx');
  const [busy, setBusy] = useState(false);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    if (project) void load(project.id, project.author);
  }, [project, load]);

  const seq = useMemo(() => manuscriptSequence(docs), [docs]);
  const front = useMemo(() => depthFirst(docs, groupRoots(docs, 'frontmatter')), [docs]);
  const back = useMemo(() => depthFirst(docs, groupRoots(docs, 'backmatter')), [docs]);
  if (!project || !profile) return null;

  const depthOf = (id: ID) => {
    let d = 0;
    let cur = docs[id];
    while (cur?.parentId && docs[cur.parentId]) {
      d++;
      cur = docs[cur.parentId];
    }
    return d;
  };
  const toggleIn = (list: ID[], id: ID) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  const frontSelected = new Set(selectedMatter(docs, 'frontmatter', profile).map((d) => d.id));
  const backSelected = new Set(selectedMatter(docs, 'backmatter', profile).map((d) => d.id));
  const included = seq.filter((d) => d.type === 'scene' && isIncluded(d, profile));
  const words = included.reduce((n, d) => n + d.wordCount, 0);

  const run = async () => {
    setBusy(true);
    try {
      await flushAll();
      const book = await buildBook(project, useStore.getState().docs, profile);
      await exportBook(book, format);
      notify(`Compiled ${book.wordCount.toLocaleString()} words to ${EXPORT_FORMATS.find((f) => f.value === format)?.label}`);
      close();
    } catch (e) {
      console.error(e);
      notify(e instanceof Error ? `Compile failed: ${e.message}` : 'Compile failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={close} maxWidth="lg" fullWidth fullScreen={fullScreen} aria-labelledby="compile-title">
      <DialogTitle id="compile-title">Compile manuscript</DialogTitle>
      {busy && <LinearProgress />}
      <DialogContent dividers>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '260px 1fr 260px' }, gap: 3 }}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Format
            </Typography>
            <RadioGroup value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)} aria-label="Output format">
              {EXPORT_FORMATS.map((f) => (
                <FormControlLabel
                  key={f.value}
                  value={f.value}
                  control={<Radio size="small" />}
                  label={
                    <Box>
                      <Typography variant="body2">{f.label}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {f.description}
                      </Typography>
                    </Box>
                  }
                  sx={{ alignItems: 'flex-start', mb: 1, '& .MuiRadio-root': { pt: 0.25 } }}
                />
              ))}
            </RadioGroup>
            <Typography variant="overline" color="text.secondary" display="block" sx={{ mt: 2 }}>
              Template
            </Typography>
            <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
              {profile.template} · {profile.bodyFont} {profile.fontSize}pt
            </Typography>
            <Button size="small" onClick={() => { close(); useStore.getState().setView('export'); }}>
              Adjust formatting…
            </Button>
            <FormControlLabel sx={{ mt: 1 }} control={<Switch size="small" checked={profile.toc} onChange={(e) => update({ toc: e.target.checked })} />} label="Table of contents" />
            <FormControlLabel control={<Switch size="small" checked={profile.titlePage} onChange={(e) => update({ titlePage: e.target.checked })} />} label="Title page" />
            <FormControlLabel control={<Switch size="small" checked={profile.copyrightPage} onChange={(e) => update({ copyrightPage: e.target.checked })} />} label="Copyright page" />
          </Box>

          <Box sx={{ minWidth: 0 }}>
            <Typography variant="overline" color="text.secondary">
              Contents
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1 }} aria-label="Include statuses">
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, alignSelf: 'center' }}>
                Statuses:
              </Typography>
              {project.statuses.map((st) => {
                const on = profile.includeStatuses.length === 0 || profile.includeStatuses.includes(st);
                return (
                  <Chip
                    key={st}
                    size="small"
                    label={st}
                    variant={on ? 'filled' : 'outlined'}
                    onClick={() => {
                      const base = profile.includeStatuses.length ? profile.includeStatuses : project.statuses;
                      const next = toggleIn(base, st);
                      update({ includeStatuses: next.length === project.statuses.length ? [] : next });
                    }}
                    sx={{ bgcolor: on ? statusColor(st) : undefined, color: on ? '#fff' : undefined }}
                    aria-pressed={on}
                  />
                );
              })}
            </Stack>
            {project.labels.length > 0 && (
              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 1 }} aria-label="Include labels">
                <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5, alignSelf: 'center' }}>
                  Labels:
                </Typography>
                <Chip size="small" label="Any" variant={profile.includeLabels.length === 0 ? 'filled' : 'outlined'} onClick={() => update({ includeLabels: [] })} />
                {project.labels.map((l) => (
                  <Chip
                    key={l.id}
                    size="small"
                    label={l.name}
                    variant={profile.includeLabels.includes(l.id) ? 'filled' : 'outlined'}
                    onClick={() => update({ includeLabels: toggleIn(profile.includeLabels, l.id) })}
                    sx={profile.includeLabels.includes(l.id) ? { bgcolor: l.color, color: '#fff' } : { borderColor: l.color }}
                  />
                ))}
              </Stack>
            )}
            <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, maxHeight: 360, overflowY: 'auto', py: 0.5 }}>
              {seq.map((d) => {
                const checked = !profile.excludedDocIds.includes(d.id);
                const passes = isIncluded(d, profile);
                return (
                  <Stack key={d.id} direction="row" alignItems="center" sx={{ pl: 1 + depthOf(d.id) * 2.5, pr: 1, opacity: passes ? 1 : 0.5 }}>
                    <Checkbox size="small" checked={checked} onChange={() => update({ excludedDocIds: toggleIn(profile.excludedDocIds, d.id) })} inputProps={{ 'aria-label': `Include ${d.title}` }} />
                    <Typography variant="body2" noWrap sx={{ flex: 1, fontWeight: d.type === 'scene' ? 400 : 500 }}>
                      {d.title}
                    </Typography>
                    {d.status && d.type === 'scene' && (
                      <Typography variant="caption" sx={{ color: statusColor(d.status), mr: 1 }}>
                        {d.status}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      {d.wordCount ? d.wordCount.toLocaleString() : ''}
                    </Typography>
                  </Stack>
                );
              })}
            </Box>
            <Typography variant="caption" color="text.secondary">
              {included.length} scenes · {words.toLocaleString()} words will be compiled. Greyed rows are filtered out by status/label.
            </Typography>
          </Box>

          <Box>
            <Typography variant="overline" color="text.secondary">
              Front matter
            </Typography>
            {front.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                None in binder.
              </Typography>
            )}
            {front.map((d) => (
              <FormControlLabel
                key={d.id}
                sx={{ display: 'flex' }}
                control={
                  <Checkbox
                    size="small"
                    checked={frontSelected.has(d.id)}
                    onChange={() => {
                      const next = toggleIn([...frontSelected], d.id);
                      // An empty list means "all", so use a sentinel when everything is unchecked.
                      update({ includeFrontMatter: next.length ? next : ['__none__'] });
                    }}
                  />
                }
                label={d.title}
              />
            ))}
            <Typography variant="overline" color="text.secondary" display="block" sx={{ mt: 2 }}>
              Back matter
            </Typography>
            {back.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                None in binder.
              </Typography>
            )}
            {back.map((d) => (
              <FormControlLabel
                key={d.id}
                sx={{ display: 'flex' }}
                control={<Checkbox size="small" checked={backSelected.has(d.id)} onChange={() => {
                      const next = toggleIn([...backSelected], d.id);
                      update({ includeBackMatter: next.length ? next : ['__none__'] });
                    }} />}
                label={d.title}
              />
            ))}
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={close}>Cancel</Button>
        <Button variant="contained" onClick={() => void run()} disabled={busy}>
          Compile &amp; download
        </Button>
      </DialogActions>
    </Dialog>
  );
}

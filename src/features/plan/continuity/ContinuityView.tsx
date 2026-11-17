/**
 * Continuity: checks the manuscript against the Story Bible (eyes or hair
 * described two ways, names spelled two ways, characters missing for too
 * long), shows each character's chapter appearances on a strip, and a
 * dialogue view of one character's lines.
 */
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControlLabel,
  IconButton,
  MenuItem,
  Select,
  Stack,
  Switch,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import RefreshIcon from '@mui/icons-material/Refresh';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CloseIcon from '@mui/icons-material/Close';
import FactCheckIcon from '@mui/icons-material/FactCheckOutlined';
import ViewTimelineIcon from '@mui/icons-material/ViewTimelineOutlined';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOverOutlined';
import type { Character, ID, InkDocument } from '@/types/models';
import { useStore } from '@/store';
import { manuscriptSequence, nearestAncestorOfType } from '@/lib/tree';
import { specialLabel } from '@/lib/specialChapters';
import { getContents } from '@/db/repos/documents';
import { flushAll } from '@/features/editor/autosave';
import { revealText } from '@/features/editor/editorActions';
import { analyseContinuity, buildMatcher, type CharacterInput, type Issue, type Occurrence, type SceneText, type Unit } from '@/lib/continuity';
import { DialogueView } from './DialogueView';

export type ContinuityMode = 'checks' | 'appearances' | 'dialogue';
const MODE_KEY = 'inkwell:continuity:mode';
const GAP_KEY = 'inkwell:continuity:gap';

/** Opens the Continuity tab on a given view (command palette). */
export function openContinuity(mode: ContinuityMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* ignore */
  }
  const s = useStore.getState();
  s.setView('plan');
  s.setPlanTab('continuity');
  window.dispatchEvent(new CustomEvent('inkwell:continuity-mode', { detail: mode }));
}

const read = (k: string, fallback: string) => {
  try {
    return localStorage.getItem(k) ?? fallback;
  } catch {
    return fallback;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
};

const PALETTE = ['#3949ab', '#00897b', '#d81b60', '#ef6c00', '#8e24aa', '#43a047', '#1e88e5', '#6d4c41', '#c0ca33', '#5e35b1'];

/** Chapters (and loose scenes) in reading order, plus the text of every manuscript document. */
export function buildUnits(docs: Record<ID, InkDocument>): { units: Unit[]; docUnit: Map<ID, ID>; docIds: ID[] } {
  const seq = manuscriptSequence(docs).filter((d) => !d.trashed);
  const units: Unit[] = [];
  const docUnit = new Map<ID, ID>();
  let n = 0;
  for (const d of seq) {
    if (d.type === 'chapter') {
      const special = specialLabel(d);
      if (!special) n++;
      units.push({ id: d.id, label: special || `Chapter ${n}`, title: d.title });
      docUnit.set(d.id, d.id);
    } else if (d.type === 'scene') {
      const ch = nearestAncestorOfType(docs, d.id, 'chapter');
      if (ch) docUnit.set(d.id, ch.id);
      else {
        units.push({ id: d.id, label: 'Scene', title: d.title });
        docUnit.set(d.id, d.id);
      }
    }
  }
  return { units, docUnit, docIds: [...docUnit.keys()] };
}

export function useManuscriptText(version: number) {
  const docs = useStore((s) => s.docs);
  const [scenes, setScenes] = useState<SceneText[] | null>(null);
  const { units, docUnit, docIds } = useMemo(() => buildUnits(docs), [docs]);
  useEffect(() => {
    let alive = true;
    setScenes(null);
    void (async () => {
      await flushAll();
      const rows = await getContents(docIds);
      if (!alive) return;
      setScenes(docIds.filter((id) => rows.get(id)?.text).map((id) => ({ docId: id, unitId: docUnit.get(id)!, title: docs[id]?.title ?? '', text: rows.get(id)!.text })));
    })();
    return () => {
      alive = false;
    };
    // Re-read only when asked (version) or when the manuscript's structure changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version, docIds.join(',')]);
  return { units, scenes };
}

export function useCharacters(): (CharacterInput & { color: string })[] {
  const bible = useStore((s) => s.bible);
  return useMemo(
    () =>
      bible
        .filter((b): b is Character => b.kind === 'character' && !!b.name.trim())
        .map((c, i) => ({ id: c.id, name: c.name, appearance: [c.appearance, c.summary].filter(Boolean).join(' '), color: c.color || PALETTE[i % PALETTE.length] })),
    [bible],
  );
}

export function OccurrenceRow({ o, docs }: { o: Occurrence; docs: Record<ID, InkDocument> }) {
  const where = o.docId === 'bible' ? 'Story Bible' : docs[o.docId]?.title ?? 'Deleted document';
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ py: 0.5 }}>
      <Chip size="small" label={where} variant="outlined" sx={{ flexShrink: 0, maxWidth: 160 }} />
      <Typography variant="body2" sx={{ flex: 1, fontFamily: 'Georgia, serif', color: 'text.secondary' }}>
        {o.snippet}
      </Typography>
      {o.docId !== 'bible' && (
        <Tooltip title="Show in the manuscript">
          <IconButton size="small" aria-label={`Show in ${where}`} onClick={() => void revealText(o.docId as ID, o.match ?? '')}>
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
    </Stack>
  );
}

export default function ContinuityView() {
  const docs = useStore((s) => s.docs);
  const projectId = useStore((s) => s.project?.id ?? '');
  const theme = useTheme();
  const [mode, setMode] = useState<ContinuityMode>(() => read(MODE_KEY, 'checks') as ContinuityMode);
  const [gap, setGap] = useState(() => Number(read(GAP_KEY, '5')) || 5);
  const [version, setVersion] = useState(0);
  const [showDismissed, setShowDismissed] = useState(false);
  const ignoreKey = `inkwell:continuity:ignored:${projectId}`;
  const [ignored, setIgnored] = useState<string[]>(() => JSON.parse(read(ignoreKey, '[]')) as string[]);
  const { units, scenes } = useManuscriptText(version);
  const characters = useCharacters();

  useEffect(() => {
    const on = (e: Event) => setMode((e as CustomEvent<ContinuityMode>).detail);
    window.addEventListener('inkwell:continuity-mode', on);
    return () => window.removeEventListener('inkwell:continuity-mode', on);
  }, []);

  const report = useMemo(() => (scenes ? analyseContinuity(units, scenes, characters, gap) : null), [units, scenes, characters, gap]);
  const byId = useMemo(() => new Map(characters.map((c) => [c.id, c])), [characters]);
  const visible = (report?.issues ?? []).filter((i) => showDismissed || !ignored.includes(i.key));
  const dismissedCount = (report?.issues ?? []).filter((i) => ignored.includes(i.key)).length;

  const dismiss = useCallback(
    (key: string, on: boolean) => {
      setIgnored((cur) => {
        const next = on ? [...new Set([...cur, key])] : cur.filter((k) => k !== key);
        write(ignoreKey, JSON.stringify(next));
        return next;
      });
    },
    [ignoreKey],
  );

  const changeMode = (m: ContinuityMode | null) => {
    if (!m) return;
    setMode(m);
    write(MODE_KEY, m);
  };

  if (!characters.length) {
    return (
      <Box sx={{ p: 4, maxWidth: 640 }}>
        <Typography variant="h5" gutterBottom>
          Continuity
        </Typography>
        <Alert severity="info">
          Add characters to the Story Bible first. The checker uses their names to find them in the manuscript, and their “Appearance” to know what their eyes and hair should look like.
        </Alert>
        <Button sx={{ mt: 2 }} onClick={() => useStore.getState().setPlanTab('bible')}>
          Open the Story Bible
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1.5, md: 3 }, display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}>
      <Stack direction="row" alignItems="center" sx={{ flexWrap: 'wrap', gap: 1.5 }}>
        <ToggleButtonGroup size="small" exclusive value={mode} onChange={(_, v) => changeMode(v)} aria-label="Continuity view">
          <ToggleButton value="checks" aria-label="Checks">
            <FactCheckIcon fontSize="small" sx={{ mr: 0.75 }} /> Checks
            {report && visible.length > 0 && <Chip size="small" color="warning" label={visible.length} sx={{ ml: 1, height: 18 }} />}
          </ToggleButton>
          <ToggleButton value="appearances" aria-label="Appearances">
            <ViewTimelineIcon fontSize="small" sx={{ mr: 0.75 }} /> Appearances
          </ToggleButton>
          <ToggleButton value="dialogue" aria-label="Dialogue">
            <RecordVoiceOverIcon fontSize="small" sx={{ mr: 0.75 }} /> Dialogue
          </ToggleButton>
        </ToggleButtonGroup>
        <Box sx={{ flex: 1 }} />
        {mode !== 'dialogue' && (
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="body2" color="text.secondary">
              Flag absences of
            </Typography>
            <Select
              size="small"
              value={gap}
              onChange={(e) => {
                setGap(Number(e.target.value));
                write(GAP_KEY, String(e.target.value));
              }}
              inputProps={{ 'aria-label': 'Chapters missing before flagging' }}
              sx={{ height: 32 }}
            >
              {[2, 3, 4, 5, 6, 8, 10].map((n) => (
                <MenuItem key={n} value={n}>
                  {n}+ chapters
                </MenuItem>
              ))}
            </Select>
          </Stack>
        )}
        <Tooltip title="Re-read the manuscript">
          <IconButton aria-label="Re-scan" onClick={() => setVersion((v) => v + 1)}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Stack>

      {!report || !scenes ? (
        <Stack alignItems="center" sx={{ py: 8 }} role="status">
          <CircularProgress />
        </Stack>
      ) : mode === 'checks' ? (
        <Checks issues={visible} ignored={ignored} units={units} byId={byId} docs={docs} onDismiss={dismiss} dismissedCount={dismissedCount} showDismissed={showDismissed} setShowDismissed={setShowDismissed} />
      ) : mode === 'appearances' ? (
        <AppearanceStrip units={units} scenes={scenes} report={report} characters={characters} gapIssues={report.issues.filter((i): i is Extract<Issue, { kind: 'absence' }> => i.kind === 'absence' && !ignored.includes(i.key))} accent={theme.palette.error.main} />
      ) : (
        <DialogueView scenes={scenes} units={units} characters={characters} />
      )}
    </Box>
  );
}

function Checks({
  issues,
  ignored,
  units,
  byId,
  docs,
  onDismiss,
  dismissedCount,
  showDismissed,
  setShowDismissed,
}: {
  issues: Issue[];
  ignored: string[];
  units: Unit[];
  byId: Map<ID, CharacterInput & { color: string }>;
  docs: Record<ID, InkDocument>;
  onDismiss: (key: string, on: boolean) => void;
  dismissedCount: number;
  showDismissed: boolean;
  setShowDismissed: (v: boolean) => void;
}) {
  const groups: { kind: Issue['kind']; title: string; icon: ReactElement; help: string }[] = [
    { kind: 'attribute', title: 'Described two different ways', icon: <VisibilityIcon />, help: 'Eye or hair colour that changes between scenes (or differs from the Story Bible).' },
    { kind: 'spelling', title: 'Name spelled two ways', icon: <SpellcheckIcon />, help: 'Words that look like a misspelt character name.' },
    { kind: 'absence', title: 'Missing for a while', icon: <HourglassEmptyIcon />, help: 'Characters who disappear for several chapters.' },
  ];
  const name = (id: ID) => byId.get(id)?.name ?? 'Unknown';
  return (
    <Stack spacing={3} sx={{ maxWidth: 980 }}>
      {issues.length === 0 && (
        <Alert severity="success">
          No continuity problems found. Inkwell checks eye and hair colour, name spellings and long absences for every Story Bible character.
        </Alert>
      )}
      {groups.map((g) => {
        const list = issues.filter((i) => i.kind === g.kind);
        if (!list.length) return null;
        return (
          <Box key={g.kind}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Box sx={{ color: 'warning.main', display: 'flex' }}>{g.icon}</Box>
              <Typography variant="h6" component="h2">
                {g.title}
              </Typography>
              <Chip size="small" label={list.length} />
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {g.help}
            </Typography>
            <Stack spacing={1.5}>
              {list.map((issue) => {
                const off = ignored.includes(issue.key);
                return (
                  <Card key={issue.key} sx={{ opacity: off ? 0.55 : 1 }}>
                    <CardContent sx={{ pb: '12px !important' }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: byId.get(issue.characterId)?.color }} />
                        <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
                          {issue.kind === 'attribute' && `${name(issue.characterId)}’s ${issue.attr}: ${issue.values.map((v) => v.value).join(' vs ')}`}
                          {issue.kind === 'spelling' && `“${issue.variant}” — did you mean “${issue.canonical}” (${name(issue.characterId)})?`}
                          {issue.kind === 'absence' &&
                            (issue.trailing
                              ? `${name(issue.characterId)} isn’t seen in the last ${issue.length} chapters`
                              : `${name(issue.characterId)} disappears for ${issue.length} chapters`)}
                        </Typography>
                        <Button size="small" color="inherit" startIcon={off ? undefined : <CloseIcon fontSize="small" />} onClick={() => onDismiss(issue.key, !off)}>
                          {off ? 'Restore' : 'Dismiss'}
                        </Button>
                      </Stack>
                      {issue.kind === 'attribute' &&
                        issue.values.map((v) => (
                          <Box key={v.value} sx={{ mb: 1 }}>
                            <Chip size="small" color="primary" variant="outlined" label={v.value} sx={{ mb: 0.5, textTransform: 'capitalize' }} />
                            {v.occurrences.map((o, k) => (
                              <OccurrenceRow key={k} o={o} docs={docs} />
                            ))}
                          </Box>
                        ))}
                      {issue.kind === 'spelling' && issue.occurrences.map((o, k) => <OccurrenceRow key={k} o={o} docs={docs} />)}
                      {issue.kind === 'absence' && (
                        <Typography variant="body2" color="text.secondary">
                          {issue.trailing ? `Last seen in ${units[issue.fromUnit - 1]?.label}` : `From ${units[issue.fromUnit]?.label} to ${units[issue.toUnit]?.label}`}
                          {' '}— see the Appearances strip.
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          </Box>
        );
      })}
      {dismissedCount > 0 && (
        <FormControlLabel control={<Switch checked={showDismissed} onChange={(e) => setShowDismissed(e.target.checked)} />} label={`Show ${dismissedCount} dismissed`} />
      )}
    </Stack>
  );
}

function AppearanceStrip({
  units,
  scenes,
  report,
  characters,
  gapIssues,
  accent,
}: {
  units: Unit[];
  scenes: SceneText[];
  report: NonNullable<ReturnType<typeof analyseContinuity>>;
  characters: (CharacterInput & { color: string })[];
  gapIssues: Extract<Issue, { kind: 'absence' }>[];
  accent: string;
}) {
  const matcher = useMemo(() => buildMatcher(characters), [characters]);
  const rows = useMemo(() => {
    const list = characters.map((c) => {
      const counts = report.counts.get(c.id) ?? [];
      return { c, counts, first: counts.findIndex((n) => n > 0), total: counts.reduce((a, b) => a + b, 0), chapters: counts.filter((n) => n > 0).length };
    });
    return list.sort((a, b) => (a.first < 0 ? 1 : b.first < 0 ? -1 : a.first - b.first) || b.total - a.total);
  }, [characters, report]);
  const max = Math.max(1, ...rows.flatMap((r) => r.counts));
  const inGap = (id: ID, i: number) => gapIssues.some((g) => g.characterId === id && i >= g.fromUnit && i <= g.toUnit);

  const open = (charId: ID, unitIndex: number) => {
    const re = matcher.patterns.get(charId);
    const unit = units[unitIndex];
    if (!re || !unit) return;
    for (const s of scenes.filter((x) => x.unitId === unit.id)) {
      re.lastIndex = 0;
      const m = re.exec(s.text);
      if (m) return void revealText(s.docId, m[0]);
    }
  };

  if (!units.length) return <Alert severity="info">The manuscript has no chapters or scenes yet.</Alert>;
  const short = (u: Unit, i: number) => (u.label.startsWith('Chapter ') ? u.label.slice(8) : u.label === 'Scene' ? `S${i + 1}` : u.label.slice(0, 3));
  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        Each square is a chapter; the darker it is, the more often the character is named there. Dashed red squares are flagged absences. Click a square to jump to that chapter.
      </Typography>
      <Box sx={{ overflowX: 'auto', pb: 1 }}>
        <Box role="table" aria-label="Character appearances by chapter" sx={{ display: 'grid', gridTemplateColumns: `minmax(140px, 200px) repeat(${units.length}, 26px) 70px`, gap: '3px', alignItems: 'center', width: 'max-content' }}>
          <Box role="columnheader" />
          {units.map((u, i) => (
            <Tooltip key={u.id} title={`${u.label} · ${u.title}`}>
              <Typography role="columnheader" variant="caption" color="text.secondary" sx={{ textAlign: 'center', fontSize: 10.5, fontWeight: 600 }}>
                {short(u, i)}
              </Typography>
            </Tooltip>
          ))}
          <Typography role="columnheader" variant="caption" color="text.secondary" sx={{ pl: 1 }}>
            Chapters
          </Typography>
          {rows.map(({ c, counts, chapters }) => (
            <Box key={c.id} role="row" sx={{ display: 'contents' }}>
              <Stack role="rowheader" direction="row" spacing={1} alignItems="center" sx={{ position: 'sticky', left: 0, bgcolor: 'background.default', pr: 1, minWidth: 0, zIndex: 1 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.color, flexShrink: 0 }} />
                <Typography variant="body2" noWrap title={c.name}>
                  {c.name}
                </Typography>
              </Stack>
              {counts.map((n, i) => (
                <Tooltip key={i} title={`${units[i].label} · ${units[i].title}: ${n ? `named ${n} time${n === 1 ? '' : 's'}` : 'not mentioned'}`}>
                  <Box
                    role="cell"
                    component="button"
                    aria-label={`${c.name}, ${units[i].label}: ${n} mentions`}
                    onClick={() => n && open(c.id, i)}
                    sx={{
                      width: 26,
                      height: 22,
                      p: 0,
                      borderRadius: '4px',
                      cursor: n ? 'pointer' : 'default',
                      bgcolor: n ? alpha(c.color, 0.25 + 0.75 * Math.min(1, n / max)) : 'transparent',
                      border: inGap(c.id, i) ? `1.5px dashed ${accent}` : '1px solid',
                      borderColor: inGap(c.id, i) ? accent : 'divider',
                    }}
                  />
                </Tooltip>
              ))}
              <Typography role="cell" variant="caption" color="text.secondary" sx={{ pl: 1 }}>
                {chapters}/{units.length}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

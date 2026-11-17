/**
 * Dialogue view: every line one character speaks, in reading order, with a
 * few measures of their voice (line length, questions, contractions, words
 * and phrases they lean on) to check it stays consistent.
 */
import { useMemo, useState } from 'react';
import { Alert, Box, Card, CardContent, Chip, FormControlLabel, IconButton, List, ListItemButton, ListItemText, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import type { ID } from '@/types/models';
import { useStore } from '@/store';
import { revealText } from '@/features/editor/editorActions';
import { extractDialogue, voiceStats, type CharacterInput, type SceneText, type Unit } from '@/lib/continuity';

const UNKNOWN = '__unknown__';

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <Tooltip title={hint}>
      <Box sx={{ minWidth: 92 }}>
        <Typography variant="h6" component="div" sx={{ lineHeight: 1.2 }}>
          {value}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Tooltip>
  );
}

export function DialogueView({ scenes, units, characters }: { scenes: SceneText[]; units: Unit[]; characters: (CharacterInput & { color: string })[] }) {
  const docs = useStore((s) => s.docs);
  const lines = useMemo(() => extractDialogue(scenes, characters), [scenes, characters]);
  const [guessed, setGuessed] = useState(true);
  const [filter, setFilter] = useState('');
  const counted = (id: ID | null) => lines.filter((l) => l.speakerId === id && (guessed || l.how === 'tag')).length;
  const ranked = useMemo(
    () => characters.map((c) => ({ c, n: lines.filter((l) => l.speakerId === c.id && (guessed || l.how === 'tag')).length })).sort((a, b) => b.n - a.n),
    [characters, lines, guessed],
  );
  const [selected, setSelected] = useState<string>(() => ranked.find((r) => r.n > 0)?.c.id ?? characters[0]?.id ?? UNKNOWN);

  const mine = lines.filter((l) => (selected === UNKNOWN ? l.speakerId === null : l.speakerId === selected) && (selected === UNKNOWN || guessed || l.how === 'tag'));
  const shown = filter.trim() ? mine.filter((l) => l.text.toLowerCase().includes(filter.trim().toLowerCase())) : mine;
  const stats = useMemo(() => voiceStats(mine, lines), [mine, lines]);
  const unitLabel = new Map(units.map((u) => [u.id, `${u.label} · ${u.title}`]));
  const char = characters.find((c) => c.id === selected);

  if (!lines.length) {
    return <Alert severity="info">No dialogue found yet. Inkwell looks for text in quotation marks (“…” or "…").</Alert>;
  }

  // Group by chapter, keeping reading order.
  const groups: { unitId: ID; items: typeof shown }[] = [];
  for (const l of shown) {
    const last = groups[groups.length - 1];
    if (last && last.unitId === l.unitId) last.items.push(l);
    else groups.push({ unitId: l.unitId, items: [l] });
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '240px 1fr' }, gap: 2.5, alignItems: 'start' }}>
      <Box>
        <Typography variant="overline" color="text.secondary">
          Speaker
        </Typography>
        <List dense aria-label="Speakers" sx={{ border: 1, borderColor: 'divider', borderRadius: 2, py: 0.5 }}>
          {ranked.map(({ c, n }) => (
            <ListItemButton key={c.id} selected={selected === c.id} onClick={() => setSelected(c.id)}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: c.color, mr: 1.25, flexShrink: 0 }} />
              <ListItemText primary={c.name} />
              <Typography variant="caption" color="text.secondary">
                {n}
              </Typography>
            </ListItemButton>
          ))}
          <ListItemButton selected={selected === UNKNOWN} onClick={() => setSelected(UNKNOWN)}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', border: 1, borderColor: 'text.secondary', mr: 1.25 }} />
            <ListItemText primary="Unknown speaker" />
            <Typography variant="caption" color="text.secondary">
              {counted(null)}
            </Typography>
          </ListItemButton>
        </List>
        <FormControlLabel
          sx={{ mt: 1 }}
          control={<Switch size="small" checked={guessed} onChange={(e) => setGuessed(e.target.checked)} />}
          label={<Typography variant="body2">Include guessed speakers</Typography>}
        />
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          Speakers come from dialogue tags (“…,” Mara said). Without a tag, Inkwell guesses from who’s named nearby and from back-and-forth exchanges.
        </Typography>
      </Box>

      <Stack spacing={2} sx={{ minWidth: 0 }}>
        <Card>
          <CardContent>
            <Typography variant="h6" component="h2" gutterBottom>
              {char ? `${char.name}’s voice` : 'Lines with no identified speaker'}
            </Typography>
            {mine.length === 0 ? (
              <Typography color="text.secondary">No lines found for this character.</Typography>
            ) : (
              <>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2.5, mb: 1.5 }}>
                  <Stat label="lines" value={String(stats.lines)} hint="Lines of dialogue found" />
                  <Stat label="words per line" value={String(stats.avgWordsPerLine)} hint="Average words per line" />
                  <Stat label="words per sentence" value={String(stats.avgSentenceLength)} hint="Average sentence length inside their dialogue" />
                  <Stat label="questions" value={`${stats.questionPct}%`} hint="Share of lines containing a question" />
                  <Stat label="exclamations" value={`${stats.exclamationPct}%`} hint="Share of lines containing an exclamation" />
                  <Stat label="contractions /100 words" value={String(stats.contractionsPer100)} hint="Formal speakers use few contractions (do not, I am); casual ones use many (don't, I'm)" />
                </Stack>
                {stats.signature.length > 0 && (
                  <Box sx={{ mb: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Words they use more than anyone else
                    </Typography>
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {stats.signature.map((w) => (
                        <Chip key={w.word} size="small" label={`${w.word} ×${w.count}`} onClick={() => setFilter(w.word)} />
                      ))}
                    </Stack>
                  </Box>
                )}
                {stats.phrases.length > 0 && (
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Phrases they repeat
                    </Typography>
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {stats.phrases.map((p) => (
                        <Chip key={p.phrase} size="small" variant="outlined" label={`“${p.phrase}” ×${p.count}`} onClick={() => setFilter(p.phrase)} />
                      ))}
                    </Stack>
                  </Box>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {mine.length > 0 && (
          <TextField size="small" label="Filter lines" value={filter} onChange={(e) => setFilter(e.target.value)} sx={{ maxWidth: 360 }} />
        )}

        {groups.map((g) => (
          <Box key={`${g.unitId}-${g.items[0].text}`}>
            <Typography variant="overline" color="text.secondary">
              {unitLabel.get(g.unitId) ?? ''}
            </Typography>
            <Stack spacing={1}>
              {g.items.map((l, i) => (
                <Stack
                  key={i}
                  direction="row"
                  spacing={1}
                  alignItems="flex-start"
                  sx={{ borderLeft: 3, borderColor: char?.color ?? 'divider', pl: 1.5, py: 0.25 }}
                >
                  <Typography sx={{ flex: 1, fontFamily: 'Georgia, serif', fontSize: 16, lineHeight: 1.5 }}>“{l.text}”</Typography>
                  {l.how === 'context' && <Chip size="small" label="guessed" variant="outlined" sx={{ height: 20 }} />}
                  <Tooltip title={`Open in ${docs[l.docId]?.title ?? 'the scene'}`}>
                    <IconButton size="small" aria-label="Show in the manuscript" onClick={() => void revealText(l.docId, l.text.slice(0, 80))}>
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ))}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Box>
  );
}

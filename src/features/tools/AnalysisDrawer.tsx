import { useEffect, useState, type ReactNode } from 'react';
import {
  Box,
  Chip,
  Divider,
  Drawer,
  FormControlLabel,
  IconButton,
  LinearProgress,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  Switch,
  Tab,
  Tabs,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useStore } from '@/store';
import { analyzeText, readabilityLabel, type Analysis } from '@/lib/analysis';
import { getContents } from '@/db/repos/documents';
import { depthFirst, manuscriptSequence, nearestAncestorOfType } from '@/lib/tree';
import { flushAll } from '@/features/editor/autosave';
import { revealComment } from '@/features/editor/editorActions';

type Scope = 'document' | 'chapter' | 'manuscript';

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Tooltip title={hint ?? ''} disableHoverListener={!hint}>
      <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: 'action.hover', minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography variant="h6" component="p">
          {value}
        </Typography>
      </Box>
    </Tooltip>
  );
}

function WordList({ title, items, empty }: { title: string; items: { word: string; count: number }[]; empty: string }) {
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>
        {title}
      </Typography>
      {items.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {empty}
        </Typography>
      ) : (
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
          {items.map((i) => (
            <Chip key={i.word} size="small" label={`${i.word} · ${i.count}`} variant="outlined" />
          ))}
        </Stack>
      )}
    </Box>
  );
}

/** Writing analysis + proofreading "to fix" list (unresolved comments). */
export default function AnalysisDrawer() {
  const close = () => useStore.getState().closeDialog('analysis');
  const docs = useStore((s) => s.docs);
  const activeId = useStore((s) => s.activeEditorDocId ?? s.activeDocId);
  const proofreading = useStore((s) => s.proofreading);
  const comments = useStore((s) => s.comments);
  const [tab, setTab] = useState(0);
  const [scope, setScope] = useState<Scope>(activeId ? 'document' : 'manuscript');
  const [result, setResult] = useState<Analysis | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    (async () => {
      await flushAll();
      const s = useStore.getState();
      let ids: string[] = [];
      if (scope === 'document' && activeId) ids = [activeId];
      else if (scope === 'chapter' && activeId) {
        const ch = nearestAncestorOfType(s.docs, activeId, 'chapter');
        ids = ch ? depthFirst(s.docs, [ch]).map((d) => d.id) : [activeId];
      } else ids = manuscriptSequence(s.docs).map((d) => d.id);
      const rows = await getContents(ids);
      const text = ids.map((id) => rows.get(id)?.text ?? '').filter(Boolean).join('\n\n');
      // Yield so the progress bar can paint on big manuscripts.
      await new Promise((r) => setTimeout(r, 0));
      const a = analyzeText(text);
      if (alive) {
        setResult(a);
        setBusy(false);
      }
    })();
    return () => {
      alive = false;
    };
    // Re-run when the scope or document changes (not on every keystroke save).
  }, [scope, activeId]);

  const toFix = comments.filter((c) => !c.resolved && docs[c.docId] && !docs[c.docId].trashed);

  return (
    <Drawer anchor="right" open onClose={close} PaperProps={{ sx: { width: { xs: '100vw', sm: 440 } } }}>
      <Stack direction="row" alignItems="center" sx={{ px: 2, pt: 1.5 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          Writing analysis
        </Typography>
        <IconButton aria-label="Close" onClick={close}>
          <CloseIcon />
        </IconButton>
      </Stack>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Analysis" />
        <Tab label={`To fix (${toFix.length})`} />
      </Tabs>
      <Box sx={{ p: 2, overflowY: 'auto', flex: 1 }}>
        <FormControlLabel
          control={<Switch checked={proofreading} onChange={(e) => useStore.getState().setProofreading(e.target.checked)} />}
          label="Proofreading mode — underline adverbs, fillers, typos, repeats and passive voice"
          sx={{ mb: 2, alignItems: 'flex-start', '& .MuiSwitch-root': { mt: -0.5 } }}
        />
        {proofreading && (
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
            <Chip size="small" label="Adverb" sx={{ textDecoration: 'underline wavy #8e24aa' }} />
            <Chip size="small" label="Filler" sx={{ textDecoration: 'underline dotted #1e88e5' }} />
            <Chip size="small" label="Misspelling" sx={{ textDecoration: 'underline wavy #e53935' }} />
            <Chip size="small" label="Repeat" sx={{ textDecoration: 'underline wavy #fb8c00' }} />
            <Chip size="small" label="Passive" sx={{ textDecoration: 'underline #00897b' }} />
          </Stack>
        )}
        {tab === 0 ? (
          <Stack spacing={2.5}>
            <ToggleButtonGroup exclusive size="small" fullWidth value={scope} onChange={(_, v) => v && setScope(v)} aria-label="Scope">
              <ToggleButton value="document" disabled={!activeId}>
                Document
              </ToggleButton>
              <ToggleButton value="chapter" disabled={!activeId}>
                Chapter
              </ToggleButton>
              <ToggleButton value="manuscript">Manuscript</ToggleButton>
            </ToggleButtonGroup>
            {busy && <LinearProgress aria-label="Analysing" />}
            {result && result.words === 0 && !busy && (
              <Typography color="text.secondary">Nothing to analyse yet — write a few paragraphs first.</Typography>
            )}
            {result && result.words > 0 && (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                  <Stat label="Words" value={result.words.toLocaleString()} />
                  <Stat label="Sentences" value={result.sentences.toLocaleString()} />
                  <Stat label="Readability" value={`${result.fleschReadingEase} · ${readabilityLabel(result.fleschReadingEase)}`} hint="Flesch reading ease (0–100, higher is easier)" />
                  <Stat label="Grade level" value={result.fleschKincaidGrade} hint="Flesch–Kincaid grade" />
                  <Stat label="Avg sentence" value={`${result.avgSentenceLength} words`} />
                  <Stat label="Variety (σ)" value={result.sentenceLengthStdDev} hint="Standard deviation of sentence length; higher means more varied rhythm" />
                </Box>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Sentence lengths
                  </Typography>
                  {result.sentenceBuckets.map((b) => {
                    const max = Math.max(1, ...result.sentenceBuckets.map((x) => x.count));
                    return (
                      <Stack key={b.label} direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
                        <Typography variant="caption" sx={{ width: 44 }}>
                          {b.label}
                        </Typography>
                        <Box sx={{ flex: 1, height: 10, bgcolor: 'action.hover', borderRadius: 1, overflow: 'hidden' }}>
                          <Box sx={{ width: `${(b.count / max) * 100}%`, height: '100%', bgcolor: 'primary.main', borderRadius: 1 }} />
                        </Box>
                        <Typography variant="caption" sx={{ width: 32, textAlign: 'right' }}>
                          {b.count}
                        </Typography>
                      </Stack>
                    );
                  })}
                </Box>
                <Box>
                  <Typography variant="subtitle2" gutterBottom>
                    Dialogue vs narration
                  </Typography>
                  <LinearProgress variant="determinate" value={result.dialogueRatio} color="secondary" sx={{ height: 10 }} aria-label="Dialogue share" />
                  <Typography variant="caption" color="text.secondary">
                    {result.dialogueRatio}% dialogue ({result.dialogueWords.toLocaleString()} words) · {100 - result.dialogueRatio}% narration
                  </Typography>
                </Box>
                <Divider />
                <WordList title="Overused words" items={result.overused} empty="Nothing stands out." />
                <WordList title={`Adverbs (${result.adverbCount})`} items={result.adverbs} empty="No -ly adverbs found." />
                <WordList title={`Filler words (${result.fillerCount})`} items={result.fillers} empty="No filler words found." />
                <WordList title="Repeated phrases" items={result.repeatedPhrases} empty="No repeated phrases." />
                {result.longestSentence && (
                  <Box>
                    <Typography variant="subtitle2" gutterBottom>
                      Longest sentence
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      “{result.longestSentence.slice(0, 400)}
                      {result.longestSentence.length > 400 ? '…' : ''}”
                    </Typography>
                  </Box>
                )}
              </>
            )}
          </Stack>
        ) : (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              Unresolved comments across the project — your revision to-do list.
            </Typography>
            {toFix.length === 0 ? (
              <Typography sx={{ mt: 2 }}>All clear. 🎉</Typography>
            ) : (
              <List dense>
                {toFix.map((c) => (
                  <ListItemButton
                    key={c.id}
                    onClick={() => {
                      const s = useStore.getState();
                      s.openDoc(c.docId);
                      setTimeout(() => {
                        const ed = useStore.getState().activeEditor;
                        if (ed) revealComment(ed, c.id);
                      }, 400);
                    }}
                  >
                    <ListItemText primary={c.text || <em>(empty comment)</em>} secondary={`${docs[c.docId]?.title} — “${c.quote.slice(0, 80)}”`} />
                  </ListItemButton>
                ))}
              </List>
            )}
          </Box>
        )}
      </Box>
    </Drawer>
  );
}

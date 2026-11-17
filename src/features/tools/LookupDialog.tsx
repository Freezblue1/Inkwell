import { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useStore } from '@/store';
import { lookupWord, type LookupResult } from '@/lib/thesaurus';

/** Dictionary & thesaurus for the selected word. Click a synonym to replace the selection. */
export default function LookupDialog() {
  const initial = useStore((s) => s.lookupWord) ?? '';
  const editor = useStore((s) => s.activeEditor);
  const close = () => useStore.getState().setLookupWord(null);
  const [word, setWord] = useState(initial);
  const [query, setQuery] = useState(initial);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!query) return;
    let alive = true;
    setBusy(true);
    void lookupWord(query).then((r) => {
      if (alive) {
        setResult(r);
        setBusy(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [query]);

  const replace = (w: string) => {
    if (!editor || editor.isDestroyed) return;
    const { from, to, empty } = editor.state.selection;
    if (empty) {
      // Replace the word around the cursor.
      const $pos = editor.state.selection.$from;
      const text = $pos.parent.textContent;
      const off = $pos.parentOffset;
      const left = text.slice(0, off).match(/[\p{L}'’-]*$/u)?.[0].length ?? 0;
      const right = text.slice(off).match(/^[\p{L}'’-]*/u)?.[0].length ?? 0;
      editor.chain().focus().insertContentAt({ from: from - left, to: from + right }, w).run();
    } else editor.chain().focus().insertContentAt({ from, to }, w).run();
    useStore.getState().notify(`Replaced with “${w}”`);
    close();
  };

  return (
    <Dialog open onClose={close} maxWidth="sm" fullWidth aria-labelledby="lookup-title">
      <DialogTitle id="lookup-title">Dictionary &amp; thesaurus</DialogTitle>
      <DialogContent>
        <Stack
          direction="row"
          spacing={1}
          component="form"
          onSubmit={(e) => {
            e.preventDefault();
            setQuery(word.trim());
          }}
          sx={{ my: 1 }}
        >
          <TextField size="small" fullWidth value={word} onChange={(e) => setWord(e.target.value)} inputProps={{ 'aria-label': 'Word' }} />
          <Button type="submit" variant="contained">
            Look up
          </Button>
        </Stack>
        {busy && (
          <Box sx={{ display: 'grid', placeItems: 'center', py: 3 }}>
            <CircularProgress size={28} aria-label="Looking up" />
          </Box>
        )}
        {!busy && result && (
          <Stack spacing={2}>
            {result.offline && <Alert severity="info">Offline — showing Inkwell’s built-in suggestions only.</Alert>}
            <Box>
              <Typography variant="h5">{result.word}</Typography>
              {result.phonetic && (
                <Typography variant="body2" color="text.secondary">
                  {result.phonetic}
                </Typography>
              )}
            </Box>
            {result.definitions.length > 0 && (
              <Box component="ol" sx={{ pl: 2.5, m: 0 }}>
                {result.definitions.map((d, i) => (
                  <li key={i}>
                    <Typography variant="body2">
                      <em>{d.partOfSpeech}</em> — {d.meaning}
                    </Typography>
                    {d.example && (
                      <Typography variant="caption" color="text.secondary">
                        “{d.example}”
                      </Typography>
                    )}
                  </li>
                ))}
              </Box>
            )}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Synonyms {editor ? '(click to replace)' : ''}
              </Typography>
              {result.synonyms.length ? (
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                  {result.synonyms.map((s) => (
                    <Chip key={s} label={s} onClick={editor ? () => replace(s) : undefined} variant="outlined" />
                  ))}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No synonyms found.
                </Typography>
              )}
            </Box>
            {result.related.length > 0 && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Related
                </Typography>
                <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
                  {result.related.map((s) => (
                    <Chip key={s} size="small" label={s} onClick={() => { setWord(s); setQuery(s); }} />
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Typography variant="caption" color="text.secondary" sx={{ flex: 1, pl: 2 }}>
          Definitions: dictionaryapi.dev · Synonyms: Datamuse
        </Typography>
        <Button onClick={close}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

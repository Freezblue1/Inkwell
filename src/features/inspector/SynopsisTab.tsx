import { useEffect, useState } from 'react';
import { Box, Card, CardContent, InputBase, Stack, TextField, Typography } from '@mui/material';
import type { ID } from '@/types/models';
import { useStore } from '@/store';
import { useDebouncedCallback } from '@/hooks/useDebounced';
import { StatusChip } from '@/components/StatusChip';
import { aggregateWordCounts } from '@/lib/tree';

/** Index-card synopsis and free-form notes. */
export function SynopsisTab({ docId }: { docId: ID }) {
  const doc = useStore((s) => s.docs[docId]);
  const label = useStore((s) => s.project?.labels.find((l) => l.id === s.docs[docId]?.label));
  const docs = useStore((s) => s.docs);
  const updateDoc = useStore((s) => s.updateDoc);
  const updateMeta = useStore((s) => s.updateDocMeta);
  const [synopsis, setSynopsis] = useState(doc?.synopsis ?? '');
  const [notes, setNotes] = useState(doc?.metadata.notes ?? '');
  const saveSynopsis = useDebouncedCallback((v: string) => void updateDoc(docId, { synopsis: v }), 500);
  const saveNotes = useDebouncedCallback((v: string) => void updateMeta(docId, { notes: v }), 500);

  useEffect(() => setSynopsis(doc?.synopsis ?? ''), [doc?.synopsis]);
  useEffect(() => setNotes(doc?.metadata.notes ?? ''), [doc?.metadata.notes]);
  if (!doc) return null;
  const words = aggregateWordCounts(docs).get(docId) ?? doc.wordCount;

  return (
    <Stack spacing={2}>
      <Card sx={{ borderTop: 4, borderTopColor: label?.color ?? 'divider', bgcolor: (t) => (t.palette.mode === 'dark' ? '#2a2a22' : '#fffdf5') }}>
        <CardContent sx={{ pb: '12px !important' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
            <Typography variant="subtitle2" sx={{ flex: 1 }} noWrap>
              {doc.title}
            </Typography>
            <StatusChip status={doc.status} />
          </Stack>
          <InputBase
            multiline
            fullWidth
            minRows={4}
            placeholder="What happens here? One or two sentences for the corkboard."
            value={synopsis}
            onChange={(e) => {
              setSynopsis(e.target.value);
              saveSynopsis(e.target.value);
            }}
            onBlur={() => saveSynopsis.flush()}
            inputProps={{ 'aria-label': 'Synopsis' }}
            sx={{ fontFamily: '"Courier Prime", monospace', fontSize: 14, lineHeight: 1.6, alignItems: 'flex-start' }}
          />
          <Typography variant="caption" color="text.secondary">
            {words.toLocaleString()} words{doc.targetWordCount ? ` of ${doc.targetWordCount.toLocaleString()}` : ''}
          </Typography>
        </CardContent>
      </Card>
      <Box>
        <TextField
          label="Notes"
          multiline
          fullWidth
          minRows={8}
          value={notes}
          placeholder="Research, reminders, things to fix…"
          onChange={(e) => {
            setNotes(e.target.value);
            saveNotes(e.target.value);
          }}
          onBlur={() => saveNotes.flush()}
        />
      </Box>
    </Stack>
  );
}

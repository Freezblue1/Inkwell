import { useMemo } from 'react';
import { Box, LinearProgress, Tooltip, Typography } from '@mui/material';
import { useStore } from '@/store';
import { aggregateWordCounts, manuscriptWordCount, nearestAncestorOfType } from '@/lib/tree';
import { formatReadingTime } from '@/lib/wordCount';
import { passInfo } from './revisions/passes';
import { PassDot } from './revisions/RevisionMenu';

function Stat({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <Tooltip title={title ?? ''} disableHoverListener={!title}>
      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
        <Box component="span" sx={{ opacity: 0.75 }}>
          {label}{' '}
        </Box>
        <Box component="span" sx={{ color: 'text.primary', fontWeight: 500 }}>
          {value}
        </Box>
      </Typography>
    </Tooltip>
  );
}

/** Live counts for the selection, document, chapter and manuscript. */
export function StatsBar() {
  const live = useStore((s) => s.liveStats);
  const revisionPass = useStore((s) => s.revisionPass);
  const docs = useStore((s) => s.docs);
  const activeDocId = useStore((s) => s.activeEditorDocId ?? s.activeDocId);
  const doc = activeDocId ? docs[activeDocId] : null;

  const { docWords, chapterWords, manuscript, target } = useMemo(() => {
    const totals = aggregateWordCounts(docs);
    const liveDelta = doc && live.docId === doc.id ? live.words - doc.wordCount : 0;
    const chapter = doc ? nearestAncestorOfType(docs, doc.id, 'chapter') : null;
    const isManuscript = doc && ['part', 'chapter', 'scene'].includes(doc.type);
    return {
      docWords: doc ? (live.docId === doc.id ? live.words : doc.wordCount) : 0,
      chapterWords: chapter ? (totals.get(chapter.id) ?? 0) + liveDelta : null,
      manuscript: manuscriptWordCount(docs) + (isManuscript ? liveDelta : 0),
      target: doc?.targetWordCount ?? null,
    };
  }, [docs, doc, live]);

  const chars = doc && live.docId === doc.id ? live.chars : null;
  const pct = target ? Math.min(100, (docWords / target) * 100) : null;

  return (
    <Box
      component="footer"
      aria-label="Word counts"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: { xs: 1.5, sm: 2.5 },
        px: 2,
        minHeight: 32,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        overflowX: 'auto',
        flex: '0 0 auto',
      }}
    >
      {live.selWords > 0 && <Stat label="Selection" value={`${live.selWords.toLocaleString()} w · ${live.selChars.toLocaleString()} ch`} />}
      {doc && (
        <Stat
          label={doc.type === 'scene' ? 'Scene' : doc.type === 'chapter' ? 'Chapter' : 'Document'}
          value={`${docWords.toLocaleString()} words`}
          title={chars !== null ? `${chars.toLocaleString()} characters · ${formatReadingTime(docWords)} read` : undefined}
        />
      )}
      {pct !== null && (
        <Tooltip title={`${docWords.toLocaleString()} of ${target!.toLocaleString()} target`}>
          <Box sx={{ width: 80 }}>
            <LinearProgress variant="determinate" value={pct} color={pct >= 100 ? 'success' : 'secondary'} aria-label="Document target progress" />
          </Box>
        </Tooltip>
      )}
      {chapterWords !== null && doc?.type !== 'chapter' && <Stat label="Chapter" value={chapterWords.toLocaleString()} />}
      <Stat label="Manuscript" value={manuscript.toLocaleString()} title={`${formatReadingTime(manuscript)} reading time`} />
      <Box sx={{ flex: 1 }} />
      {revisionPass && (
        <Tooltip title="Revision mode is on: new edits are tracked in this colour. Ctrl+Alt+R turns it off.">
          <Box
            component="button"
            onClick={() => useStore.getState().setRevisionPass(null)}
            aria-label={`Revision mode on: ${passInfo(revisionPass).name}. Turn off`}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.75, border: 0, bgcolor: 'transparent', color: 'text.secondary', cursor: 'pointer', font: 'inherit', p: 0 }}
          >
            <PassDot n={revisionPass} />
            <Typography variant="caption" sx={{ whiteSpace: 'nowrap', fontWeight: 500, color: 'text.primary' }}>
              {passInfo(revisionPass).name}
            </Typography>
          </Box>
        </Tooltip>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', md: 'block' }, whiteSpace: 'nowrap' }}>
        {formatReadingTime(docWords)} read
      </Typography>
    </Box>
  );
}

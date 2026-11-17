import { useEffect, useState } from 'react';
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, useMediaQuery, useTheme } from '@mui/material';
import type { Snapshot } from '@/types/models';
import { getContent } from '@/db/repos/documents';
import { DiffView } from '@/components/DiffView';
import { formatDateTime } from '@/lib/dates';
import { flushAll } from '@/features/editor/autosave';

/** Compares a document snapshot with the current text; offers restore. */
export function SnapshotDialog({ snapshot, onClose, onRestore }: { snapshot: Snapshot; onClose: () => void; onRestore: (s: Snapshot) => void }) {
  const [current, setCurrent] = useState<string | null>(null);
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));

  useEffect(() => {
    void flushAll()
      .then(() => getContent(snapshot.docId!))
      .then((c) => setCurrent(c?.text ?? ''));
  }, [snapshot.docId]);

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth fullScreen={fullScreen} aria-labelledby="snap-title">
      <DialogTitle id="snap-title">
        {snapshot.name} · {formatDateTime(snapshot.createdAt)}
      </DialogTitle>
      <DialogContent dividers>{current !== null && <DiffView oldText={snapshot.text} newText={current} oldLabel="Snapshot" newLabel="Current text" />}</DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button variant="contained" onClick={() => onRestore(snapshot)}>
          Restore this version
        </Button>
      </DialogActions>
    </Dialog>
  );
}

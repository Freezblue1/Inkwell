import { useEffect, useState } from 'react';
import { Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DownloadIcon from '@mui/icons-material/Download';
import FolderIcon from '@mui/icons-material/FolderOutlined';
import type { ID } from '@/types/models';
import { useStore } from '@/store';
import { useAssetUrl } from '@/hooks/useAssetUrl';
import { useDebouncedCallback } from '@/hooks/useDebounced';
import { childrenOf } from '@/lib/tree';
import { EmptyState } from '@/components/EmptyState';
import { DocumentPage } from '@/features/editor/DocumentPage';

/** Shows one research item: a note (editor), web link, image, PDF or folder. */
export function ResearchViewer({ docId }: { docId: ID }) {
  const doc = useStore((s) => s.docs[docId]);
  const docs = useStore((s) => s.docs);
  const url = useAssetUrl(doc?.metadata.assetId);
  const [link, setLink] = useState(doc?.metadata.url ?? '');
  const [notes, setNotes] = useState(doc?.synopsis ?? '');
  const saveNotes = useDebouncedCallback((v: string) => void useStore.getState().updateDoc(docId, { synopsis: v }), 500);
  useEffect(() => {
    setLink(doc?.metadata.url ?? '');
    setNotes(doc?.synopsis ?? '');
  }, [docId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!doc) return <EmptyState title="Item not found" />;
  const kind = doc.metadata.researchKind ?? 'note';

  if (kind === 'note') return <DocumentPage key={docId} docId={docId} dense autoFocus={false} />;

  if (kind === 'folder') {
    const kids = childrenOf(docs, docId);
    return (
      <EmptyState
        icon={<FolderIcon />}
        title={doc.title}
        description={kids.length ? `${kids.length} item${kids.length === 1 ? '' : 's'}: ${kids.map((k) => k.title).join(', ')}` : 'Empty folder. Select it, then add notes, links or files.'}
      />
    );
  }

  const notesField = (
    <TextField
      label="Notes"
      multiline
      minRows={3}
      fullWidth
      value={notes}
      onChange={(e) => {
        setNotes(e.target.value);
        saveNotes(e.target.value);
      }}
      onBlur={() => saveNotes.flush()}
    />
  );

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: { xs: 2, md: 3 } }}>
      <Typography variant="h5" component="h2" gutterBottom>
        {doc.title}
      </Typography>
      {kind === 'link' && (
        <Stack spacing={2} sx={{ maxWidth: 720 }}>
          <Stack direction="row" spacing={1}>
            <TextField
              label="URL"
              fullWidth
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onBlur={() => void useStore.getState().updateDocMeta(docId, { url: link.trim() })}
            />
            <Button
              variant="contained"
              startIcon={<OpenInNewIcon />}
              disabled={!/^https?:\/\//i.test(link)}
              onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}
              sx={{ flexShrink: 0 }}
            >
              Open
            </Button>
          </Stack>
          {notesField}
        </Stack>
      )}
      {kind === 'image' && (
        <Stack spacing={2}>
          {url ? (
            <Box component="img" src={url} alt={doc.title} sx={{ maxWidth: '100%', maxHeight: '65vh', objectFit: 'contain', borderRadius: 2, border: 1, borderColor: 'divider', alignSelf: 'flex-start' }} />
          ) : (
            <Typography color="text.secondary">Loading image…</Typography>
          )}
          {notesField}
        </Stack>
      )}
      {kind === 'pdf' && (
        <Stack spacing={2} sx={{ height: 'calc(100% - 48px)' }}>
          {url ? (
            <>
              <Box component="object" data={url} type="application/pdf" aria-label={doc.title} sx={{ width: '100%', flex: 1, minHeight: 480, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Typography sx={{ p: 2 }}>
                  Your browser can’t show PDFs inline.{' '}
                  <Link href={url} download={doc.title}>
                    Download it
                  </Link>
                  .
                </Typography>
              </Box>
              <Box>
                <Button startIcon={<DownloadIcon />} href={url} download={`${doc.title}.pdf`}>
                  Download
                </Button>
              </Box>
            </>
          ) : (
            <Typography color="text.secondary">Loading PDF…</Typography>
          )}
          {notesField}
        </Stack>
      )}
    </Box>
  );
}

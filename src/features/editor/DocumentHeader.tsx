import { useEffect, useState } from 'react';
import { Box, Breadcrumbs, InputBase, Link, Stack, Typography } from '@mui/material';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import type { ID } from '@/types/models';
import { useStore } from '@/store';
import { ancestors } from '@/lib/tree';
import { StatusChip } from '@/components/StatusChip';

/** Breadcrumbs + inline-editable title above the page. */
export function DocumentHeader({ docId, dense = false }: { docId: ID; dense?: boolean }) {
  const doc = useStore((s) => s.docs[docId]);
  const docs = useStore((s) => s.docs);
  const updateDoc = useStore((s) => s.updateDoc);
  const [title, setTitle] = useState(doc?.title ?? '');
  useEffect(() => setTitle(doc?.title ?? ''), [doc?.title]);
  if (!doc) return null;
  const chain = ancestors(docs, docId);

  const commit = () => {
    const t = title.trim();
    if (t && t !== doc.title) void updateDoc(docId, { title: t });
    else setTitle(doc.title);
  };

  return (
    <Box sx={{ mb: dense ? 1 : 3 }}>
      {chain.length > 0 && (
        <Breadcrumbs separator={<NavigateNextIcon fontSize="small" />} aria-label="Location in binder" sx={{ mb: 0.5, fontSize: 13 }}>
          {chain.map((a) => (
            <Link
              key={a.id}
              component="button"
              underline="hover"
              color="text.secondary"
              onClick={() => useStore.getState().setScrivenings(a.id)}
              sx={{ fontSize: 13 }}
              title="View as scrivenings"
            >
              {a.title}
            </Link>
          ))}
          <Typography color="text.primary" sx={{ fontSize: 13 }}>
            {doc.title}
          </Typography>
        </Breadcrumbs>
      )}
      <Stack direction="row" alignItems="center" spacing={1}>
        <InputBase
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (e.target as HTMLInputElement).blur();
            }
            if (e.key === 'Escape') setTitle(doc.title);
          }}
          inputProps={{ 'aria-label': 'Document title' }}
          sx={{ flex: 1, fontSize: dense ? 18 : 26, fontWeight: 500, fontFamily: 'inherit', color: 'inherit' }}
        />
        <StatusChip status={doc.status} />
      </Stack>
    </Box>
  );
}

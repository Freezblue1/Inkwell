import { useEffect, useLayoutEffect, useState } from 'react';
import { Box, Button, LinearProgress, Stack, Typography } from '@mui/material';
import type { CompiledBook } from '@/lib/compile/compile';
import { bookCss, pageGeometry, paginate, type PreviewPage } from './paginate';

const BATCH = 40;

/** Live paginated preview of the compiled book (pages rendered lazily in batches). */
export function BookPreview({ book, zoom }: { book: CompiledBook; zoom: number }) {
  const [max, setMax] = useState(BATCH);
  const [result, setResult] = useState<{ pages: PreviewPage[]; complete: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => setMax(BATCH), [book]);

  useLayoutEffect(() => {
    setBusy(true);
    // Defer so the progress bar paints before the (synchronous) measurement.
    const t = setTimeout(() => {
      const first = paginate(book, max);
      // Second pass fills in TOC page numbers once chapter openings are known.
      const res = book.profile.toc ? paginate(book, max, first.openings) : first;
      setResult(res);
      setBusy(false);
    }, 30);
    return () => clearTimeout(t);
  }, [book, max]);

  const g = pageGeometry(book);
  const w = g.w * zoom;
  const h = g.h * zoom;

  return (
    <Box className="ink-book" sx={{ position: 'relative' }}>
      <style>{bookCss(book)}</style>
      {busy && <LinearProgress sx={{ position: 'sticky', top: 0, zIndex: 2 }} aria-label="Laying out pages" />}
      {result && (
        <Box
          sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center', alignItems: 'flex-start', p: 3 }}
          role="list"
          aria-label={`Book preview, ${result.pages.length}${result.complete ? '' : '+'} pages`}
        >
          {result.pages.map((pg) => (
            <Box key={pg.number} role="listitem" sx={{ width: w, height: h + 24, contentVisibility: 'auto', containIntrinsicSize: `${w}px ${h + 24}px` }}>
              <Box sx={{ width: w, height: h, boxShadow: 3, borderRadius: 0.5, overflow: 'hidden' }}>
                <div className={`ink-page ${pg.number % 2 === 0 ? 'verso' : 'recto'}`} style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                  {pg.header && <div className="ink-head" dangerouslySetInnerHTML={{ __html: pg.header }} />}
                  <div className="ink-body" dangerouslySetInnerHTML={{ __html: pg.html }} />
                  {pg.footer && <div className="ink-foot">{pg.footer}</div>}
                </div>
              </Box>
              <Typography variant="caption" color="text.secondary" display="block" textAlign="center">
                {pg.number}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
      {result && !result.complete && (
        <Stack alignItems="center" sx={{ pb: 4 }}>
          <Button variant="outlined" onClick={() => setMax((m) => m + BATCH * 2)} disabled={busy}>
            Lay out more pages
          </Button>
        </Stack>
      )}
    </Box>
  );
}

/**
 * PDF → Blocks. PDFs only store positioned text, so this rebuilds lines,
 * paragraphs (from indents, gaps and short last lines), headings (from
 * larger type) and removes page numbers and running heads. Italics and
 * bold can't be recovered reliably and are left plain.
 */
import { SCENE_BREAK_RE, type Block, type FlatSource } from './blocks';

export interface PdfLine {
  text: string;
  x: number;
  xEnd: number;
  /** Baseline, measured from the top of the page (grows downwards). */
  y: number;
  size: number;
}

interface PdfTextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
  hasEOL?: boolean;
}

/** Groups positioned text items into lines (top to bottom). */
export function itemsToLines(items: PdfTextItem[], pageHeight: number): PdfLine[] {
  const lines: PdfLine[] = [];
  let cur: PdfLine | null = null;
  for (const it of items) {
    if (!it.str) continue;
    const size = Math.abs(it.transform[3]) || it.height || 10;
    const x = it.transform[4];
    const y = pageHeight - it.transform[5];
    if (cur && Math.abs(y - cur.y) <= size * 0.45) {
      const gap = x - cur.xEnd;
      const needsSpace = gap > size * 0.15 && !cur.text.endsWith(' ') && !it.str.startsWith(' ');
      cur.text += (needsSpace ? ' ' : '') + it.str;
      cur.xEnd = Math.max(cur.xEnd, x + it.width);
      cur.x = Math.min(cur.x, x);
      cur.size = Math.max(cur.size, size);
    } else {
      cur = { text: it.str, x, xEnd: x + it.width, y, size };
      lines.push(cur);
    }
  }
  return lines
    .map((l) => ({ ...l, text: l.text.replace(/\s+/g, ' ').trim() }))
    .filter((l) => l.text)
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

const mode = (values: number[]) => {
  const counts = new Map<number, number>();
  let best = values[0] ?? 0;
  let bestN = 0;
  for (const v of values) {
    const n = (counts.get(v) ?? 0) + 1;
    counts.set(v, n);
    if (n > bestN) {
      best = v;
      bestN = n;
    }
  }
  return best;
};

const median = (values: number[]) => {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Rebuilds paragraphs and headings from the lines of every page. */
export function linesToBlocks(pages: PdfLine[][]): Block[] {
  // 1. Drop page numbers and running heads/feet (repeated first/last lines).
  // Size is part of the key: a running head "THE LANTERN ROAD" (9 pt) must not remove the 26 pt title on the title page.
  const key = (l: PdfLine) => `${l.text.toLowerCase().replace(/\d+/g, '#').replace(/\s+/g, ' ').trim()}@${Math.round(l.size)}`;
  const edgeCounts = new Map<string, number>();
  pages.forEach((lines) => {
    const edges = new Set([lines[0], lines[1], lines[lines.length - 1], lines[lines.length - 2]].filter(Boolean).map((l) => key(l!)));
    edges.forEach((k) => edgeCounts.set(k, (edgeCounts.get(k) ?? 0) + 1));
  });
  const threshold = Math.max(3, pages.length * 0.25);
  const isPageNumber = (t: string) => /^(page\s+)?[\divxlc]{1,6}(\s+of\s+\d+)?$/i.test(t.trim()) || /^[-–—]\s*\d+\s*[-–—]$/.test(t.trim());
  const cleaned = pages.map((lines) =>
    lines.filter((l, i) => {
      const edge = i <= 1 || i >= lines.length - 2;
      if (!edge) return true;
      if (isPageNumber(l.text)) return false;
      return (edgeCounts.get(key(l)) ?? 0) < threshold || l.text.length > 90;
    }),
  );

  const all = cleaned.flat();
  if (!all.length) return [];
  // 2. Typical body size, left margin, right edge and line spacing.
  const r = (n: number) => Math.round(n * 2) / 2;
  const weighted: number[] = [];
  all.forEach((l) => {
    for (let k = 0; k < Math.min(20, Math.ceil(l.text.length / 10)); k++) weighted.push(r(l.size));
  });
  const body = mode(weighted);
  const bodyLines = all.filter((l) => Math.abs(l.size - body) < 0.6);
  const left = mode(bodyLines.map((l) => Math.round(l.x)));
  const right = median(bodyLines.filter((l) => l.text.length > 40).map((l) => l.xEnd)) || Math.max(...bodyLines.map((l) => l.xEnd));
  const gaps: number[] = [];
  cleaned.forEach((lines) => {
    for (let i = 1; i < lines.length; i++) {
      const g = lines[i].y - lines[i - 1].y;
      if (g > 0 && Math.abs(lines[i].size - body) < 0.6 && Math.abs(lines[i - 1].size - body) < 0.6) gaps.push(r(g));
    }
  });
  const lineGap = mode(gaps) || body * 1.2;

  // Heading sizes (largest first) → levels 1…3.
  const headingSizes = [...new Set(all.filter((l) => l.size >= body * 1.18 && l.text.length <= 100).map((l) => r(l.size)))].sort((a, b) => b - a);
  const levelOf = (size: number) => Math.min(3, headingSizes.indexOf(r(size)) + 1);

  const blocks: Block[] = [];
  let para: { text: string; align?: 'center' } | null = null;
  const flush = () => {
    if (para && para.text.trim()) {
      const t = para.text.trim();
      blocks.push(SCENE_BREAK_RE.test(t) ? { type: 'sceneBreak' } : { type: 'para', inl: [{ kind: 'text', text: t }], align: para.align });
    }
    para = null;
  };
  const join = (a: string, b: string) => (/[A-Za-z]-$/.test(a) && /^[a-z]/.test(b) ? a.slice(0, -1) + b : `${a} ${b}`);

  cleaned.forEach((lines, pageIndex) => {
    let prev: PdfLine | null = null;
    lines.forEach((l) => {
      const isHeading = r(l.size) >= body * 1.18 && l.text.length <= 100 && headingSizes.includes(r(l.size));
      if (isHeading) {
        flush();
        const last = blocks[blocks.length - 1];
        // A title broken over two lines in the same size.
        if (last?.type === 'heading' && prev && Math.abs(prev.size - l.size) < 0.6 && l.y - prev.y < l.size * 1.8) {
          const t = last.inl[0];
          if (t.kind === 'text') t.text = `${t.text} ${l.text}`;
        } else blocks.push({ type: 'heading', level: levelOf(l.size), inl: [{ kind: 'text', text: l.text }] });
        prev = l;
        return;
      }
      const centered = l.x > left + body * 2 && Math.abs(l.x - left - (right - l.xEnd)) < body * 2.5 && l.xEnd < right - body * 2;
      const indented = l.x > left + body * 0.8 && !centered;
      const sentenceEnd = (t: string) => /[.!?…:"”’')\]]$/.test(t);
      let startNew = !para;
      if (para && prev) {
        const gap = l.y - prev.y;
        const prevShort = prev.xEnd < right - body * 3 && sentenceEnd(prev.text);
        if (gap > lineGap * 2.4) {
          flush();
          blocks.push({ type: 'sceneBreak' });
          startNew = true;
        } else if (gap > lineGap * 1.45 || indented || prevShort || centered || para.align === 'center') startNew = true;
      } else if (para && !prev) {
        // First line of a new page: continue the paragraph unless it clearly starts a new one.
        const lastLine = cleaned[pageIndex - 1]?.[cleaned[pageIndex - 1].length - 1];
        const prevShort = lastLine ? lastLine.xEnd < right - body * 3 && sentenceEnd(lastLine.text) : true;
        if (indented || prevShort || centered) startNew = true;
      }
      if (startNew) {
        flush();
        para = { text: l.text, align: centered ? 'center' : undefined };
      } else if (para) para.text = join(para.text, l.text);
      prev = l;
    });
  });
  flush();
  // Scene breaks right after headings are just chapter-opening space.
  return blocks.filter((b, i) => !(b.type === 'sceneBreak' && (i === 0 || blocks[i - 1].type === 'heading')));
}

export async function readPdf(data: ArrayBuffer, name: string, onProgress?: (done: number, total: number) => void): Promise<FlatSource> {
  const pdfjs = await import('pdfjs-dist');
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(data), isEvalSupported: false }).promise;
  const pages: PdfLine[][] = [];
  let chars = 0;
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const items = content.items.filter((it): it is PdfTextItem & (typeof content.items)[number] => 'str' in it);
    const lines = itemsToLines(items, viewport.height);
    chars += lines.reduce((s, l) => s + l.text.length, 0);
    pages.push(lines);
    page.cleanup();
    onProgress?.(p, pdf.numPages);
  }
  let title = '';
  let author = '';
  try {
    const meta = await pdf.getMetadata();
    const info = meta.info as { Title?: string; Author?: string };
    title = info.Title?.trim() ?? '';
    author = info.Author?.trim() ?? '';
  } catch {
    /* no metadata */
  }
  const pageCount = pdf.numPages;
  await pdf.destroy();
  if (chars < 20 * Math.max(1, Math.min(pageCount, 5))) {
    throw new Error('This PDF has no selectable text — it is probably a scan or a picture of pages. Inkwell can only import PDFs whose text you can select and copy.');
  }
  // Titles in metadata are often a file name ("Microsoft Word - draft3.docx").
  if (/\.(docx?|pdf|odt|rtf)$|^microsoft word|^untitled/i.test(title)) title = '';
  return {
    kind: 'flat',
    format: 'pdf',
    name,
    title,
    author,
    warnings: ['PDFs don’t keep italics or bold in a reliable way, so the text comes in plain. Check the chapter list before importing.'],
    blocks: linesToBlocks(pages),
  };
}

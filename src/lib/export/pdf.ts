/**
 * PDF exporter (jsPDF) with a small line-layout engine: mixed bold/italic
 * runs, justification, first-line indents, running headers, page numbers,
 * chapter openings, endnotes and a table of contents with page numbers
 * (two-pass render). For pixel-perfect typography use Print from the preview.
 */
import type { jsPDF as JsPDFType } from 'jspdf';
import type { Run } from '../compile/blocks';
import type { CompiledBook } from '../compile/compile';
import { approxWordCount } from '../compile/compile';
import { TRIM_SIZES, isMonoFont } from './trim';

const CP1252_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const REPLACEMENTS: Record<string, string> = { '⁂': '* * *', '❦': '~', '✦': '*', '→': '->', '←': '<-', '↩': '', '­': '' };

/** Maps text to the WinAnsi set supported by jsPDF's built-in fonts. */
export function pdfSafe(text: string): string {
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0)!;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || CP1252_EXTRA.includes(ch) || ch === '\n') out += ch;
    else if (REPLACEMENTS[ch] !== undefined) out += REPLACEMENTS[ch];
    else out += ch.normalize('NFKD').replace(/[^\x20-\x7e]/g, '') || '?';
  }
  return out;
}

interface Atom {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  sup?: boolean;
  /** No space before this atom (continues the previous word). */
  glue: boolean;
  /** Forced line break after this atom. */
  hard?: boolean;
}

function toAtoms(runs: Run[]): Atom[] {
  const atoms: Atom[] = [];
  let pendingSpace = false;
  for (const r of runs) {
    if (r.footnote) {
      atoms.push({ text: String(r.footnote), sup: true, glue: true });
      continue;
    }
    const parts = pdfSafe(r.text).split(/(\s+)/);
    for (const part of parts) {
      if (!part) continue;
      if (/^\s+$/.test(part)) {
        if (part.includes('\n') && atoms.length) atoms[atoms.length - 1].hard = true;
        pendingSpace = true;
        continue;
      }
      atoms.push({ text: part, bold: r.bold, italic: r.italic, underline: r.underline, strike: r.strike, glue: !pendingSpace && atoms.length > 0 });
      pendingSpace = false;
    }
  }
  return atoms;
}

interface RenderResult {
  doc: JsPDFType;
  chapterPages: Map<string, number>;
}

function render(JsPDF: typeof JsPDFType, book: CompiledBook, tocPages: Map<string, number> | null): RenderResult {
  const p = book.profile;
  const manuscript = p.template === 'manuscript';
  const trim = TRIM_SIZES[manuscript ? 'letter' : p.trim];
  const W = trim.w * 72;
  const H = trim.h * 72;
  const doc = new JsPDF({ unit: 'pt', format: [W, H], orientation: W > H ? 'landscape' : 'portrait', compress: true });
  doc.setProperties({ title: book.title, author: book.author, creator: 'Inkwell' });
  const family = isMonoFont(p.bodyFont) ? 'courier' : 'times';
  const fs = manuscript ? 12 : p.fontSize;
  const lh = fs * (manuscript ? 2 : p.lineHeight);
  const m = manuscript ? { top: 72, bottom: 72, inside: 72, outside: 72 } : { top: p.margins.top * 72, bottom: p.margins.bottom * 72, inside: p.margins.inside * 72, outside: p.margins.outside * 72 };
  const textW = W - m.inside - m.outside;
  const indentPts = manuscript ? 36 : p.firstLineIndent * fs;
  const chapterPages = new Map<string, number>();
  let page = 1;
  let y = m.top;
  let decorated = false;

  const leftX = () => (!manuscript && page % 2 === 0 ? m.outside : m.inside);
  const styleName = (a: { bold?: boolean; italic?: boolean }) => (a.bold && a.italic ? 'bolditalic' : a.bold ? 'bold' : a.italic ? 'italic' : 'normal');
  const setFont = (style: string, size: number) => {
    doc.setFont(family, style);
    doc.setFontSize(size);
  };

  const drawHeader = () => {
    if (!p.runningHeaders) return;
    doc.setTextColor(40);
    if (manuscript) {
      setFont('normal', 12);
      doc.text(pdfSafe(`${book.surname} / ${book.title.toUpperCase()} / ${page}`), W - m.outside, m.top / 2, { align: 'right' });
    } else {
      setFont('italic', fs * 0.8);
      const head = page % 2 === 0 ? book.author : book.title;
      doc.text(pdfSafe(head), W / 2, m.top * 0.55, { align: 'center' });
      setFont('normal', fs * 0.85);
      doc.text(String(page), W / 2, H - m.bottom * 0.45, { align: 'center' });
    }
    doc.setTextColor(0);
  };

  const newPage = (decorate: boolean) => {
    doc.addPage([W, H], W > H ? 'landscape' : 'portrait');
    page++;
    y = m.top;
    decorated = decorate;
    if (decorate) drawHeader();
  };
  const ensure = (h: number) => {
    if (y + h > H - m.bottom) newPage(decorated || true);
  };

  /** Lays out and draws a paragraph of runs. */
  const paragraph = (runs: Run[], opts: { indent?: number; align?: 'left' | 'center' | 'right' | 'justify'; size?: number; extraLeft?: number; extraRight?: number; italicAll?: boolean; spaceAfter?: number } = {}) => {
    const size = opts.size ?? fs;
    const lineH = size * (manuscript ? 2 : p.lineHeight);
    const atoms = toAtoms(runs).map((a) => (opts.italicAll ? { ...a, italic: !a.italic } : a));
    if (!atoms.length) return;
    const avail = textW - (opts.extraLeft ?? 0) - (opts.extraRight ?? 0);
    const width = (a: Atom) => {
      setFont(styleName(a), a.sup ? size * 0.65 : size);
      return doc.getTextWidth(a.text);
    };
    setFont('normal', size);
    const space = doc.getTextWidth(' ');

    const lines: { atoms: { a: Atom; w: number }[]; width: number; hard: boolean }[] = [];
    let cur: { a: Atom; w: number }[] = [];
    let curW = 0;
    const firstAvail = () => (lines.length === 0 ? avail - (opts.indent ?? 0) : avail);
    for (const a of atoms) {
      const w = width(a);
      const add = (cur.length && !a.glue ? space : 0) + w;
      if (cur.length && curW + add > firstAvail() && !a.glue) {
        lines.push({ atoms: cur, width: curW, hard: false });
        cur = [];
        curW = 0;
      }
      curW += (cur.length && !a.glue ? space : 0) + w;
      cur.push({ a, w });
      if (a.hard) {
        lines.push({ atoms: cur, width: curW, hard: true });
        cur = [];
        curW = 0;
      }
    }
    if (cur.length) lines.push({ atoms: cur, width: curW, hard: true });

    const align = opts.align ?? (p.justify && !manuscript ? 'justify' : 'left');
    lines.forEach((line, li) => {
      ensure(lineH);
      const base = leftX() + (opts.extraLeft ?? 0);
      const indent = li === 0 ? opts.indent ?? 0 : 0;
      const room = avail - indent;
      let x = base + indent;
      const gaps = line.atoms.filter((it, i) => i > 0 && !it.a.glue).length;
      let gap = space;
      if (align === 'center') x = base + (avail - line.width) / 2;
      else if (align === 'right') x = base + avail - line.width;
      else if (align === 'justify' && !line.hard && gaps > 0) gap = space + (room - line.width) / gaps;
      const baseline = y + size;
      line.atoms.forEach((it, i) => {
        if (i > 0 && !it.a.glue) x += gap;
        setFont(styleName(it.a), it.a.sup ? size * 0.65 : size);
        doc.text(it.a.text, x, it.a.sup ? baseline - size * 0.35 : baseline);
        if (it.a.underline) doc.line(x, baseline + 1.5, x + it.w, baseline + 1.5);
        if (it.a.strike) doc.line(x, baseline - size * 0.3, x + it.w, baseline - size * 0.3);
        x += it.w;
      });
      y += lineH;
    });
    y += opts.spaceAfter ?? p.paragraphSpacing * size;
  };

  const centered = (text: string, size: number, style = 'normal', gapAfter = 0) => {
    setFont(style, size);
    const lines = doc.splitTextToSize(pdfSafe(text), textW) as string[];
    lines.forEach((l) => {
      ensure(size * 1.4);
      doc.text(l, W / 2, y + size, { align: 'center' });
      y += size * 1.4;
    });
    y += gapAfter;
  };

  // --- Title page --------------------------------------------------------
  if (p.titlePage) {
    if (manuscript) {
      setFont('normal', 12);
      doc.text(pdfSafe(book.author || 'Author Name'), m.inside, m.top);
      doc.text(pdfSafe(approxWordCount(book.wordCount)), W - m.outside, m.top, { align: 'right' });
      y = H * 0.42;
      centered(book.title.toUpperCase(), 12, 'normal', 24);
      centered(`by ${book.author}`, 12);
    } else {
      y = H * 0.3;
      centered(book.title, fs * 2.2, 'bold', fs);
      if (book.subtitle) centered(book.subtitle, fs * 1.2, 'italic', fs);
      y = H * 0.55;
      centered(book.author, fs * 1.3);
    }
  }
  let started = p.titlePage;
  const startPage = (decorate: boolean) => {
    if (started) newPage(decorate);
    else {
      decorated = decorate;
      if (decorate) drawHeader();
    }
    started = true;
  };

  if (p.copyrightPage && p.copyrightText && !manuscript) {
    startPage(false);
    y = H - m.bottom - fs * 6;
    paragraph([{ text: p.copyrightText }], { size: fs * 0.8, align: 'left' });
  }
  if (p.dedication && !manuscript) {
    startPage(false);
    y = H * 0.3;
    centered(p.dedication, fs, 'italic');
  }

  // --- Table of contents --------------------------------------------------
  const tocEntries = book.sections.filter((s) => (s.kind === 'chapter' || s.kind === 'part') && s.tocTitle);
  if (p.toc && !manuscript && tocEntries.length) {
    startPage(false);
    y = m.top + fs * 2;
    centered('Contents', fs * 1.4, 'normal', fs);
    for (const s of tocEntries) {
      ensure(fs * 1.6);
      const indent = s.kind === 'part' ? 0 : fs;
      setFont(s.kind === 'part' ? 'bold' : 'normal', fs);
      const num = tocPages ? String(tocPages.get(s.id) ?? '') : '00';
      const title = doc.splitTextToSize(pdfSafe(s.tocTitle), textW - indent - fs * 3)[0] as string;
      doc.text(title, leftX() + indent, y + fs);
      doc.text(num, leftX() + textW, y + fs, { align: 'right' });
      // Dot leader.
      const start = leftX() + indent + doc.getTextWidth(title) + 4;
      const end = leftX() + textW - doc.getTextWidth(num) - 4;
      setFont('normal', fs * 0.8);
      const dot = doc.getTextWidth('. ');
      let dx = start;
      let dots = '';
      while (dx + dot < end) {
        dots += '. ';
        dx += dot;
      }
      if (dots) doc.text(dots, start, y + fs);
      y += fs * 1.6;
    }
  }

  // --- Sections -----------------------------------------------------------
  for (const s of book.sections) {
    startPage(true);
    chapterPages.set(s.id, page);
    if (s.kind === 'part') {
      y = H * 0.35;
      if (s.heading) centered(s.heading, fs * 1.6, manuscript ? 'normal' : 'bold', fs * 0.6);
      if (s.subheading) centered(s.subheading, fs * 1.2, 'italic', fs * 2);
    } else if (s.heading || s.subheading) {
      y = manuscript ? H / 3 : H * 0.25;
      if (s.heading) centered(manuscript ? s.heading : s.heading, manuscript ? 12 : fs * 1.5, manuscript ? 'normal' : 'bold', fs * 0.4);
      if (s.subheading) centered(s.subheading, manuscript ? 12 : fs * 1.15, manuscript ? 'normal' : 'italic', fs);
      y += lh * 0.5;
    }
    for (const b of s.blocks) {
      switch (b.type) {
        case 'paragraph':
          paragraph(b.runs, { indent: b.first && !manuscript ? 0 : indentPts, align: b.align });
          break;
        case 'heading':
          y += lh * 0.3;
          paragraph(b.runs, { align: 'center', size: fs * (b.level === 1 ? 1.3 : 1.1), spaceAfter: lh * 0.3 });
          break;
        case 'quote':
          paragraph(b.runs, { extraLeft: fs * 2, extraRight: fs * 2, italicAll: !manuscript, align: 'left' });
          break;
        case 'list':
          b.items.forEach((it, i) => paragraph([{ text: b.ordered ? `${i + 1}. ` : '• ' }, ...it], { extraLeft: fs, align: 'left' }));
          break;
        case 'break':
          ensure(lh * 2);
          setFont('normal', fs);
          doc.text(pdfSafe(p.sceneBreakGlyph), W / 2, y + fs + (lh - fs) / 2, { align: 'center' });
          y += lh * 1.4;
          break;
      }
    }
    if (s.notes.length) {
      y += lh;
      ensure(lh * 2);
      paragraph([{ text: 'Notes', bold: true }], { align: 'left', size: fs * 0.9 });
      s.notes.forEach((n, i) => paragraph([{ text: `${i + 1}. ${n}` }], { size: fs * 0.8, align: 'left' }));
    }
  }
  if (manuscript) {
    y += lh;
    centered('END', 12);
  }
  return { doc, chapterPages };
}

export async function toPdf(book: CompiledBook): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const first = render(jsPDF, book, null);
  const final = book.profile.toc && book.profile.template !== 'manuscript' ? render(jsPDF, book, first.chapterPages) : first;
  return final.doc.output('blob');
}

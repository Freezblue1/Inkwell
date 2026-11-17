/**
 * DOCX exporter (docx library). Standard Manuscript Format: Courier/Times
 * 12 pt, double spaced, 1" margins, "Surname / TITLE / page" header, chapters
 * on new pages a third of the way down. Paperback uses the trim size.
 */
import {
  AlignmentType,
  Document,
  FootnoteReferenceRun,
  Header,
  HeadingLevel,
  Footer,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  TextRun,
  type IRunOptions,
  type ISectionOptions,
} from 'docx';
import type { Block, Run } from '../compile/blocks';
import type { CompiledBook } from '../compile/compile';
import { approxWordCount } from '../compile/compile';
import { TRIM_SIZES } from './trim';

const TWIP = 1440;

export async function toDocx(book: CompiledBook): Promise<Blob> {
  const p = book.profile;
  const manuscript = p.template === 'manuscript';
  const font = manuscript ? (/courier/i.test(p.bodyFont) ? 'Courier New' : 'Times New Roman') : p.bodyFont;
  const size = Math.round((manuscript ? 12 : p.fontSize) * 2);
  const line = Math.round((manuscript ? 2 : p.lineHeight) * 240);
  const indent = manuscript ? 0.5 * TWIP : Math.round(p.firstLineIndent * (p.fontSize / 72) * TWIP);
  const trim = TRIM_SIZES[manuscript ? 'letter' : p.trim];

  const footnotes: Record<number, { children: Paragraph[] }> = {};
  let footnoteId = 0;

  const runs = (rs: Run[], noteMap: Map<number, number>): (TextRun | FootnoteReferenceRun)[] =>
    rs.flatMap((r) => {
      if (r.footnote) return [new FootnoteReferenceRun(noteMap.get(r.footnote) ?? 1)];
      const parts = r.text.split('\n');
      return parts.map((t, i) => {
        const opts: IRunOptions = {
          text: t,
          bold: r.bold,
          italics: manuscript && r.italic ? false : r.italic,
          // SMF convention: italics are traditionally underlined in manuscripts.
          underline: r.underline || (manuscript && r.italic) ? {} : undefined,
          strike: r.strike,
          break: i > 0 ? 1 : undefined,
        };
        return new TextRun(opts);
      });
    });

  const blockParas = (blocks: Block[], noteMap: Map<number, number>): Paragraph[] => {
    const out: Paragraph[] = [];
    for (const b of blocks) {
      switch (b.type) {
        case 'paragraph':
          out.push(
            new Paragraph({
              children: runs(b.runs, noteMap),
              alignment: b.align === 'center' ? AlignmentType.CENTER : b.align === 'right' ? AlignmentType.RIGHT : p.justify && !manuscript ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
              indent: b.first && !manuscript ? undefined : { firstLine: indent },
              spacing: { line, after: Math.round(p.paragraphSpacing * size * 10) },
            }),
          );
          break;
        case 'heading':
          out.push(new Paragraph({ children: runs(b.runs, noteMap).map((r) => r), alignment: AlignmentType.CENTER, spacing: { before: 240, after: 240, line } }));
          break;
        case 'quote':
          out.push(new Paragraph({ children: runs(b.runs, noteMap), indent: { left: TWIP / 2, right: TWIP / 2 }, spacing: { line } }));
          break;
        case 'list':
          b.items.forEach((it, i) => out.push(new Paragraph({ children: [new TextRun(b.ordered ? `${i + 1}. ` : '• '), ...runs(it, noteMap)], indent: { left: TWIP / 2 }, spacing: { line } })));
          break;
        case 'break':
          out.push(new Paragraph({ children: [new TextRun(p.sceneBreakGlyph)], alignment: AlignmentType.CENTER, spacing: { line } }));
          break;
      }
    }
    return out;
  };

  const children: Paragraph[] = [];

  // Title page.
  if (p.titlePage) {
    if (manuscript) {
      children.push(
        new Paragraph({ children: [new TextRun(book.author || 'Author Name')] }),
        new Paragraph({ children: [new TextRun(approxWordCount(book.wordCount))], alignment: AlignmentType.RIGHT }),
        new Paragraph({ children: [new TextRun(book.title.toUpperCase())], alignment: AlignmentType.CENTER, spacing: { before: 4 * TWIP } }),
        new Paragraph({ children: [new TextRun(`by ${book.author}`)], alignment: AlignmentType.CENTER, spacing: { before: 240 } }),
      );
    } else {
      children.push(
        new Paragraph({ children: [new TextRun({ text: book.title, size: size * 2, bold: true })], alignment: AlignmentType.CENTER, spacing: { before: 3 * TWIP } }),
        ...(book.subtitle ? [new Paragraph({ children: [new TextRun({ text: book.subtitle, italics: true, size: Math.round(size * 1.3) })], alignment: AlignmentType.CENTER })] : []),
        new Paragraph({ children: [new TextRun({ text: book.author, size: Math.round(size * 1.3) })], alignment: AlignmentType.CENTER, spacing: { before: TWIP } }),
      );
    }
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }
  if (p.copyrightPage && p.copyrightText && !manuscript) {
    children.push(new Paragraph({ children: [new TextRun({ text: p.copyrightText, size: Math.round(size * 0.85) })], spacing: { before: 4 * TWIP } }), new Paragraph({ children: [new PageBreak()] }));
  }
  if (p.dedication) {
    children.push(new Paragraph({ children: [new TextRun({ text: p.dedication, italics: true })], alignment: AlignmentType.CENTER, spacing: { before: 3 * TWIP } }), new Paragraph({ children: [new PageBreak()] }));
  }
  if (p.toc && !manuscript) {
    children.push(new Paragraph({ children: [new TextRun({ text: 'Contents', bold: true, size: Math.round(size * 1.4) })], alignment: AlignmentType.CENTER, spacing: { after: 480 } }));
    book.sections
      .filter((s) => (s.kind === 'chapter' || s.kind === 'part') && s.tocTitle)
      .forEach((s) => children.push(new Paragraph({ children: [new TextRun({ text: s.tocTitle, bold: s.kind === 'part' })], indent: { left: s.kind === 'part' ? 0 : TWIP / 4 }, spacing: { after: 80 } })));
    children.push(new Paragraph({ children: [new PageBreak()] }));
  }

  book.sections.forEach((s, si) => {
    const noteMap = new Map<number, number>();
    s.notes.forEach((text, i) => {
      footnoteId++;
      noteMap.set(i + 1, footnoteId);
      footnotes[footnoteId] = { children: [new Paragraph({ children: [new TextRun(text)] })] };
    });
    const first = si === 0 && !p.titlePage && !p.dedication && !(p.toc && !manuscript);
    if (s.heading || s.subheading) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: s.heading, bold: !manuscript, size: manuscript ? size : Math.round(size * 1.5) })],
          // Real heading styles: Word's navigation pane, and other apps (Google Docs, Reedsy, Inkwell's importer) see the chapters.
          heading: s.kind === 'part' ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
          alignment: AlignmentType.CENTER,
          pageBreakBefore: !first,
          spacing: { before: manuscript ? 3 * TWIP : 2 * TWIP, after: 240 },
        }),
      );
      if (s.subheading) children.push(new Paragraph({ children: [new TextRun({ text: s.subheading, italics: !manuscript, size: manuscript ? size : Math.round(size * 1.2) })], alignment: AlignmentType.CENTER, spacing: { after: 480 } }));
    } else if (!first) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
    children.push(...blockParas(s.blocks, noteMap));
  });

  if (manuscript) children.push(new Paragraph({ children: [new TextRun('END')], alignment: AlignmentType.CENTER, spacing: { before: 480 } }));

  const header = p.runningHeaders
    ? new Header({
        children: [
          new Paragraph({
            alignment: manuscript ? AlignmentType.RIGHT : AlignmentType.CENTER,
            children: manuscript
              ? [new TextRun(`${book.surname} / ${book.title.toUpperCase()} / `), new TextRun({ children: [PageNumber.CURRENT] })]
              : [new TextRun({ text: book.title, italics: true, size: Math.round(size * 0.8) })],
          }),
        ],
      })
    : undefined;
  const footer =
    !manuscript && p.runningHeaders
      ? new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], size: Math.round(size * 0.85) })] })] })
      : undefined;

  const section: ISectionOptions = {
    properties: {
      titlePage: p.titlePage,
      page: {
        size: { width: Math.round(trim.w * TWIP), height: Math.round(trim.h * TWIP) },
        margin: {
          top: Math.round(p.margins.top * TWIP),
          bottom: Math.round(p.margins.bottom * TWIP),
          left: Math.round((manuscript ? 1 : p.margins.inside) * TWIP),
          right: Math.round((manuscript ? 1 : p.margins.outside) * TWIP),
        },
      },
    },
    headers: header ? { default: header } : undefined,
    footers: footer ? { default: footer } : undefined,
    children,
  };

  const doc = new Document({
    creator: book.author || 'Inkwell',
    title: book.title,
    description: 'Compiled with Inkwell',
    styles: {
      default: {
        document: { run: { font, size }, paragraph: { spacing: { line } } },
        // Headings look exactly like before (the runs carry the size/weight); just no theme colour or font.
        heading1: { run: { font, color: '000000' }, paragraph: { spacing: { line } } },
        heading2: { run: { font, color: '000000' }, paragraph: { spacing: { line } } },
      },
    },
    footnotes,
    sections: [section],
  });
  return Packer.toBlob(doc);
}

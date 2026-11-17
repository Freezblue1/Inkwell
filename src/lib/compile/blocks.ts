/**
 * Format-neutral book model produced by the compiler and consumed by every
 * exporter (DOCX, EPUB, PDF, Markdown, text, HTML preview).
 */
import type { JSONContent } from '@tiptap/core';

export interface Run {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** Footnote reference number (the run's text is empty). */
  footnote?: number;
}

export type Align = 'left' | 'center' | 'right' | 'justify';

export type Block =
  | { type: 'paragraph'; runs: Run[]; align?: Align; first: boolean }
  | { type: 'heading'; level: 1 | 2 | 3; runs: Run[] }
  | { type: 'quote'; runs: Run[] }
  | { type: 'list'; ordered: boolean; items: Run[][] }
  | { type: 'break' };

/** Converts TipTap JSON into blocks. Footnote texts are appended to `notes`. */
export function jsonToBlocks(json: JSONContent | null | undefined, notes: string[], opts: { includeComments?: boolean } = {}): Block[] {
  const blocks: Block[] = [];
  let first = true;

  const runsOf = (node: JSONContent): Run[] => {
    const out: Run[] = [];
    const walk = (n: JSONContent) => {
      if (n.type === 'text') {
        const marks = new Set((n.marks ?? []).map((m) => m.type));
        out.push({
          text: n.text ?? '',
          bold: marks.has('bold') || undefined,
          italic: marks.has('italic') || undefined,
          underline: marks.has('underline') || undefined,
          strike: marks.has('strike') || undefined,
        });
      } else if (n.type === 'hardBreak') out.push({ text: '\n' });
      else if (n.type === 'mention') out.push({ text: String(n.attrs?.label ?? '') });
      else if (n.type === 'footnote') {
        notes.push(String(n.attrs?.text ?? ''));
        out.push({ text: '', footnote: notes.length });
      } else n.content?.forEach(walk);
    };
    node.content?.forEach(walk);
    return mergeRuns(out);
  };

  const visit = (n: JSONContent) => {
    switch (n.type) {
      case 'paragraph': {
        const runs = runsOf(n);
        if (!runs.some((r) => r.text.trim() || r.footnote)) return;
        const align = n.attrs?.textAlign as Align | undefined;
        blocks.push({ type: 'paragraph', runs, align: align && align !== 'left' ? align : undefined, first });
        first = false;
        return;
      }
      case 'heading':
        blocks.push({ type: 'heading', level: Math.min(3, Math.max(1, Number(n.attrs?.level ?? 2))) as 1 | 2 | 3, runs: runsOf(n) });
        first = true;
        return;
      case 'blockquote': {
        const runs: Run[] = [];
        n.content?.forEach((p, i) => {
          if (i > 0) runs.push({ text: '\n' });
          runs.push(...runsOf(p));
        });
        blocks.push({ type: 'quote', runs });
        return;
      }
      case 'bulletList':
      case 'orderedList':
        blocks.push({
          type: 'list',
          ordered: n.type === 'orderedList',
          items: (n.content ?? []).map((li) => (li.content ?? []).flatMap((p) => runsOf(p))),
        });
        return;
      case 'sceneBreak':
        blocks.push({ type: 'break' });
        first = true;
        return;
      default:
        n.content?.forEach(visit);
    }
  };
  void opts;
  visit(json ?? { type: 'doc' });
  return blocks;
}

/** Joins adjacent runs with identical formatting. */
export function mergeRuns(runs: Run[]): Run[] {
  const out: Run[] = [];
  for (const r of runs) {
    const prev = out[out.length - 1];
    if (prev && !prev.footnote && !r.footnote && prev.bold === r.bold && prev.italic === r.italic && prev.underline === r.underline && prev.strike === r.strike) prev.text += r.text;
    else out.push({ ...r });
  }
  return out;
}

export function runsToPlain(runs: Run[]): string {
  return runs.map((r) => (r.footnote ? '' : r.text)).join('');
}

const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

/** 1 → "One", 42 → "Forty-Two" (up to 999). */
export function numberToWords(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : '');
  if (n < 1000) return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${numberToWords(n % 100)}` : ''}`;
  return String(n);
}

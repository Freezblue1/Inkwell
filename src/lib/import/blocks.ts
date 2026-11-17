/**
 * The common, format-neutral model every importer produces, plus conversion
 * to TipTap JSON. Readers (Word, Markdown, PDF, Scrivener…) turn a file into
 * Blocks; structure.ts turns Blocks into a binder tree of ImportNodes.
 */
import type { JSONContent } from '@tiptap/core';
import type { SpecialChapter } from '@/types/models';

export type Mark = 'bold' | 'italic' | 'underline' | 'strike';
export type Align = 'left' | 'center' | 'right' | 'justify';

export type Inline =
  | { kind: 'text'; text: string; marks?: Mark[]; href?: string }
  | { kind: 'break' }
  | { kind: 'footnote'; text: string };

export type HeadingRole = 'title' | 'subtitle' | 'part' | 'chapter';

export type Block =
  | { type: 'para'; inl: Inline[]; align?: Align; quote?: boolean }
  | { type: 'heading'; level: number; inl: Inline[]; align?: Align; role?: HeadingRole }
  | { type: 'list'; ordered: boolean; items: Inline[][] }
  | { type: 'sceneBreak' }
  | { type: 'pageBreak' };

export type NodeKind = 'part' | 'chapter' | 'scene' | 'frontmatter' | 'backmatter' | 'note';

/** One binder item to create. */
export interface ImportNode {
  key: string;
  kind: NodeKind;
  title: string;
  blocks: Block[];
  children: ImportNode[];
  /** Unticked items (and their children) are not imported. */
  include: boolean;
  synopsis?: string;
  notes?: string;
  status?: string;
  special?: SpecialChapter | null;
  specialLabel?: string;
}

export type ImportFormat = 'docx' | 'markdown' | 'text' | 'html' | 'rtf' | 'odt' | 'epub' | 'pdf' | 'scrivener' | 'paste' | 'multi';

interface SourceBase {
  format: ImportFormat;
  /** Human name of the file or folder. */
  name: string;
  title: string;
  author: string;
  warnings: string[];
}

/** A single stream of text (Word, Markdown, PDF, EPUB…) that still needs chapters found. */
export interface FlatSource extends SourceBase {
  kind: 'flat';
  blocks: Block[];
}

/** A source that already has a binder (Scrivener). */
export interface TreeSource extends SourceBase {
  kind: 'tree';
  nodes: ImportNode[];
}

export type ImportSource = FlatSource | TreeSource;

// ── Text helpers ──────────────────────────────────────────────────────────

export const SCENE_BREAK_RE = /^(?:(?:[*✱∗]\s*){1,5}|#|(?:~\s*){1,5}|⁂|§|(?:[-–—]\s*){3,}|(?:[•·]\s*){1,5}|(?:o\s*){3}|[❧✻❦✦✧◆◇❖※]+(?:\s*[❧✻❦✦✧◆◇❖※])*|(?:=\s*){3,})$/i;

export function inlineText(inl: Inline[]): string {
  return inl.map((i) => (i.kind === 'text' ? i.text : i.kind === 'break' ? '\n' : '')).join('');
}

export function blockText(b: Block): string {
  if (b.type === 'para' || b.type === 'heading') return inlineText(b.inl);
  if (b.type === 'list') return b.items.map(inlineText).join('\n');
  return '';
}

export function wordsIn(blocks: Block[]): number {
  let n = 0;
  for (const b of blocks) {
    const t = blockText(b).trim();
    if (t) n += t.split(/\s+/).length;
  }
  return n;
}

export function nodeWords(n: ImportNode): number {
  return wordsIn(n.blocks) + n.children.reduce((s, c) => s + nodeWords(c), 0);
}

export function isEmptyBlock(b: Block): boolean {
  if (b.type === 'sceneBreak' || b.type === 'pageBreak') return false;
  return blockText(b).trim() === '' && !(b.type !== 'list' && b.inl.some((i) => i.kind === 'footnote'));
}

/** Plain paragraph (or scene break when the text is "***", "#", "⁂"…). */
export function textBlock(text: string, align?: Align): Block {
  const t = text.trim();
  if (t && SCENE_BREAK_RE.test(t)) return { type: 'sceneBreak' };
  return { type: 'para', inl: t ? [{ kind: 'text', text: t }] : [], align };
}

/** Collapses whitespace runs across inline boundaries and trims the ends. */
export function tidyInlines(inl: Inline[]): Inline[] {
  const out: Inline[] = [];
  for (const i of inl) {
    if (i.kind !== 'text') {
      out.push(i);
      continue;
    }
    let text = i.text.replace(/\s+/g, ' ');
    const prev = out[out.length - 1];
    if ((!prev || prev.kind === 'break' || (prev.kind === 'text' && prev.text.endsWith(' '))) && text.startsWith(' ')) text = text.slice(1);
    if (!text) continue;
    if (prev && prev.kind === 'text' && sameMarks(prev, i)) prev.text += text;
    else out.push({ ...i, text });
  }
  // Trim the end (and spaces before line breaks).
  for (let k = out.length - 1; k >= 0; k--) {
    const i = out[k];
    const next = out[k + 1];
    if (i.kind === 'text' && (!next || next.kind === 'break')) {
      i.text = i.text.replace(/ +$/, '');
      if (!i.text) out.splice(k, 1);
    }
  }
  while (out.length && out[0].kind === 'break') out.shift();
  while (out.length && out[out.length - 1].kind === 'break') out.pop();
  return out;
}

function sameMarks(a: Extract<Inline, { kind: 'text' }>, b: Extract<Inline, { kind: 'text' }>): boolean {
  const am = [...(a.marks ?? [])].sort().join();
  const bm = [...(b.marks ?? [])].sort().join();
  return am === bm && (a.href ?? '') === (b.href ?? '');
}

/** Drops empty paragraphs and page breaks; turns "***" paragraphs into scene breaks. */
export function cleanBlocks(blocks: Block[]): Block[] {
  const out: Block[] = [];
  for (const b of blocks) {
    if (b.type === 'pageBreak') continue;
    if (b.type === 'para') {
      const inl = tidyInlines(b.inl);
      const t = inlineText(inl).trim();
      if (!t && !inl.some((i) => i.kind === 'footnote')) continue;
      if (SCENE_BREAK_RE.test(t)) {
        out.push({ type: 'sceneBreak' });
        continue;
      }
      out.push({ ...b, inl });
    } else if (b.type === 'heading') {
      const inl = tidyInlines(b.inl);
      if (!inlineText(inl).trim()) continue;
      out.push({ ...b, inl });
    } else if (b.type === 'list') {
      const items = b.items.map(tidyInlines).filter((i) => inlineText(i).trim());
      if (items.length) out.push({ ...b, items });
    } else out.push(b);
  }
  // No doubled, leading or trailing scene breaks.
  const res: Block[] = [];
  for (const b of out) {
    if (b.type === 'sceneBreak' && (res.length === 0 || res[res.length - 1].type === 'sceneBreak')) continue;
    res.push(b);
  }
  while (res.length && res[res.length - 1].type === 'sceneBreak') res.pop();
  return res;
}

// ── TipTap conversion ─────────────────────────────────────────────────────

function inlinesToJSON(inl: Inline[]): JSONContent[] {
  const out: JSONContent[] = [];
  for (const i of tidyInlines(inl.map((x) => ({ ...x })))) {
    if (i.kind === 'break') out.push({ type: 'hardBreak' });
    else if (i.kind === 'footnote') out.push({ type: 'footnote', attrs: { text: i.text.trim() } });
    else {
      const marks: JSONContent['marks'] = (i.marks ?? []).map((m) => ({ type: m }));
      if (i.href) marks.push({ type: 'link', attrs: { href: i.href } });
      out.push(marks.length ? { type: 'text', text: i.text, marks } : { type: 'text', text: i.text });
    }
  }
  return out;
}

function paragraph(inl: Inline[], align?: Align): JSONContent {
  const content = inlinesToJSON(inl);
  const node: JSONContent = { type: 'paragraph' };
  if (align && align !== 'left') node.attrs = { textAlign: align };
  if (content.length) node.content = content;
  return node;
}

/** Converts imported blocks into a TipTap document matching Inkwell's editor schema. */
export function blocksToDoc(blocks: Block[]): JSONContent {
  const content: JSONContent[] = [];
  let quote: JSONContent | null = null;
  for (const b of cleanBlocks(blocks)) {
    if (b.type === 'para' && b.quote) {
      if (!quote) {
        quote = { type: 'blockquote', content: [] };
        content.push(quote);
      }
      quote.content!.push(paragraph(b.inl, b.align));
      continue;
    }
    quote = null;
    if (b.type === 'para') content.push(paragraph(b.inl, b.align));
    else if (b.type === 'heading') {
      const node: JSONContent = { type: 'heading', attrs: { level: Math.min(3, Math.max(1, b.level)) }, content: inlinesToJSON(b.inl) };
      if (b.align && b.align !== 'left') node.attrs!.textAlign = b.align;
      content.push(node);
    } else if (b.type === 'list') {
      content.push({
        type: b.ordered ? 'orderedList' : 'bulletList',
        content: b.items.map((item) => ({ type: 'listItem', content: [paragraph(item)] })),
      });
    } else if (b.type === 'sceneBreak') content.push({ type: 'sceneBreak' });
  }
  if (!content.length) content.push({ type: 'paragraph' });
  return { type: 'doc', content };
}

let keySeq = 0;
export function nodeKey(): string {
  keySeq += 1;
  return `n${keySeq}`;
}

export function makeNode(kind: NodeKind, title: string, blocks: Block[] = [], extra: Partial<ImportNode> = {}): ImportNode {
  return { key: nodeKey(), kind, title, blocks, children: [], include: true, ...extra };
}

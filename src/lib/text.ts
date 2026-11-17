/**
 * Helpers for converting TipTap JSON documents into plain text and back.
 * Pure functions (no DOM) so they work in workers and tests.
 */
import type { JSONContent } from '@tiptap/core';

const BLOCK_TYPES = new Set(['paragraph', 'heading', 'blockquote', 'listItem', 'bulletList', 'orderedList', 'codeBlock']);

export interface TextOptions {
  /** Include footnote text inline as "[^n: …]" (default false → excluded from counts). */
  includeFootnotes?: boolean;
  /** Text to emit for scene breaks (default "* * *"). */
  sceneBreak?: string;
}

/** Converts TipTap JSON into plain text; blocks separated by blank lines. */
export function docToText(json: JSONContent | null | undefined, opts: TextOptions = {}): string {
  if (!json) return '';
  const blocks: string[] = [];
  const sceneBreak = opts.sceneBreak ?? '* * *';

  const inlineText = (node: JSONContent): string => {
    if (node.type === 'text') return node.text ?? '';
    if (node.type === 'hardBreak') return '\n';
    if (node.type === 'mention') return String(node.attrs?.label ?? '');
    if (node.type === 'footnote') return opts.includeFootnotes ? ` [${String(node.attrs?.text ?? '')}]` : '';
    return (node.content ?? []).map(inlineText).join('');
  };

  const walk = (node: JSONContent) => {
    if (node.type === 'sceneBreak') {
      blocks.push(sceneBreak);
      return;
    }
    if (node.type === 'paragraph' || node.type === 'heading' || node.type === 'codeBlock') {
      blocks.push(inlineText(node));
      return;
    }
    (node.content ?? []).forEach(walk);
  };
  walk(json);
  return blocks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Text used for word counting (excludes scene breaks and footnotes). */
export function docToCountableText(json: JSONContent | null | undefined): string {
  return docToText(json, { sceneBreak: '' });
}

/** Builds a TipTap document from plain text paragraphs. "***" lines become scene breaks. */
export function textToDoc(text: string): JSONContent {
  const paras = text.replace(/\r\n/g, '\n').split(/\n{2,}|\n/);
  return paragraphsToDoc(paras);
}

/**
 * Builds a TipTap document from paragraphs. Supports a tiny inline syntax used
 * by templates and sample content: *italic*, **bold**, and "***" for scene breaks.
 */
export function paragraphsToDoc(paras: string[]): JSONContent {
  const content: JSONContent[] = [];
  for (const raw of paras) {
    const p = raw.trim();
    if (!p) continue;
    if (/^(\*\s*){3}$|^#$/.test(p)) {
      content.push({ type: 'sceneBreak' });
      continue;
    }
    content.push({ type: 'paragraph', content: parseInline(p) });
  }
  if (content.length === 0) content.push({ type: 'paragraph' });
  return { type: 'doc', content };
}

function parseInline(text: string): JSONContent[] {
  const out: JSONContent[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) });
    const token = m[0];
    if (token.startsWith('**')) out.push({ type: 'text', text: token.slice(2, -2), marks: [{ type: 'bold' }] });
    else out.push({ type: 'text', text: token.slice(1, -1), marks: [{ type: 'italic' }] });
    last = m.index + token.length;
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) });
  return out.filter((n) => n.text);
}

/** Empty TipTap document. */
export function emptyDoc(): JSONContent {
  return { type: 'doc', content: [{ type: 'paragraph' }] };
}

/** Collects ids of all @-mentions in a document. */
export function extractMentionIds(json: JSONContent | null | undefined): string[] {
  const ids = new Set<string>();
  const walk = (n: JSONContent) => {
    if (n.type === 'mention' && n.attrs?.id) ids.add(String(n.attrs.id));
    n.content?.forEach(walk);
  };
  if (json) walk(json);
  return [...ids];
}

/** Collects comment ids referenced by comment marks. */
export function extractCommentIds(json: JSONContent | null | undefined): string[] {
  const ids = new Set<string>();
  const walk = (n: JSONContent) => {
    n.marks?.forEach((m) => {
      if (m.type === 'comment' && m.attrs?.commentId) ids.add(String(m.attrs.commentId));
    });
    n.content?.forEach(walk);
  };
  if (json) walk(json);
  return [...ids];
}

/** Concatenates several documents into one (used by merge). */
export function concatDocs(docs: JSONContent[], withSceneBreaks = true): JSONContent {
  const content: JSONContent[] = [];
  docs.forEach((d, i) => {
    if (i > 0 && withSceneBreaks) content.push({ type: 'sceneBreak' });
    content.push(...(d.content ?? []));
  });
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] };
}

export function isBlockType(type: string | undefined): boolean {
  return !!type && BLOCK_TYPES.has(type);
}

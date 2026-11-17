/** Plain text and Markdown readers. */
import { marked } from 'marked';
import { textBlock, type Block } from './blocks';
import { htmlToBlocks } from './html';

/**
 * Plain text. With blank lines between paragraphs, single line breaks are
 * treated as hard wrapping and joined; without any blank lines, every line
 * is its own paragraph.
 */
export function plainTextToBlocks(text: string): Block[] {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const hasBlankLines = /\n[ \t]*\n/.test(src);
  if (!hasBlankLines) return src.split('\n').filter((p) => p.trim()).map((p) => textBlock(p));
  const out: Block[] = [];
  for (const chunk of src.split(/\n[ \t]*\n+/)) {
    const lines = chunk.split('\n').map((l) => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    // "PROLOGUE\nThe Night of the Flood": a heading line on top of its title stays separate.
    if (lines.length > 1 && lines.length <= 3 && lines[0].length <= 60 && (/^[^a-z]*[A-Z][^a-z]*$/.test(lines[0]) || /^(chapter|part|book|prologue|epilogue)\b/i.test(lines[0]))) {
      out.push(textBlock(lines[0]));
      out.push(textBlock(lines.slice(1).join(' ')));
      continue;
    }
    out.push(textBlock(lines.join(' ')));
  }
  return out;
}

export interface MarkdownResult {
  blocks: Block[];
  title: string;
  author: string;
  images: number;
}

/** Markdown (CommonMark + GFM), with optional YAML front matter for title/author. */
export function markdownToBlocks(md: string): MarkdownResult {
  let src = md.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  let title = '';
  let author = '';
  const fm = /^---\n([\s\S]*?)\n(?:---|\.\.\.)\n/.exec(src);
  if (fm) {
    src = src.slice(fm[0].length);
    for (const line of fm[1].split('\n')) {
      const m = /^(title|author)\s*:\s*["']?(.*?)["']?\s*$/i.exec(line);
      if (m && m[1].toLowerCase() === 'title') title = m[2];
      if (m && m[1].toLowerCase() === 'author') author = m[2];
    }
  }
  // A lone "#" is a common scene break, not an empty heading.
  src = src.replace(/^[ \t]*#[ \t]*$/gm, '\\#');
  const html = marked.parse(src, { async: false, gfm: true, breaks: false }) as string;
  const res = htmlToBlocks(html);
  return { blocks: res.blocks, title, author, images: res.images };
}

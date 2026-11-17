/** Markdown and plain-text exporters. */
import type { Block, Run } from '../compile/blocks';
import type { CompiledBook } from '../compile/compile';

function mdEscape(t: string): string {
  return t.replace(/([\\`*_[\]#])/g, '\\$1');
}

function runsToMd(runs: Run[], prefix: string): string {
  return runs
    .map((r) => {
      if (r.footnote) return `[^${prefix}${r.footnote}]`;
      if (!r.text.trim()) return r.text;
      // Keep surrounding spaces outside the markers.
      const m = /^(\s*)(.*?)(\s*)$/s.exec(r.text)!;
      let t = mdEscape(m[2]).replace(/\n/g, '  \n');
      if (r.bold && r.italic) t = `***${t}***`;
      else if (r.bold) t = `**${t}**`;
      else if (r.italic) t = `*${t}*`;
      if (r.strike) t = `~~${t}~~`;
      if (r.underline) t = `<u>${t}</u>`;
      return m[1] + t + m[3];
    })
    .join('');
}

function blocksToMd(blocks: Block[], glyph: string, prefix: string): string {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'paragraph':
          return runsToMd(b.runs, prefix);
        case 'heading':
          return `${'#'.repeat(b.level + 2)} ${runsToMd(b.runs, prefix)}`;
        case 'quote':
          return runsToMd(b.runs, prefix)
            .split('\n')
            .map((l) => `> ${l}`)
            .join('\n');
        case 'list':
          return b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : '-'} ${runsToMd(it, prefix)}`).join('\n');
        case 'break':
          return `<p align="center">${glyph}</p>`;
      }
    })
    .join('\n\n');
}

export function toMarkdown(book: CompiledBook): string {
  const p = book.profile;
  const out: string[] = [`# ${mdEscape(book.title)}`];
  if (book.subtitle) out.push(`*${mdEscape(book.subtitle)}*`);
  if (book.author) out.push(`by ${mdEscape(book.author)}`);
  if (p.copyrightPage && p.copyrightText) out.push(`---\n\n${mdEscape(p.copyrightText)}`);
  if (p.dedication) out.push(`---\n\n*${mdEscape(p.dedication)}*`);
  if (p.toc) {
    out.push('## Contents');
    out.push(
      book.sections
        .filter((s) => s.kind === 'chapter' || s.kind === 'part')
        .filter((s) => s.tocTitle)
        .map((s) => `${s.kind === 'part' ? '' : '  '}- ${mdEscape(s.tocTitle)}`)
        .join('\n'),
    );
  }
  book.sections.forEach((s, si) => {
    const prefix = `s${si + 1}-`;
    out.push('---');
    if (s.heading) out.push(`${s.kind === 'part' ? '#' : '##'} ${mdEscape(s.heading)}${s.subheading ? `\n\n### ${mdEscape(s.subheading)}` : ''}`);
    if (s.blocks.length) out.push(blocksToMd(s.blocks, p.sceneBreakGlyph, prefix));
    if (s.notes.length) out.push(s.notes.map((n, i) => `[^${prefix}${i + 1}]: ${n}`).join('\n'));
  });
  return out.join('\n\n') + '\n';
}

function runsToText(runs: Run[]): string {
  return runs.map((r) => (r.footnote ? `[${r.footnote}]` : r.text)).join('');
}

export function toPlainText(book: CompiledBook): string {
  const p = book.profile;
  const out: string[] = [book.title.toUpperCase()];
  if (book.subtitle) out.push(book.subtitle);
  if (book.author) out.push(`by ${book.author}`);
  if (p.copyrightPage && p.copyrightText) out.push(p.copyrightText);
  if (p.dedication) out.push(p.dedication);
  for (const s of book.sections) {
    out.push('\n');
    if (s.heading) out.push(s.heading.toUpperCase() + (s.subheading ? `\n${s.subheading}` : ''));
    for (const b of s.blocks) {
      if (b.type === 'break') out.push(`            ${p.sceneBreakGlyph}`);
      else if (b.type === 'list') out.push(b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : '•'} ${runsToText(it)}`).join('\n'));
      else if (b.type === 'quote') out.push(runsToText(b.runs).split('\n').map((l) => `    ${l}`).join('\n'));
      else out.push(runsToText(b.runs));
    }
    if (s.notes.length) out.push('Notes\n' + s.notes.map((n, i) => `${i + 1}. ${n}`).join('\n'));
  }
  return out.join('\n\n').replace(/\n{4,}/g, '\n\n\n') + '\n';
}

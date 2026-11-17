/** Book model → (X)HTML fragments, shared by the live preview, print and EPUB. */
import type { Block, Run } from '../compile/blocks';
import type { CompiledSection } from '../compile/compile';

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function runsToHtml(runs: Run[], noteHref?: (n: number) => string): string {
  return runs
    .map((r) => {
      if (r.footnote) {
        const n = r.footnote;
        return noteHref ? `<a class="noteref" epub:type="noteref" href="${noteHref(n)}" id="ref-${n}"><sup>${n}</sup></a>` : `<sup class="noteref">${n}</sup>`;
      }
      let t = escapeXml(r.text).replace(/\n/g, '<br/>');
      if (r.bold) t = `<strong>${t}</strong>`;
      if (r.italic) t = `<em>${t}</em>`;
      if (r.underline) t = `<u>${t}</u>`;
      if (r.strike) t = `<s>${t}</s>`;
      return t;
    })
    .join('');
}

/** One HTML string per block (the preview paginates by block). */
export function blocksToHtmlList(blocks: Block[], glyph: string, opts: { dropCaps?: boolean; noteHref?: (n: number) => string } = {}): string[] {
  let firstPara = true;
  return blocks.map((b) => {
    switch (b.type) {
      case 'paragraph': {
        const cls = [b.first ? 'first' : '', opts.dropCaps && firstPara ? 'dropcap' : ''].filter(Boolean).join(' ');
        firstPara = false;
        const style = b.align ? ` style="text-align:${b.align}"` : '';
        return `<p${cls ? ` class="${cls}"` : ''}${style}>${runsToHtml(b.runs, opts.noteHref)}</p>`;
      }
      case 'heading':
        return `<h${b.level + 2} class="inline-heading">${runsToHtml(b.runs, opts.noteHref)}</h${b.level + 2}>`;
      case 'quote':
        return `<blockquote><p>${runsToHtml(b.runs, opts.noteHref)}</p></blockquote>`;
      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul';
        return `<${tag}>${b.items.map((it) => `<li>${runsToHtml(it, opts.noteHref)}</li>`).join('')}</${tag}>`;
      }
      case 'break':
        return `<p class="scene-break">${escapeXml(glyph)}</p>`;
    }
  });
}

export function sectionHeadingHtml(s: CompiledSection): string {
  if (!s.heading && !s.subheading) return '';
  const cls = s.kind === 'part' ? 'part-heading' : 'chapter-heading';
  return `<div class="${cls}">${s.heading ? `<h1>${escapeXml(s.heading)}</h1>` : ''}${s.subheading ? `<h2>${escapeXml(s.subheading)}</h2>` : ''}</div>`;
}

export function notesHtml(notes: string[], backHref?: (n: number) => string): string {
  if (!notes.length) return '';
  return `<section class="notes"><h3>Notes</h3><ol>${notes
    .map((t, i) => `<li id="note-${i + 1}"${backHref ? ' epub:type="footnote"' : ''}>${escapeXml(t)}${backHref ? ` <a href="${backHref(i + 1)}">↩</a>` : ''}</li>`)
    .join('')}</ol></section>`;
}

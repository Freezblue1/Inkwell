/**
 * DOM-measured pagination for the live book preview and print.
 * Blocks are laid into fixed-size page bodies; paragraphs that overflow are
 * split at the last word that fits (runs are split, so formatting survives).
 */
import type { Block, Run } from '@/lib/compile/blocks';
import type { CompiledBook } from '@/lib/compile/compile';
import { approxWordCount } from '@/lib/compile/compile';
import { blocksToHtmlList, escapeXml, notesHtml, sectionHeadingHtml } from '@/lib/export/html';
import { TRIM_SIZES } from '@/lib/export/trim';

export const PX_PER_IN = 96;

export interface PreviewPage {
  html: string;
  number: number;
  header: string;
  footer: string;
  kind: 'front' | 'opening' | 'body';
}

export function pageGeometry(book: CompiledBook) {
  const p = book.profile;
  const manuscript = p.template === 'manuscript';
  const trim = TRIM_SIZES[manuscript ? 'letter' : p.trim];
  const m = manuscript ? { top: 1, bottom: 1, inside: 1, outside: 1 } : p.margins;
  return { manuscript, w: trim.w * PX_PER_IN, h: trim.h * PX_PER_IN, m: { top: m.top * PX_PER_IN, bottom: m.bottom * PX_PER_IN, inside: m.inside * PX_PER_IN, outside: m.outside * PX_PER_IN } };
}

/** CSS for preview/print pages, scoped under `.ink-book`. */
export function bookCss(book: CompiledBook): string {
  const p = book.profile;
  const g = pageGeometry(book);
  const font = g.manuscript ? (/courier/i.test(p.bodyFont) ? '"Courier Prime", "Courier New", monospace' : '"Tinos", "Times New Roman", serif') : `"${p.bodyFont}", Georgia, serif`;
  const size = ((g.manuscript ? 12 : p.fontSize) * 96) / 72;
  const lh = g.manuscript ? 2 : p.lineHeight;
  const indent = g.manuscript ? '0.5in' : `${p.firstLineIndent}em`;
  return `
.ink-book .ink-page { position: relative; width: ${g.w}px; height: ${g.h}px; background: #fff; color: #111; box-sizing: border-box; overflow: hidden; font-family: ${font}; font-size: ${size}px; line-height: ${lh}; }
.ink-book .ink-body { position: absolute; top: ${g.m.top}px; bottom: ${g.m.bottom}px; overflow: hidden; }
.ink-book .ink-page.recto .ink-body { left: ${g.m.inside}px; right: ${g.m.outside}px; }
.ink-book .ink-page.verso .ink-body { left: ${g.m.outside}px; right: ${g.m.inside}px; }
.ink-book .ink-head, .ink-book .ink-foot { position: absolute; left: ${g.m.outside}px; right: ${g.m.outside}px; font-size: ${size * 0.8}px; color: #444; text-align: center; line-height: 1.2; }
.ink-book .ink-head { top: ${g.m.top * 0.4}px; font-style: ${g.manuscript ? 'normal' : 'italic'}; ${g.manuscript ? `text-align: right; font-size: ${size}px;` : ''} }
.ink-book .ink-foot { bottom: ${g.m.bottom * 0.35}px; }
.ink-book p { margin: 0 0 ${p.paragraphSpacing}em; text-indent: ${indent}; text-align: ${p.justify && !g.manuscript ? 'justify' : 'left'}; hyphens: auto; orphans: 1; widows: 1; }
.ink-book p.first, .ink-book p.cont { text-indent: ${g.manuscript ? indent : '0'}; }
.ink-book p.cont { text-indent: 0; }
.ink-book p.scene-break { text-align: center; text-indent: 0; margin: 0.5em 0; letter-spacing: 0.3em; }
.ink-book p.dropcap::first-letter { float: left; font-size: ${lh * 2.6}em; line-height: 0.85; padding: 0.06em 0.08em 0 0; }
.ink-book .chapter-heading { padding-top: ${g.manuscript ? g.h / 3 - g.m.top : g.h * 0.18}px; text-align: center; margin-bottom: ${g.manuscript ? '0' : '2em'}; }
.ink-book .chapter-heading h1 { font-size: ${g.manuscript ? 1 : 1.5}em; font-weight: ${g.manuscript ? 'normal' : '500'}; margin: 0; letter-spacing: 0.06em; ${g.manuscript ? 'text-transform: none;' : ''} }
.ink-book .chapter-heading h2 { font-size: ${g.manuscript ? 1 : 1.1}em; font-weight: normal; font-style: ${g.manuscript ? 'normal' : 'italic'}; margin: 0.4em 0 ${g.manuscript ? '1em' : '0'}; }
.ink-book .part-heading { padding-top: ${g.h * 0.3}px; text-align: center; }
.ink-book .part-heading h1 { font-size: 1.6em; font-weight: 500; margin: 0; }
.ink-book .part-heading h2 { font-size: 1.15em; font-style: italic; font-weight: normal; }
.ink-book blockquote { margin: 0.5em 2em; font-style: italic; }
.ink-book blockquote p { text-indent: 0; }
.ink-book ul, .ink-book ol { margin: 0.3em 0 0.3em 1.5em; padding: 0; }
.ink-book .notes { font-size: 0.85em; border-top: 1px solid #aaa; margin-top: 1em; }
.ink-book .notes h3 { font-size: 1em; margin: 0.5em 0; }
.ink-book .notes ol { margin-left: 1.2em; }
.ink-book .front-title { padding-top: ${g.h * 0.25}px; text-align: center; }
.ink-book .front-title h1 { font-size: 2.2em; margin: 0 0 0.3em; font-weight: 600; }
.ink-book .front-title .sub { font-style: italic; font-size: 1.2em; }
.ink-book .front-title .author { margin-top: ${g.h * 0.2}px; font-size: 1.3em; }
.ink-book .ms-title { display: flex; justify-content: space-between; }
.ink-book .ms-center { padding-top: ${g.h * 0.3}px; text-align: center; }
.ink-book .copyright { position: absolute; bottom: 0; font-size: 0.8em; text-indent: 0; }
.ink-book .dedication { padding-top: ${g.h * 0.25}px; text-align: center; font-style: italic; }
.ink-book .toc h1 { text-align: center; font-size: 1.4em; font-weight: 500; }
.ink-book .toc div { display: flex; gap: 6px; margin: 0.2em 0; }
.ink-book .toc div.part { font-weight: 600; margin-top: 0.6em; }
.ink-book .toc div span.leader { flex: 1; border-bottom: 1px dotted #999; margin-bottom: 0.35em; }
.ink-book sup.noteref { font-size: 0.65em; line-height: 0; }
`;
}

type FlowItem =
  | { kind: 'page'; html: string; pageKind: PreviewPage['kind']; header: boolean; id?: string }
  | { kind: 'html'; html: string }
  | { kind: 'block'; block: Block; dropcap: boolean; cont: boolean };

/** Splits runs after the k-th word. */
function splitRuns(runs: Run[], k: number): [Run[], Run[]] {
  let count = 0;
  const a: Run[] = [];
  const b: Run[] = [];
  let done = false;
  for (const r of runs) {
    if (done) {
      b.push(r);
      continue;
    }
    if (r.footnote) {
      a.push(r);
      continue;
    }
    const re = /\S+/g;
    let m: RegExpExecArray | null;
    let cut = -1;
    while ((m = re.exec(r.text))) {
      count++;
      if (count === k) {
        cut = m.index + m[0].length;
        break;
      }
    }
    if (cut < 0) a.push(r);
    else {
      a.push({ ...r, text: r.text.slice(0, cut) });
      const rest = r.text.slice(cut).replace(/^\s+/, '');
      if (rest) b.push({ ...r, text: rest });
      done = true;
    }
  }
  return [a, b];
}

const wordTotal = (runs: Run[]) => runs.reduce((n, r) => n + (r.text.match(/\S+/g)?.length ?? 0), 0);

function blockHtml(item: Extract<FlowItem, { kind: 'block' }>, glyph: string): string {
  let html = blocksToHtmlList([item.block], glyph, { dropCaps: item.dropcap })[0];
  if (item.cont) html = html.replace(/^<p( class="[^"]*")?/, (_m, cls?: string) => `<p class="${cls ? cls.slice(8, -1) + ' ' : ''}cont"`);
  return html;
}

function buildFlow(book: CompiledBook, tocNumbers: Map<string, number> | null): FlowItem[] {
  const p = book.profile;
  const g = pageGeometry(book);
  const flow: FlowItem[] = [];
  if (p.titlePage) {
    flow.push({
      kind: 'page',
      pageKind: 'front',
      header: false,
      html: g.manuscript
        ? `<div class="ms-title"><span>${escapeXml(book.author || 'Author Name')}</span><span>${escapeXml(approxWordCount(book.wordCount))}</span></div><div class="ms-center"><p style="text-align:center;text-indent:0">${escapeXml(book.title.toUpperCase())}</p><p style="text-align:center;text-indent:0">by ${escapeXml(book.author)}</p></div>`
        : `<div class="front-title"><h1>${escapeXml(book.title)}</h1>${book.subtitle ? `<div class="sub">${escapeXml(book.subtitle)}</div>` : ''}<div class="author">${escapeXml(book.author)}</div></div>`,
    });
  }
  if (p.copyrightPage && p.copyrightText && !g.manuscript) flow.push({ kind: 'page', pageKind: 'front', header: false, html: `<p class="copyright">${escapeXml(p.copyrightText)}</p>` });
  if (p.dedication && !g.manuscript) flow.push({ kind: 'page', pageKind: 'front', header: false, html: `<div class="dedication">${escapeXml(p.dedication)}</div>` });
  const tocEntries = book.sections.filter((s) => (s.kind === 'chapter' || s.kind === 'part') && s.tocTitle);
  if (p.toc && !g.manuscript && tocEntries.length) {
    flow.push({
      kind: 'page',
      pageKind: 'front',
      header: false,
      html: `<div class="toc"><h1>Contents</h1>${tocEntries.map((s) => `<div class="${s.kind}"><span>${escapeXml(s.tocTitle)}</span><span class="leader"></span><span>${tocNumbers?.get(s.id) ?? ''}</span></div>`).join('')}</div>`,
    });
  }
  for (const s of book.sections) {
    flow.push({ kind: 'page', pageKind: 'opening', header: false, html: sectionHeadingHtml(s), id: s.id });
    let firstPara = true;
    for (const b of s.blocks) {
      flow.push({ kind: 'block', block: b, dropcap: p.dropCaps && !g.manuscript && s.kind === 'chapter' && b.type === 'paragraph' && firstPara, cont: false });
      if (b.type === 'paragraph') firstPara = false;
    }
    if (s.notes.length) flow.push({ kind: 'html', html: notesHtml(s.notes) });
  }
  if (g.manuscript) flow.push({ kind: 'html', html: '<p style="text-align:center;text-indent:0;margin-top:1em">END</p>' });
  return flow;
}

export interface PaginateResult {
  pages: PreviewPage[];
  complete: boolean;
  openings: Map<string, number>;
}

/** Paginates up to `maxPages` pages using a hidden measuring element. */
export function paginate(book: CompiledBook, maxPages = Infinity, tocNumbers: Map<string, number> | null = null): PaginateResult {
  const g = pageGeometry(book);
  const p = book.profile;
  const host = document.createElement('div');
  host.className = 'ink-book';
  host.style.cssText = 'position:absolute;left:-100000px;top:0;visibility:hidden;';
  const style = document.createElement('style');
  style.textContent = bookCss(book);
  host.appendChild(style);
  const pageEl = document.createElement('div');
  pageEl.className = 'ink-page recto';
  const body = document.createElement('div');
  body.className = 'ink-body';
  pageEl.appendChild(body);
  host.appendChild(pageEl);
  document.body.appendChild(host);

  const pages: PreviewPage[] = [];
  const openings = new Map<string, number>();
  type Cur = { parts: string[]; kind: PreviewPage['kind']; header: boolean };
  // Typed initializer keeps TS from narrowing to `null` (it's reassigned inside helpers).
  let current = null as Cur | null;
  const overflow = () => body.scrollHeight > body.clientHeight + 1;
  const flush = () => {
    if (!current?.parts.length) {
      current = null;
      return;
    }
    const n = pages.length + 1;
    const header =
      !p.runningHeaders || !current.header ? '' : g.manuscript ? `${escapeXml(book.surname)} / ${escapeXml(book.title.toUpperCase())} / ${n}` : escapeXml(n % 2 === 0 ? book.author : book.title);
    const footer = p.runningHeaders && !g.manuscript && current.kind !== 'front' ? String(n) : '';
    pages.push({ html: current.parts.join(''), number: n, header, footer, kind: current.kind });
    current = null;
  };
  const start = (kind: PreviewPage['kind'], header: boolean) => {
    flush();
    pageEl.className = `ink-page ${(pages.length + 1) % 2 === 0 ? 'verso' : 'recto'}`;
    body.innerHTML = '';
    // Manuscripts carry the slug line on every page except the title page.
    current = { parts: [], kind, header: header || (g.manuscript && kind !== 'front') };
  };
  const append = (html: string): boolean => {
    body.insertAdjacentHTML('beforeend', html);
    if (!overflow()) {
      current!.parts.push(html);
      return true;
    }
    body.lastElementChild?.remove();
    return false;
  };

  let complete = true;
  const flow = buildFlow(book, tocNumbers);
  for (let i = 0; i < flow.length; i++) {
    if (pages.length >= maxPages) {
      complete = false;
      break;
    }
    const item = flow[i];
    if (item.kind === 'page') {
      start(item.pageKind, item.header);
      if (item.id) openings.set(item.id, pages.length + 1);
      body.insertAdjacentHTML('beforeend', item.html);
      current!.parts.push(item.html);
      if (item.pageKind === 'front') start('body', true);
      continue;
    }
    if (!current) start('body', true);
    const html = item.kind === 'html' ? item.html : blockHtml(item, p.sceneBreakGlyph);
    if (append(html)) continue;

    // Doesn't fit. Split paragraphs; move other blocks to the next page.
    if (item.kind === 'block' && item.block.type === 'paragraph') {
      const block = item.block;
      const total = wordTotal(block.runs);
      let lo = 0;
      let hi = total - 1;
      let best = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const [a] = splitRuns(block.runs, mid);
        body.insertAdjacentHTML('beforeend', blockHtml({ ...item, block: { ...block, runs: a } }, p.sceneBreakGlyph));
        const fits = !overflow();
        body.lastElementChild?.remove();
        if (fits) {
          best = mid;
          lo = mid + 1;
        } else hi = mid - 1;
      }
      if (best > 0) {
        const [a, b] = splitRuns(block.runs, best);
        current!.parts.push(blockHtml({ ...item, block: { ...block, runs: a } }, p.sceneBreakGlyph));
        start('body', true);
        flow.splice(i + 1, 0, { kind: 'block', block: { ...block, runs: b }, dropcap: false, cont: true });
        continue;
      }
    }
    if (current!.parts.length === 0) {
      // Taller than a page on its own: place it anyway (it will be clipped).
      body.insertAdjacentHTML('beforeend', html);
      current!.parts.push(html);
      start('body', true);
      continue;
    }
    start('body', true);
    i--; // retry the same item on the new page
  }
  if (current?.parts.length) flush();
  document.body.removeChild(host);
  return { pages, complete, openings };
}

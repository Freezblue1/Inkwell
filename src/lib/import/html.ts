/**
 * HTML → Blocks. Shared by Word (via mammoth), Markdown (via marked), EPUB,
 * Google Docs "Web page" downloads and pasted rich text. Understands
 * Google Docs' class-based styles and the common footnote patterns.
 */
import { tidyInlines, SCENE_BREAK_RE, type Align, type Block, type HeadingRole, type Inline, type Mark } from './blocks';

export interface HtmlResult {
  blocks: Block[];
  title: string;
  images: number;
}

type Style = Record<string, string>;
interface InlineState {
  marks: Set<Mark>;
  href?: string;
}

const SKIP = new Set(['script', 'style', 'head', 'noscript', 'svg', 'nav', 'template', 'iframe', 'object', 'math', 'button', 'select', 'input', 'textarea']);
const BLOCK = new Set([
  'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'li', 'hr', 'pre', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
  'section', 'article', 'header', 'footer', 'main', 'aside', 'figure', 'figcaption', 'body', 'dl', 'dt', 'dd', 'address', 'center', 'caption', 'hgroup', 'details', 'summary',
]);
const BREAK_CLASS = /(^|[\s_-])(scene-?break|section-?break|break|ornament|separator|divider|dinkus|asterism|space-?break|fleuron)([\s_-]|$)/i;
const NOTE_MARK = /^[[(]?\s*(\d{1,3}|[ivx]{1,5}|[*†‡§¶])\s*[\])]?$/i;

function parseStyle(text: string | null): Style {
  const out: Style = {};
  if (!text) return out;
  for (const part of text.split(';')) {
    const i = part.indexOf(':');
    if (i > 0) out[part.slice(0, i).trim().toLowerCase()] = part.slice(i + 1).trim().toLowerCase();
  }
  return out;
}

/** ".c3{font-weight:700}" rules from <style> blocks (Google Docs HTML export). */
function classStyles(doc: Document): Map<string, Style> {
  const map = new Map<string, Style>();
  doc.querySelectorAll('style').forEach((s) => {
    const css = (s.textContent ?? '').replace(/\/\*[\s\S]*?\*\//g, '');
    const re = /([^{}]+)\{([^}]*)\}/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(css))) {
      const style = parseStyle(m[2]);
      for (const sel of m[1].split(',')) {
        const cls = /^\s*(?:[a-z0-9]*)\.([\w-]+)\s*$/i.exec(sel);
        if (cls) map.set(cls[1], { ...map.get(cls[1]), ...style });
      }
    }
  });
  return map;
}

function alignFrom(style: Style, el: Element): Align | undefined {
  const a = style['text-align'] || el.getAttribute('align')?.toLowerCase() || (el.tagName.toLowerCase() === 'center' ? 'center' : '');
  if (a === 'center' || a === 'right' || a === 'justify') return a;
  if (a === 'end') return 'right';
  return undefined;
}

/** Finds footnote references and the footnote bodies they point to. */
function collectFootnotes(doc: Document): { refs: Map<Element, string>; bodies: Set<Element> } {
  const refs = new Map<Element, string>();
  const bodies = new Set<Element>();
  doc.querySelectorAll('a[href*="#"]').forEach((a) => {
    const href = a.getAttribute('href') ?? '';
    const id = decodeURIComponent(href.slice(href.indexOf('#') + 1));
    if (!id) return;
    const type = `${a.getAttribute('epub:type') ?? ''} ${a.getAttribute('role') ?? ''}`;
    const isRef = /noteref/.test(type) || NOTE_MARK.test((a.textContent ?? '').trim());
    if (!isRef) return;
    const target = doc.getElementById(id);
    if (!target) return;
    // Notes follow their reference; links pointing backwards are "↑ return" links.
    if (!(a.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING)) return;
    const body = target.closest('li, aside, p, div, section, dd, td') ?? target;
    if (body.contains(a)) return;
    // Not a note: a contents link to a chapter or a section.
    if (/^h[1-6]$/i.test(target.tagName) || body.querySelector('h1, h2, h3, h4, h5, h6') || (body.textContent ?? '').length > 4000) return;
    const clone = body.cloneNode(true) as Element;
    clone.querySelectorAll('a[href*="#"]').forEach((b) => {
      if (NOTE_MARK.test((b.textContent ?? '').trim()) || /^[↑↩⤴^]$/.test((b.textContent ?? '').trim())) b.remove();
    });
    const text = (clone.textContent ?? '').replace(/\s+/g, ' ').replace(/^\s*[[(]?\d{1,3}[\])]?[.)]?\s*/, '').trim();
    refs.set(a, text);
    bodies.add(body);
  });
  return { refs, bodies };
}

export function htmlToBlocks(html: string): HtmlResult {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const classes = classStyles(doc);
  const { refs, bodies } = collectFootnotes(doc);
  const blocks: Block[] = [];
  let images = 0;

  const styleOf = (el: Element): Style => {
    let s: Style = {};
    const cls = el.getAttribute('class');
    if (cls) for (const c of cls.split(/\s+/)) if (classes.has(c)) s = { ...s, ...classes.get(c) };
    return { ...s, ...parseStyle(el.getAttribute('style')) };
  };

  const applyStyle = (state: InlineState, el: Element): InlineState => {
    const tag = el.tagName.toLowerCase();
    const marks = new Set(state.marks);
    let href = state.href;
    if (tag === 'b' || tag === 'strong') marks.add('bold');
    if (tag === 'i' || tag === 'em' || tag === 'cite' || tag === 'dfn' || tag === 'var') marks.add('italic');
    if (tag === 'u' || tag === 'ins') marks.add('underline');
    if (tag === 's' || tag === 'strike' || tag === 'del') marks.add('strike');
    if (tag === 'a') {
      const h = el.getAttribute('href') ?? '';
      if (/^(https?:|mailto:)/i.test(h)) href = h;
    }
    const st = styleOf(el);
    const fw = st['font-weight'];
    if (fw) {
      const n = Number(fw);
      if (fw === 'bold' || fw === 'bolder' || n >= 600) marks.add('bold');
      else if (fw === 'normal' || fw === 'lighter' || (n && n < 600)) marks.delete('bold');
    }
    const fs = st['font-style'];
    if (fs === 'italic' || fs === 'oblique') marks.add('italic');
    else if (fs === 'normal') marks.delete('italic');
    const td = st['text-decoration'] ?? st['text-decoration-line'];
    if (td) {
      if (td.includes('underline')) marks.add('underline');
      if (td.includes('line-through')) marks.add('strike');
      if (td === 'none') {
        marks.delete('underline');
        marks.delete('strike');
      }
    }
    return { marks, href };
  };

  /** Collects inline content of an element (block children are flattened with line breaks). */
  const inlines = (node: Node, state: InlineState, out: Inline[]) => {
    if (node.nodeType === 3) {
      const text = node.textContent ?? '';
      if (text) out.push({ kind: 'text', text, marks: state.marks.size ? [...state.marks] : undefined, href: state.href });
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (SKIP.has(tag) || bodies.has(el)) return;
    if (refs.has(el)) {
      out.push({ kind: 'footnote', text: refs.get(el)! });
      return;
    }
    if (tag === 'br') {
      out.push({ kind: 'break' });
      return;
    }
    if (tag === 'img') {
      images++;
      return;
    }
    if (tag === 'sup' || tag === 'sub') {
      // A <sup> wrapping only a footnote ref is handled by the ref; keep other text.
    }
    const next = applyStyle(state, el);
    el.childNodes.forEach((c) => inlines(c, next, out));
  };

  // Inline wrappers around blocks (Google Docs wraps everything in <b id="docs-internal-guid…">) act as containers.
  const blockSelector = [...BLOCK].filter((t) => t !== 'body').join(',');
  const isBlockEl = (n: Node) => {
    if (n.nodeType !== 1 || bodies.has(n as Element)) return false;
    const el = n as Element;
    return BLOCK.has(el.tagName.toLowerCase()) || (!SKIP.has(el.tagName.toLowerCase()) && !refs.has(el) && !!el.querySelector(blockSelector));
  };

  const pushPara = (inl: Inline[], el: Element, quote: boolean, align?: Align) => {
    const tidy = tidyInlines(inl);
    const text = tidy.map((i) => (i.kind === 'text' ? i.text : '')).join('').trim();
    const cls = el.getAttribute('class') ?? '';
    if (!text && !tidy.some((i) => i.kind === 'footnote')) {
      if (BREAK_CLASS.test(cls) || (el.querySelector('img') && BREAK_CLASS.test(`${cls} ${el.querySelector('img')?.getAttribute('class') ?? ''} ${el.querySelector('img')?.getAttribute('alt') ?? ''}`))) {
        blocks.push({ type: 'sceneBreak' });
      }
      return;
    }
    if (SCENE_BREAK_RE.test(text) || (text.length <= 12 && BREAK_CLASS.test(cls))) {
      blocks.push({ type: 'sceneBreak' });
      return;
    }
    if (/(^|\s)(subtitle)(\s|$)/i.test(cls)) {
      blocks.push({ type: 'heading', level: 2, inl: tidy, align, role: 'subtitle' });
      return;
    }
    // Google Docs' "Title" paragraph style.
    if (/(^|\s)(title|book-?title)(\s|$)/i.test(cls) && text.length <= 150) {
      blocks.push({ type: 'heading', level: 1, inl: tidy, align, role: 'title' });
      return;
    }
    blocks.push({ type: 'para', inl: tidy, align, quote: quote || undefined });
  };

  const walk = (el: Element, quote: boolean, state: InlineState) => {
    const tag = el.tagName.toLowerCase();
    if (SKIP.has(tag) || bodies.has(el)) return;
    const st = styleOf(el);
    if (st['page-break-before'] === 'always' || st['break-before'] === 'page') blocks.push({ type: 'pageBreak' });

    if (/^h[1-6]$/.test(tag)) {
      const inl: Inline[] = [];
      el.childNodes.forEach((c) => inlines(c, applyStyle(state, el), inl));
      const cls = el.getAttribute('class') ?? '';
      let role: HeadingRole | undefined;
      if (/(^|\s)(title|book-?title)(\s|$)/i.test(cls)) role = 'title';
      else if (/(^|\s)subtitle(\s|$)/i.test(cls)) role = 'subtitle';
      const tidy = tidyInlines(inl);
      if (tidy.length) blocks.push({ type: 'heading', level: Number(tag[1]), inl: tidy, align: alignFrom(st, el), role });
      return;
    }
    if (tag === 'hr') {
      blocks.push({ type: 'sceneBreak' });
      return;
    }
    if (tag === 'ul' || tag === 'ol') {
      const items: Inline[][] = [];
      el.querySelectorAll(':scope > li').forEach((li) => {
        if (bodies.has(li)) return;
        const inl: Inline[] = [];
        li.childNodes.forEach((c) => {
          if (c.nodeType === 1 && ['ul', 'ol'].includes((c as Element).tagName.toLowerCase())) return;
          inlines(c, state, inl);
        });
        items.push(tidyInlines(inl));
        li.querySelectorAll(':scope > ul, :scope > ol').forEach((sub) => {
          sub.querySelectorAll('li').forEach((sli) => {
            const sinl: Inline[] = [];
            sli.childNodes.forEach((c) => {
              if (c.nodeType === 1 && ['ul', 'ol'].includes((c as Element).tagName.toLowerCase())) return;
              inlines(c, state, sinl);
            });
            items.push(tidyInlines(sinl));
          });
        });
      });
      const kept = items.filter((i) => i.length);
      if (kept.length) blocks.push({ type: 'list', ordered: tag === 'ol', items: kept });
      return;
    }
    if (tag === 'pre') {
      (el.textContent ?? '').split(/\r?\n/).forEach((line) => {
        if (line.trim()) blocks.push({ type: 'para', inl: [{ kind: 'text', text: line }], quote: quote || undefined });
      });
      return;
    }
    const inQuote = quote || tag === 'blockquote';
    const align = alignFrom(st, el);
    const elState = applyStyle(state, el);
    // Mixed content: runs of inline nodes become paragraphs; block children recurse.
    let run: Inline[] = [];
    const flush = () => {
      if (run.length) pushPara(run, el, inQuote, align);
      run = [];
    };
    const hasBlockChild = [...el.childNodes].some(isBlockEl);
    if (!hasBlockChild) {
      el.childNodes.forEach((c) => inlines(c, elState, run));
      if (run.length || el.querySelector('img') || BREAK_CLASS.test(el.getAttribute('class') ?? '')) pushPara(run, el, inQuote, align);
      return;
    }
    el.childNodes.forEach((c) => {
      if (isBlockEl(c)) {
        flush();
        walk(c as Element, inQuote, elState);
      } else inlines(c, elState, run);
    });
    flush();
  };

  const body = doc.body ?? doc.documentElement;
  walk(body, false, { marks: new Set() });
  const title = (doc.querySelector('title')?.textContent ?? '').trim();
  return { blocks, title, images };
}

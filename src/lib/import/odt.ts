/** OpenDocument Text (.odt) — LibreOffice, and a Google Docs download option. */
import JSZip from 'jszip';
import { tidyInlines, SCENE_BREAK_RE, type Align, type Block, type FlatSource, type HeadingRole, type Inline, type Mark } from './blocks';

interface OdtStyle {
  parent?: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  align?: Align;
  heading?: number;
  role?: HeadingRole;
}

function readStyles(doc: Document, into: Map<string, OdtStyle>) {
  for (const el of [...doc.getElementsByTagName('style:style')]) {
    const name = el.getAttribute('style:name');
    if (!name) continue;
    const s: OdtStyle = { parent: el.getAttribute('style:parent-style-name') ?? undefined };
    const text = el.getElementsByTagName('style:text-properties')[0];
    if (text) {
      const fw = text.getAttribute('fo:font-weight');
      if (fw) s.bold = fw === 'bold' || Number(fw) >= 600;
      const fs = text.getAttribute('fo:font-style');
      if (fs) s.italic = fs === 'italic' || fs === 'oblique';
      const ul = text.getAttribute('style:text-underline-style');
      if (ul) s.underline = ul !== 'none';
      const lt = text.getAttribute('style:text-line-through-style');
      if (lt) s.strike = lt !== 'none';
    }
    const para = el.getElementsByTagName('style:paragraph-properties')[0];
    const ta = para?.getAttribute('fo:text-align');
    if (ta === 'center') s.align = 'center';
    else if (ta === 'end' || ta === 'right') s.align = 'right';
    else if (ta === 'justify') s.align = 'justify';
    const display = (el.getAttribute('style:display-name') ?? name).toLowerCase().replace(/_20_/g, ' ');
    const h = /^heading (\d)$/.exec(display);
    if (h) s.heading = Number(h[1]);
    if (display === 'title') s.role = 'title';
    if (display === 'subtitle') s.role = 'subtitle';
    into.set(name, s);
  }
}

function resolveStyle(styles: Map<string, OdtStyle>, name: string | null): OdtStyle {
  const chain: OdtStyle[] = [];
  let cur = name ?? undefined;
  for (let guard = 0; cur && guard < 10; guard++) {
    const s = styles.get(cur);
    if (!s) break;
    chain.unshift(s);
    cur = s.parent;
  }
  return chain.reduce<OdtStyle>((acc, s) => ({ ...acc, ...Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) }), {});
}

export async function readOdt(data: ArrayBuffer, name: string): Promise<FlatSource> {
  const zip = await JSZip.loadAsync(data);
  const contentXml = await zip.file('content.xml')?.async('text');
  if (!contentXml) throw new Error('This .odt file is damaged (no content.xml).');
  const parse = (t: string) => new DOMParser().parseFromString(t, 'application/xml');
  const content = parse(contentXml);
  const styles = new Map<string, OdtStyle>();
  const stylesXml = await zip.file('styles.xml')?.async('text');
  if (stylesXml) readStyles(parse(stylesXml), styles);
  readStyles(content, styles);
  const metaXml = await zip.file('meta.xml')?.async('text');
  const meta = metaXml ? parse(metaXml) : null;
  const title = meta?.getElementsByTagName('dc:title')[0]?.textContent?.trim() ?? '';
  const author = meta?.getElementsByTagName('meta:initial-creator')[0]?.textContent?.trim() ?? meta?.getElementsByTagName('dc:creator')[0]?.textContent?.trim() ?? '';

  const blocks: Block[] = [];

  const inlines = (node: Node, marks: Set<Mark>, href: string | undefined, out: Inline[]) => {
    if (node.nodeType === 3) {
      if (node.textContent) out.push({ kind: 'text', text: node.textContent, marks: marks.size ? [...marks] : undefined, href });
      return;
    }
    if (node.nodeType !== 1) return;
    const el = node as Element;
    switch (el.tagName) {
      case 'text:s':
        out.push({ kind: 'text', text: ' '.repeat(Number(el.getAttribute('text:c') ?? 1)), marks: marks.size ? [...marks] : undefined });
        return;
      case 'text:tab':
        out.push({ kind: 'text', text: ' ' });
        return;
      case 'text:line-break':
        out.push({ kind: 'break' });
        return;
      case 'text:note': {
        const body = el.getElementsByTagName('text:note-body')[0];
        const text = (body?.textContent ?? '').replace(/\s+/g, ' ').trim();
        if (text) out.push({ kind: 'footnote', text });
        return;
      }
      case 'text:bookmark':
      case 'text:bookmark-start':
      case 'text:bookmark-end':
      case 'office:annotation':
      case 'office:annotation-end':
      case 'draw:frame':
        return;
    }
    let m = marks;
    let h = href;
    if (el.tagName === 'text:span') {
      const s = resolveStyle(styles, el.getAttribute('text:style-name'));
      m = new Set(marks);
      if (s.bold !== undefined) (s.bold ? m.add('bold') : m.delete('bold'));
      if (s.italic !== undefined) (s.italic ? m.add('italic') : m.delete('italic'));
      if (s.underline !== undefined) (s.underline ? m.add('underline') : m.delete('underline'));
      if (s.strike !== undefined) (s.strike ? m.add('strike') : m.delete('strike'));
    }
    if (el.tagName === 'text:a') {
      const link = el.getAttribute('xlink:href') ?? '';
      if (/^(https?:|mailto:)/i.test(link)) h = link;
    }
    el.childNodes.forEach((c) => inlines(c, m, h, out));
  };

  const baseMarks = (s: OdtStyle) => {
    const m = new Set<Mark>();
    if (s.bold) m.add('bold');
    if (s.italic) m.add('italic');
    if (s.underline) m.add('underline');
    if (s.strike) m.add('strike');
    return m;
  };

  const walk = (el: Element) => {
    for (const child of [...el.children]) {
      const tag = child.tagName;
      if (tag === 'text:p' || tag === 'text:h') {
        const s = resolveStyle(styles, child.getAttribute('text:style-name'));
        const inl: Inline[] = [];
        // Headings keep their own weight; don't mark heading text bold.
        const isHeading = tag === 'text:h' || !!s.heading || !!s.role;
        child.childNodes.forEach((c) => inlines(c, isHeading ? new Set() : baseMarks(s), undefined, inl));
        const tidy = tidyInlines(inl);
        const text = tidy.map((i) => (i.kind === 'text' ? i.text : '')).join('').trim();
        if (child.getElementsByTagName('draw:frame').length && !text) continue;
        if (isHeading && text) {
          const level = Number(child.getAttribute('text:outline-level')) || s.heading || 1;
          blocks.push({ type: 'heading', level, inl: tidy, align: s.align, role: s.role });
        } else if (SCENE_BREAK_RE.test(text)) blocks.push({ type: 'sceneBreak' });
        else blocks.push({ type: 'para', inl: tidy, align: s.align });
      } else if (tag === 'text:list') {
        const items: Inline[][] = [];
        for (const p of [...child.getElementsByTagName('text:p')]) {
          const inl: Inline[] = [];
          p.childNodes.forEach((c) => inlines(c, new Set(), undefined, inl));
          items.push(tidyInlines(inl));
        }
        blocks.push({ type: 'list', ordered: false, items });
      } else if (tag === 'text:section' || tag === 'table:table' || tag === 'table:table-row' || tag === 'table:table-cell' || tag === 'table:table-header-rows' || tag === 'text:index-body') {
        if (tag === 'text:index-body') continue; // generated table of contents
        walk(child);
      } else if (tag === 'text:table-of-content') {
        continue;
      }
    }
  };
  const officeText = content.getElementsByTagName('office:text')[0];
  if (officeText) walk(officeText);
  return { kind: 'flat', format: 'odt', name, title, author, warnings: [], blocks };
}

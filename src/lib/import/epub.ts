/**
 * EPUB (Reedsy Studio, Google Docs, Vellum, Atticus… exports). Uses the
 * book's own table of contents to name chapters and spot parts, then reads
 * each chapter file in reading order.
 */
import JSZip from 'jszip';
import { blockText, type Block, type FlatSource } from './blocks';
import { htmlToBlocks } from './html';
import { isPartTitle } from './structure';

interface TocEntry {
  label: string;
  depth: number;
  hasChildren: boolean;
  fragment: string;
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

function resolve(base: string, href: string): string {
  const parts = (base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : '').concat(href).split('/');
  const out: string[] = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p && p !== '.') out.push(p);
  }
  return out.join('/');
}

function xml(text: string): Document {
  return new DOMParser().parseFromString(text, 'application/xml');
}

/** Elements by local name, ignoring namespace prefixes. */
function byName(root: Document | Element, name: string): Element[] {
  return [...root.getElementsByTagName('*')].filter((e) => e.localName === name);
}

export async function readEpub(data: ArrayBuffer, name: string): Promise<FlatSource> {
  const zip = await JSZip.loadAsync(data);
  const file = (path: string) => zip.file(path) ?? zip.file(decodeURIComponent(path));
  const container = await file('META-INF/container.xml')?.async('text');
  if (!container) throw new Error('This EPUB is damaged (no META-INF/container.xml).');
  const opfPath = byName(xml(container), 'rootfile')[0]?.getAttribute('full-path');
  const opfText = opfPath ? await file(opfPath)?.async('text') : null;
  if (!opfPath || !opfText) throw new Error('This EPUB is damaged (no package file).');
  const opf = xml(opfText);

  const title = byName(opf, 'title')[0]?.textContent?.trim() ?? '';
  const author = byName(opf, 'creator')[0]?.textContent?.trim() ?? '';
  const manifest = new Map<string, { href: string; type: string; props: string }>();
  byName(opf, 'item').forEach((it) => {
    manifest.set(it.getAttribute('id') ?? '', {
      href: resolve(opfPath, it.getAttribute('href') ?? ''),
      type: it.getAttribute('media-type') ?? '',
      props: it.getAttribute('properties') ?? '',
    });
  });
  const spineEl = byName(opf, 'spine')[0];
  const spine = byName(opf, 'itemref')
    .filter((r) => r.getAttribute('linear') !== 'no')
    .map((r) => manifest.get(r.getAttribute('idref') ?? ''))
    .filter((x): x is { href: string; type: string; props: string } => !!x);

  // Table of contents: EPUB 3 nav document, or EPUB 2 NCX.
  const toc = new Map<string, TocEntry[]>();
  const addToc = (href: string, e: TocEntry) => {
    const [path, fragment = ''] = href.split('#');
    const list = toc.get(path) ?? [];
    list.push({ ...e, fragment });
    toc.set(path, list);
  };
  const navItem = [...manifest.values()].find((m) => m.props.split(/\s+/).includes('nav'));
  let navPath = '';
  if (navItem) {
    navPath = navItem.href;
    const navText = await file(navItem.href)?.async('text');
    if (navText) {
      const doc = new DOMParser().parseFromString(navText, 'text/html');
      const nav = [...doc.querySelectorAll('nav')].find((n) => /toc/.test(n.getAttribute('epub:type') ?? n.getAttribute('role') ?? '')) ?? doc.querySelector('nav');
      const walk = (ol: Element, depth: number) => {
        ol.querySelectorAll(':scope > li').forEach((li) => {
          const a = li.querySelector(':scope > a, :scope > span > a');
          const sub = li.querySelector(':scope > ol');
          if (a?.getAttribute('href')) addToc(resolve(navItem.href, a.getAttribute('href')!), { label: (a.textContent ?? '').replace(/\s+/g, ' ').trim(), depth, hasChildren: !!sub, fragment: '' });
          if (sub) walk(sub, depth + 1);
        });
      };
      const ol = nav?.querySelector('ol');
      if (ol) walk(ol, 0);
    }
  } else {
    const ncxId = spineEl?.getAttribute('toc');
    const ncx = ncxId ? manifest.get(ncxId) : [...manifest.values()].find((m) => m.type === 'application/x-dtbncx+xml');
    const ncxText = ncx ? await file(ncx.href)?.async('text') : null;
    if (ncx && ncxText) {
      const walk = (parent: Element, depth: number) => {
        [...parent.children].filter((c) => c.localName === 'navPoint').forEach((np) => {
          const label = byName(np, 'text')[0]?.textContent?.trim() ?? '';
          const src = [...np.children].find((c) => c.localName === 'content')?.getAttribute('src');
          const kids = [...np.children].filter((c) => c.localName === 'navPoint');
          if (src) addToc(resolve(ncx.href, src), { label, depth, hasChildren: kids.length > 0, fragment: '' });
          walk(np, depth + 1);
        });
      };
      const navMap = byName(xml(ncxText), 'navMap')[0];
      if (navMap) walk(navMap, 0);
    }
  }

  const blocks: Block[] = [];
  let images = 0;
  for (const item of spine) {
    if (item.href === navPath || !/x?html/.test(item.type)) continue;
    const text = await file(item.href)?.async('text');
    if (!text) continue;
    const res = htmlToBlocks(text);
    images += res.images;
    let doc = res.blocks;
    const entries = toc.get(item.href) ?? [];
    // One contents entry for the whole file: use it as the chapter (or part) heading.
    const entry = entries.length === 1 && !entries[0].fragment ? entries[0] : entries.find((e) => !e.fragment) ?? (entries.length === 1 ? entries[0] : undefined);
    if (entry && entry.label && entry.depth <= 1) {
      const role = (entry.hasChildren && entry.depth === 0) || isPartTitle(entry.label) ? 'part' : 'chapter';
      doc = stripDuplicateTitle(doc, entry.label);
      doc.unshift({ type: 'heading', level: 1, inl: [{ kind: 'text', text: entry.label }], role });
    }
    blocks.push({ type: 'pageBreak' }, ...doc);
  }
  const warnings: string[] = [];
  if (images) warnings.push(`${images} picture${images === 1 ? ' was' : 's were'} left out (covers, ornaments or illustrations).`);
  return { kind: 'flat', format: 'epub', name, title, author, warnings, blocks };
}

/** Removes the heading lines at the top of a chapter file that repeat its contents entry ("1", "Chapter One", "The Storm"). */
function stripDuplicateTitle(blocks: Block[], label: string): Block[] {
  const l = norm(label);
  const out = [...blocks];
  let removed = 0;
  while (out.length && removed < 4) {
    const b = out[0];
    const t = norm(blockText(b));
    if (b.type === 'sceneBreak' || b.type === 'pageBreak' || !t) {
      if (b.type === 'pageBreak' || !t) {
        out.shift();
        continue;
      }
      break;
    }
    if (t.length > 80 || (b.type !== 'heading' && b.type !== 'para')) break;
    const isNumber = /^((chapter|part|book) )?(\d+|[ivxlc]+)$/.test(t) || /^(chapter|part|book) [a-z]+( [a-z]+)?$/.test(t);
    const centered = b.type === 'para' && b.align === 'center';
    if (isNumber || l === t || ((b.type === 'heading' || centered) && (l.includes(t) || t.includes(l)))) {
      out.shift();
      removed++;
      continue;
    }
    break;
  }
  return out;
}

/**
 * Finds the book's structure in a stream of blocks: parts, chapters (from
 * headings or "Chapter 3" lines), scenes (at scene breaks), prologues and
 * epilogues, front and back matter, and a contents page to skip.
 */
import type { SpecialChapter } from '@/types/models';
import { blockText, cleanBlocks, makeNode, wordsIn, type Block, type ImportNode, type ImportSource } from './blocks';

export interface StructureOptions {
  /** How chapters are found. */
  chapters: 'auto' | 'headings' | 'lines' | 'none';
  /** Split chapters into scenes at scene breaks, or keep one scene per chapter. */
  scenes: 'split' | 'keep';
  /** Recognise prologues/epilogues, front & back matter, and skip a contents page. */
  matter: boolean;
}

export const DEFAULT_STRUCTURE: StructureOptions = { chapters: 'auto', scenes: 'split', matter: true };

export interface ImportPlan {
  title: string;
  author: string;
  nodes: ImportNode[];
  warnings: string[];
}

// ── Numbers ───────────────────────────────────────────────────────────────

const UNITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

export function wordsToNumber(s: string): number | null {
  const parts = s.toLowerCase().split(/[\s-]+/).filter((w) => w && w !== 'and');
  if (!parts.length || parts.length > 4) return null;
  let total = 0;
  let current = 0;
  for (const w of parts) {
    const u = UNITS.indexOf(w);
    const t = TENS.indexOf(w);
    if (u >= 0) current += u;
    else if (t >= 2) current += t * 10;
    else if (w === 'hundred') current = (current || 1) * 100;
    else return null;
  }
  total += current;
  return total > 0 ? total : null;
}

export function romanToNumber(s: string): number | null {
  if (!/^[ivxlcdm]+$/i.test(s)) return null;
  const v: Record<string, number> = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  const chars = s.toLowerCase();
  let total = 0;
  for (let k = 0; k < chars.length; k++) {
    const cur = v[chars[k]];
    const nxt = v[chars[k + 1]] ?? 0;
    total += cur < nxt ? -cur : cur;
  }
  return total > 0 && total < 4000 ? total : null;
}

/** "12: The Storm" → { n: 12, rest: "The Storm" }; "Twenty-One" → { n: 21, rest: "" }. */
export function splitNumberPrefix(s: string): { n: number; rest: string } | null {
  const strip = (r: string) => r.replace(/^[\s:.\-–—|]+/, '').trim();
  let m = /^(\d{1,4})(?![\w])(.*)$/.exec(s);
  if (m) return { n: Number(m[1]), rest: strip(m[2]) };
  m = /^([ivxlcdm]{1,8})(?![\w])(.*)$/i.exec(s);
  if (m && romanToNumber(m[1])) return { n: romanToNumber(m[1])!, rest: strip(m[2]) };
  const words = s.split(/\s+/);
  for (let take = Math.min(3, words.length); take >= 1; take--) {
    const head = words.slice(0, take).join(' ').replace(/[:.\-–—]+$/, '');
    const n = wordsToNumber(head);
    if (n) return { n, rest: strip(s.slice(words.slice(0, take).join(' ').length)) };
  }
  return null;
}

// ── Title recognition ─────────────────────────────────────────────────────

const SPECIALS: Record<string, { kind: SpecialChapter; label: string }> = {
  prologue: { kind: 'prologue', label: 'Prologue' },
  epilogue: { kind: 'epilogue', label: 'Epilogue' },
  interlude: { kind: 'interlude', label: 'Interlude' },
  foreword: { kind: 'foreword', label: 'Foreword' },
  introduction: { kind: 'introduction', label: 'Introduction' },
  afterword: { kind: 'afterword', label: 'Afterword' },
  preface: { kind: 'custom', label: 'Preface' },
  coda: { kind: 'custom', label: 'Coda' },
};
const SPECIAL_RE = /^(prologue|epilogue|interlude|foreword|introduction|afterword|preface|coda)(?:\s*[:.\-–—]\s*(.*))?$/i;
const TOC_RE = /^(table of )?contents:?$/i;
const MATTER_RE =
  /^(title page|half[- ]title( page)?|copyright( page)?|dedication|epigraph|also by\b.*|praise for\b.*|acknowledge?ments?|about the authors?|about the book|author'?s note|a note from the author|note from the author|glossary|appendix\b.*|bibliography|endnotes|notes|further reading|reading group guide|book club questions|discussion questions|credits|colophon|other books by\b.*|books by\b.*|by the same author)$/i;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

export function isPartTitle(text: string): boolean {
  const m = /^(?:part|book)\s+(.+)$/i.exec(clean(text));
  return !!m && !!splitNumberPrefix(m[1]);
}

/** A short line that starts a chapter: "Chapter 3", "CHAPTER TWELVE: Fire", "IV", "12.", "Prologue". */
export function isChapterLine(text: string, matter: boolean): boolean {
  const t = clean(text);
  if (!t || t.length > 80) return false;
  const m = /^(?:chapter|chap\.?|ch\.)\s+(.+)$/i.exec(t);
  if (m) return !!splitNumberPrefix(m[1]);
  if (/^\d{1,3}\.?$/.test(t) || /^[IVXLC]{1,7}\.?$/.test(t)) return true;
  if (SPECIAL_RE.test(t)) return true;
  if (matter && (MATTER_RE.test(t) || TOC_RE.test(t))) return true;
  return false;
}

/** A heading with no name of its own ("Chapter 3", "IV", "Prologue", "Part One"), often followed by a title line. */
function isBareHeading(text: string): boolean {
  const t = clean(text);
  const m = /^(?:chapter|chap\.?|ch\.|part|book)\s+(.+)$/i.exec(t);
  if (m) {
    const sp = splitNumberPrefix(m[1]);
    return !!sp && !sp.rest;
  }
  if (/^(prologue|epilogue|interlude|foreword|introduction|afterword|preface|coda)$/i.test(t)) return true;
  return /^\d{1,3}\.?$/.test(t) || /^[IVXLC]{1,7}\.?$/.test(t);
}

/** "THE TIDE RETURNS THINGS" → "The Tide Returns Things" (titles typed in capitals). */
export function niceCase(text: string): string {
  if (!/[A-Z]/.test(text) || /[a-z]/.test(text) || text.length < 4 || /^[IVXLCDM]+\.?$/.test(text)) return text;
  const small = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'with']);
  return text
    .toLowerCase()
    .split(' ')
    .map((w, i) => (i > 0 && small.has(w) ? w : w.replace(/^(\W*)(\p{L})/u, (_m, pre: string, c: string) => pre + c.toUpperCase())))
    .join(' ');
}

interface TitleInfo {
  kind: 'chapter' | 'matter' | 'toc';
  title: string;
  special: SpecialChapter | null;
  specialLabel: string;
}

export function classifyTitle(raw: string, matter: boolean): TitleInfo {
  const t = niceCase(clean(raw).replace(/[.:]$/, ''));
  const base: TitleInfo = { kind: 'chapter', title: t, special: null, specialLabel: '' };
  if (matter && TOC_RE.test(t)) return { ...base, kind: 'toc' };
  if (matter && MATTER_RE.test(t)) return { ...base, kind: 'matter' };
  const sp = matter ? SPECIAL_RE.exec(t) : null;
  if (sp) {
    const info = SPECIALS[sp[1].toLowerCase()];
    return { kind: 'chapter', title: sp[2]?.trim() || info.label, special: info.kind, specialLabel: info.kind === 'custom' ? info.label : '' };
  }
  return { ...base, title: chapterTitle(t) };
}

/** "Chapter Three: The Storm" → "The Storm"; "Chapter Three" → "Chapter 3" (numbered on compile). */
export function chapterTitle(raw: string): string {
  const t = clean(raw);
  const m = /^(?:chapter|chap\.?|ch\.)\s+(.+)$/i.exec(t);
  if (m) {
    const sp = splitNumberPrefix(m[1]);
    if (sp) return sp.rest || `Chapter ${sp.n}`;
    return t;
  }
  const pure = /^(\d{1,3}|[IVXLCDM]{1,7})\.?$/.exec(t);
  if (pure) return `Chapter ${/^\d/.test(pure[1]) ? Number(pure[1]) : romanToNumber(pure[1])}`;
  const numbered = /^(\d{1,3}|[IVXLCDM]{1,7})\s*[.:\-–—]\s+(.+)$/.exec(t);
  if (numbered) return numbered[2];
  return t;
}

export function partTitle(raw: string): string {
  const t = niceCase(clean(raw));
  const m = /^(?:part|book)\s+(.+)$/i.exec(t);
  const sp = m ? splitNumberPrefix(m[1]) : null;
  if (!sp) return t;
  return sp.rest ? `Part ${sp.n}: ${sp.rest}` : `Part ${sp.n}`;
}

// ── Planning ──────────────────────────────────────────────────────────────

type Role = 'part' | 'chapter' | 'scene';
interface Section {
  role: Role | 'pre';
  title: string;
  blocks: Block[];
}

/** Splits text at scene breaks (or keeps the breaks inside one scene). */
function scenePieces(blocks: Block[], mode: StructureOptions['scenes']): Block[][] {
  const cleaned = cleanBlocks(blocks);
  if (mode === 'keep') return cleaned.length ? [cleaned] : [];
  const pieces: Block[][] = [[]];
  for (const b of cleaned) {
    if (b.type === 'sceneBreak') pieces.push([]);
    else pieces[pieces.length - 1].push(b);
  }
  return pieces.filter((p) => p.length);
}

export function planImport(src: ImportSource, opts: StructureOptions = DEFAULT_STRUCTURE): ImportPlan {
  if (src.kind === 'tree') return { title: src.title, author: src.author, nodes: src.nodes, warnings: [...src.warnings] };

  const warnings = [...src.warnings];
  let title = src.title;
  const blocks = src.blocks.filter((b) => b.type !== 'pageBreak');
  const text = (b: Block) => clean(blockText(b));
  const firstContent = blocks.findIndex((b) => text(b) !== '');

  // Which headings are chapters?
  const hasRoles = blocks.some((b) => b.type === 'heading' && (b.role === 'chapter' || b.role === 'part'));
  let chapterLevel: number | null = null;
  let titleIndex = -1;
  if (!hasRoles && (opts.chapters === 'auto' || opts.chapters === 'headings')) {
    const heads = blocks
      .map((b, i) => ({ b, i }))
      .filter((x): x is { b: Extract<Block, { type: 'heading' }>; i: number } => x.b.type === 'heading' && !x.b.role && !isPartTitle(text(x.b)));
    if (heads.length) {
      let min = Math.min(...heads.map((h) => h.b.level));
      const atMin = heads.filter((h) => h.b.level === min);
      const deeper = heads.filter((h) => h.b.level > min);
      // A single top-level heading at the very start is the book's title.
      if (atMin.length === 1 && deeper.length && atMin[0].i === firstContent) {
        titleIndex = atMin[0].i;
        min = Math.min(...deeper.map((h) => h.b.level));
      }
      chapterLevel = min;
    }
  }
  const useLines = opts.chapters === 'lines' || (opts.chapters === 'auto' && chapterLevel === null && !hasRoles);

  const roleOf = (b: Block, seenChapter: boolean): Role | 'title' | null => {
    if (b.type === 'heading' && (b.role === 'title' || b.role === 'subtitle')) return seenChapter ? null : 'title';
    if (opts.chapters === 'none') return null;
    const t = text(b);
    if (!t) return null;
    if (hasRoles) return b.type === 'heading' && (b.role === 'chapter' || b.role === 'part') ? b.role : null;
    if (b.type === 'heading' && opts.chapters !== 'lines') {
      if (isPartTitle(t)) return 'part';
      if (b.level === chapterLevel) return 'chapter';
      if (chapterLevel !== null && b.level === chapterLevel + 1) return 'scene';
      return null;
    }
    if (useLines && (b.type === 'para' || b.type === 'heading')) {
      if (isPartTitle(t)) return 'part';
      if (isChapterLine(t, opts.matter)) return 'chapter';
    }
    return null;
  };

  /** Could this block be the name under a bare "Chapter 3" / "Prologue" / "Part One" heading? */
  const isTitleLine = (b: Block | undefined): boolean => {
    if (!b || (b.type !== 'heading' && b.type !== 'para')) return false;
    if (b.type === 'heading' && b.role && b.role !== 'subtitle') return false; // the next chapter from a table of contents
    const t = text(b);
    if (!t || t.length > 80 || isChapterLine(t, opts.matter) || isPartTitle(t)) return false;
    if (b.type === 'heading' || b.align === 'center') return !/[.,;]$/.test(t);
    // An unstyled line (Word without heading styles, plain text): short, capitalised, no sentence punctuation.
    return t.length <= 60 && /^[\p{Lu}\d"“'‘]/u.test(t) && !/[.!?,;:…"”’)]$/.test(t);
  };

  // Cut the stream into sections.
  const sections: Section[] = [{ role: 'pre', title: '', blocks: [] }];
  let seenChapter = false;
  let seenPart = false;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (i === titleIndex) {
      title ||= text(b);
      continue;
    }
    let role = roleOf(b, seenChapter);
    if (role === 'title') {
      if (b.type === 'heading' && b.role === 'title') title ||= text(b);
      continue;
    }
    // Sub-headings before the first chapter (a subtitle, "Contents") belong to the opening pages.
    if (role === 'scene' && !seenChapter && !seenPart) role = null;
    if (!role) {
      // An unstyled "Chapter 1" line right above a chapter heading: one heading, "Chapter 1: The Letter".
      if (b.type === 'para' && isBareHeading(text(b)) && !SPECIAL_RE.test(text(b))) {
        let j = i + 1;
        while (j < blocks.length && !text(blocks[j]) && blocks[j].type !== 'sceneBreak') j++;
        const nb = blocks[j];
        if (nb && roleOf(nb, seenChapter) === 'chapter' && !isBareHeading(text(nb))) {
          seenChapter = true;
          sections.push({ role: 'chapter', title: `${text(b)}: ${text(nb)}`, blocks: [] });
          i = j;
          continue;
        }
      }
      sections[sections.length - 1].blocks.push(b);
      continue;
    }
    let heading = text(b);
    // "Chapter 3" / "Prologue" / "Part One" followed by its name: "Chapter 3: The Storm".
    if ((role === 'chapter' || role === 'part') && isBareHeading(heading)) {
      let j = i + 1;
      while (j < blocks.length && !text(blocks[j]) && blocks[j].type !== 'sceneBreak') j++;
      if (isTitleLine(blocks[j])) {
        heading = `${heading}: ${niceCase(text(blocks[j]))}`;
        i = j;
      }
    }
    if (role === 'chapter') seenChapter = true;
    if (role === 'part') seenPart = true;
    sections.push({ role, title: heading, blocks: [] });
  }
  const key = (t: string) => clean(t).toLowerCase();
  const laterTitles = sections.map((_, idx) => new Set(sections.slice(idx + 1).map((x) => key(x.title))));

  // Build the binder tree.
  const nodes: ImportNode[] = [];
  let part: ImportNode | null = null;
  let chapter: ImportNode | null = null;
  let matterNode: ImportNode | null = null;
  let skipping = false;
  let anyChapter = false;
  let tocSkipped = false;

  const addScenes = (parent: ImportNode[], blocksIn: Block[], sceneTitle: string | null) => {
    const pieces = scenePieces(blocksIn, opts.scenes);
    pieces.forEach((piece, k) => {
      const count = parent.filter((n) => n.kind === 'scene').length;
      const name = sceneTitle ? (k === 0 ? sceneTitle : `${sceneTitle} (${k + 1})`) : `Scene ${count + 1}`;
      parent.push(makeNode('scene', name, piece));
    });
  };

  let inToc = false;
  for (let idx = 1; idx < sections.length; idx++) {
    const sec = sections[idx];
    // A contents page written as plain lines: each entry looks like a heading with nothing under it, and repeats later.
    if (inToc && sec.role !== 'scene') {
      if (wordsIn(sec.blocks) === 0 && laterTitles[idx].has(key(sec.title))) continue;
      inToc = false;
    }
    if (sec.role === 'part') {
      part = makeNode('part', partTitle(sec.title), cleanBlocks(sec.blocks));
      nodes.push(part);
      chapter = null;
      matterNode = null;
      skipping = false;
      continue;
    }
    if (sec.role === 'chapter') {
      const info = classifyTitle(sec.title, opts.matter);
      chapter = null;
      matterNode = null;
      skipping = false;
      if (info.kind === 'toc') {
        skipping = true;
        tocSkipped = true;
        inToc = true;
        continue;
      }
      if (info.kind === 'matter') {
        matterNode = makeNode(anyChapter ? 'backmatter' : 'frontmatter', info.title, cleanBlocks(sec.blocks));
        nodes.push(matterNode);
        continue;
      }
      anyChapter = true;
      chapter = makeNode('chapter', info.title, [], { special: info.special, specialLabel: info.specialLabel });
      (info.special === 'epilogue' || info.special === 'afterword' || !part ? nodes : part.children).push(chapter);
      addScenes(chapter.children, sec.blocks, null);
      continue;
    }
    // Scene title heading.
    if (skipping) continue;
    if (matterNode) {
      matterNode.blocks.push({ type: 'heading', level: 3, inl: [{ kind: 'text', text: sec.title }] }, ...cleanBlocks(sec.blocks));
      continue;
    }
    addScenes(chapter ? chapter.children : part ? part.children : nodes, sec.blocks, sec.title);
  }

  // Whatever came before the first chapter.
  let pre = cleanBlocks(sections[0].blocks);
  if (!anyChapter && !part && !nodes.some((n) => n.kind === 'scene')) {
    const body: ImportNode[] = [];
    addScenes(body, pre, null);
    nodes.unshift(...body);
  } else if (pre.length) {
    if (opts.matter) {
      const toc = pre.findIndex((b) => TOC_RE.test(text(b)));
      if (toc >= 0) {
        let end = toc + 1;
        // Entries are short lines, or dot-leader lines ("Chapter One ........ 7") that a PDF may run together.
        const isEntry = (b: Block) => b.type !== 'sceneBreak' && (text(b).length < 90 || /(?:\.\s?){4,}|…{2,}/.test(text(b)));
        while (end < pre.length && isEntry(pre[end])) end++;
        pre = [...pre.slice(0, toc), ...pre.slice(end)];
        tocSkipped = true;
      }
    }
    const words = wordsIn(pre);
    const shortLines = pre.every((b) => text(b).length < 90);
    if (opts.matter && pre.length <= 6 && shortLines && words <= 40) {
      const first = pre.find((b) => text(b));
      if (!title && first && text(first).length <= 80 && !/^(by|copyright|©)\b/i.test(text(first))) title = niceCase(text(first));
      warnings.push('Skipped the title page at the start (Inkwell builds its own when you export).');
    } else if (words > 400) {
      const opening = makeNode('chapter', 'Opening', []);
      addScenes(opening.children, pre, null);
      nodes.unshift(opening);
    } else if (pre.length) {
      nodes.unshift(makeNode('frontmatter', 'Opening pages', pre));
    }
  }
  if (tocSkipped) warnings.push('Skipped the table of contents (Inkwell makes a new one when you export).');
  return { title, author: src.author, nodes, warnings };
}

/** Counts for the preview summary. */
export function planStats(nodes: ImportNode[]): { parts: number; chapters: number; scenes: number; other: number; words: number } {
  const s = { parts: 0, chapters: 0, scenes: 0, other: 0, words: 0 };
  const walk = (list: ImportNode[]) => {
    for (const n of list) {
      if (!n.include) continue;
      if (n.kind === 'part') s.parts++;
      else if (n.kind === 'chapter') s.chapters++;
      else if (n.kind === 'scene') s.scenes++;
      else s.other++;
      s.words += wordsIn(n.blocks);
      walk(n.children);
    }
  };
  walk(nodes);
  return s;
}

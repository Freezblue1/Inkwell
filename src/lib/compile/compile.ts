/**
 * The compiler: turns the binder (filtered by an export profile) into a
 * CompiledBook — front matter, chapters (scenes joined by scene breaks) and
 * back matter — independent of any output format.
 */
import type { JSONContent } from '@tiptap/core';
import type { ExportProfile, ID, InkDocument, Project } from '@/types/models';
import { childrenOf, groupRoots, depthFirst } from '../tree';
import { jsonToBlocks, numberToWords, type Block } from './blocks';
import { countWords } from '../wordCount';
import { runsToPlain } from './blocks';
import { specialLabel } from '../specialChapters';

export type SectionKind = 'front' | 'part' | 'chapter' | 'back';

export interface CompiledSection {
  id: string;
  kind: SectionKind;
  /** Main heading text ("Chapter One", "Part Two", or the title). */
  heading: string;
  /** Secondary heading (the chapter title under "Chapter One"), if any. */
  subheading: string;
  /** Title for tables of contents. */
  tocTitle: string;
  blocks: Block[];
  /** Footnote texts in order; references in blocks are 1-based. */
  notes: string[];
}

export interface CompiledBook {
  title: string;
  subtitle: string;
  author: string;
  surname: string;
  profile: ExportProfile;
  sections: CompiledSection[];
  wordCount: number;
}

/** Should this manuscript document be included according to the profile filters? */
export function isIncluded(doc: InkDocument, profile: ExportProfile): boolean {
  if (profile.excludedDocIds.includes(doc.id)) return false;
  if (doc.type === 'scene' || (doc.type === 'chapter' && doc.wordCount > 0)) {
    if (profile.includeStatuses.length && !profile.includeStatuses.includes(doc.status)) return false;
    if (profile.includeLabels.length && (!doc.label || !profile.includeLabels.includes(doc.label))) return false;
  }
  return true;
}

/** Front/back matter selected for compile (empty selection = all, minus a duplicate title page). */
export function selectedMatter(docs: Record<ID, InkDocument>, group: 'frontmatter' | 'backmatter', profile: ExportProfile): InkDocument[] {
  const all = depthFirst(docs, groupRoots(docs, group));
  const ids = group === 'frontmatter' ? profile.includeFrontMatter : profile.includeBackMatter;
  if (ids.length) return all.filter((d) => ids.includes(d.id));
  return all.filter((d) => !(group === 'frontmatter' && profile.titlePage && /^title page$/i.test(d.title.trim())));
}

function chapterHeading(n: number, title: string, style: ExportProfile['chapterHeadingStyle']): { heading: string; subheading: string } {
  switch (style) {
    case 'number':
      return { heading: `Chapter ${numberToWords(n)}`, subheading: '' };
    case 'title':
      return { heading: title, subheading: '' };
    case 'ornamental':
      return { heading: `❦ ${n} ❦`, subheading: title };
    default:
      return { heading: `Chapter ${numberToWords(n)}`, subheading: title };
  }
}

const isDefaultTitle = (t: string) => /^(chapter|scene|part)\s+\d+$/i.test(t.trim());

/**
 * Compiles a project. `contents` maps doc id → TipTap JSON (load with
 * getContents for the ids returned by collectCompileIds).
 */
export function compileBook(project: Project, docs: Record<ID, InkDocument>, contents: Map<ID, JSONContent>, profile: ExportProfile): CompiledBook {
  const sections: CompiledSection[] = [];
  const opts = { includeComments: profile.includeComments };

  for (const d of selectedMatter(docs, 'frontmatter', profile)) {
    const notes: string[] = [];
    sections.push({ id: d.id, kind: 'front', heading: d.title, subheading: '', tocTitle: d.title, blocks: jsonToBlocks(contents.get(d.id), notes, opts), notes });
  }

  let chapterNo = 0;
  let partNo = 0;
  let loose: CompiledSection | null = null;

  const visitChapter = (ch: InkDocument) => {
    const special = specialLabel(ch);
    if (!special) chapterNo++;
    const notes: string[] = [];
    const blocks: Block[] = [];
    if (isIncluded(ch, profile)) blocks.push(...jsonToBlocks(contents.get(ch.id), notes, opts));
    const scenes = depthFirst(docs, childrenOf(docs, ch.id)).filter((s) => isIncluded(s, profile));
    scenes.forEach((s) => {
      const b = jsonToBlocks(contents.get(s.id), notes, opts);
      if (!b.length) return;
      if (blocks.length && blocks[blocks.length - 1].type !== 'break') blocks.push({ type: 'break' });
      blocks.push(...b);
    });
    if (!blocks.length && !scenes.length && !isIncluded(ch, profile)) {
      if (!special) chapterNo--;
      return;
    }
    // Special chapters are unnumbered: "Prologue", with the title underneath unless it repeats the label.
    const h = special
      ? { heading: special, subheading: ch.title.trim().toLowerCase() === special.toLowerCase() ? '' : ch.title }
      : chapterHeading(chapterNo, ch.title, profile.chapterHeadingStyle);
    if (!special && profile.chapterHeadingStyle !== 'title' && isDefaultTitle(ch.title)) h.subheading = '';
    sections.push({ id: ch.id, kind: 'chapter', heading: h.heading, subheading: h.subheading, tocTitle: h.subheading ? `${h.heading}: ${h.subheading}` : h.heading, blocks, notes });
  };

  const addLooseScene = (s: InkDocument) => {
    if (!isIncluded(s, profile)) return;
    if (!loose) {
      loose = { id: `loose-${s.id}`, kind: 'chapter', heading: '', subheading: '', tocTitle: s.title, blocks: [], notes: [] };
      sections.push(loose);
    }
    const b = jsonToBlocks(contents.get(s.id), loose.notes, opts);
    if (!b.length) return;
    if (loose.blocks.length) loose.blocks.push({ type: 'break' });
    loose.blocks.push(...b);
  };

  const visit = (d: InkDocument) => {
    if (profile.excludedDocIds.includes(d.id)) return;
    if (d.type === 'part') {
      loose = null;
      partNo++;
      const notes: string[] = [];
      const title = isDefaultTitle(d.title) ? '' : d.title.replace(/^part\s+\w+\s*[:—-]\s*/i, '');
      sections.push({ id: d.id, kind: 'part', heading: `Part ${numberToWords(partNo)}`, subheading: title, tocTitle: title ? `Part ${numberToWords(partNo)}: ${title}` : `Part ${numberToWords(partNo)}`, blocks: jsonToBlocks(contents.get(d.id), notes, opts), notes });
      childrenOf(docs, d.id).forEach(visit);
    } else if (d.type === 'chapter') {
      loose = null;
      visitChapter(d);
    } else if (d.type === 'scene') {
      addLooseScene(d);
    }
  };
  groupRoots(docs, 'manuscript').forEach(visit);

  for (const d of selectedMatter(docs, 'backmatter', profile)) {
    const notes: string[] = [];
    sections.push({ id: d.id, kind: 'back', heading: d.title, subheading: '', tocTitle: d.title, blocks: jsonToBlocks(contents.get(d.id), notes, opts), notes });
  }

  const wordCount = sections
    .filter((s) => s.kind === 'chapter' || s.kind === 'part')
    .reduce((n, s) => n + s.blocks.reduce((m, b) => m + (b.type === 'paragraph' || b.type === 'quote' || b.type === 'heading' ? countWords(runsToPlain(b.runs)) : b.type === 'list' ? b.items.reduce((k, it) => k + countWords(runsToPlain(it)), 0) : 0), 0), 0);

  return {
    title: project.title,
    subtitle: project.subtitle,
    author: profile.authorName || project.author,
    surname: profile.authorSurname || (profile.authorName || project.author).trim().split(/\s+/).pop() || '',
    profile,
    sections,
    wordCount,
  };
}

/** Ids whose content the compiler needs. */
export function collectCompileIds(docs: Record<ID, InkDocument>): ID[] {
  return Object.values(docs)
    .filter((d) => !d.trashed && d.type !== 'research' && d.type !== 'note')
    .map((d) => d.id);
}

/** Rounds a word count the way agents expect on manuscript title pages. */
export function approxWordCount(n: number): string {
  if (n < 1000) return `${Math.round(n / 100) * 100 || n} words`;
  if (n < 10000) return `about ${(Math.round(n / 500) * 500).toLocaleString()} words`;
  return `about ${(Math.round(n / 1000) * 1000).toLocaleString()} words`;
}

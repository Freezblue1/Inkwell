import { describe, expect, it } from 'vitest';
import type { JSONContent } from '@tiptap/core';
import type { ID, InkDocument } from '@/types/models';
import { makeDocument, makeExportProfile, makeProject } from '../defaults';
import { paragraphsToDoc } from '../text';
import { compileBook } from './compile';
import { jsonToBlocks, numberToWords } from './blocks';
import { toMarkdown, toPlainText } from '../export/markdown';
import { aggregateWordCounts, flattenTree, groupRoots, manuscriptSequence, sceneSequence } from '../tree';

function fixture() {
  const project = makeProject({ title: 'Test Book', author: 'Ada Writer', kind: 'novel' });
  const docs: Record<ID, InkDocument> = {};
  const contents = new Map<ID, JSONContent>();
  const add = (type: InkDocument['type'], title: string, parent: InkDocument | null, paras?: string[], extra: Partial<InkDocument> = {}) => {
    const order = Object.values(docs).filter((d) => d.parentId === (parent?.id ?? null)).length;
    const d = makeDocument(project.id, type, title, parent?.id ?? null, order, extra);
    docs[d.id] = d;
    if (paras) {
      contents.set(d.id, paragraphsToDoc(paras));
      d.wordCount = paras.join(' ').split(/\s+/).filter((w) => /\w/.test(w)).length;
    }
    return d;
  };
  add('frontmatter', 'Title Page', null, ['Test Book']);
  add('frontmatter', 'Epigraph', null, ['*All is well.*']);
  const part = add('part', 'Part One', null);
  const ch1 = add('chapter', 'The Start', part);
  add('scene', 'Scene A', ch1, ['First *scene* text.'], { status: 'Final' });
  add('scene', 'Scene B', ch1, ['Second scene.'], { status: 'Draft' });
  const ch2 = add('chapter', 'Chapter 2', part);
  add('scene', 'Scene C', ch2, ['Third scene with a note.'], { status: 'Idea' });
  add('backmatter', 'Thanks', null, ['Thank you.']);
  return { project, docs, contents, ch1 };
}

describe('tree helpers', () => {
  it('orders the manuscript depth-first and aggregates counts', () => {
    const { docs, ch1 } = fixture();
    expect(manuscriptSequence(docs).map((d) => d.title)).toEqual(['Part One', 'The Start', 'Scene A', 'Scene B', 'Chapter 2', 'Scene C']);
    expect(sceneSequence(docs)).toHaveLength(3);
    expect(aggregateWordCounts(docs).get(ch1.id)).toBe(5);
    expect(groupRoots(docs, 'frontmatter')).toHaveLength(2);
    const flat = flattenTree(docs, groupRoots(docs, 'manuscript'), { [ch1.id]: true });
    expect(flat.map((f) => f.doc.title)).toEqual(['Part One', 'The Start', 'Chapter 2', 'Scene C']);
  });
});

describe('compileBook', () => {
  it('builds front matter, parts, chapters with scene breaks, and back matter', () => {
    const { project, docs, contents } = fixture();
    const profile = makeExportProfile(project.id, 'Ada Writer');
    const book = compileBook(project, docs, contents, profile);
    const kinds = book.sections.map((s) => s.kind);
    expect(kinds).toEqual(['front', 'part', 'chapter', 'chapter', 'back']);
    // The "Title Page" document is skipped because a title page is generated.
    expect(book.sections[0].heading).toBe('Epigraph');
    const ch1 = book.sections[2];
    expect(ch1.heading).toBe('Chapter One');
    expect(ch1.subheading).toBe('The Start');
    expect(ch1.blocks.map((b) => b.type)).toEqual(['paragraph', 'break', 'paragraph']);
    // Default titles like "Chapter 2" don't repeat as subheadings.
    expect(book.sections[3].subheading).toBe('');
    // 3 + 2 + 5 words across the three scenes.
    expect(book.wordCount).toBe(10);
  });

  it('compiles special chapters unnumbered without breaking numbering', () => {
    const { project, docs, contents } = fixture();
    // A prologue before Part One and an epilogue at the end.
    const pro = makeDocument(project.id, 'chapter', 'Prologue', null, -1, { metadata: { special: 'prologue' } as InkDocument['metadata'] });
    const epi = makeDocument(project.id, 'chapter', 'Afterwards', null, 99, { metadata: { special: 'epilogue' } as InkDocument['metadata'] });
    const coda = makeDocument(project.id, 'chapter', 'The Sea', null, 100, { metadata: { special: 'custom', specialLabel: 'Coda' } as InkDocument['metadata'] });
    [pro, epi, coda].forEach((d) => {
      docs[d.id] = d;
      contents.set(d.id, paragraphsToDoc(['Some words here.']));
    });
    const book = compileBook(project, docs, contents, makeExportProfile(project.id));
    const chapters = book.sections.filter((s) => s.kind === 'chapter');
    expect(chapters.map((c) => c.heading)).toEqual(['Prologue', 'Chapter One', 'Chapter Two', 'Epilogue', 'Coda']);
    // Title equal to the label isn't repeated; a distinct title becomes the subheading.
    expect(chapters[0].subheading).toBe('');
    expect(chapters[3].subheading).toBe('Afterwards');
    expect(chapters[3].tocTitle).toBe('Epilogue: Afterwards');
  });

  it('filters by status and excluded documents', () => {
    const { project, docs, contents } = fixture();
    const profile = { ...makeExportProfile(project.id), includeStatuses: ['Final', 'Draft'] };
    const book = compileBook(project, docs, contents, profile);
    const chapters = book.sections.filter((s) => s.kind === 'chapter');
    expect(chapters[0].blocks.filter((b) => b.type === 'paragraph')).toHaveLength(2);
    expect(chapters[1].blocks).toHaveLength(0);
  });

  it('exports Markdown and plain text', () => {
    const { project, docs, contents } = fixture();
    const book = compileBook(project, docs, contents, makeExportProfile(project.id, 'Ada Writer'));
    const md = toMarkdown(book);
    expect(md).toContain('# Test Book');
    expect(md).toContain('## Chapter One');
    expect(md).toContain('First *scene* text.');
    const txt = toPlainText(book);
    expect(txt).toContain('CHAPTER ONE');
    expect(txt).not.toContain('*scene*');
  });
});

describe('blocks', () => {
  it('collects footnotes as numbered references', () => {
    const notes: string[] = [];
    const blocks = jsonToBlocks({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Hi' }, { type: 'footnote', attrs: { text: 'A note' } }] }] }, notes);
    expect(notes).toEqual(['A note']);
    expect(blocks[0]).toMatchObject({ type: 'paragraph', runs: [{ text: 'Hi' }, { footnote: 1 }] });
  });
  it('spells chapter numbers', () => {
    expect(numberToWords(1)).toBe('One');
    expect(numberToWords(21)).toBe('Twenty-One');
    expect(numberToWords(105)).toBe('One Hundred Five');
  });
});

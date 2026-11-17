/**
 * Binder tree helpers. Documents are stored flat (parentId + order); these
 * functions build cached indexes for fast tree traversal.
 */
import type { DocType, ID, InkDocument } from '@/types/models';

export type BinderGroup = 'frontmatter' | 'manuscript' | 'backmatter' | 'notes' | 'research';

export const GROUP_LABELS: Record<BinderGroup, string> = {
  frontmatter: 'Front Matter',
  manuscript: 'Manuscript',
  backmatter: 'Back Matter',
  notes: 'Notes',
  research: 'Research',
};

export function groupOfType(type: DocType): BinderGroup {
  switch (type) {
    case 'frontmatter':
      return 'frontmatter';
    case 'backmatter':
      return 'backmatter';
    case 'note':
      return 'notes';
    case 'research':
      return 'research';
    default:
      return 'manuscript';
  }
}

export function isManuscriptType(type: DocType): boolean {
  return type === 'part' || type === 'chapter' || type === 'scene';
}

/** Whether a document may contain children. */
export function canHaveChildren(doc: Pick<InkDocument, 'type' | 'metadata'>): boolean {
  if (doc.type === 'scene') return false;
  if (doc.type === 'research') return doc.metadata.researchKind === 'folder';
  return true;
}

/** Sensible type for a new child of `parent`. */
export function defaultChildType(parent: Pick<InkDocument, 'type'> | null, group: BinderGroup = 'manuscript'): DocType {
  if (!parent) {
    if (group === 'frontmatter') return 'frontmatter';
    if (group === 'backmatter') return 'backmatter';
    if (group === 'notes') return 'note';
    if (group === 'research') return 'research';
    return 'chapter';
  }
  if (parent.type === 'part') return 'chapter';
  if (parent.type === 'chapter') return 'scene';
  return parent.type;
}

export type ChildIndex = Map<ID | null, InkDocument[]>;

export const byOrder = (a: InkDocument, b: InkDocument) => a.order - b.order || a.createdAt - b.createdAt;

const indexCache = new WeakMap<object, ChildIndex>();

/** Map of parentId → sorted, non-trashed children. Cached per docs object. */
export function getChildIndex(docs: Record<ID, InkDocument>): ChildIndex {
  const cached = indexCache.get(docs);
  if (cached) return cached;
  const index: ChildIndex = new Map();
  for (const d of Object.values(docs)) {
    if (d.trashed) continue;
    // Orphans (parent deleted or trashed) are shown at the root.
    const parent = d.parentId ? docs[d.parentId] : null;
    const key = parent && !parent.trashed ? d.parentId : null;
    const list = index.get(key);
    if (list) list.push(d);
    else index.set(key, [d]);
  }
  for (const list of index.values()) list.sort(byOrder);
  indexCache.set(docs, index);
  return index;
}

export function childrenOf(docs: Record<ID, InkDocument>, parentId: ID | null): InkDocument[] {
  return getChildIndex(docs).get(parentId) ?? [];
}

/** Root documents belonging to a binder group. */
export function groupRoots(docs: Record<ID, InkDocument>, group: BinderGroup): InkDocument[] {
  return childrenOf(docs, null).filter((d) => groupOfType(d.type) === group);
}

/** Depth-first list of all non-trashed descendants of the given roots. */
export function depthFirst(docs: Record<ID, InkDocument>, roots: InkDocument[]): InkDocument[] {
  const out: InkDocument[] = [];
  const index = getChildIndex(docs);
  const visit = (d: InkDocument) => {
    out.push(d);
    (index.get(d.id) ?? []).forEach(visit);
  };
  roots.forEach(visit);
  return out;
}

const seqCache = new WeakMap<object, InkDocument[]>();

/** All manuscript documents in reading order (parts, chapters, scenes). */
export function manuscriptSequence(docs: Record<ID, InkDocument>): InkDocument[] {
  const cached = seqCache.get(docs);
  if (cached) return cached;
  const seq = depthFirst(docs, groupRoots(docs, 'manuscript'));
  seqCache.set(docs, seq);
  return seq;
}

/** Scenes in reading order — the "cards" of the corkboard/outliner. Chapters without scenes count as cards too. */
export function sceneSequence(docs: Record<ID, InkDocument>): InkDocument[] {
  const index = getChildIndex(docs);
  return manuscriptSequence(docs).filter(
    (d) => d.type === 'scene' || (d.type === 'chapter' && !(index.get(d.id)?.length ?? 0)),
  );
}

/** All descendant ids (including trashed ones), not including the doc itself. */
export function descendantIds(docs: Record<ID, InkDocument>, id: ID): ID[] {
  const byParent = new Map<ID, ID[]>();
  for (const d of Object.values(docs)) {
    if (!d.parentId) continue;
    const l = byParent.get(d.parentId);
    if (l) l.push(d.id);
    else byParent.set(d.parentId, [d.id]);
  }
  const out: ID[] = [];
  const stack = [...(byParent.get(id) ?? [])];
  while (stack.length) {
    const cur = stack.pop()!;
    out.push(cur);
    stack.push(...(byParent.get(cur) ?? []));
  }
  return out;
}

/** Ancestors from the root down to the immediate parent. */
export function ancestors(docs: Record<ID, InkDocument>, id: ID): InkDocument[] {
  const out: InkDocument[] = [];
  let cur = docs[id];
  const seen = new Set<ID>();
  while (cur?.parentId && docs[cur.parentId] && !seen.has(cur.parentId)) {
    seen.add(cur.parentId);
    cur = docs[cur.parentId];
    out.unshift(cur);
  }
  return out;
}

export function nearestAncestorOfType(docs: Record<ID, InkDocument>, id: ID, type: DocType): InkDocument | null {
  const self = docs[id];
  if (self?.type === type) return self;
  const chain = ancestors(docs, id);
  for (let i = chain.length - 1; i >= 0; i--) if (chain[i].type === type) return chain[i];
  return null;
}

/** Root group of a document (follows parents up). */
export function groupOfDoc(docs: Record<ID, InkDocument>, id: ID): BinderGroup {
  const chain = ancestors(docs, id);
  const root = chain[0] ?? docs[id];
  return root ? groupOfType(root.type) : 'manuscript';
}

const totalsCache = new WeakMap<object, Map<ID, number>>();

/** Word count of each document including all descendants. */
export function aggregateWordCounts(docs: Record<ID, InkDocument>): Map<ID, number> {
  const cached = totalsCache.get(docs);
  if (cached) return cached;
  const index = getChildIndex(docs);
  const totals = new Map<ID, number>();
  const sum = (d: InkDocument): number => {
    const known = totals.get(d.id);
    if (known !== undefined) return known;
    let t = d.wordCount;
    for (const c of index.get(d.id) ?? []) t += sum(c);
    totals.set(d.id, t);
    return t;
  };
  for (const d of Object.values(docs)) if (!d.trashed) sum(d);
  totalsCache.set(docs, totals);
  return totals;
}

/** Total words in the manuscript (excludes front/back matter, notes, research, trash). */
export function manuscriptWordCount(docs: Record<ID, InkDocument>): number {
  let total = 0;
  for (const d of manuscriptSequence(docs)) total += d.wordCount;
  return total;
}

/** A flattened row of the binder tree. */
export interface FlatNode {
  id: ID;
  parentId: ID | null;
  depth: number;
  doc: InkDocument;
  hasChildren: boolean;
}

/** Flattens the visible (expanded) part of a subtree. */
export function flattenTree(
  docs: Record<ID, InkDocument>,
  roots: InkDocument[],
  collapsed: Record<ID, boolean>,
  depth = 0,
): FlatNode[] {
  const index = getChildIndex(docs);
  const out: FlatNode[] = [];
  const visit = (d: InkDocument, level: number, parentId: ID | null) => {
    const kids = index.get(d.id) ?? [];
    out.push({ id: d.id, parentId, depth: level, doc: d, hasChildren: kids.length > 0 });
    if (!collapsed[d.id]) kids.forEach((k) => visit(k, level + 1, d.id));
  };
  roots.forEach((r) => visit(r, depth, null));
  return out;
}

/** The next manuscript document after `id` in reading order. */
export function nextInSequence(docs: Record<ID, InkDocument>, id: ID): InkDocument | null {
  const seq = manuscriptSequence(docs);
  const i = seq.findIndex((d) => d.id === id);
  return i >= 0 && i < seq.length - 1 ? seq[i + 1] : null;
}

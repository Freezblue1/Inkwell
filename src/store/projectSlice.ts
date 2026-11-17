/** Project slice: project list, the open project, and binder document operations. */
import type { JSONContent } from '@tiptap/core';
import type { DocType, ID, InkDocument, Project, Series, DocMetadata, SpecialChapter } from '@/types/models';
import type { SliceCreator } from './types';
import { db } from '@/db/db';
import { bulkPutDocs, deleteDocsForever, getContentJSON, getContents, listDocs, putDoc, writeContentRaw } from '@/db/repos/documents';
import { createDocSnapshot } from '@/db/repos/snapshots';
import { deleteProjectData, exportBundle, importBundle } from '@/db/bundle';
import { createProjectFromTemplate, type NewProjectInput } from '@/db/templates';
import { createSampleProject } from '@/db/sample';
import { makeDocument } from '@/lib/defaults';
import { childrenOf, descendantIds, groupRoots, isManuscriptType, nearestAncestorOfType } from '@/lib/tree';
import { SPECIAL_CHAPTERS, specialLabel } from '@/lib/specialChapters';
import { concatDocs } from '@/lib/text';
import { newId } from '@/lib/ids';
import { flushAll } from '@/features/editor/autosave';

export interface NewDocInput {
  type: DocType;
  parentId: ID | null;
  title?: string;
  /** Insert directly after this sibling (default: append). */
  afterId?: ID;
  /** Insert directly before this sibling. */
  beforeId?: ID;
  synopsis?: string;
  status?: string;
  json?: JSONContent;
  metadata?: Partial<DocMetadata>;
}

export interface ProjectSlice {
  projects: Project[];
  seriesList: Series[];
  project: Project | null;
  docs: Record<ID, InkDocument>;
  projectLoading: boolean;

  loadProjects(): Promise<void>;
  openProject(id: ID): Promise<void>;
  closeProject(): void;
  /** Saves everything, closes the project and shows Home (all projects). */
  goHome(): Promise<void>;
  createProject(input: NewProjectInput): Promise<ID>;
  createDemoProject(): Promise<ID>;
  duplicateProject(id: ID): Promise<ID>;
  deleteProject(id: ID): Promise<void>;
  updateProject(patch: Partial<Project>): Promise<void>;
  createSeries(name: string): Promise<Series>;

  createDoc(input: NewDocInput): Promise<InkDocument>;
  /** Adds a prologue/epilogue/interlude… placed sensibly in the manuscript. */
  createSpecialChapter(kind: SpecialChapter, customLabel?: string): Promise<InkDocument>;
  /** Turns a chapter into a special chapter (or back into a numbered one with null). */
  setSpecialChapter(id: ID, kind: SpecialChapter | null, customLabel?: string): Promise<void>;
  updateDoc(id: ID, patch: Partial<InkDocument>): Promise<void>;
  updateDocMeta(id: ID, patch: Partial<DocMetadata>): Promise<void>;
  moveDoc(id: ID, parentId: ID | null, index: number): Promise<void>;
  trashDoc(id: ID): Promise<void>;
  restoreDoc(id: ID): Promise<void>;
  deleteDocForever(id: ID): Promise<void>;
  emptyTrash(): Promise<void>;
  duplicateDoc(id: ID): Promise<InkDocument | null>;
  mergeWithNext(id: ID): Promise<boolean>;
  splitDoc(id: ID, before: JSONContent, after: JSONContent, newTitle?: string): Promise<ID>;
  applyLocalSave(id: ID, wordCount: number, updatedAt: number, mentionIds: ID[]): void;
  reloadDocs(): Promise<void>;
}

function defaultTitle(type: DocType, n: number): string {
  switch (type) {
    case 'part':
      return `Part ${n}`;
    case 'chapter':
      return `Chapter ${n}`;
    case 'scene':
      return `Scene ${n}`;
    case 'note':
      return 'New note';
    case 'research':
      return 'New research item';
    default:
      return 'Untitled';
  }
}

export const createProjectSlice: SliceCreator<ProjectSlice> = (set, get) => ({
  projects: [],
  seriesList: [],
  project: null,
  docs: {},
  projectLoading: false,

  async loadProjects() {
    const [projects, seriesList] = await Promise.all([db.projects.orderBy('lastOpenedAt').reverse().toArray(), db.series.toArray()]);
    set({ projects, seriesList });
  },

  async openProject(id) {
    await flushAll();
    set({ projectLoading: true });
    try {
      const project = await db.projects.get(id);
      if (!project) throw new Error('Project not found');
      project.lastOpenedAt = Date.now();
      await db.projects.put(project);
      const docs = await listDocs(id);
      const map: Record<ID, InkDocument> = Object.fromEntries(docs.map((d) => [d.id, d]));
      set({ project, docs: map });
      await Promise.all([get().loadStory(project), get().loadGoals(id)]);
      get().resetEditorForProject(map);
      get().updateSettings({ lastProjectId: id });
      void get().loadProjects();
    } finally {
      set({ projectLoading: false });
    }
  },

  closeProject() {
    void flushAll();
    set({ project: null, docs: {}, activeDocId: null, scriveningsRootId: null });
  },

  async goHome() {
    await flushAll();
    if (get().focusMode) get().setFocusMode(false);
    get().closeProject();
    get().closeDialog('projects');
    await get().loadProjects(); // fresh "last opened" times and word counts on Home
  },

  async createProject(input) {
    const id = await createProjectFromTemplate(input);
    await get().loadProjects();
    return id;
  },

  async createDemoProject() {
    const id = await createSampleProject();
    await get().loadProjects();
    return id;
  },

  async duplicateProject(id) {
    const bundle = await exportBundle(id);
    const newIdValue = await importBundle({ ...bundle, project: { ...bundle.project, isDemo: false } }, { titleSuffix: ' (copy)' });
    await get().loadProjects();
    return newIdValue;
  },

  async deleteProject(id) {
    if (get().project?.id === id) get().closeProject();
    await deleteProjectData(id);
    if (get().settings.lastProjectId === id) get().updateSettings({ lastProjectId: null });
    await get().loadProjects();
  },

  async updateProject(patch) {
    const cur = get().project;
    if (!cur) return;
    const next = { ...cur, ...patch, updatedAt: Date.now() };
    set((s) => ({ project: next, projects: s.projects.map((p) => (p.id === next.id ? next : p)) }));
    await db.projects.put(next);
  },

  async createSeries(name) {
    const series: Series = { id: newId(), name, createdAt: Date.now() };
    await db.series.put(series);
    set((s) => ({ seriesList: [...s.seriesList, series] }));
    return series;
  },

  async createDoc(input) {
    const { project, docs } = get();
    if (!project) throw new Error('No project open');
    const siblings = childrenOf(docs, input.parentId);
    let order = siblings.length ? siblings[siblings.length - 1].order + 1 : 0;
    if (input.afterId) {
      const idx = siblings.findIndex((s) => s.id === input.afterId);
      if (idx >= 0) {
        const next = siblings[idx + 1];
        order = next ? (siblings[idx].order + next.order) / 2 : siblings[idx].order + 1;
      }
    } else if (input.beforeId) {
      const idx = siblings.findIndex((s) => s.id === input.beforeId);
      if (idx >= 0) {
        const prev = siblings[idx - 1];
        order = prev ? (prev.order + siblings[idx].order) / 2 : siblings[idx].order - 1;
      }
    }
    const sameType = siblings.filter((s) => s.type === input.type).length;
    const doc = makeDocument(project.id, input.type, input.title ?? defaultTitle(input.type, sameType + 1), input.parentId, order, {
      synopsis: input.synopsis ?? '',
      ...(input.status !== undefined ? { status: input.status } : {}),
      metadata: input.metadata as DocMetadata | undefined,
    });
    await putDoc(doc);
    if (input.json) doc.wordCount = await writeContentRaw(doc, input.json);
    set((s) => ({ docs: { ...s.docs, [doc.id]: doc } }));
    return doc;
  },

  async createSpecialChapter(kind, customLabel = '') {
    const { docs, activeDocId } = get();
    const info = SPECIAL_CHAPTERS.find((s) => s.value === kind)!;
    const label = kind === 'custom' ? customLabel.trim() || 'Special chapter' : info.label;
    const roots = groupRoots(docs, 'manuscript');
    const metadata = { special: kind, specialLabel: kind === 'custom' ? label : '' };
    const base = { type: 'chapter' as const, title: label, status: 'Draft', metadata };
    if (info.placement === 'start') return get().createDoc({ ...base, parentId: null, beforeId: roots[0]?.id });
    if (info.placement === 'end') return get().createDoc({ ...base, parentId: null });
    // "here": right after the chapter (or part) you're working in.
    const anchor = activeDocId ? nearestAncestorOfType(docs, activeDocId, 'chapter') ?? docs[activeDocId] : null;
    if (anchor && isManuscriptType(anchor.type)) return get().createDoc({ ...base, parentId: anchor.parentId, afterId: anchor.id });
    return get().createDoc({ ...base, parentId: null });
  },

  async setSpecialChapter(id, kind, customLabel = '') {
    const doc = get().docs[id];
    if (!doc) return;
    const oldLabel = specialLabel(doc);
    const metadata = { ...doc.metadata, special: kind, specialLabel: kind === 'custom' ? customLabel.trim() : '' };
    const newLabel = specialLabel({ metadata });
    // Retitle placeholder titles ("Chapter 3", or the old special label) to match.
    const placeholder = /^chapter\s+\d+$/i.test(doc.title.trim()) || (oldLabel && doc.title.trim() === oldLabel);
    const title = placeholder ? newLabel || 'Chapter' : doc.title;
    await get().updateDoc(id, { metadata, title });
  },

  async updateDoc(id, patch) {
    const cur = get().docs[id];
    if (!cur) return;
    const next = { ...cur, ...patch, updatedAt: Date.now() };
    set((s) => ({ docs: { ...s.docs, [id]: next } }));
    await putDoc(next);
  },

  async updateDocMeta(id, patch) {
    const cur = get().docs[id];
    if (!cur) return;
    await get().updateDoc(id, { metadata: { ...cur.metadata, ...patch } });
  },

  async moveDoc(id, parentId, index) {
    const { docs } = get();
    const doc = docs[id];
    if (!doc) return;
    if (parentId === id || (parentId && descendantIds(docs, id).includes(parentId))) return;
    const siblings = childrenOf(docs, parentId).filter((d) => d.id !== id);
    const at = Math.max(0, Math.min(index, siblings.length));
    siblings.splice(at, 0, { ...doc, parentId });
    const changed: InkDocument[] = [];
    siblings.forEach((d, i) => {
      if (d.order !== i || d.parentId !== parentId || d.id === id) changed.push({ ...d, parentId, order: i });
    });
    set((s) => {
      const next = { ...s.docs };
      changed.forEach((d) => (next[d.id] = d));
      return { docs: next };
    });
    await bulkPutDocs(changed);
  },

  async trashDoc(id) {
    const { docs } = get();
    if (!docs[id]) return;
    await flushAll();
    const ids = [id, ...descendantIds(docs, id)];
    const now = Date.now();
    const changed = ids.filter((i) => docs[i] && !docs[i].trashed).map((i) => ({ ...docs[i], trashed: true, trashedAt: now }));
    set((s) => {
      const next = { ...s.docs };
      changed.forEach((d) => (next[d.id] = d));
      return { docs: next };
    });
    await bulkPutDocs(changed);
    get().handleDocsRemoved(ids);
  },

  async restoreDoc(id) {
    const { docs } = get();
    const root = docs[id];
    if (!root) return;
    const ids = [id, ...descendantIds(docs, id)];
    const parentTrashed = root.parentId ? !docs[root.parentId] || docs[root.parentId].trashed : false;
    const changed = ids
      .filter((i) => docs[i])
      .map((i) => ({
        ...docs[i],
        trashed: false,
        trashedAt: null,
        parentId: i === id && parentTrashed ? null : docs[i].parentId,
      }));
    set((s) => {
      const next = { ...s.docs };
      changed.forEach((d) => (next[d.id] = d));
      return { docs: next };
    });
    await bulkPutDocs(changed);
  },

  async deleteDocForever(id) {
    const { docs } = get();
    const ids = [id, ...descendantIds(docs, id)];
    await deleteDocsForever(ids);
    set((s) => {
      const next = { ...s.docs };
      ids.forEach((i) => delete next[i]);
      return { docs: next, comments: s.comments.filter((c) => !ids.includes(c.docId)) };
    });
    get().handleDocsRemoved(ids);
  },

  async emptyTrash() {
    const trashed = Object.values(get().docs).filter((d) => d.trashed);
    if (!trashed.length) return;
    const ids = trashed.map((d) => d.id);
    await deleteDocsForever(ids);
    set((s) => {
      const next = { ...s.docs };
      ids.forEach((i) => delete next[i]);
      return { docs: next, comments: s.comments.filter((c) => !ids.includes(c.docId)) };
    });
  },

  async duplicateDoc(id) {
    const { docs, project } = get();
    const root = docs[id];
    if (!root || !project) return null;
    await flushAll();
    const subtree = [root, ...descendantIds(docs, id).map((i) => docs[i]).filter((d) => d && !d.trashed)];
    const idMap = new Map<ID, ID>(subtree.map((d) => [d.id, newId()]));
    const siblings = childrenOf(docs, root.parentId);
    const idx = siblings.findIndex((s) => s.id === id);
    const nextSibling = siblings[idx + 1];
    const now = Date.now();
    const copies = subtree.map((d) => ({
      ...d,
      id: idMap.get(d.id)!,
      parentId: d.id === id ? d.parentId : idMap.get(d.parentId!) ?? d.parentId,
      title: d.id === id ? `${d.title} (copy)` : d.title,
      order: d.id === id ? (nextSibling ? (root.order + nextSibling.order) / 2 : root.order + 1) : d.order,
      createdAt: now,
      updatedAt: now,
      metadata: { ...d.metadata },
    }));
    const contents = await getContents(subtree.map((d) => d.id));
    await bulkPutDocs(copies);
    for (const c of copies) {
      const original = subtree.find((d) => idMap.get(d.id) === c.id)!;
      const content = contents.get(original.id);
      if (content) await writeContentRaw(c, content.json);
    }
    set((s) => {
      const next = { ...s.docs };
      copies.forEach((d) => (next[d.id] = d));
      return { docs: next };
    });
    return copies[0];
  },

  async mergeWithNext(id) {
    const { docs } = get();
    const doc = docs[id];
    if (!doc) return false;
    const siblings = childrenOf(docs, doc.parentId);
    const next = siblings[siblings.findIndex((s) => s.id === id) + 1];
    if (!next || childrenOf(docs, next.id).length) return false;
    await flushAll();
    await createDocSnapshot(doc, `Before merging “${next.title}”`, 'manual');
    const [a, b] = await Promise.all([getContentJSON(doc.id), getContentJSON(next.id)]);
    const wordCount = await writeContentRaw(doc, concatDocs([a, b]));
    const synopsis = [doc.synopsis, next.synopsis].filter(Boolean).join(' ');
    set((s) => ({ docs: { ...s.docs, [id]: { ...s.docs[id], wordCount, synopsis } } }));
    await putDoc({ ...get().docs[id] });
    await get().trashDoc(next.id);
    get().bumpContent([id]);
    return true;
  },

  async splitDoc(id, before, after, newTitle) {
    const doc = get().docs[id];
    if (!doc) throw new Error('Document not found');
    await flushAll();
    await createDocSnapshot(doc, 'Before split', 'manual');
    const wordCount = await writeContentRaw(doc, before);
    set((s) => ({ docs: { ...s.docs, [id]: { ...s.docs[id], wordCount } } }));
    const created = await get().createDoc({
      type: doc.type,
      parentId: doc.parentId,
      afterId: doc.id,
      title: newTitle ?? `${doc.title} (part 2)`,
      status: doc.status,
      json: after,
      metadata: { pov: doc.metadata.pov, locationId: doc.metadata.locationId },
    });
    get().bumpContent([id]);
    return created.id;
  },

  applyLocalSave(id, wordCount, updatedAt, mentionIds) {
    set((s) => {
      const cur = s.docs[id];
      if (!cur) return {};
      return { docs: { ...s.docs, [id]: { ...cur, wordCount, updatedAt, metadata: { ...cur.metadata, mentionIds } } } };
    });
  },

  async reloadDocs() {
    const project = get().project;
    if (!project) return;
    const docs = await listDocs(project.id);
    set({ docs: Object.fromEntries(docs.map((d) => [d.id, d])) });
  },
});

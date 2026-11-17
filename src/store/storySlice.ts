/** Story slice: bible entries, tags, plot threads and comments. */
import type { BibleEntry, BibleKind, ID, InkComment, PlotCell, PlotThread, Project, Tag } from '@/types/models';
import type { SliceCreator } from './types';
import * as repo from '@/db/repos/story';
import { makeBibleEntry } from '@/lib/bible';
import { newId } from '@/lib/ids';

export interface StorySlice {
  bible: BibleEntry[];
  tags: Tag[];
  plotThreads: PlotThread[];
  comments: InkComment[];

  loadStory(project: Project): Promise<void>;
  createBibleEntry(kind: BibleKind, fields?: Partial<BibleEntry>): Promise<BibleEntry>;
  saveBibleEntry(entry: BibleEntry): Promise<void>;
  deleteBibleEntry(id: ID): Promise<void>;

  saveTag(name: string, color?: string): Promise<Tag>;

  createPlotThread(name: string, color?: string): Promise<PlotThread>;
  savePlotThread(thread: PlotThread): Promise<void>;
  deletePlotThread(id: ID): Promise<void>;
  setPlotCell(threadId: ID, docId: ID, cell: PlotCell | null): Promise<void>;

  createComment(docId: ID, quote: string, text?: string): Promise<InkComment>;
  updateComment(id: ID, patch: Partial<InkComment>): Promise<void>;
  deleteComment(id: ID): Promise<void>;
}

const THREAD_COLORS = ['#3949ab', '#d81b60', '#00897b', '#f4511e', '#8e24aa', '#6d4c41', '#039be5', '#7cb342'];

export const createStorySlice: SliceCreator<StorySlice> = (set, get) => ({
  bible: [],
  tags: [],
  plotThreads: [],
  comments: [],

  async loadStory(project) {
    const [bible, tags, plotThreads, comments] = await Promise.all([
      repo.listBible(project),
      repo.listTags(project.id),
      repo.listPlotThreads(project.id),
      repo.listComments(project.id),
    ]);
    set({ bible, tags, plotThreads: plotThreads.sort((a, b) => a.order - b.order), comments });
  },

  async createBibleEntry(kind, fields = {}) {
    const project = get().project;
    if (!project) throw new Error('No project open');
    const entry = makeBibleEntry<BibleEntry>(project.id, kind, fields);
    set((s) => ({ bible: [...s.bible, entry] }));
    await repo.putBibleEntry(entry);
    return entry;
  },

  async saveBibleEntry(entry) {
    const next = { ...entry, updatedAt: Date.now() } as BibleEntry;
    set((s) => ({ bible: s.bible.map((e) => (e.id === next.id ? next : e)) }));
    await repo.putBibleEntry(next);
  },

  async deleteBibleEntry(id) {
    set((s) => ({ bible: s.bible.filter((e) => e.id !== id) }));
    await repo.deleteBibleEntry(id);
  },

  async saveTag(name, color = '#5c6bc0') {
    const project = get().project;
    if (!project) throw new Error('No project open');
    const existing = get().tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    const tag: Tag = existing ? { ...existing, color } : { id: newId(), projectId: project.id, name, color };
    set((s) => ({ tags: existing ? s.tags.map((t) => (t.id === tag.id ? tag : t)) : [...s.tags, tag] }));
    await repo.putTag(tag);
    return tag;
  },

  async createPlotThread(name, color) {
    const project = get().project;
    if (!project) throw new Error('No project open');
    const n = get().plotThreads.length;
    const thread: PlotThread = {
      id: newId(),
      projectId: project.id,
      name,
      color: color ?? THREAD_COLORS[n % THREAD_COLORS.length],
      order: n,
      cells: {},
    };
    set((s) => ({ plotThreads: [...s.plotThreads, thread] }));
    await repo.putPlotThread(thread);
    return thread;
  },

  async savePlotThread(thread) {
    set((s) => ({ plotThreads: s.plotThreads.map((t) => (t.id === thread.id ? thread : t)) }));
    await repo.putPlotThread(thread);
  },

  async deletePlotThread(id) {
    set((s) => ({ plotThreads: s.plotThreads.filter((t) => t.id !== id) }));
    await repo.deletePlotThread(id);
  },

  async setPlotCell(threadId, docId, cell) {
    const thread = get().plotThreads.find((t) => t.id === threadId);
    if (!thread) return;
    const cells = { ...thread.cells };
    if (cell) cells[docId] = cell;
    else delete cells[docId];
    await get().savePlotThread({ ...thread, cells });
  },

  async createComment(docId, quote, text = '') {
    const project = get().project;
    if (!project) throw new Error('No project open');
    const now = Date.now();
    const c: InkComment = { id: newId(), projectId: project.id, docId, quote, text, resolved: false, createdAt: now, updatedAt: now };
    set((s) => ({ comments: [...s.comments, c] }));
    await repo.putComment(c);
    return c;
  },

  async updateComment(id, patch) {
    const cur = get().comments.find((c) => c.id === id);
    if (!cur) return;
    const next = { ...cur, ...patch, updatedAt: Date.now() };
    set((s) => ({ comments: s.comments.map((c) => (c.id === id ? next : c)) }));
    await repo.putComment(next);
  },

  async deleteComment(id) {
    set((s) => ({ comments: s.comments.filter((c) => c.id !== id) }));
    await repo.deleteComment(id);
  },
});

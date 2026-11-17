/** Editor slice: which documents are open and how, plus live stats and save status. */
import type { Editor } from '@tiptap/react';
import type { ID, InkDocument } from '@/types/models';
import type { SliceCreator } from './types';
import { sceneSequence } from '@/lib/tree';

export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

export interface LiveStats {
  docId: ID | null;
  words: number;
  chars: number;
  selWords: number;
  selChars: number;
}

export interface EditorSlice {
  activeDocId: ID | null;
  /** When set, the editor shows this container's documents as one continuous text. */
  scriveningsRootId: ID | null;
  split: { enabled: boolean; docId: ID | null; orientation: 'vertical' | 'horizontal' };
  focusMode: boolean;
  saveStatus: SaveStatus;
  lastSavedAt: number | null;
  liveStats: LiveStats;
  /** The most recently focused TipTap editor (toolbar, find, analysis act on it). */
  activeEditor: Editor | null;
  activeEditorDocId: ID | null;
  /** Bumped to force an editor to reload its content from the database. */
  contentVersion: Record<ID, number>;
  find: { open: boolean; replace: boolean };
  footnoteEdit: { pos: number; text: string } | null;
  proofreading: boolean;

  openDoc(id: ID | null, opts?: { target?: 'main' | 'split'; keepView?: boolean }): void;
  setScrivenings(rootId: ID | null): void;
  toggleSplit(force?: boolean): void;
  setSplitDoc(id: ID | null): void;
  setSplitOrientation(o: 'vertical' | 'horizontal'): void;
  setFocusMode(on: boolean): void;
  setSaveStatus(status: SaveStatus): void;
  setLiveStats(stats: Partial<LiveStats>): void;
  setActiveEditor(editor: Editor | null, docId: ID | null): void;
  bumpContent(ids: ID[]): void;
  setFind(patch: Partial<EditorSlice['find']>): void;
  setFootnoteEdit(v: EditorSlice['footnoteEdit']): void;
  setProofreading(on: boolean): void;
  resetEditorForProject(docs: Record<ID, InkDocument>): void;
  handleDocsRemoved(ids: ID[]): void;
}

const lastDocKey = (pid: string) => `inkwell:lastDoc:${pid}`;

export const createEditorSlice: SliceCreator<EditorSlice> = (set, get) => ({
  activeDocId: null,
  scriveningsRootId: null,
  split: { enabled: false, docId: null, orientation: 'vertical' },
  focusMode: false,
  saveStatus: 'saved',
  lastSavedAt: null,
  liveStats: { docId: null, words: 0, chars: 0, selWords: 0, selChars: 0 },
  activeEditor: null,
  activeEditorDocId: null,
  contentVersion: {},
  find: { open: false, replace: false },
  footnoteEdit: null,
  proofreading: false,

  openDoc(id, opts = {}) {
    const doc = id ? get().docs[id] : null;
    if (doc?.type === 'research') {
      get().setResearchDoc(doc.id);
      get().setView('research');
      return;
    }
    if (opts.target === 'split') {
      set((s) => ({ split: { ...s.split, enabled: true, docId: id } }));
    } else {
      set({ activeDocId: id, scriveningsRootId: null });
      const pid = get().project?.id;
      if (pid && id) {
        try {
          localStorage.setItem(lastDocKey(pid), id);
        } catch {
          /* ignore */
        }
      }
    }
    if (!opts.keepView) get().setView('write');
    get().setBinderDrawer(false);
  },

  setScrivenings(rootId) {
    set({ scriveningsRootId: rootId });
    if (rootId) get().setView('write');
  },

  toggleSplit(force) {
    set((s) => {
      const enabled = force ?? !s.split.enabled;
      let docId = s.split.docId;
      if (enabled && !docId) {
        // Default the second pane to the first note, else the next scene.
        const notes = Object.values(s.docs).filter((d) => d.type === 'note' && !d.trashed);
        docId = notes[0]?.id ?? sceneSequence(s.docs).find((d) => d.id !== s.activeDocId)?.id ?? null;
      }
      return { split: { ...s.split, enabled, docId } };
    });
  },

  setSplitDoc(id) {
    set((s) => ({ split: { ...s.split, docId: id, enabled: true } }));
  },

  setSplitOrientation(orientation) {
    set((s) => ({ split: { ...s.split, orientation } }));
  },

  setFocusMode(on) {
    set({ focusMode: on });
  },

  setSaveStatus(status) {
    set(status === 'saved' ? { saveStatus: status, lastSavedAt: Date.now() } : { saveStatus: status });
  },

  setLiveStats(stats) {
    set((s) => ({ liveStats: { ...s.liveStats, ...stats } }));
  },

  setActiveEditor(editor, docId) {
    if (get().activeEditor === editor && get().activeEditorDocId === docId) return;
    set({ activeEditor: editor, activeEditorDocId: docId });
  },

  bumpContent(ids) {
    set((s) => {
      const next = { ...s.contentVersion };
      ids.forEach((id) => (next[id] = (next[id] ?? 0) + 1));
      return { contentVersion: next };
    });
  },

  setFind(patch) {
    set((s) => ({ find: { ...s.find, ...patch } }));
  },

  setFootnoteEdit(v) {
    set({ footnoteEdit: v });
  },

  setProofreading(on) {
    set({ proofreading: on });
  },

  resetEditorForProject(docs) {
    const pid = get().project?.id;
    let last: string | null = null;
    try {
      last = pid ? localStorage.getItem(lastDocKey(pid)) : null;
    } catch {
      /* ignore */
    }
    const valid = last && docs[last] && !docs[last].trashed ? last : null;
    const first = sceneSequence(docs)[0]?.id ?? null;
    let collapsed: Record<ID, boolean> = {};
    try {
      collapsed = JSON.parse(localStorage.getItem(`inkwell:collapsed:${pid}`) ?? '{}');
    } catch {
      /* ignore */
    }
    set({
      activeDocId: valid ?? first,
      scriveningsRootId: null,
      split: { enabled: false, docId: null, orientation: get().split.orientation },
      focusMode: false,
      activeEditor: null,
      activeEditorDocId: null,
      collapsed,
    });
  },

  handleDocsRemoved(ids) {
    const removed = new Set(ids);
    set((s) => ({
      activeDocId: s.activeDocId && removed.has(s.activeDocId) ? null : s.activeDocId,
      scriveningsRootId: s.scriveningsRootId && removed.has(s.scriveningsRootId) ? null : s.scriveningsRootId,
      split: s.split.docId && removed.has(s.split.docId) ? { ...s.split, docId: null, enabled: false } : s.split,
    }));
  },
});

/** UI slice: navigation, dialogs, snackbars and persisted settings. */
import type { EditorSettings, ID, LayoutSettings, Settings } from '@/types/models';
import type { SliceCreator } from './types';
import { loadSettings, saveSettings } from '@/db/repos/settings';
import { defaultSettings } from '@/lib/defaults';

export type View = 'write' | 'plan' | 'research' | 'goals' | 'export' | 'history';
export type PlanTab = 'corkboard' | 'whiteboard' | 'outliner' | 'plotgrid' | 'timeline' | 'bible' | 'relationships' | 'structure';
export type InspectorTab = 'synopsis' | 'metadata' | 'snapshots' | 'links' | 'comments';
export type DialogKey =
  | 'palette'
  | 'search'
  | 'shortcuts'
  | 'nameGen'
  | 'projects'
  | 'compile'
  | 'analysis'
  | 'ai'
  | 'scratchpad'
  | 'settings'
  | 'import';

export interface Snack {
  id: number;
  message: string;
  severity: 'success' | 'info' | 'warning' | 'error';
  action?: { label: string; run: () => void };
}

export interface UISlice {
  view: View;
  planTab: PlanTab;
  inspectorTab: InspectorTab;
  researchDocId: ID | null;
  settings: Settings;
  settingsLoaded: boolean;
  binderDrawerOpen: boolean;
  inspectorDrawerOpen: boolean;
  dialogs: Record<DialogKey, boolean>;
  lookupWord: string | null;
  bibleEditId: ID | null;
  collapsed: Record<ID, boolean>;
  snacks: Snack[];
  focusCommentId: ID | null;

  setView(view: View): void;
  setPlanTab(tab: PlanTab): void;
  setInspectorTab(tab: InspectorTab): void;
  setResearchDoc(id: ID | null): void;
  loadSettings(): Promise<void>;
  updateSettings(patch: Partial<Settings>): void;
  updateEditorSettings(patch: Partial<EditorSettings>): void;
  updateLayout(patch: Partial<LayoutSettings>): void;
  setBinderDrawer(open: boolean): void;
  setInspectorDrawer(open: boolean): void;
  openDialog(key: DialogKey): void;
  closeDialog(key: DialogKey): void;
  toggleDialog(key: DialogKey): void;
  setLookupWord(word: string | null): void;
  openBibleEntry(id: ID | null): void;
  toggleCollapsed(id: ID): void;
  setCollapsed(map: Record<ID, boolean>): void;
  notify(message: string, severity?: Snack['severity'], action?: Snack['action']): void;
  dismissSnack(id: number): void;
  setFocusComment(id: ID | null): void;
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let snackId = 1;

const closedDialogs: Record<DialogKey, boolean> = {
  palette: false,
  search: false,
  shortcuts: false,
  nameGen: false,
  projects: false,
  compile: false,
  analysis: false,
  ai: false,
  scratchpad: false,
  settings: false,
  import: false,
};

export const createUISlice: SliceCreator<UISlice> = (set, get) => {
  /** Debounced persistence of settings. */
  const persist = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void saveSettings(get().settings), 400);
  };
  const persistCollapsed = () => {
    const pid = get().project?.id;
    if (!pid) return;
    try {
      localStorage.setItem(`inkwell:collapsed:${pid}`, JSON.stringify(get().collapsed));
    } catch {
      /* ignore */
    }
  };

  return {
    view: 'write',
    planTab: 'corkboard',
    inspectorTab: 'synopsis',
    researchDocId: null,
    settings: defaultSettings(),
    settingsLoaded: false,
    binderDrawerOpen: false,
    inspectorDrawerOpen: false,
    dialogs: { ...closedDialogs },
    lookupWord: null,
    bibleEditId: null,
    collapsed: {},
    snacks: [],
    focusCommentId: null,

    setView: (view) => set({ view }),
    setPlanTab: (planTab) => set({ planTab, view: 'plan' }),
    setInspectorTab: (inspectorTab) => set({ inspectorTab }),
    setResearchDoc: (researchDocId) => set({ researchDocId }),

    async loadSettings() {
      const settings = await loadSettings();
      set({ settings, settingsLoaded: true });
    },

    updateSettings(patch) {
      set((s) => ({ settings: { ...s.settings, ...patch } }));
      persist();
    },

    updateEditorSettings(patch) {
      set((s) => ({ settings: { ...s.settings, editor: { ...s.settings.editor, ...patch } } }));
      persist();
    },

    updateLayout(patch) {
      set((s) => ({ settings: { ...s.settings, layout: { ...s.settings.layout, ...patch } } }));
      persist();
    },

    setBinderDrawer: (binderDrawerOpen) => set({ binderDrawerOpen }),
    setInspectorDrawer: (inspectorDrawerOpen) => set({ inspectorDrawerOpen }),
    openDialog: (key) => set((s) => ({ dialogs: { ...s.dialogs, [key]: true } })),
    closeDialog: (key) => set((s) => ({ dialogs: { ...s.dialogs, [key]: false } })),
    toggleDialog: (key) => set((s) => ({ dialogs: { ...s.dialogs, [key]: !s.dialogs[key] } })),
    setLookupWord: (lookupWord) => set({ lookupWord }),
    openBibleEntry: (bibleEditId) => set({ bibleEditId }),

    toggleCollapsed(id) {
      set((s) => {
        const next = { ...s.collapsed };
        if (next[id]) delete next[id];
        else next[id] = true;
        return { collapsed: next };
      });
      persistCollapsed();
    },

    setCollapsed(map) {
      set({ collapsed: map });
      persistCollapsed();
    },

    notify(message, severity = 'success', action) {
      const snack: Snack = { id: snackId++, message, severity, action };
      set((s) => ({ snacks: [...s.snacks.slice(-3), snack] }));
    },

    dismissSnack: (id) => set((s) => ({ snacks: s.snacks.filter((x) => x.id !== id) })),
    setFocusComment: (focusCommentId) => set({ focusCommentId }),
  };
};

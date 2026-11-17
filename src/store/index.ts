/**
 * Global Zustand store composed of slices:
 *  - project: projects, binder documents, tree operations
 *  - story:   story bible, plot threads, comments, tags
 *  - editor:  open documents, split/scrivenings/focus, save status
 *  - ui:      current view, dialogs, settings, snackbars
 *  - goals:   writing goal, daily sessions, sprint timer
 */
import { create } from 'zustand';
import type { AppState } from './types';
import { createProjectSlice } from './projectSlice';
import { createStorySlice } from './storySlice';
import { createEditorSlice } from './editorSlice';
import { createUISlice } from './uiSlice';
import { createGoalsSlice } from './goalsSlice';

export const useStore = create<AppState>()((...a) => ({
  ...createProjectSlice(...a),
  ...createStorySlice(...a),
  ...createEditorSlice(...a),
  ...createUISlice(...a),
  ...createGoalsSlice(...a),
}));

export type { AppState };

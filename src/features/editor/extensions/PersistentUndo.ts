/**
 * Persistent undo: when the in-memory history is empty (e.g. after reopening
 * the app), Ctrl+Z steps back through saved revisions from IndexedDB.
 */
import { Extension } from '@tiptap/core';
import { redoDepth, undoDepth } from '@tiptap/pm/history';

export interface PersistentUndoOptions {
  onUndoEmpty: () => boolean;
  onRedoEmpty: () => boolean;
}

export const PersistentUndo = Extension.create<PersistentUndoOptions>({
  name: 'persistentUndo',
  // Run before the History extension's own shortcuts.
  priority: 1000,

  addOptions() {
    return { onUndoEmpty: () => false, onRedoEmpty: () => false };
  },

  addKeyboardShortcuts() {
    const undo = () => (undoDepth(this.editor.state) > 0 ? false : this.options.onUndoEmpty());
    const redo = () => (redoDepth(this.editor.state) > 0 ? false : this.options.onRedoEmpty());
    return {
      'Mod-z': undo,
      'Mod-Shift-z': redo,
      'Mod-y': redo,
    };
  },
});

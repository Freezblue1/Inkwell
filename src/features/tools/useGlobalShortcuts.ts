/** App-wide keyboard shortcuts (editor formatting shortcuts live in TipTap). */
import { useEffect } from 'react';
import { useStore } from '@/store';
import type { View } from '@/store/uiSlice';
import { flushAll } from '@/features/editor/autosave';
import { createDocSnapshot } from '@/db/repos/snapshots';

const VIEWS: View[] = ['write', 'plan', 'research', 'goals', 'export', 'history'];

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

export async function snapshotActiveDoc() {
  const s = useStore.getState();
  const id = s.activeEditorDocId ?? s.activeDocId;
  if (!id || !s.docs[id]) return s.notify('Open a document to snapshot it.', 'info');
  await flushAll();
  await createDocSnapshot(useStore.getState().docs[id], `Snapshot ${new Date().toLocaleString()}`);
  s.notify(`Snapshot of “${s.docs[id].title}” saved`);
}

export async function newSceneAfterCurrent() {
  const s = useStore.getState();
  const cur = s.activeDocId ? s.docs[s.activeDocId] : null;
  const parentId = cur ? (cur.type === 'scene' ? cur.parentId : cur.type === 'chapter' || cur.type === 'part' ? cur.id : cur.parentId) : null;
  const d = await s.createDoc({ type: 'scene', parentId, afterId: cur?.type === 'scene' ? cur.id : undefined });
  s.openDoc(d.id);
}

export function useGlobalShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useStore.getState();
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (mod && !e.shiftKey && !e.altKey && key === 'k') {
        e.preventDefault();
        s.toggleDialog('palette');
        return;
      }
      if (mod && e.shiftKey && key === 'f') {
        e.preventDefault();
        s.openDialog('search');
        return;
      }
      if (mod && !e.shiftKey && key === 's') {
        e.preventDefault();
        void flushAll().then(() => useStore.getState().notify('All changes saved'));
        return;
      }
      // Ctrl+Alt+H (Ctrl+Shift+H is the editor's Highlight).
      if (mod && e.altKey && !e.shiftKey && key === 'h') {
        e.preventDefault();
        void s.goHome();
        return;
      }
      if (mod && !e.shiftKey && (key === 'f' || key === 'h') && s.view === 'write') {
        e.preventDefault();
        s.setFind({ open: true, replace: key === 'h' });
        return;
      }
      if (mod && e.shiftKey && key === 'enter') {
        e.preventDefault();
        if (s.activeDocId) s.setFocusMode(!s.focusMode);
        return;
      }
      if (mod && key === '\\') {
        e.preventDefault();
        s.setView('write');
        s.toggleSplit();
        return;
      }
      if (mod && e.altKey && !e.shiftKey && key === 'r') {
        e.preventDefault();
        s.toggleRevisionMode();
        return;
      }
      if (mod && !e.altKey && key === '.') {
        e.preventDefault();
        s.toggleDialog('scratchpad');
        return;
      }
      if (mod && !e.altKey && key === '[') {
        e.preventDefault();
        s.updateLayout({ binderOpen: !s.settings.layout.binderOpen });
        return;
      }
      if (mod && !e.altKey && key === ']') {
        e.preventDefault();
        s.updateLayout({ inspectorOpen: !s.settings.layout.inspectorOpen });
        return;
      }
      if (mod && e.shiftKey && key === 'p') {
        e.preventDefault();
        void snapshotActiveDoc();
        return;
      }
      if (mod && e.altKey && key === 'n') {
        e.preventDefault();
        void newSceneAfterCurrent();
        return;
      }
      if (e.altKey && !mod && /^[1-6]$/.test(e.key)) {
        e.preventDefault();
        s.setView(VIEWS[Number(e.key) - 1]);
        return;
      }
      if (e.key === '?' && !mod && !isTyping(e.target)) {
        e.preventDefault();
        s.openDialog('shortcuts');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

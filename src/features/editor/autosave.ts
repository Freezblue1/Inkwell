/**
 * Autosave engine.
 *
 * - Editors call `scheduleSave(docId, pmDoc)` on every change. The ProseMirror
 *   node is immutable, so storing it costs nothing and stays valid even after
 *   the editor is destroyed; JSON is only produced when we actually save.
 * - A save runs 1.2 s after typing stops, on blur, when the tab is hidden, and
 *   before unload. Saves for one document are chained so they never race.
 * - On unload, pending text is also written synchronously to localStorage as
 *   a recovery copy; editors restore it on next load if it is newer.
 */
import type { Node as PMNode } from '@tiptap/pm/model';
import type { JSONContent } from '@tiptap/core';
import type { ID } from '@/types/models';
import { saveContent } from '@/db/repos/documents';
import { useStore } from '@/store';
import { isDesktop } from '@/lib/desktop';

export const AUTOSAVE_DELAY_MS = 1200;
const RECOVERY_PREFIX = 'inkwell:recovery:';

interface Pending {
  node: PMNode;
  timer: ReturnType<typeof setTimeout> | null;
}

const pending = new Map<ID, Pending>();
const chains = new Map<ID, Promise<void>>();

export function scheduleSave(docId: ID, node: PMNode, delay = AUTOSAVE_DELAY_MS): void {
  const prev = pending.get(docId);
  if (prev?.timer) clearTimeout(prev.timer);
  const entry: Pending = { node, timer: null };
  entry.timer = setTimeout(() => void flushSave(docId), delay);
  pending.set(docId, entry);
  const store = useStore.getState();
  if (store.saveStatus !== 'unsaved') store.setSaveStatus('unsaved');
}

export function hasPendingSaves(): boolean {
  return pending.size > 0;
}

/** Saves one document now (no-op if nothing is pending). */
export function flushSave(docId: ID): Promise<void> {
  const entry = pending.get(docId);
  if (!entry) return chains.get(docId) ?? Promise.resolve();
  if (entry.timer) clearTimeout(entry.timer);
  pending.delete(docId);
  const json = entry.node.toJSON() as JSONContent;
  const prev = chains.get(docId) ?? Promise.resolve();
  const next = prev.then(() => performSave(docId, json));
  chains.set(docId, next);
  void next.finally(() => {
    if (chains.get(docId) === next) chains.delete(docId);
  });
  return next;
}

/** Other autosaving features (e.g. whiteboards) that must flush with the editor. */
const extraFlushers = new Set<() => Promise<void> | void>();

/** Registers a flush callback; returns an unregister function. */
export function registerFlusher(fn: () => Promise<void> | void): () => void {
  extraFlushers.add(fn);
  return () => extraFlushers.delete(fn);
}

/** Saves everything that is pending. */
export async function flushAll(): Promise<void> {
  await Promise.all([...pending.keys()].map((id) => flushSave(id)));
  await Promise.all([...chains.values(), ...[...extraFlushers].map((fn) => fn())]);
}

async function performSave(docId: ID, json: JSONContent): Promise<void> {
  const store = useStore.getState();
  const doc = store.docs[docId];
  if (!doc) return;
  store.setSaveStatus('saving');
  try {
    const res = await saveContent(doc, json);
    const s = useStore.getState();
    s.applyLocalSave(docId, res.wordCount, res.updatedAt, res.mentionIds);
    const delta = res.wordCount - res.prevWordCount;
    if (delta !== 0 && ['part', 'chapter', 'scene'].includes(doc.type)) void s.recordWordDelta(delta);
    clearRecovery(docId);
    s.setSaveStatus(pending.size ? 'unsaved' : 'saved');
  } catch (err) {
    console.error('[Inkwell] save failed', err);
    writeRecovery(docId, json);
    const s = useStore.getState();
    s.setSaveStatus('error');
    const quota = err instanceof Error && /quota/i.test(err.name + err.message);
    s.notify(
      quota
        ? 'Storage is full — your latest text is kept in a recovery copy. Free up space or export a backup.'
        : 'Could not save. Your text is kept in a recovery copy and will be retried.',
      'error',
      { label: 'Retry', run: () => scheduleSaveJSON(docId, json) },
    );
  }
}

/** Retries a save from JSON (used after an error). */
function scheduleSaveJSON(docId: ID, json: JSONContent) {
  const prev = chains.get(docId) ?? Promise.resolve();
  chains.set(docId, prev.then(() => performSave(docId, json)));
}

function writeRecovery(docId: ID, json: JSONContent) {
  try {
    localStorage.setItem(RECOVERY_PREFIX + docId, JSON.stringify({ savedAt: Date.now(), json }));
  } catch {
    /* storage full or unavailable */
  }
}

function clearRecovery(docId: ID) {
  try {
    localStorage.removeItem(RECOVERY_PREFIX + docId);
  } catch {
    /* ignore */
  }
}

/** Returns a recovery copy if it is newer than the stored content. */
export function takeRecovery(docId: ID, storedUpdatedAt: number): JSONContent | null {
  try {
    const raw = localStorage.getItem(RECOVERY_PREFIX + docId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { savedAt: number; json: JSONContent };
    if (parsed.savedAt > storedUpdatedAt) return parsed.json;
    clearRecovery(docId);
  } catch {
    /* ignore */
  }
  return null;
}

/** Synchronously writes all pending text to localStorage (for beforeunload). */
export function writeRecoveryCopies(): void {
  for (const [docId, entry] of pending) writeRecovery(docId, entry.node.toJSON() as JSONContent);
}

let installed = false;

/** Flushes on tab hide / unload. Call once at startup. */
export function installUnloadHandlers(): void {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('beforeunload', (e) => {
    if (!hasPendingSaves()) return;
    writeRecoveryCopies();
    void flushAll();
    // The desktop app saves before closing on its own; only browsers need the prompt.
    if (isDesktop()) return;
    e.preventDefault();
    e.returnValue = '';
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      writeRecoveryCopies();
      void flushAll();
    }
  });
  window.addEventListener('pagehide', () => {
    writeRecoveryCopies();
    void flushAll();
  });
}

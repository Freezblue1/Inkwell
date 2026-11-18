/** App-side wiring for folder sync: choosing the folder, starting the engine, status for the UI. */
import { create } from 'zustand';
import type { ID } from '@/types/models';
import { useStore } from '@/store';
import { flushAll } from '@/features/editor/autosave';
import { desktop, isDesktop } from '@/lib/desktop';
import { FolderSync, type SyncResult } from './engine';
import { browserAdapter, browserFoldersSupported, desktopAdapter, loadBrowserHandle, pickBrowserFolder, saveBrowserHandle, type FsDir } from './adapters';

const DIR_KEY = 'inkwell:folderSync:dir';
const POLL_DESKTOP_MS = 5000;
const POLL_BROWSER_MS = 10000;

export type FolderStatus = 'off' | 'starting' | 'idle' | 'syncing' | 'error' | 'permission';

interface FolderSyncState {
  status: FolderStatus;
  /** Full path (desktop) or folder name (browser). */
  label: string | null;
  lastSync: number | null;
  error: string | null;
  result: SyncResult | null;
}

export const useFolderSync = create<FolderSyncState>(() => ({ status: 'off', label: null, lastSync: null, error: null, result: null }));

export const folderSyncSupported = () => (isDesktop() ? !!desktop()?.folders : browserFoldersSupported());

let engine: FolderSync | null = null;
let pendingHandle: FsDir | null = null;

async function onChanged(change: { replaced: ID[]; imported: ID[]; deleted: ID[] }) {
  const s = useStore.getState();
  const open = s.project?.id;
  if (open && change.deleted.includes(open)) await s.goHome();
  else if (open && change.replaced.includes(open)) await s.openProject(open);
  await useStore.getState().loadProjects();
  const n = change.imported.length;
  if (n) s.notify(n === 1 ? 'Added a project from your projects folder' : `Added ${n} projects from your projects folder`, 'info');
}

const set = (patch: Partial<FolderSyncState>) => useFolderSync.setState(patch);

function startEngine(e: FolderSync, pollMs: number) {
  engine?.stop();
  engine = e;
  set({ status: 'starting', label: e.adapter.label, error: null });
  let slow: ReturnType<typeof setTimeout> | null = null;
  e.onStatus = (st) => {
    if (engine !== e) return;
    if (slow) clearTimeout(slow);
    slow = null;
    // Routine checks take milliseconds: only say "Syncing…" for passes that take a while.
    if (st.syncing) {
      slow = setTimeout(() => engine === e && set({ status: 'syncing' }), 700);
    } else if (st.error) set({ status: 'error', error: friendly(st.error) });
    else set({ status: 'idle', error: null, lastSync: st.lastSync ?? Date.now(), result: st.result ?? null });
  };
  void e.start(pollMs).catch(() => {});
}

function friendly(msg: string): string {
  if (/ENOENT|NotFound|could not be found/i.test(msg)) return 'The folder can’t be found. Is the drive connected, or was it moved?';
  if (/EPERM|EACCES|NotAllowed|permission/i.test(msg)) return 'Inkwell isn’t allowed to write to this folder.';
  return msg;
}

const env = {
  flush: () => flushAll(),
  onChanged,
  notify: (m: string, sev?: 'success' | 'info' | 'warning' | 'error') => useStore.getState().notify(m, sev),
};

/** On startup: reconnect to the folder chosen earlier. */
export async function initFolderSync() {
  if (isDesktop()) {
    const dir = localStorage.getItem(DIR_KEY);
    if (!dir || !desktop()?.folders) return;
    if (!(await desktop()!.folders!.exists(dir))) {
      set({ status: 'error', label: dir, error: 'The folder can’t be found. Is the drive connected, or was it moved?' });
      return;
    }
    startEngine(new FolderSync(desktopAdapter(dir), env), POLL_DESKTOP_MS);
    return;
  }
  if (!browserFoldersSupported()) return;
  const handle = await loadBrowserHandle();
  if (!handle) return;
  if ((await handle.queryPermission({ mode: 'readwrite' })) === 'granted') {
    startEngine(new FolderSync(browserAdapter(handle), env), POLL_BROWSER_MS);
  } else {
    // Browsers ask again after a restart, and only in response to a click.
    pendingHandle = handle;
    set({ status: 'permission', label: handle.name });
    useStore.getState().notify(`Allow Inkwell to keep using your “${handle.name}” projects folder`, 'info', { label: 'Allow', run: () => void allowFolder() });
  }
}

/** Browser: re-grant access after a restart (must run from a click). */
export async function allowFolder() {
  const h = pendingHandle;
  if (!h) return;
  if ((await h.requestPermission({ mode: 'readwrite' })) === 'granted') {
    pendingHandle = null;
    startEngine(new FolderSync(browserAdapter(h), env), POLL_BROWSER_MS);
  }
}

/** Lets the writer pick a folder and starts syncing to it. Returns false if they cancelled. */
export async function chooseFolder(): Promise<boolean> {
  await flushAll();
  if (isDesktop()) {
    const dir = await desktop()!.folders!.pick(localStorage.getItem(DIR_KEY));
    if (!dir) return false;
    localStorage.setItem(DIR_KEY, dir);
    startEngine(new FolderSync(desktopAdapter(dir), env), POLL_DESKTOP_MS);
    return true;
  }
  const handle = await pickBrowserFolder();
  if (!handle) return false;
  await saveBrowserHandle(handle);
  pendingHandle = null;
  startEngine(new FolderSync(browserAdapter(handle), env), POLL_BROWSER_MS);
  return true;
}

/** Stops mirroring. Files already in the folder stay where they are. */
export async function stopFolderSync() {
  if (engine) {
    await engine.sync().catch(() => {});
    engine.stop();
    engine.reset();
  }
  engine = null;
  pendingHandle = null;
  localStorage.removeItem(DIR_KEY);
  await saveBrowserHandle(null);
  set({ status: 'off', label: null, lastSync: null, error: null, result: null });
}

export async function syncNow() {
  if (engine) await engine.sync().catch(() => {});
  else await initFolderSync();
}

export function openFolder() {
  const dir = localStorage.getItem(DIR_KEY);
  if (dir) void desktop()?.folders?.open(dir);
}

/** Before the desktop window closes: write anything still pending (bounded). */
export async function flushFolderSync() {
  if (!engine || !engine.pending) return;
  await Promise.race([engine.sync().catch(() => {}), new Promise((r) => setTimeout(r, 2500))]);
}

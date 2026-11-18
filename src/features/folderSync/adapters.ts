/** Folder access for sync: the desktop app (Node fs via IPC) and Chromium browsers (File System Access API). */
import { desktop } from '@/lib/desktop';
import { DELETED_DIR, META_FILE, type FileInfo, type FolderAdapter } from './engine';

// ---------------------------------------------------------------------------
// Desktop

export function desktopAdapter(dir: string): FolderAdapter {
  const f = desktop()?.folders;
  if (!f) throw new Error('This version of the desktop app can’t use folders.');
  return {
    id: `desktop:${dir.toLowerCase()}`,
    label: dir,
    list: () => f.list(dir),
    read: (name) => f.read(dir, name),
    write: (name, text) => f.write(dir, name, text),
    remove: (name) => f.remove(dir, name),
    moveToDeleted: (name) => f.moveToDeleted(dir, name),
    readMeta: () => f.readMeta(dir),
    writeMeta: (text) => f.writeMeta(dir, text),
  };
}

// ---------------------------------------------------------------------------
// Browser (Chrome, Edge, Opera…)

type PermissionMode = { mode: 'read' | 'readwrite' };
interface FsHandle {
  kind: 'file' | 'directory';
  name: string;
}
interface FsFile extends FsHandle {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(): Promise<{ write(data: string): Promise<void>; close(): Promise<void> }>;
}
export interface FsDir extends FsHandle {
  kind: 'directory';
  values(): AsyncIterable<FsFile | FsDir>;
  getFileHandle(name: string, opts?: { create?: boolean }): Promise<FsFile>;
  getDirectoryHandle(name: string, opts?: { create?: boolean }): Promise<FsDir>;
  removeEntry(name: string): Promise<void>;
  queryPermission(opts: PermissionMode): Promise<PermissionState>;
  requestPermission(opts: PermissionMode): Promise<PermissionState>;
}

export const browserFoldersSupported = () => typeof window !== 'undefined' && 'showDirectoryPicker' in window;

export async function pickBrowserFolder(): Promise<FsDir | null> {
  const picker = (window as unknown as { showDirectoryPicker(o: object): Promise<FsDir> }).showDirectoryPicker;
  try {
    return await picker({ id: 'inkwell-projects', mode: 'readwrite', startIn: 'documents' });
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') return null;
    throw err;
  }
}

async function exists(dir: FsDir, name: string): Promise<boolean> {
  try {
    await dir.getFileHandle(name);
    return true;
  } catch {
    return false;
  }
}

async function writeFile(dir: FsDir, name: string, text: string): Promise<File> {
  const h = await dir.getFileHandle(name, { create: true });
  const w = await h.createWritable(); // written to a temporary file, swapped in on close
  await w.write(text);
  await w.close();
  return h.getFile();
}

export function browserAdapter(dir: FsDir): FolderAdapter {
  return {
    id: `browser:${dir.name}`,
    label: dir.name,
    async list() {
      const out: FileInfo[] = [];
      for await (const h of dir.values()) {
        if (h.kind !== 'file' || !/\.inkwell$/i.test(h.name) || h.name.startsWith('.')) continue;
        const file = await h.getFile();
        out.push({ name: h.name, mtime: file.lastModified, size: file.size });
      }
      return out;
    },
    async read(name) {
      return (await (await dir.getFileHandle(name)).getFile()).text();
    },
    async write(name, text) {
      const file = await writeFile(dir, name, text);
      return { name, mtime: file.lastModified, size: file.size };
    },
    async remove(name) {
      await dir.removeEntry(name).catch(() => {});
    },
    async moveToDeleted(name) {
      const text = await (await (await dir.getFileHandle(name)).getFile()).text();
      const bin = await dir.getDirectoryHandle(DELETED_DIR, { create: true });
      let dest = name;
      for (let i = 2; await exists(bin, dest); i++) dest = name.replace(/\.inkwell$/i, ` (${i}).inkwell`);
      await writeFile(bin, dest, text);
      await dir.removeEntry(name);
    },
    async readMeta() {
      try {
        return await (await (await dir.getFileHandle(META_FILE)).getFile()).text();
      } catch {
        return null;
      }
    },
    async writeMeta(text) {
      await writeFile(dir, META_FILE, text);
    },
  };
}

// The chosen folder handle survives reloads in its own small IndexedDB database.
const HANDLE_DB = 'inkwell-folder';

function handleStore<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(HANDLE_DB, 1);
    open.onupgradeneeded = () => open.result.createObjectStore('kv');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const tx = open.result.transaction('kv', mode);
      const req = fn(tx.objectStore('kv'));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => open.result.close();
    };
  });
}

export const loadBrowserHandle = () => handleStore<FsDir | undefined>('readonly', (s) => s.get('dir') as IDBRequest<FsDir | undefined>).catch(() => undefined);
export const saveBrowserHandle = (dir: FsDir | null) =>
  handleStore<unknown>('readwrite', (s) => (dir ? s.put(dir, 'dir') : s.delete('dir')) as IDBRequest<unknown>).then(
    () => undefined,
    () => undefined,
  );

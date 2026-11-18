/**
 * Folder sync: mirrors every project to `<Title>.inkwell` in a folder the
 * writer chooses (OneDrive, Dropbox, a USB stick…) and picks up changes other
 * devices make to those files.
 *
 * - Files are matched to projects by the project id inside, so renaming a file
 *   is harmless. Inkwell names new files after the project title.
 * - A project changed only here is written out; a file changed only elsewhere
 *   replaces the project here (after a rolling backup). If both changed, the
 *   local version wins the file and the other one is kept as a separate
 *   project, so nothing is ever lost.
 * - Deleting a project moves its file to "Deleted projects" and records the
 *   deletion in `.inkwell-sync.json`, so other devices remove it too.
 * - Snapshots, undo history and rolling backups stay on each device; the
 *   sample novel is never synced.
 */
import type { ID, Project } from '@/types/models';
import { db } from '@/db/db';
import { createRollingBackup, deleteProjectData, exportBundle, importBundle, isProjectBundle, type ProjectBundle } from '@/db/bundle';

export interface FileInfo {
  name: string;
  mtime: number;
  size: number;
}

/** A folder Inkwell can read and write: desktop (Node fs) or browser (File System Access). */
export interface FolderAdapter {
  /** Stable id of the folder (path or handle name) so state isn't mixed between folders. */
  id: string;
  label: string;
  /** `.inkwell` files at the top level of the folder. */
  list(): Promise<FileInfo[]>;
  read(name: string): Promise<string>;
  /** Atomic write; returns the new file's info. */
  write(name: string, text: string): Promise<FileInfo>;
  remove(name: string): Promise<void>;
  /** Moves a file into the "Deleted projects" subfolder. */
  moveToDeleted(name: string): Promise<void>;
  /** Small JSON side file shared by all devices; null if missing. */
  readMeta(): Promise<string | null>;
  writeMeta(text: string): Promise<void>;
}

export interface SyncEnv {
  /** Saves pending editor changes to the database. */
  flush(): Promise<void>;
  /** Called after projects were replaced, imported or deleted from the folder. */
  onChanged(change: { replaced: ID[]; imported: ID[]; deleted: ID[] }): Promise<void> | void;
  notify(message: string, severity?: 'success' | 'info' | 'warning' | 'error'): void;
}

interface Entry {
  file: string;
  mtime: number;
  size: number;
  /** Hash of the file text as last written or read. */
  fileHash: string;
  /** Hash of the project's content as last synced (ignoring timestamps of export/opening). */
  localHash: string;
}

interface Meta {
  version: 1;
  deleted: Record<ID, number>;
}

export interface SyncResult {
  written: number;
  replaced: number;
  imported: number;
  deleted: number;
  conflicts: number;
  files: number;
}

export const META_FILE = '.inkwell-sync.json';
export const DELETED_DIR = 'Deleted projects';
const EXT = '.inkwell';

// ---------------------------------------------------------------------------
// Change tracking: Dexie hooks mark a project dirty when any of its rows change.

let active: FolderSync | null = null;
let hooksInstalled = false;
const suppressed = new Set<ID>();

function mark(pid: unknown) {
  if (typeof pid === 'string' && active && !suppressed.has(pid)) active.markDirty(pid);
}

function installHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;
  db.projects.hook('creating', (pk) => mark(pk));
  db.projects.hook('updating', (mods, pk) => {
    if (Object.keys(mods).some((k) => k !== 'lastOpenedAt')) mark(pk);
  });
  db.projects.hook('deleting', (pk) => {
    if (typeof pk === 'string' && active && !suppressed.has(pk)) active.markDeleted(pk);
  });
  const tables = [db.documents, db.contents, db.bible, db.tags, db.plotThreads, db.comments, db.goals, db.sessions, db.exportProfiles, db.assets, db.whiteboards];
  for (const t of tables) {
    const table = t as unknown as { hook: (ev: string, fn: (...a: unknown[]) => void) => void };
    table.hook('creating', (_pk, obj) => mark((obj as { projectId?: ID }).projectId));
    table.hook('updating', (_mods, _pk, obj) => mark((obj as { projectId?: ID }).projectId));
    table.hook('deleting', (_pk, obj) => mark((obj as { projectId?: ID } | undefined)?.projectId));
  }
}

// ---------------------------------------------------------------------------

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Content identity of a bundle, ignoring when it was exported or last opened. */
function normalized(b: ProjectBundle): string {
  return JSON.stringify({ ...b, exportedAt: 0, snapshots: [], project: { ...b.project, lastOpenedAt: 0, updatedAt: 0 } });
}

const RESERVED = /^(con|prn|aux|nul|com\d|lpt\d)$/i;

/** A Windows/macOS-safe file name for a project title. */
export function fileNameFor(title: string): string {
  let base = title
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '')
    .slice(0, 80)
    .trim();
  if (!base) base = 'Untitled';
  if (RESERVED.test(base)) base = `${base} project`;
  return base + EXT;
}

async function exportForSync(pid: ID): Promise<{ text: string; localHash: string }> {
  const bundle = await exportBundle(pid, { includeSnapshots: false });
  return { text: JSON.stringify(bundle), localHash: await sha256(normalized(bundle)) };
}

/** The most recent edit anywhere in a project. */
export function lastEdit(b: Pick<ProjectBundle, 'project' | 'documents'> & Partial<Pick<ProjectBundle, 'bible' | 'whiteboards'>>): number {
  let m = b.project.updatedAt || 0;
  for (const d of b.documents) m = Math.max(m, d.updatedAt || 0);
  for (const x of b.bible ?? []) m = Math.max(m, x.updatedAt || 0);
  for (const w of b.whiteboards ?? []) m = Math.max(m, w.updatedAt || 0);
  return m;
}

function parseBundle(text: string): ProjectBundle | null {
  try {
    const b = JSON.parse(text);
    return isProjectBundle(b) ? b : null;
  } catch {
    return null;
  }
}

export class FolderSync {
  private state: Record<ID, Entry>;
  private dirty = new Set<ID>();
  private deletedHere = new Set<ID>();
  private checkAll = true;
  private running: Promise<SyncResult> | null = null;
  private again = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private poll: ReturnType<typeof setInterval> | null = null;
  private firstDirtyAt = 0;
  onStatus: (s: { syncing: boolean; lastSync?: number; error?: string; result?: SyncResult }) => void = () => {};

  constructor(
    readonly adapter: FolderAdapter,
    private env: SyncEnv,
    private storage: Pick<Storage, 'getItem' | 'setItem'> = localStorage,
  ) {
    try {
      this.state = JSON.parse(storage.getItem(this.stateKey) ?? '{}');
    } catch {
      this.state = {};
    }
  }

  private get stateKey() {
    return `inkwell:folderSync:state:${this.adapter.id}`;
  }
  private saveState() {
    try {
      this.storage.setItem(this.stateKey, JSON.stringify(this.state));
    } catch {
      /* ignore */
    }
  }

  /** Starts tracking changes (without polling the folder). */
  attach() {
    installHooks();
    active = this;
  }

  start(pollMs: number) {
    this.attach();
    this.poll = setInterval(() => void this.sync().catch(() => {}), pollMs);
    return this.sync();
  }

  stop() {
    if (active === this) active = null;
    if (this.poll) clearInterval(this.poll);
    if (this.timer) clearTimeout(this.timer);
    this.poll = this.timer = null;
  }

  /** Forget everything about this folder (used when the user stops syncing). */
  reset() {
    this.state = {};
    this.saveState();
  }

  markDirty(pid: ID) {
    this.dirty.add(pid);
    this.schedule();
  }
  markDeleted(pid: ID) {
    this.deletedHere.add(pid);
    this.schedule();
  }

  /** Writes soon after the last change (3 s), but at least every 20 s while typing. */
  private schedule() {
    const now = Date.now();
    if (!this.firstDirtyAt) this.firstDirtyAt = now;
    if (this.timer) clearTimeout(this.timer);
    const wait = Math.max(0, Math.min(3000, this.firstDirtyAt + 20000 - now));
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.sync().catch(() => {});
    }, wait);
  }

  get pending() {
    return this.dirty.size + this.deletedHere.size;
  }

  /** Runs a sync pass; overlapping calls share one pass and queue another. */
  sync(): Promise<SyncResult> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.firstDirtyAt = 0;
    this.onStatus({ syncing: true });
    this.running = this.pass()
      .then((result) => {
        this.onStatus({ syncing: false, lastSync: Date.now(), result });
        return result;
      })
      .catch((err) => {
        this.onStatus({ syncing: false, error: err instanceof Error ? err.message : String(err) });
        throw err;
      })
      .finally(() => {
        this.running = null;
        if (this.again) {
          this.again = false;
          void this.sync().catch(() => {});
        }
      });
    return this.running;
  }

  private async pass(): Promise<SyncResult> {
    const a = this.adapter;
    const result: SyncResult = { written: 0, replaced: 0, imported: 0, deleted: 0, conflicts: 0, files: 0 };
    const change = { replaced: [] as ID[], imported: [] as ID[], deleted: [] as ID[] };
    const checkAll = this.checkAll;
    const dirty = new Set(this.dirty);
    const deletedHere = new Set(this.deletedHere);
    this.dirty.clear();
    this.deletedHere.clear();

    try {
      // Shared deletion records.
      let meta: Meta = { version: 1, deleted: {} };
      const metaText = await a.readMeta();
      if (metaText) {
        try {
          meta = { version: 1, deleted: {}, ...JSON.parse(metaText) };
        } catch {
          /* rewrite below if needed */
        }
      }
      let metaChanged = false;

      // Index the folder: project id → file (reading only new or changed files).
      const files = await a.list();
      result.files = files.length;
      const texts = new Map<string, string>();
      const byPid = new Map<ID, FileInfo>();
      const byName = new Map(Object.entries(this.state).map(([pid, e]) => [e.file, { pid, e }]));
      for (const f of files) {
        let pid: ID | null = null;
        const known = byName.get(f.name);
        if (known && known.e.mtime === f.mtime && known.e.size === f.size) pid = known.pid;
        else {
          const text = await a.read(f.name);
          const b = parseBundle(text);
          if (!b) continue; // not an Inkwell backup (or mid-sync); ignore
          if (b.project.isDemo) continue;
          pid = b.project.id;
          texts.set(f.name, text);
        }
        const prev = byPid.get(pid);
        // Two files for one project (a copy made in Explorer): prefer the one we know, then the newest.
        if (!prev || (this.state[pid]?.file !== prev.name && (this.state[pid]?.file === f.name || f.mtime > prev.mtime))) byPid.set(pid, f);
      }
      const takenNames = new Set(files.map((f) => f.name.toLowerCase()));

      const locals = new Map<ID, Project>((await db.projects.toArray()).filter((p) => !p.isDemo).map((p) => [p.id, p]));
      const textOf = async (f: FileInfo) => texts.get(f.name) ?? (await a.read(f.name));

      const writeLocal = async (pid: ID, project: Project, exported?: { text: string; localHash: string }) => {
        const out = exported ?? (await exportForSync(pid));
        const prev = this.state[pid];
        const desired = fileNameFor(project.title);
        let name = prev?.file ?? desired;
        if (!prev || prev.file.toLowerCase() !== desired.toLowerCase()) {
          // New file, or the project was renamed: use the title, avoiding other projects' files.
          name = desired;
          for (let i = 2; takenNames.has(name.toLowerCase()) && name.toLowerCase() !== prev?.file.toLowerCase(); i++) name = desired.replace(/\.inkwell$/, ` (${i}).inkwell`);
        }
        const info = await a.write(name, out.text);
        takenNames.add(name.toLowerCase());
        if (prev && prev.file !== name && byPid.get(pid)?.name === prev.file) {
          await a.remove(prev.file).catch(() => {});
          takenNames.delete(prev.file.toLowerCase());
        }
        this.state[pid] = { file: name, mtime: info.mtime, size: info.size, fileHash: await sha256(out.text), localHash: out.localHash };
        result.written++;
      };

      const keepAsCopy = async (bundle: ProjectBundle) => {
        const stamp = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
        const id = await importBundle({ ...bundle, project: { ...bundle.project, isDemo: false } }, { titleSuffix: ` (other device, ${stamp})` });
        change.imported.push(id);
        result.conflicts++;
        this.env.notify(`“${bundle.project.title}” changed here and on another device. Both versions are kept: the other one is “${bundle.project.title} (other device, ${stamp})”.`, 'warning');
      };

      const applyFile = async (pid: ID, bundle: ProjectBundle, f: FileInfo, text: string, existing?: Project) => {
        suppressed.add(pid);
        try {
          if (existing) {
            await createRollingBackup(pid).catch(() => {});
            await deleteProjectData(pid, { keepHistory: true });
          }
          await importBundle({ ...bundle, snapshots: [] }, { keepIds: true, keepTimes: { lastOpenedAt: existing?.lastOpenedAt ?? bundle.project.lastOpenedAt } });
          const { localHash } = await exportForSync(pid);
          this.state[pid] = { file: f.name, mtime: f.mtime, size: f.size, fileHash: await sha256(text), localHash };
        } finally {
          suppressed.delete(pid);
        }
      };

      // 1. Projects deleted here: move their files aside and tell other devices.
      for (const pid of deletedHere) {
        const e = this.state[pid];
        if (locals.has(pid)) continue; // deleted and re-imported in the same breath
        const f = byPid.get(pid);
        if (f) {
          await a.moveToDeleted(f.name);
          byPid.delete(pid);
          result.deleted++;
        }
        if (e || f) {
          meta.deleted[pid] = Date.now();
          metaChanged = true;
        }
        delete this.state[pid];
      }

      // 2. Everything else, project by project.
      const pids = new Set<ID>([...locals.keys(), ...byPid.keys(), ...Object.keys(this.state)]);
      for (const pid of pids) {
        const local = locals.get(pid);
        const f = byPid.get(pid);
        const e = this.state[pid];

        if (local && meta.deleted[pid] && e && !f) {
          // Deleted on another device.
          suppressed.add(pid);
          try {
            await deleteProjectData(pid);
          } finally {
            suppressed.delete(pid);
          }
          delete this.state[pid];
          change.deleted.push(pid);
          result.deleted++;
          this.env.notify(`“${local.title}” was deleted on another device. Its file is in the “${DELETED_DIR}” folder.`, 'info');
          continue;
        }

        if (local && !f) {
          await writeLocal(pid, local);
          if (meta.deleted[pid]) {
            delete meta.deleted[pid];
            metaChanged = true;
          }
          continue;
        }

        if (!local && f) {
          if (e) {
            // Deleted here while Inkwell wasn't watching (e.g. before an update).
            await a.moveToDeleted(f.name);
            meta.deleted[pid] = Date.now();
            metaChanged = true;
            delete this.state[pid];
            result.deleted++;
            continue;
          }
          if (meta.deleted[pid]) continue;
          const text = await textOf(f);
          const bundle = parseBundle(text);
          if (!bundle) continue;
          await applyFile(pid, bundle, f, text);
          change.imported.push(pid);
          result.imported++;
          continue;
        }

        if (!local && !f) {
          delete this.state[pid];
          continue;
        }

        // Both exist.
        const fileMaybeChanged = !e || e.mtime !== f!.mtime || e.size !== f!.size;
        let fileText: string | null = null;
        let fileChanged = false;
        if (fileMaybeChanged) {
          fileText = await textOf(f!);
          fileChanged = !e || (await sha256(fileText)) !== e.fileHash;
          if (!fileChanged && e) this.state[pid] = { ...e, mtime: f!.mtime, size: f!.size };
        }
        if (fileChanged) await this.env.flush(); // pending typing counts as a local change
        let exported: { text: string; localHash: string } | undefined;
        let localChanged = false;
        if (!e || fileChanged || checkAll || dirty.has(pid) || this.dirty.has(pid)) {
          exported = await exportForSync(pid);
          localChanged = !e || exported.localHash !== e.localHash;
        }

        if (!fileChanged && !localChanged) continue;
        if (!fileChanged && localChanged) {
          await writeLocal(pid, local!, exported);
          continue;
        }
        const bundle = parseBundle(fileText!);
        if (!bundle) continue;
        if (!e) {
          // First time this folder meets this project (e.g. the folder was chosen again): the newer edit wins.
          // Replacing the local copy makes a rolling backup first.
          const mine = lastEdit(JSON.parse(exported!.text) as ProjectBundle);
          const theirs = lastEdit(bundle);
          if (theirs > mine) {
            await applyFile(pid, bundle, f!, fileText!, local);
            change.replaced.push(pid);
            result.replaced++;
          } else if (mine > theirs) {
            // Keep the older file in "Deleted projects" rather than overwrite it.
            await a.moveToDeleted(f!.name);
            takenNames.delete(f!.name.toLowerCase());
            byPid.delete(pid);
            await writeLocal(pid, local!, exported);
          }
          else this.state[pid] = { file: f!.name, mtime: f!.mtime, size: f!.size, fileHash: await sha256(fileText!), localHash: exported!.localHash };
          continue;
        }
        if (fileChanged && !localChanged) {
          await applyFile(pid, bundle, f!, fileText!, local);
          change.replaced.push(pid);
          result.replaced++;
          continue;
        }
        await keepAsCopy(bundle);
        await writeLocal(pid, local!, exported);
      }

      if (metaChanged) await a.writeMeta(JSON.stringify(meta, null, 2));
      this.checkAll = false;
    } catch (err) {
      // Try these again next time.
      dirty.forEach((p) => this.dirty.add(p));
      deletedHere.forEach((p) => this.deletedHere.add(p));
      throw err;
    } finally {
      this.saveState();
      if (change.replaced.length || change.imported.length || change.deleted.length) await this.env.onChanged(change);
    }
    return result;
  }
}

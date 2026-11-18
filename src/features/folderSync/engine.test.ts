import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/db';
import { createProjectFromTemplate } from '@/db/templates';
import { createSampleProject } from '@/db/sample';
import { listDocs, saveContent } from '@/db/repos/documents';
import { paragraphsToDoc } from '@/lib/text';
import type { ProjectBundle } from '@/db/bundle';
import { DELETED_DIR, FolderSync, fileNameFor, META_FILE, type FileInfo, type FolderAdapter } from './engine';

/** In-memory folder. */
class MemFolder implements FolderAdapter {
  id = 'mem';
  label = 'Mem';
  files = new Map<string, { text: string; mtime: number }>();
  clock = 1000;
  writes = 0;
  async list(): Promise<FileInfo[]> {
    return [...this.files].filter(([n]) => !n.includes('/') && n.endsWith('.inkwell')).map(([name, f]) => ({ name, mtime: f.mtime, size: f.text.length }));
  }
  async read(name: string) {
    const f = this.files.get(name);
    if (!f) throw new Error(`missing ${name}`);
    return f.text;
  }
  async write(name: string, text: string) {
    this.writes++;
    const mtime = ++this.clock;
    this.files.set(name, { text, mtime });
    return { name, mtime, size: text.length };
  }
  async remove(name: string) {
    this.files.delete(name);
  }
  async moveToDeleted(name: string) {
    const f = this.files.get(name)!;
    this.files.delete(name);
    this.files.set(`${DELETED_DIR}/${name}`, f);
  }
  async readMeta() {
    return this.files.get(META_FILE)?.text ?? null;
  }
  async writeMeta(text: string) {
    this.files.set(META_FILE, { text, mtime: ++this.clock });
  }
  bundle(name: string): ProjectBundle {
    return JSON.parse(this.files.get(name)!.text);
  }
  /** Another device edits a file. */
  edit(name: string, fn: (b: ProjectBundle) => void) {
    const b = this.bundle(name);
    fn(b);
    this.files.set(name, { text: JSON.stringify(b), mtime: ++this.clock });
  }
}

const memStorage = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

let folder: MemFolder;
let sync: FolderSync;
let notes: string[];
let changes: { replaced: string[]; imported: string[]; deleted: string[] }[];

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
  folder = new MemFolder();
  notes = [];
  changes = [];
  sync = new FolderSync(folder, { flush: async () => {}, onChanged: (c) => void changes.push(c), notify: (m) => void notes.push(m) }, memStorage());
  sync.attach();
});
afterEach(() => sync.stop());

async function sceneOf(pid: string) {
  return (await listDocs(pid)).find((d) => d.type === 'scene')!;
}

describe('folder sync', () => {
  it('names files safely', () => {
    expect(fileNameFor('Book: The "End"?')).toBe('Book The End.inkwell');
    expect(fileNameFor('  ...  ')).toBe('Untitled.inkwell');
    expect(fileNameFor('CON')).toBe('CON project.inkwell');
  });

  it('writes every project except the sample, and only rewrites on real changes', async () => {
    const pid = await createProjectFromTemplate({ title: 'Salt', author: '', kind: 'novel' });
    await createSampleProject();
    const r = await sync.sync();
    expect(r.written).toBe(1);
    expect([...folder.files.keys()]).toEqual(['Salt.inkwell']);
    expect(folder.bundle('Salt.inkwell').project.id).toBe(pid);

    // Opening the project only touches lastOpenedAt: nothing to write.
    await db.projects.update(pid, { lastOpenedAt: Date.now() + 5 });
    expect((await sync.sync()).written).toBe(0);

    await saveContent(await sceneOf(pid), paragraphsToDoc(['New words here.']));
    expect((await sync.sync()).written).toBe(1);
    expect(folder.files.get('Salt.inkwell')!.text).toContain('New words here.');
  });

  it('renames the file when the project is renamed', async () => {
    const pid = await createProjectFromTemplate({ title: 'Draft', author: '', kind: 'novel' });
    await sync.sync();
    await db.projects.update(pid, { title: 'Final Title' });
    await sync.sync();
    expect([...folder.files.keys()]).toEqual(['Final Title.inkwell']);
  });

  it('picks up a change made on another device', async () => {
    const pid = await createProjectFromTemplate({ title: 'Salt', author: '', kind: 'novel' });
    await sync.sync();
    const scene = await sceneOf(pid);
    folder.edit('Salt.inkwell', (b) => {
      b.contents = b.contents.map((c) => (c.docId === scene.id ? { ...c, json: paragraphsToDoc(['Written on the laptop.']) } : c));
      b.project.title = 'Salt (laptop)';
    });
    const r = await sync.sync();
    expect(r.replaced).toBe(1);
    expect((await db.projects.get(pid))!.title).toBe('Salt (laptop)');
    expect(JSON.stringify((await db.contents.get(scene.id))!.json)).toContain('Written on the laptop.');
    expect(changes.at(-1)!.replaced).toEqual([pid]);
    expect(await db.backups.where('projectId').equals(pid).count()).toBe(1);
    // Applying it doesn't bounce straight back to the folder.
    const writes = folder.writes;
    await sync.sync();
    expect(folder.writes).toBe(writes);
  });

  it('keeps both versions when both sides changed', async () => {
    const pid = await createProjectFromTemplate({ title: 'Salt', author: '', kind: 'novel' });
    await sync.sync();
    folder.edit('Salt.inkwell', (b) => {
      b.project.subtitle = 'from the laptop';
    });
    await saveContent(await sceneOf(pid), paragraphsToDoc(['Local words.']));
    const r = await sync.sync();
    expect(r.conflicts).toBe(1);
    const titles = (await db.projects.toArray()).map((p) => p.title).sort();
    expect(titles[0]).toBe('Salt');
    expect(titles[1]).toMatch(/^Salt \(other device, /);
    expect(folder.files.get('Salt.inkwell')!.text).toContain('Local words.');
    expect(notes.some((n) => n.includes('Both versions are kept'))).toBe(true);
    // The kept copy becomes its own file next time.
    await sync.sync();
    expect((await folder.list()).length).toBe(2);
  });

  it('imports a project added by another device, keeping its id', async () => {
    const pid = await createProjectFromTemplate({ title: 'Elsewhere', author: '', kind: 'novel' });
    await sync.sync();
    const text = folder.files.get('Elsewhere.inkwell')!.text;
    // A fresh device: empty database, no sync state.
    sync.stop();
    await Promise.all(db.tables.map((t) => t.clear()));
    const other = new FolderSync(folder, { flush: async () => {}, onChanged: () => {}, notify: () => {} }, memStorage());
    other.attach();
    const r = await other.sync();
    other.stop();
    expect(r.imported).toBe(1);
    expect((await db.projects.get(pid))!.title).toBe('Elsewhere');
    expect(folder.files.get('Elsewhere.inkwell')!.text).toBe(text);
  });

  it('moves a deleted project to Deleted projects, and deletes it here when another device did', async () => {
    const a = await createProjectFromTemplate({ title: 'Gone', author: '', kind: 'novel' });
    const b = await createProjectFromTemplate({ title: 'Also gone', author: '', kind: 'novel' });
    await sync.sync();

    await db.projects.delete(a);
    await sync.sync();
    expect(folder.files.has('Gone.inkwell')).toBe(false);
    expect(folder.files.has(`${DELETED_DIR}/Gone.inkwell`)).toBe(true);
    expect(JSON.parse(folder.files.get(META_FILE)!.text).deleted[a]).toBeTruthy();

    // Another device deletes b.
    await folder.moveToDeleted('Also gone.inkwell');
    await folder.writeMeta(JSON.stringify({ version: 1, deleted: { ...JSON.parse(folder.files.get(META_FILE)!.text).deleted, [b]: Date.now() } }));
    const r = await sync.sync();
    expect(r.deleted).toBe(1);
    expect(await db.projects.get(b)).toBeUndefined();
    expect(notes.some((n) => n.includes('deleted on another device'))).toBe(true);
  });

  it('when a folder is chosen again, the newer edit wins and the older file is kept aside', async () => {
    const pid = await createProjectFromTemplate({ title: 'Salt', author: '', kind: 'novel' });
    await sync.sync();
    sync.reset(); // "Stop using this folder", then choose it again later
    await saveContent(await sceneOf(pid), paragraphsToDoc(['Newer local words.']));
    const r = await sync.sync();
    expect(r.conflicts).toBe(0);
    expect(folder.files.get('Salt.inkwell')!.text).toContain('Newer local words.');
    expect(folder.files.has(`${DELETED_DIR}/Salt.inkwell`)).toBe(true);
  });
});

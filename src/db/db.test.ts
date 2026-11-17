import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { createProjectFromTemplate } from './templates';
import { createSampleProject } from './sample';
import { exportBundle, importBundle, deleteProjectData } from './bundle';
import { saveContent, listDocs, getContent, listRevisions } from './repos/documents';
import { createDocSnapshot, createProjectSnapshot, listDocSnapshots, restoreDocSnapshot, restoreProjectSnapshot } from './repos/snapshots';
import { recordWords, listSessions } from './repos/goals';
import { searchContents } from './repos/search';
import { listWhiteboards, makeWhiteboard, putWhiteboard } from './repos/whiteboards';
import { paragraphsToDoc } from '@/lib/text';
import { DEFAULT_FIND_OPTIONS } from '@/lib/findRegex';
import { dayKey } from '@/lib/dates';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('schema', () => {
  it('opens at the latest version with every table', async () => {
    await db.open();
    expect(db.verno).toBe(3);
    expect(db.tables.map((t) => t.name).sort()).toEqual(
      ['assets', 'backups', 'bible', 'comments', 'contents', 'documents', 'exportProfiles', 'goals', 'plotThreads', 'projects', 'revisions', 'series', 'sessions', 'settings', 'snapshots', 'tags', 'whiteboards'].sort(),
    );
  });
});

describe('templates', () => {
  it('creates a novel with front matter, a part, chapter and scene', async () => {
    const id = await createProjectFromTemplate({ title: 'My Novel', author: 'Me', kind: 'novel' });
    const docs = await listDocs(id);
    expect(docs.map((d) => d.type).sort()).toEqual(['backmatter', 'backmatter', 'chapter', 'frontmatter', 'frontmatter', 'note', 'part', 'scene']);
    expect((await db.goals.get(id))?.targetWords).toBe(80000);
  });
  it('creates a series and shares it with a second book', async () => {
    const id1 = await createProjectFromTemplate({ title: 'Book 1', author: '', kind: 'series', seriesName: 'Saga' });
    const p1 = await db.projects.get(id1);
    expect(p1?.seriesId).toBeTruthy();
    const id2 = await createProjectFromTemplate({ title: 'Book 2', author: '', kind: 'series', seriesId: p1!.seriesId });
    expect((await db.projects.get(id2))?.seriesOrder).toBe(2);
  });
});

describe('content saving', () => {
  it('saves text, updates word counts, revisions and the search index', async () => {
    const id = await createProjectFromTemplate({ title: 'X', author: '', kind: 'short-story' });
    const scene = (await listDocs(id)).find((d) => d.type === 'scene')!;
    const res = await saveContent(scene, paragraphsToDoc(['The lighthouse keeper waited.', 'Then the tide turned.']));
    expect(res.wordCount).toBe(8);
    expect((await db.documents.get(scene.id))?.wordCount).toBe(8);
    expect((await getContent(scene.id))?.text).toContain('lighthouse');
    expect(await listRevisions(scene.id)).toHaveLength(1);
    const hits = await searchContents(id, 'lighthouse', DEFAULT_FIND_OPTIONS);
    expect(hits).toHaveLength(1);
    expect(hits[0].snippets[0].match).toBe('lighthouse');
  });
  it('takes an automatic snapshot after a major edit', async () => {
    const id = await createProjectFromTemplate({ title: 'X', author: '', kind: 'short-story' });
    const scene = (await listDocs(id)).find((d) => d.type === 'scene')!;
    await saveContent(scene, paragraphsToDoc(['Short.']));
    await createDocSnapshot(scene, 'base');
    const big = Array.from({ length: 30 }, () => 'This sentence has exactly ten words in it for testing.');
    const res = await saveContent(scene, paragraphsToDoc(big));
    expect(res.autoSnapshot?.reason).toBe('major-edit');
  });
});

describe('snapshots', () => {
  it('restores a document snapshot (with a safety snapshot)', async () => {
    const id = await createProjectFromTemplate({ title: 'X', author: '', kind: 'short-story' });
    const scene = (await listDocs(id)).find((d) => d.type === 'scene')!;
    await saveContent(scene, paragraphsToDoc(['Version one.']));
    const snap = await createDocSnapshot(scene, 'v1');
    await saveContent(scene, paragraphsToDoc(['Version two is longer.']));
    const wc = await restoreDocSnapshot(snap);
    expect(wc).toBe(2);
    expect((await getContent(scene.id))?.text).toBe('Version one.');
    const all = await listDocSnapshots(scene.id);
    expect(all.some((s) => s.reason === 'pre-restore')).toBe(true);
  });
  it('restores a project snapshot and trashes newer documents', async () => {
    const id = await createProjectFromTemplate({ title: 'X', author: '', kind: 'short-story' });
    const scene = (await listDocs(id)).find((d) => d.type === 'scene')!;
    await saveContent(scene, paragraphsToDoc(['Before.']));
    const snap = await createProjectSnapshot(id, 'checkpoint');
    await saveContent(scene, paragraphsToDoc(['After.']));
    await db.documents.put({ ...scene, id: 'new-doc', title: 'Added later' });
    await restoreProjectSnapshot(snap);
    expect((await getContent(scene.id))?.text).toBe('Before.');
    expect((await db.documents.get('new-doc'))?.trashed).toBe(true);
  });
});

describe('backup bundles', () => {
  it('round-trips the sample novel with fresh ids', async () => {
    const id = await createSampleProject();
    const bundle = await exportBundle(id);
    expect(bundle.documents.length).toBeGreaterThan(10);
    expect(bundle.bible.length).toBe(9);
    const copyId = await importBundle(JSON.parse(JSON.stringify(bundle)), { titleSuffix: ' (copy)' });
    expect(copyId).not.toBe(id);
    const copy = await db.projects.get(copyId);
    expect(copy?.title).toBe('The Salt Archive (copy)');
    const docs = await listDocs(copyId);
    expect(docs).toHaveLength(bundle.documents.length);
    // Parent links survive remapping.
    const ids = new Set(docs.map((d) => d.id));
    expect(docs.every((d) => !d.parentId || ids.has(d.parentId))).toBe(true);
    // Mentions/links point at the copied bible entries.
    const bible = await db.bible.where('projectId').equals(copyId).toArray();
    const bibleIds = new Set(bible.map((b) => b.id));
    expect(docs.flatMap((d) => d.metadata.linkedIds).every((l) => bibleIds.has(l))).toBe(true);
    const threads = await db.plotThreads.where('projectId').equals(copyId).toArray();
    expect(threads.flatMap((t) => Object.keys(t.cells)).every((k) => ids.has(k))).toBe(true);
  });
  it('includes whiteboards and remaps scene-card links', async () => {
    const id = await createSampleProject();
    const scene = (await listDocs(id)).find((d) => d.type === 'scene')!;
    const wb = makeWhiteboard(id, 'Map', 0);
    wb.elements = [{ id: 'n1', type: 'note', x: 0, y: 0, w: 100, h: 80, text: scene.title, fill: '#fff59d', color: 'ink', strokeWidth: 1, docId: scene.id }];
    await putWhiteboard(wb);
    const copyId = await importBundle(await exportBundle(id));
    const [copy] = await listWhiteboards(copyId);
    expect(copy.name).toBe('Map');
    const note = copy.elements[0];
    expect(note.type === 'note' && note.docId).not.toBe(scene.id);
    expect(note.type === 'note' && (await db.documents.get(note.docId!))?.title).toBe(scene.title);
  });

  it('marks the sample prologue as a special chapter', async () => {
    const id = await createSampleProject();
    const prologue = (await listDocs(id)).find((d) => d.metadata.special === 'prologue');
    expect(prologue?.title).toBe('The Night of the Flood');
  });

  it('rejects files that are not backups', async () => {
    await expect(importBundle({ hello: 'world' } as never)).rejects.toThrow(/not an Inkwell/);
  });
  it('deletes every row of a project', async () => {
    const id = await createSampleProject();
    await deleteProjectData(id);
    expect(await db.documents.where('projectId').equals(id).count()).toBe(0);
    expect(await db.projects.get(id)).toBeUndefined();
  });
});

describe('writing sessions', () => {
  it('accumulates added, removed and net words per day', async () => {
    await recordWords('p1', 300);
    await recordWords('p1', -50);
    await recordWords('p1', 0, 1);
    const [row] = await listSessions('p1');
    expect(row).toMatchObject({ date: dayKey(), added: 300, removed: 50, net: 250, sprints: 1 });
  });
});

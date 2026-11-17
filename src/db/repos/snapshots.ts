/** Document- and project-level snapshots (named versions) with restore. */
import type { ID, InkDocument, Snapshot } from '@/types/models';
import { db } from '../db';
import { buildContentRow, makeSnapshot } from './documents';
import { docToCountableText, emptyDoc } from '@/lib/text';
import { countWords } from '@/lib/wordCount';
import { newId } from '@/lib/ids';
import { dayKey } from '@/lib/dates';

const MAX_AUTO_PROJECT_SNAPSHOTS = 15;

export async function listProjectSnapshots(projectId: ID): Promise<Snapshot[]> {
  const rows = await db.snapshots.where('projectId').equals(projectId).toArray();
  return rows.sort((a, b) => b.createdAt - a.createdAt);
}

export async function listDocSnapshots(docId: ID): Promise<Snapshot[]> {
  const rows = await db.snapshots.where('[docId+createdAt]').between([docId, 0], [docId, Infinity]).toArray();
  return rows.reverse();
}

export async function createDocSnapshot(doc: InkDocument, name: string, reason: Snapshot['reason'] = 'manual'): Promise<Snapshot> {
  const content = await db.contents.get(doc.id);
  const snap = makeSnapshot(doc, name || 'Untitled snapshot', reason, content?.json ?? emptyDoc(), content?.text ?? '');
  await db.snapshots.add(snap);
  return snap;
}

export async function renameSnapshot(id: ID, name: string): Promise<void> {
  await db.snapshots.update(id, { name });
}

export async function deleteSnapshot(id: ID): Promise<void> {
  await db.snapshots.delete(id);
}

/** Restores a document snapshot (after saving a "before restore" snapshot). Returns the new word count. */
export async function restoreDocSnapshot(snap: Snapshot): Promise<number> {
  if (!snap.docId || !snap.json) throw new Error('Not a document snapshot');
  const doc = await db.documents.get(snap.docId);
  if (!doc) throw new Error('The document no longer exists');
  await createDocSnapshot(doc, `Before restoring “${snap.name}”`, 'pre-restore');
  const row = buildContentRow(doc.id, doc.projectId, snap.json);
  const wordCount = countWords(docToCountableText(snap.json));
  await db.transaction('rw', db.contents, db.documents, async () => {
    await db.contents.put(row);
    await db.documents.update(doc.id, { wordCount, updatedAt: Date.now() });
  });
  return wordCount;
}

/** Captures every document (metadata + text) of a project. */
export async function createProjectSnapshot(projectId: ID, name: string, reason: Snapshot['reason'] = 'manual'): Promise<Snapshot> {
  const [docs, contents] = await Promise.all([
    db.documents.where('projectId').equals(projectId).toArray(),
    db.contents.where('projectId').equals(projectId).toArray(),
  ]);
  const live = docs.filter((d) => !d.trashed);
  const liveIds = new Set(live.map((d) => d.id));
  const snap: Snapshot = {
    id: newId(),
    projectId,
    docId: null,
    scope: 'project',
    name: name || 'Project snapshot',
    auto: reason !== 'manual',
    reason,
    createdAt: Date.now(),
    wordCount: live.filter((d) => ['part', 'chapter', 'scene'].includes(d.type)).reduce((s, d) => s + d.wordCount, 0),
    json: null,
    text: '',
    projectData: {
      docs: live,
      contents: contents.filter((c) => liveIds.has(c.docId)).map((c) => ({ docId: c.docId, json: c.json, text: c.text })),
    },
  };
  await db.snapshots.add(snap);
  if (snap.auto) {
    const autos = (await db.snapshots.where('[projectId+scope]').equals([projectId, 'project']).toArray())
      .filter((s) => s.auto)
      .sort((a, b) => a.createdAt - b.createdAt);
    if (autos.length > MAX_AUTO_PROJECT_SNAPSHOTS)
      await db.snapshots.bulkDelete(autos.slice(0, autos.length - MAX_AUTO_PROJECT_SNAPSHOTS).map((s) => s.id));
  }
  return snap;
}

/** Takes the daily automatic project snapshot if none exists for today. */
export async function ensureDailyProjectSnapshot(projectId: ID): Promise<Snapshot | null> {
  const today = dayKey();
  const existing = await db.snapshots.where('[projectId+scope]').equals([projectId, 'project']).toArray();
  if (existing.some((s) => s.auto && dayKey(s.createdAt) === today)) return null;
  const hasText = (await db.contents.where('projectId').equals(projectId).count()) > 0;
  if (!hasText) return null;
  return createProjectSnapshot(projectId, `Daily snapshot ${new Date().toLocaleDateString()}`, 'daily');
}

/**
 * Restores a whole project. Documents created after the snapshot are moved to
 * the trash (not deleted), so nothing is lost.
 */
export async function restoreProjectSnapshot(snap: Snapshot): Promise<void> {
  if (snap.scope !== 'project' || !snap.projectData) throw new Error('Not a project snapshot');
  await createProjectSnapshot(snap.projectId, `Before restoring “${snap.name}”`, 'pre-restore');
  const { docs, contents } = snap.projectData;
  const now = Date.now();
  await db.transaction('rw', db.documents, db.contents, async () => {
    const snapIds = new Set(docs.map((d) => d.id));
    const current = await db.documents.where('projectId').equals(snap.projectId).toArray();
    for (const d of current) {
      if (!snapIds.has(d.id) && !d.trashed) await db.documents.update(d.id, { trashed: true, trashedAt: now });
    }
    await db.documents.bulkPut(docs.map((d) => ({ ...d, trashed: false, trashedAt: null, updatedAt: now })));
    await db.contents.bulkPut(contents.map((c) => buildContentRow(c.docId, snap.projectId, c.json, now)));
  });
}

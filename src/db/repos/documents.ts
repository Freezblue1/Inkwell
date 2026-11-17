/** Document + content persistence, including revisions and auto-snapshots. */
import type { JSONContent } from '@tiptap/core';
import type { DocumentContent, ID, InkDocument, Snapshot } from '@/types/models';
import { db } from '../db';
import { docToCountableText, docToText, emptyDoc, extractMentionIds } from '@/lib/text';
import { countWords, indexTokens } from '@/lib/wordCount';
import { dayKey } from '@/lib/dates';
import { newId } from '@/lib/ids';

/** Revisions are kept at most this often, and at most this many per document. */
const REVISION_INTERVAL_MS = 60_000;
const MAX_REVISIONS = 40;
/** Auto-snapshot when the word count moves by this much since the last snapshot. */
const MAJOR_EDIT_WORDS = 250;
const MAX_AUTO_SNAPSHOTS = 30;

export async function listDocs(projectId: ID): Promise<InkDocument[]> {
  return db.documents.where('projectId').equals(projectId).toArray();
}

export async function putDoc(doc: InkDocument): Promise<void> {
  await db.documents.put(doc);
}

export async function bulkPutDocs(docs: InkDocument[]): Promise<void> {
  if (docs.length) await db.documents.bulkPut(docs);
}

export async function getContent(docId: ID): Promise<DocumentContent | undefined> {
  return db.contents.get(docId);
}

export async function getContents(docIds: ID[]): Promise<Map<ID, DocumentContent>> {
  const rows = await db.contents.bulkGet(docIds);
  const map = new Map<ID, DocumentContent>();
  rows.forEach((r) => r && map.set(r.docId, r));
  return map;
}

export async function listProjectContents(projectId: ID): Promise<DocumentContent[]> {
  return db.contents.where('projectId').equals(projectId).toArray();
}

/** Builds a content row (plain text + search tokens) from TipTap JSON. */
export function buildContentRow(docId: ID, projectId: ID, json: JSONContent, now = Date.now()): DocumentContent {
  const text = docToText(json);
  return { docId, projectId, json, text, words: indexTokens(text), updatedAt: now };
}

export interface SaveResult {
  wordCount: number;
  prevWordCount: number;
  mentionIds: ID[];
  autoSnapshot: Snapshot | null;
  updatedAt: number;
}

/**
 * Saves a document's text. Runs in one transaction: content row, cached word
 * count, rolling revision (persistent undo) and auto-snapshots.
 */
export async function saveContent(doc: InkDocument, json: JSONContent): Promise<SaveResult> {
  const now = Date.now();
  const row = buildContentRow(doc.id, doc.projectId, json, now);
  const wordCount = countWords(docToCountableText(json));
  const mentionIds = extractMentionIds(json);

  return db.transaction('rw', [db.contents, db.documents, db.revisions, db.snapshots], async () => {
    const prev = await db.contents.get(doc.id);
    const current = await db.documents.get(doc.id);
    const prevWordCount = current?.wordCount ?? 0;
    await db.contents.put(row);
    if (current) {
      await db.documents.update(doc.id, {
        wordCount,
        updatedAt: now,
        metadata: { ...current.metadata, mentionIds },
      });
    }

    if (!prev || prev.text !== row.text) await addRevision(doc, json, row.text, now);
    const autoSnapshot = await maybeAutoSnapshot(doc, prev, row, wordCount, now);
    return { wordCount, prevWordCount, mentionIds, autoSnapshot, updatedAt: now };
  });
}

/** Writes content without revision/snapshot side effects (imports, templates). */
export async function writeContentRaw(doc: InkDocument, json: JSONContent): Promise<number> {
  const row = buildContentRow(doc.id, doc.projectId, json);
  const wordCount = countWords(docToCountableText(json));
  await db.transaction('rw', db.contents, db.documents, async () => {
    await db.contents.put(row);
    await db.documents.update(doc.id, { wordCount, updatedAt: row.updatedAt });
  });
  return wordCount;
}

async function addRevision(doc: InkDocument, json: JSONContent, text: string, now: number) {
  const last = await db.revisions.where('[docId+createdAt]').between([doc.id, 0], [doc.id, Infinity]).last();
  if (last && now - last.createdAt < REVISION_INTERVAL_MS) {
    // Too soon: refresh the latest revision instead of adding a new one.
    await db.revisions.update(last.id, { json, text, createdAt: last.createdAt });
    return;
  }
  await db.revisions.add({ id: newId(), docId: doc.id, projectId: doc.projectId, createdAt: now, json, text });
  const count = await db.revisions.where('docId').equals(doc.id).count();
  if (count > MAX_REVISIONS) {
    const old = await db.revisions
      .where('[docId+createdAt]')
      .between([doc.id, 0], [doc.id, Infinity])
      .limit(count - MAX_REVISIONS)
      .primaryKeys();
    await db.revisions.bulkDelete(old);
  }
}

async function maybeAutoSnapshot(
  doc: InkDocument,
  prev: DocumentContent | undefined,
  next: DocumentContent,
  wordCount: number,
  now: number,
): Promise<Snapshot | null> {
  const last = await db.snapshots.where('[docId+createdAt]').between([doc.id, 0], [doc.id, Infinity]).last();
  let snap: Snapshot | null = null;

  if (prev && prev.text.trim() && (!last || dayKey(last.createdAt) !== dayKey(now))) {
    // First save of the day: keep yesterday's version.
    snap = makeSnapshot(doc, `Start of ${new Date(now).toLocaleDateString()}`, 'daily', prev.json, prev.text, now);
  } else if (last && Math.abs(wordCount - last.wordCount) >= Math.max(MAJOR_EDIT_WORDS, last.wordCount * 0.25)) {
    snap = makeSnapshot(doc, 'Major edit', 'major-edit', next.json, next.text, now);
  }
  if (!snap) return null;
  await db.snapshots.add(snap);

  const autos = await db.snapshots
    .where('[docId+createdAt]')
    .between([doc.id, 0], [doc.id, Infinity])
    .filter((s) => s.auto)
    .primaryKeys();
  if (autos.length > MAX_AUTO_SNAPSHOTS) await db.snapshots.bulkDelete(autos.slice(0, autos.length - MAX_AUTO_SNAPSHOTS));
  return snap;
}

export function makeSnapshot(
  doc: Pick<InkDocument, 'id' | 'projectId'>,
  name: string,
  reason: Snapshot['reason'],
  json: JSONContent,
  text: string,
  now = Date.now(),
): Snapshot {
  return {
    id: newId(),
    projectId: doc.projectId,
    docId: doc.id,
    scope: 'document',
    name,
    auto: reason !== 'manual',
    reason,
    createdAt: now,
    wordCount: countWords(docToCountableText(json)),
    json,
    text,
    projectData: null,
  };
}

export async function listRevisions(docId: ID): Promise<{ id: ID; createdAt: number; text: string; json: JSONContent }[]> {
  const rows = await db.revisions.where('[docId+createdAt]').between([docId, 0], [docId, Infinity]).toArray();
  return rows.reverse();
}

/** Removes a document and everything that hangs off it. */
export async function deleteDocsForever(ids: ID[]): Promise<void> {
  await db.transaction('rw', [db.documents, db.contents, db.revisions, db.snapshots, db.comments], async () => {
    await db.documents.bulkDelete(ids);
    await db.contents.bulkDelete(ids);
    await db.revisions.where('docId').anyOf(ids).delete();
    await db.snapshots.where('docId').anyOf(ids).delete();
    await db.comments.where('docId').anyOf(ids).delete();
  });
}

export async function getContentJSON(docId: ID): Promise<JSONContent> {
  return (await db.contents.get(docId))?.json ?? emptyDoc();
}

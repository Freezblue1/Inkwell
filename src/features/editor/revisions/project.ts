/** Accept or reject revisions across stored documents (whole project), without opening them. */
import type { JSONContent } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import { Node as PMNode } from '@tiptap/pm/model';
import type { ID } from '@/types/models';
import { getInkSchema } from '../find/projectReplace';
import { resolveRevisions, type RevisionAction } from './resolve';
import { getContentJSON, writeContentRaw } from '@/db/repos/documents';
import { createDocSnapshot } from '@/db/repos/snapshots';
import { useStore } from '@/store';
import { flushAll } from '../autosave';

const hasRevisions = (json: JSONContent) => JSON.stringify(json).includes('"revision');

export function resolveRevisionsInJson(json: JSONContent, action: RevisionAction, pass: number | null = null): { json: JSONContent; changed: boolean } {
  if (!hasRevisions(json)) return { json, changed: false };
  const doc = PMNode.fromJSON(getInkSchema(), json);
  const tr = EditorState.create({ doc }).tr;
  if (!resolveRevisions(tr, action, { pass })) return { json, changed: false };
  return { json: tr.doc.toJSON() as JSONContent, changed: true };
}

/** Counts documents in the project that still have tracked changes. */
export async function countDocsWithRevisions(docIds: ID[]): Promise<number> {
  let n = 0;
  for (const id of docIds) if (hasRevisions(await getContentJSON(id))) n++;
  return n;
}

/** Accepts/rejects in every listed document; snapshots each changed document first. */
export async function resolveRevisionsInProject(docIds: ID[], action: RevisionAction, pass: number | null = null): Promise<number> {
  await flushAll();
  const changed: ID[] = [];
  for (const id of docIds) {
    const doc = useStore.getState().docs[id];
    if (!doc) continue;
    const res = resolveRevisionsInJson(await getContentJSON(id), action, pass);
    if (!res.changed) continue;
    await createDocSnapshot(doc, action === 'accept' ? 'Before accepting revisions' : 'Before rejecting revisions', 'manual');
    const wc = await writeContentRaw(doc, res.json);
    useStore.getState().applyLocalSave(id, wc, Date.now(), doc.metadata.mentionIds);
    changed.push(id);
  }
  useStore.getState().bumpContent(changed);
  return changed.length;
}

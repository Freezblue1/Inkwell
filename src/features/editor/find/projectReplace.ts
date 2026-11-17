/**
 * Project-wide replace. Each document is loaded into a headless ProseMirror
 * state built from the same schema as the editor, so replacements behave
 * exactly like in-editor Replace All (marks preserved, atoms untouched).
 */
import { getSchema, type JSONContent } from '@tiptap/core';
import { EditorState } from '@tiptap/pm/state';
import { Node as PMNode, type Schema } from '@tiptap/pm/model';
import type { ID } from '@/types/models';
import { buildFindRegex, expandReplacement } from '@/lib/findRegex';
import { buildExtensions } from '../extensions';
import { computeMatches, replaceRange, type SearchQuery } from '../extensions/SearchHighlight';
import { getContentJSON, writeContentRaw } from '@/db/repos/documents';
import { createDocSnapshot } from '@/db/repos/snapshots';
import { useStore } from '@/store';
import { flushAll } from '../autosave';

let schema: Schema | null = null;

export function getInkSchema(): Schema {
  if (!schema) {
    schema = getSchema(
      buildExtensions({
        onFootnoteEdit: () => undefined,
        onCommentClick: () => undefined,
        onMentionClick: () => undefined,
        onUndoEmpty: () => false,
        onRedoEmpty: () => false,
      }),
    );
  }
  return schema;
}

export function replaceInJson(json: JSONContent, query: SearchQuery, replacement: string): { json: JSONContent; count: number } {
  const doc = PMNode.fromJSON(getInkSchema(), json);
  const matches = computeMatches(doc, query);
  if (!matches.length) return { json, count: 0 };
  const re = buildFindRegex(query.term, query.options)!;
  const tr = EditorState.create({ doc }).tr;
  for (let i = matches.length - 1; i >= 0; i--) {
    const m = matches[i];
    replaceRange(tr, m.from, m.to, expandReplacement(m.text, re, replacement, query.options.regex));
  }
  return { json: tr.doc.toJSON() as JSONContent, count: matches.length };
}

/** Replaces in every listed document; snapshots each changed document first. */
export async function replaceInProject(docIds: ID[], query: SearchQuery, replacement: string): Promise<{ docs: number; replacements: number }> {
  await flushAll();
  const store = useStore.getState();
  let changedDocs = 0;
  let total = 0;
  const changedIds: ID[] = [];
  for (const id of docIds) {
    const doc = store.docs[id];
    if (!doc) continue;
    const json = await getContentJSON(id);
    const res = replaceInJson(json, query, replacement);
    if (!res.count) continue;
    await createDocSnapshot(doc, `Before replacing “${query.term}”`, 'manual');
    const wc = await writeContentRaw(doc, res.json);
    useStore.getState().applyLocalSave(id, wc, Date.now(), doc.metadata.mentionIds);
    changedDocs++;
    total += res.count;
    changedIds.push(id);
  }
  useStore.getState().bumpContent(changedIds);
  return { docs: changedDocs, replacements: total };
}

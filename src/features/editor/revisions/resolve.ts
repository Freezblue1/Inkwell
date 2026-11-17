/**
 * Accept / reject tracked revisions on a ProseMirror transaction. Used by the
 * editor commands and, headlessly, by project-wide accept/reject.
 *
 *   accept: insertions become normal text, deletions are removed.
 *   reject: insertions are removed, deletions become normal text again.
 */
import type { Transaction } from '@tiptap/pm/state';
import type { Mark, MarkType, Node as PMNode } from '@tiptap/pm/model';

export type RevisionAction = 'accept' | 'reject';

export interface ResolveOptions {
  from?: number;
  to?: number;
  /** Only this pass (null/undefined = every pass). */
  pass?: number | null;
}

function types(doc: PMNode): { ins: MarkType; del: MarkType } | null {
  const ins = doc.type.schema.marks.revisionInsert;
  const del = doc.type.schema.marks.revisionDelete;
  return ins && del ? { ins, del } : null;
}

const matches = (mark: Mark | undefined, pass: number | null | undefined) => !!mark && (pass == null || mark.attrs.pass === pass);

export function resolveRevisions(tr: Transaction, action: RevisionAction, opts: ResolveOptions = {}): boolean {
  const doc = tr.doc;
  const t = types(doc);
  if (!t) return false;
  const from = Math.max(0, opts.from ?? 0);
  const to = Math.min(doc.content.size, opts.to ?? doc.content.size);
  const remove: [number, number][] = [];
  const unmark: { from: number; to: number; type: MarkType }[] = [];

  doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isInline) return true;
    const a = Math.max(pos, from);
    const b = Math.min(pos + node.nodeSize, to);
    if (a >= b) return false;
    const ins = t.ins.isInSet(node.marks);
    const del = t.del.isInSet(node.marks);
    if (action === 'accept') {
      if (matches(del, opts.pass)) remove.push([a, b]);
      else if (matches(ins, opts.pass)) unmark.push({ from: a, to: b, type: t.ins });
    } else if (matches(ins, opts.pass)) remove.push([a, b]);
    else if (matches(del, opts.pass)) unmark.push({ from: a, to: b, type: t.del });
    return false;
  });
  if (!remove.length && !unmark.length) return false;

  // A top-level paragraph whose whole text goes away is removed with it (no empty lines left behind).
  const blocks: [number, number][] = [];
  doc.forEach((node, offset) => {
    if (!node.isTextblock || node.content.size === 0 || offset < from || offset + node.nodeSize > to) return;
    const start = offset + 1;
    const end = offset + node.nodeSize - 1;
    let covered = 0;
    for (const [a, b] of remove) if (a >= start && b <= end) covered += b - a;
    if (covered === node.content.size) blocks.push([offset, offset + node.nodeSize]);
  });
  const allBlocks = blocks.length === doc.childCount;
  if (allBlocks) blocks.shift(); // keep one (now empty) paragraph so the document stays valid
  const ranges = [...remove.filter(([a, b]) => !blocks.some(([s, e]) => a >= s && b <= e)), ...blocks].sort((x, y) => x[0] - y[0]);

  // Merge touching ranges, then delete from the end so positions stay valid.
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  for (const u of unmark) tr.removeMark(u.from, u.to, u.type);
  for (let i = merged.length - 1; i >= 0; i--) tr.delete(merged[i][0], merged[i][1]);
  tr.setMeta('revisionSkip', true);
  return true;
}

export interface RevisionChange {
  from: number;
  to: number;
  kind: 'insert' | 'delete';
  pass: number;
}

/** Contiguous tracked changes in document order. */
export function listChanges(doc: PMNode): RevisionChange[] {
  const t = types(doc);
  if (!t) return [];
  const out: RevisionChange[] = [];
  doc.descendants((node, pos) => {
    if (!node.isInline) return true;
    const del = t.del.isInSet(node.marks);
    const ins = t.ins.isInSet(node.marks);
    const mark = del ?? ins;
    if (!mark) return false;
    const kind = del ? 'delete' : 'insert';
    const pass = mark.attrs.pass as number;
    const last = out[out.length - 1];
    if (last && last.to === pos && last.kind === kind && last.pass === pass) last.to = pos + node.nodeSize;
    else out.push({ from: pos, to: pos + node.nodeSize, kind, pass });
    return false;
  });
  return out;
}

/** The change under (or touching) a position, if any. */
export function changeAt(doc: PMNode, pos: number): RevisionChange | null {
  // Fast path: nothing tracked right next to the cursor.
  const $pos = doc.resolve(Math.min(Math.max(0, pos), doc.content.size));
  const tracked = (n: PMNode | null | undefined) => !!n?.marks.some((m) => m.type.name === 'revisionInsert' || m.type.name === 'revisionDelete');
  if (!tracked($pos.nodeBefore) && !tracked($pos.nodeAfter)) return null;
  const list = listChanges(doc);
  return list.find((c) => pos > c.from && pos < c.to) ?? list.find((c) => pos >= c.from && pos <= c.to) ?? null;
}

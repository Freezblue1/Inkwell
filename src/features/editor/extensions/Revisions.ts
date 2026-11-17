/**
 * Revision mode (tracked changes in colour-coded passes, like Scrivener's
 * revision colours). While a pass is active:
 *  - new text gets a `revisionInsert` mark in that pass's colour;
 *  - deleted text is kept, struck through, with a `revisionDelete` mark
 *    (deleting text you added in the same pass really deletes it);
 *  - paragraph breaks and formatting changes aren't tracked.
 * Accept/reject turns marks into final text (see revisions/resolve.ts).
 */
import { Extension, Mark, getMarkRange } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import { ReplaceStep, type Mapping } from '@tiptap/pm/transform';
import { Fragment, Slice, type MarkType, type Node as PMNode } from '@tiptap/pm/model';
import { getRevisionPass } from '../revisions/passes';
import { changeAt, listChanges, resolveRevisions, type RevisionAction } from '../revisions/resolve';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    revisions: {
      /** Accept/reject the selection, or the change under the cursor. */
      resolveRevisionAtSelection: (action: RevisionAction) => ReturnType;
      /** Accept/reject every change in the document (optionally one pass). */
      resolveAllRevisions: (action: RevisionAction, pass?: number | null) => ReturnType;
      /** Select the next/previous tracked change. */
      goToRevision: (dir: 1 | -1) => ReturnType;
    };
  }
}

const passAttr = {
  pass: {
    default: 1,
    parseHTML: (el: HTMLElement) => Number(el.getAttribute('data-pass')) || 1,
    renderHTML: (attrs: Record<string, unknown>) => ({ 'data-pass': String(attrs.pass) }),
  },

};

export const RevisionInsert = Mark.create({
  name: 'revisionInsert',
  inclusive: false,
  addAttributes: () => passAttr,
  parseHTML: () => [{ tag: 'span[data-rev-ins]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', { ...HTMLAttributes, 'data-rev-ins': '', class: 'rev-ins' }, 0],
});

export const RevisionDelete = Mark.create({
  name: 'revisionDelete',
  inclusive: false,
  addAttributes: () => passAttr,
  parseHTML: () => [{ tag: 'span[data-rev-del]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', { ...HTMLAttributes, 'data-rev-del': '', class: 'rev-del' }, 0],
});

const key = new PluginKey('revisionTracking');

/** Transactions that come from the person typing, pasting, cutting… */
function isTracked(tr: Transaction): boolean {
  return (
    tr.docChanged &&
    !tr.getMeta('revisionSkip') &&
    !tr.getMeta('history$') &&
    !tr.getMeta('preventUpdate') &&
    !tr.getMeta('appendedTransaction') &&
    tr.getMeta('addToHistory') !== false
  );
}

function hasInline(frag: Fragment): boolean {
  let found = false;
  frag.descendants((n) => {
    if (n.isInline) found = true;
    return !found;
  });
  return found;
}

/** Deleted content, re-marked as a tracked deletion (own same-pass insertions are dropped). */
function markDeleted(frag: Fragment, ins: MarkType, del: MarkType, pass: number): Fragment {
  const out: PMNode[] = [];
  frag.forEach((node) => {
    if (node.isInline) {
      const insMark = ins.isInSet(node.marks);
      if (insMark && insMark.attrs.pass === pass && !del.isInSet(node.marks)) return;
      out.push(del.isInSet(node.marks) ? node : node.mark(del.create({ pass }).addToSet(node.marks)));
    } else out.push(node.copy(markDeleted(node.content, ins, del, pass)));
  });
  return Fragment.fromArray(out);
}

function trackingPlugin(): Plugin {
  return new Plugin({
    key,
    appendTransaction(transactions, oldState: EditorState, newState: EditorState) {
      const pass = getRevisionPass();
      if (!pass || !transactions.some(isTracked)) return null;
      const ins = newState.schema.marks.revisionInsert;
      const del = newState.schema.marks.revisionDelete;
      if (!ins || !del) return null;

      // Mapping from the doc after transaction ti / step si to the final doc.
      const toEnd = (ti: number, si: number): Mapping => {
        const m = transactions[ti].mapping.slice(si + 1);
        for (let k = ti + 1; k < transactions.length; k++) m.appendMapping(transactions[k].mapping);
        return m;
      };

      const inserted: [number, number][] = [];
      const removed: { pos: number; slice: Slice; from: number; to: number }[] = [];
      transactions.forEach((tr, ti) => {
        if (!isTracked(tr)) return;
        tr.steps.forEach((step, si) => {
          if (!(step instanceof ReplaceStep)) return;
          const { from, to, slice } = step as unknown as { from: number; to: number; slice: Slice };
          const m = toEnd(ti, si);
          if (slice.size && hasInline(slice.content)) inserted.push([m.map(from, 1), m.map(from + slice.size, -1)]);
          if (to > from) {
            const gone = tr.docs[si].slice(from, to);
            if (!hasInline(gone.content)) return; // a joined paragraph: not tracked
            const kept = markDeleted(gone.content, ins, del, pass);
            if (!hasInline(kept)) return; // only own new text: really deleted
            removed.push({ pos: m.map(from, -1), slice: new Slice(kept, gone.openStart, gone.openEnd), from, to });
          }
        });
      });
      if (!inserted.length && !removed.length) return null;

      const tr = newState.tr;
      for (const [a, b] of inserted) {
        if (b <= a) continue;
        tr.removeMark(a, b, del);
        tr.addMark(a, b, ins.create({ pass }));
      }
      removed.sort((x, y) => y.pos - x.pos);
      for (const r of removed) tr.replace(r.pos, r.pos, r.slice);

      // Backspace moves left past what it "deleted"; Delete moves right.
      const sel = oldState.selection;
      if (transactions.length === 1 && removed.length === 1 && !inserted.length && sel.empty) {
        const r = removed[0];
        const start = tr.mapping.map(r.pos, -1);
        const end = start + r.slice.size;
        const target = sel.head === r.to ? start : end;
        tr.setSelection(TextSelection.create(tr.doc, Math.min(target, tr.doc.content.size)));
      }
      tr.setMeta('revisionSkip', true);
      return tr.docChanged || tr.selectionSet ? tr : null;
    },
  });
}

export const Revisions = Extension.create({
  name: 'revisions',

  addExtensions() {
    return [RevisionInsert, RevisionDelete];
  },

  addProseMirrorPlugins() {
    return [trackingPlugin()];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-.': () => this.editor.commands.goToRevision(1),
      'Mod-Alt-,': () => this.editor.commands.goToRevision(-1),
    };
  },

  addCommands() {
    return {
      resolveRevisionAtSelection:
        (action) =>
        ({ state, tr, dispatch }) => {
          const { from, to, empty } = state.selection;
          let range = empty ? null : { from, to };
          if (!range) {
            const c = changeAt(state.doc, from);
            if (!c) return false;
            const type = state.schema.marks[c.kind === 'insert' ? 'revisionInsert' : 'revisionDelete'];
            range = getMarkRange(state.doc.resolve(Math.min(Math.max(from, c.from + 1), c.to)), type) ?? { from: c.from, to: c.to };
          }
          if (!dispatch) return listChanges(state.doc).some((c) => c.to > range!.from && c.from < range!.to);
          return resolveRevisions(tr, action, range);
        },
      resolveAllRevisions:
        (action, pass = null) =>
        ({ state, tr, dispatch }) => {
          if (!dispatch) return listChanges(state.doc).some((c) => pass == null || c.pass === pass);
          return resolveRevisions(tr, action, { pass });
        },
      goToRevision:
        (dir) =>
        ({ state, tr, dispatch }) => {
          const list = listChanges(state.doc);
          if (!list.length) return false;
          const { from, to } = state.selection;
          const next = dir > 0 ? list.find((c) => c.from >= to) ?? list[0] : [...list].reverse().find((c) => c.to <= from) ?? list[list.length - 1];
          if (dispatch) tr.setSelection(TextSelection.create(state.doc, next.from, next.to)).scrollIntoView();
          return true;
        },
    };
  },
});

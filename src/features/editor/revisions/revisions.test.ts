// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { Editor, type JSONContent } from '@tiptap/core';
import { TextSelection } from '@tiptap/pm/state';
import { buildExtensions } from '../extensions';
import { setRevisionPass } from './passes';
import { listChanges } from './resolve';
import { resolveRevisionsInJson } from './project';
import { docToCountableText } from '@/lib/text';
import { pmCountableText } from '../extensions/textblocks';
import { jsonToBlocks } from '@/lib/compile/blocks';

const cb = { onFootnoteEdit: () => {}, onCommentClick: () => {}, onMentionClick: () => {}, onUndoEmpty: () => false, onRedoEmpty: () => false };
const make = (html = '<p>Hello world</p>') => new Editor({ extensions: buildExtensions(cb), content: html });
const text = (ed: Editor) => ed.state.doc.textContent;
/** Text with [+inserted+] and [-deleted-] markers. */
function marked(ed: Editor): string {
  let out = '';
  ed.state.doc.descendants((n) => {
    if (n.isTextblock && out) out += '|';
    if (!n.isText) return true;
    const ins = n.marks.find((m) => m.type.name === 'revisionInsert');
    const del = n.marks.find((m) => m.type.name === 'revisionDelete');
    out += del ? `[-${n.text}-]${del.attrs.pass}` : ins ? `[+${n.text}+]${ins.attrs.pass}` : n.text;
    return false;
  });
  return out;
}
/** Mimics a native Backspace: deletes the character before the cursor. */
function backspace(ed: Editor) {
  const pos = ed.state.selection.head;
  ed.view.dispatch(ed.state.tr.delete(pos - 1, pos));
}
function forwardDelete(ed: Editor) {
  const pos = ed.state.selection.head;
  ed.view.dispatch(ed.state.tr.delete(pos, pos + 1));
}
function type(ed: Editor, s: string) {
  for (const ch of s) ed.view.dispatch(ed.state.tr.insertText(ch));
}

afterEach(() => setRevisionPass(null));

describe('revision mode tracking', () => {
  it('does nothing when revision mode is off', () => {
    const ed = make();
    ed.commands.setTextSelection(6);
    type(ed, ' big');
    expect(marked(ed)).toBe('Hello big world');
  });

  it('colours new text with the active pass', () => {
    const ed = make();
    setRevisionPass(2);
    ed.commands.setTextSelection(6);
    type(ed, ' big');
    expect(marked(ed)).toBe('Hello[+ big+]2 world');
  });

  it('keeps deleted text struck through, and Backspace walks left past it', () => {
    const ed = make();
    setRevisionPass(1);
    ed.commands.setTextSelection(12); // end of "world"
    backspace(ed);
    backspace(ed);
    expect(marked(ed)).toBe('Hello wor[-ld-]1');
    expect(ed.state.selection.head).toBe(10); // before "ld"
    expect(text(ed)).toBe('Hello world');
  });

  it('Delete moves right past what it deleted', () => {
    const ed = make();
    setRevisionPass(1);
    ed.commands.setTextSelection(1);
    forwardDelete(ed);
    forwardDelete(ed);
    expect(marked(ed)).toBe('[-He-]1llo world');
    expect(ed.state.selection.head).toBe(3);
  });

  it('really deletes text added in the same pass, but tracks deleting an earlier pass', () => {
    const ed = make();
    setRevisionPass(1);
    ed.commands.setTextSelection(6);
    type(ed, ' big');
    backspace(ed);
    expect(marked(ed)).toBe('Hello[+ bi+]1 world');
    setRevisionPass(2);
    backspace(ed);
    expect(marked(ed)).toBe('Hello[+ b+]1[-i-]2 world');
  });

  it('typing over a selection keeps the old words before the new ones', () => {
    const ed = make();
    setRevisionPass(3);
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 7, 12)).insertText('there'));
    expect(marked(ed)).toBe('Hello [-world-]3[+there+]3');
  });

  it('does not track joining paragraphs, and one undo removes the whole tracked edit', () => {
    const ed = make('<p>One</p><p>Two</p>');
    setRevisionPass(1);
    ed.view.dispatch(ed.state.tr.delete(4, 6)); // Backspace at the start of "Two"
    expect(ed.state.doc.childCount).toBe(1);
    ed.commands.setTextSelection(4);
    type(ed, '!');
    expect(marked(ed)).toBe('One[+!+]1Two');
    ed.commands.undo();
    expect(text(ed)).not.toContain('!');
    expect(listChanges(ed.state.doc)).toHaveLength(0);
  });

  it('leaves deleted text out of word counts and the compiled book', () => {
    const ed = make('<p>Hello cruel world</p>');
    setRevisionPass(1);
    ed.view.dispatch(ed.state.tr.delete(7, 13)); // "cruel "
    const json = ed.getJSON();
    expect(docToCountableText(json)).toBe('Hello world');
    expect(pmCountableText(ed.state.doc)).toBe('Hello world');
    const blocks = jsonToBlocks(json, []);
    expect(blocks[0].type === 'paragraph' && blocks[0].runs.map((r) => r.text).join('')).toBe('Hello world');
  });
});

describe('accept and reject', () => {
  function edited() {
    const ed = make('<p>The cat sat.</p><p>Old line.</p>');
    setRevisionPass(1);
    ed.view.dispatch(ed.state.tr.setSelection(TextSelection.create(ed.state.doc, 5, 8)).insertText('dog')); // cat → dog
    setRevisionPass(2);
    const p2 = ed.state.doc.child(0).nodeSize;
    ed.view.dispatch(ed.state.tr.delete(p2 + 1, p2 + 1 + 'Old line.'.length)); // whole second paragraph
    setRevisionPass(null);
    return ed;
  }

  it('lists changes by pass', () => {
    const ed = edited();
    expect(listChanges(ed.state.doc).map((c) => `${c.kind}${c.pass}`)).toEqual(['delete1', 'insert1', 'delete2']);
  });

  it('accepts everything: insertions stay, deletions go, emptied paragraphs disappear', () => {
    const ed = edited();
    ed.commands.resolveAllRevisions('accept');
    expect(marked(ed)).toBe('The dog sat.');
    expect(ed.state.doc.childCount).toBe(1);
  });

  it('rejects everything: back to the original', () => {
    const ed = edited();
    ed.commands.resolveAllRevisions('reject');
    expect(marked(ed)).toBe('The cat sat.|Old line.');
  });

  it('can accept one pass only', () => {
    const ed = edited();
    ed.commands.resolveAllRevisions('accept', 2);
    expect(marked(ed)).toBe('The [-cat-]1[+dog+]1 sat.');
  });

  it('accepts or rejects the change under the cursor', () => {
    const ed = edited();
    ed.commands.setTextSelection(9); // inside "dog"
    ed.commands.resolveRevisionAtSelection('reject');
    expect(marked(ed)).toBe('The [-cat-]1 sat.|[-Old line.-]2');
    ed.commands.setTextSelection(6); // inside "cat"
    ed.commands.resolveRevisionAtSelection('reject');
    expect(marked(ed)).toBe('The cat sat.|[-Old line.-]2');
  });

  it('jumps between changes', () => {
    const ed = edited();
    ed.commands.setTextSelection(1);
    ed.commands.goToRevision(1);
    expect(ed.state.doc.textBetween(ed.state.selection.from, ed.state.selection.to)).toBe('cat');
    ed.commands.goToRevision(1);
    expect(ed.state.doc.textBetween(ed.state.selection.from, ed.state.selection.to)).toBe('dog');
    ed.commands.goToRevision(-1);
    expect(ed.state.doc.textBetween(ed.state.selection.from, ed.state.selection.to)).toBe('cat');
  });

  it('resolves stored documents without an editor (project-wide)', () => {
    const json = edited().getJSON() as JSONContent;
    const accepted = resolveRevisionsInJson(json, 'accept');
    expect(accepted.changed).toBe(true);
    expect(docToCountableText(accepted.json)).toBe('The dog sat.');
    expect(JSON.stringify(accepted.json)).not.toContain('revision');
    const untouched = resolveRevisionsInJson({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Plain' }] }] }, 'accept');
    expect(untouched.changed).toBe(false);
  });
});

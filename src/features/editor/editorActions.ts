/** Editor commands that need the store (comments, footnotes, split, links…). */
import type { Editor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import type { ID } from '@/types/models';
import { useStore } from '@/store';
import { promptDialog } from '@/components/DialogHost';
import { findCommentRange } from './extensions/Comment';
import { forEachTextblock } from './extensions/textblocks';

/** Opens the inspector on a given tab (desktop panel or tablet/mobile drawer). */
export function revealInspector(tab: 'comments' | 'snapshots' | 'synopsis' | 'metadata' | 'links') {
  const s = useStore.getState();
  s.setInspectorTab(tab);
  if (window.innerWidth >= 1200) s.updateLayout({ inspectorOpen: true });
  else s.setInspectorDrawer(true);
}

export async function addCommentToSelection(editor: Editor, docId: ID) {
  const s = useStore.getState();
  const { from, to, empty } = editor.state.selection;
  if (empty) {
    s.notify('Select some text to comment on.', 'info');
    return;
  }
  const quote = editor.state.doc.textBetween(from, to, ' ', ' ').slice(0, 280);
  const comment = await s.createComment(docId, quote);
  editor.chain().focus().setComment(comment.id).run();
  s.setFocusComment(comment.id);
  revealInspector('comments');
}

export function insertFootnote(editor: Editor) {
  editor.chain().focus().insertFootnote('').run();
  const pos = editor.state.selection.from - 1;
  useStore.getState().setFootnoteEdit({ pos, text: '' });
}

export async function editLink(editor: Editor) {
  const prev = editor.getAttributes('link').href as string | undefined;
  const url = await promptDialog({ title: prev ? 'Edit link' : 'Add link', label: 'URL (leave empty to remove)', initial: prev ?? 'https://' });
  if (url === null) return;
  const chain = editor.chain().focus().extendMarkRange('link');
  if (!url.trim() || url.trim() === 'https://') chain.unsetLink().run();
  else chain.setLink({ href: url.trim() }).run();
}

/** Selects and scrolls to a comment's text in the given editor. */
export function revealComment(editor: Editor, commentId: ID): boolean {
  const range = findCommentRange(editor.state.doc, commentId);
  if (!range) return false;
  editor.chain().focus().setTextSelection(range).scrollIntoView().run();
  return true;
}

/** Splits the editor's document at the cursor into two binder documents. */
export async function splitAtCursor(editor: Editor, docId: ID) {
  const s = useStore.getState();
  const { from } = editor.state.selection;
  const doc = editor.state.doc;
  if (from <= 1 || from >= doc.content.size - 1) {
    s.notify('Place the cursor inside the text where you want to split.', 'info');
    return;
  }
  const before = doc.cut(0, from).toJSON() as JSONContent;
  const after = doc.cut(from).toJSON() as JSONContent;
  const title = await promptDialog({ title: 'Split document', label: 'Title of the new document', initial: `${s.docs[docId]?.title ?? 'Scene'} (cont.)` });
  if (title === null) return;
  const newId = await s.splitDoc(docId, before, after, title || undefined);
  s.notify('Document split', 'success', { label: 'Open new part', run: () => useStore.getState().openDoc(newId) });
}

/** The word under or around the selection (for dictionary lookup). */
export function selectedWord(editor: Editor): string {
  const { from, to, empty } = editor.state.selection;
  if (!empty) return editor.state.doc.textBetween(from, to, ' ').trim().split(/\s+/)[0] ?? '';
  const $pos = editor.state.selection.$from;
  const text = $pos.parent.textContent;
  const offset = $pos.parentOffset;
  const left = text.slice(0, offset).match(/[\p{L}'’-]*$/u)?.[0] ?? '';
  const right = text.slice(offset).match(/^[\p{L}'’-]*/u)?.[0] ?? '';
  return (left + right).trim();
}

/**
 * Opens a document in the Write view and selects the first place where `text`
 * appears (used by the continuity checker and dialogue view).
 */
export async function revealText(docId: ID, text: string): Promise<boolean> {
  const s = useStore.getState();
  s.setView('write');
  s.openDoc(docId);
  const needle = text.trim();
  for (let i = 0; i < 50; i++) {
    await new Promise((r) => setTimeout(r, 80));
    const st = useStore.getState();
    const ed = st.activeEditor;
    if (!ed || ed.isDestroyed || st.activeEditorDocId !== docId) continue;
    if (!needle) return true;
    let range: { from: number; to: number } | null = null;
    forEachTextblock(ed.state.doc, (blockText, start) => {
      if (range) return;
      const at = blockText.indexOf(needle);
      if (at >= 0) range = { from: start + at, to: start + at + needle.length };
    });
    if (range) ed.chain().focus().setTextSelection(range).scrollIntoView().run();
    else ed.commands.focus();
    return !!range;
  }
  return false;
}

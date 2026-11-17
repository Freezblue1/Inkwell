/**
 * A single TipTap editor bound to one binder document.
 * Loads content lazily, autosaves, reports live stats, supports persistent
 * undo, typewriter scrolling, focus dimming and proofreading highlights.
 */
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import type { JSONContent } from '@tiptap/core';
import { Box, Skeleton } from '@mui/material';
import type { FocusDim, ID } from '@/types/models';
import { useStore } from '@/store';
import { getContent, listRevisions } from '@/db/repos/documents';
import { docToText, emptyDoc } from '@/lib/text';
import { countCharacters, countWords } from '@/lib/wordCount';
import { relativeTime } from '@/lib/dates';
import { buildExtensions } from './extensions';
import { pmCountableText } from './extensions/textblocks';
import { flushSave, scheduleSave, takeRecovery } from './autosave';
import { addCommentToSelection, revealInspector } from './editorActions';
import { EditorBubbleMenu } from './EditorBubbleMenu';
import { ViewSkeleton } from '@/components/ViewSkeleton';

export type EditorVariant = 'page' | 'scrivenings' | 'focus' | 'split';

interface DocEditorProps {
  docId: ID;
  variant?: EditorVariant;
  autoFocus?: boolean;
  dim?: FocusDim;
  typewriter?: boolean;
}

const ALL_PROOF_KINDS = ['adverb', 'filler', 'misspelling', 'repeat', 'passive'] as const;

/** Loads a document's content, then mounts the editor. */
export const DocEditor = memo(function DocEditor(props: DocEditorProps) {
  const { docId, variant = 'page' } = props;
  const version = useStore((s) => s.contentVersion[docId] ?? 0);
  const [loaded, setLoaded] = useState<{ json: JSONContent; recovered: boolean } | null>(null);

  useEffect(() => {
    let alive = true;
    setLoaded(null);
    (async () => {
      await flushSave(docId);
      const row = await getContent(docId);
      const recovered = takeRecovery(docId, row?.updatedAt ?? 0);
      if (alive) setLoaded({ json: recovered ?? row?.json ?? emptyDoc(), recovered: !!recovered });
    })().catch((e) => {
      console.error(e);
      if (alive) setLoaded({ json: emptyDoc(), recovered: false });
    });
    return () => {
      alive = false;
    };
  }, [docId, version]);

  if (!loaded) {
    return variant === 'scrivenings' ? (
      <Box sx={{ py: 2 }} aria-busy="true">
        <Skeleton variant="text" />
        <Skeleton variant="text" width="80%" />
      </Box>
    ) : (
      <ViewSkeleton variant="editor" />
    );
  }
  return <LoadedEditor key={`${docId}:${version}`} {...props} initial={loaded.json} recovered={loaded.recovered} />;
});

interface LoadedProps extends DocEditorProps {
  initial: JSONContent;
  recovered: boolean;
}

function LoadedEditor({ docId, variant = 'page', autoFocus, dim = 'off', typewriter = false, initial, recovered }: LoadedProps) {
  const spellcheck = useStore((s) => s.settings.editor.spellcheck);
  const proofreading = useStore((s) => s.proofreading);
  const title = useStore((s) => s.docs[docId]?.title ?? 'document');
  const editorRef = useRef<Editor | null>(null);
  const statsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoState = useRef<{ pointer: number; redo: JSONContent[] }>({ pointer: Infinity, redo: [] });
  const typewriterRef = useRef(typewriter);
  typewriterRef.current = typewriter;

  const extensions = useMemo(
    () =>
      buildExtensions({
        placeholder: variant === 'scrivenings' ? 'Empty — click to write…' : 'Start writing…',
        onFootnoteEdit: (pos, text) => {
          const ed = editorRef.current;
          if (ed) useStore.getState().setActiveEditor(ed, docId);
          useStore.getState().setFootnoteEdit({ pos, text });
        },
        onCommentClick: (id) => {
          useStore.getState().setFocusComment(id);
          revealInspector('comments');
        },
        onMentionClick: (id) => useStore.getState().openBibleEntry(id),
        onUndoEmpty: () => {
          void persistentUndo();
          return true;
        },
        onRedoEmpty: () => {
          const ed = editorRef.current;
          const next = undoState.current.redo.pop();
          if (!ed || !next) return false;
          ed.chain()
            .command(({ tr }) => {
              tr.setMeta('addToHistory', false);
              return true;
            })
            .setContent(next, true)
            .run();
          if (!undoState.current.redo.length) undoState.current.pointer = Infinity;
          return true;
        },
      }),
    // Built once per document; callbacks read live state through refs/the store.
    [docId],
  );

  /** Steps back through saved revisions once the in-memory history is exhausted. */
  async function persistentUndo() {
    const ed = editorRef.current;
    if (!ed) return;
    await flushSave(docId);
    const revs = await listRevisions(docId);
    const currentText = docToText(ed.getJSON());
    const target = revs.find((r) => r.createdAt < undoState.current.pointer && r.text !== currentText);
    if (!target) {
      useStore.getState().notify('Nothing older to undo for this document.', 'info');
      return;
    }
    undoState.current.redo.push(ed.getJSON());
    undoState.current.pointer = target.createdAt;
    ed.chain()
      .command(({ tr }) => {
        tr.setMeta('addToHistory', false);
        return true;
      })
      .setContent(target.json, true)
      .run();
    useStore.getState().notify(`Restored the saved version from ${relativeTime(target.createdAt)} (Ctrl+Shift+Z to redo).`, 'info');
  }

  const reportStats = (ed: Editor, immediate = false) => {
    const run = () => {
      if (ed.isDestroyed) return;
      const text = pmCountableText(ed.state.doc);
      const { from, to, empty } = ed.state.selection;
      const sel = empty ? '' : ed.state.doc.textBetween(from, to, '\n', ' ');
      useStore.getState().setLiveStats({
        docId,
        words: countWords(text),
        chars: countCharacters(text),
        selWords: countWords(sel),
        selChars: countCharacters(sel),
      });
    };
    if (statsTimer.current) clearTimeout(statsTimer.current);
    if (immediate) run();
    else statsTimer.current = setTimeout(run, 250);
  };

  const typewriterScroll = (ed: Editor) => {
    if (!typewriterRef.current || ed.isDestroyed) return;
    const container = ed.view.dom.closest('[data-scroll-container]') as HTMLElement | null;
    if (!container) return;
    try {
      const coords = ed.view.coordsAtPos(ed.state.selection.head);
      const rect = container.getBoundingClientRect();
      const delta = coords.top - (rect.top + rect.height * 0.45);
      if (Math.abs(delta) > 4) {
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        container.scrollBy({ top: delta, behavior: reduce ? 'auto' : 'smooth' });
      }
    } catch {
      /* position not rendered yet */
    }
  };

  const editor = useEditor({
    extensions,
    content: initial,
    autofocus: autoFocus ? 'end' : false,
    shouldRerenderOnTransaction: false,
    immediatelyRender: true,
    editorProps: {
      attributes: {
        class: 'ink-prose',
        spellcheck: String(spellcheck),
        'aria-label': `Text of ${title}`,
        'aria-multiline': 'true',
        role: 'textbox',
      },
    },
    onCreate: ({ editor: ed }) => {
      editorRef.current = ed;
      if (recovered) {
        scheduleSave(docId, ed.state.doc, 100);
        useStore.getState().notify(`Recovered unsaved changes in “${title}”.`, 'info');
      }
      if (autoFocus) {
        useStore.getState().setActiveEditor(ed, docId);
        reportStats(ed, true);
      }
    },
    onUpdate: ({ editor: ed }) => {
      scheduleSave(docId, ed.state.doc);
      reportStats(ed);
      typewriterScroll(ed);
    },
    onSelectionUpdate: ({ editor: ed }) => {
      if (useStore.getState().activeEditor === ed) reportStats(ed);
      typewriterScroll(ed);
    },
    onFocus: ({ editor: ed }) => {
      useStore.getState().setActiveEditor(ed, docId);
      reportStats(ed, true);
    },
    onBlur: () => {
      void flushSave(docId);
    },
  });

  // Keep the ref in sync and clean up on unmount (flush + unregister).
  useEffect(() => {
    editorRef.current = editor;
    return () => {
      void flushSave(docId);
      if (statsTimer.current) clearTimeout(statsTimer.current);
      const s = useStore.getState();
      if (s.activeEditor === editor) s.setActiveEditor(null, null);
    };
  }, [editor, docId]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.view.dom.setAttribute('spellcheck', String(spellcheck));
  }, [editor, spellcheck]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.setFocusDim(dim);
  }, [editor, dim]);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.commands.setAnalysisKinds(proofreading ? [...ALL_PROOF_KINDS] : []);
  }, [editor, proofreading]);

  // Ctrl+Alt+M from the Comment extension.
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handler = () => void addCommentToSelection(editor, docId);
    dom.addEventListener('inkwell:add-comment', handler);
    return () => dom.removeEventListener('inkwell:add-comment', handler);
  }, [editor, docId]);

  if (!editor) return null;
  return (
    <>
      <EditorContent editor={editor} />
      <EditorBubbleMenu editor={editor} docId={docId} />
    </>
  );
}

/** Assembles the TipTap extension list for an editor instance. */
import type { Extensions } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import Typography from '@tiptap/extension-typography';
import CharacterCount from '@tiptap/extension-character-count';
import Placeholder from '@tiptap/extension-placeholder';
import Link from '@tiptap/extension-link';
import { SceneBreak } from './SceneBreak';
import { Footnote } from './Footnote';
import { Comment } from './Comment';
import { SearchHighlight } from './SearchHighlight';
import { FocusHighlight } from './FocusHighlight';
import { AnalysisHighlight } from './AnalysisHighlight';
import { PersistentUndo } from './PersistentUndo';
import { createInkMention } from './InkMention';
import { Revisions } from './Revisions';

export interface EditorCallbacks {
  placeholder?: string;
  onFootnoteEdit: (pos: number, text: string) => void;
  onCommentClick: (commentId: string) => void;
  onMentionClick: (id: string) => void;
  onUndoEmpty: () => boolean;
  onRedoEmpty: () => boolean;
}

export function buildExtensions(cb: EditorCallbacks): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      horizontalRule: false,
      codeBlock: false,
      code: false,
      history: { depth: 500, newGroupDelay: 600 },
    }),
    Underline,
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Highlight.configure({ multicolor: true }),
    Typography,
    CharacterCount,
    Placeholder.configure({ placeholder: cb.placeholder ?? 'Start writing…' }),
    Link.configure({ openOnClick: false, autolink: true, HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' } }),
    SceneBreak,
    Footnote.configure({ onEdit: cb.onFootnoteEdit }),
    Comment.configure({ onClick: cb.onCommentClick }),
    createInkMention(cb.onMentionClick),
    Revisions,
    SearchHighlight,
    FocusHighlight,
    AnalysisHighlight,
    PersistentUndo.configure({ onUndoEmpty: cb.onUndoEmpty, onRedoEmpty: cb.onRedoEmpty }),
  ];
}

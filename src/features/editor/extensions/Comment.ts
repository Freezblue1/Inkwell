/**
 * Comment mark: wraps commented text with a `commentId`. The comment body
 * lives in the `comments` table; resolved comments are hidden via CSS.
 */
import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    comment: {
      setComment: (commentId: string) => ReturnType;
      removeCommentById: (commentId: string) => ReturnType;
    };
  }
}

export interface CommentOptions {
  onClick: (commentId: string) => void;
}

export const Comment = Mark.create<CommentOptions>({
  name: 'comment',
  inclusive: false,
  excludes: '',

  addOptions() {
    return { onClick: () => {} };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => el.getAttribute('data-comment-id'),
        renderHTML: (attrs) => ({ 'data-comment-id': attrs.commentId }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'comment-mark' }), 0];
  },

  addCommands() {
    return {
      setComment:
        (commentId) =>
        ({ commands }) =>
          commands.setMark(this.name, { commentId }),
      removeCommentById:
        (commentId) =>
        ({ tr, state, dispatch }) => {
          const type = state.schema.marks[this.name];
          let found = false;
          state.doc.descendants((node, pos) => {
            node.marks.forEach((m) => {
              if (m.type === type && m.attrs.commentId === commentId) {
                found = true;
                if (dispatch) tr.removeMark(pos, pos + node.nodeSize, m);
              }
            });
          });
          return found;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Handled by the editor UI (needs the store); kept here for discoverability.
      'Mod-Alt-m': () => {
        this.editor.view.dom.dispatchEvent(new CustomEvent('inkwell:add-comment', { bubbles: true }));
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    const onClick = this.options.onClick;
    return [
      new Plugin({
        key: new PluginKey('commentClick'),
        props: {
          handleClick(_view, _pos, event) {
            const el = (event.target as HTMLElement | null)?.closest?.('[data-comment-id]');
            const id = el?.getAttribute('data-comment-id');
            if (id) onClick(id);
            return false;
          },
        },
      }),
    ];
  },
});

/** Finds the document range covered by a comment. */
export function findCommentRange(doc: import('@tiptap/pm/model').Node, commentId: string): { from: number; to: number } | null {
  let from = -1;
  let to = -1;
  doc.descendants((node, pos) => {
    if (node.marks.some((m) => m.type.name === 'comment' && m.attrs.commentId === commentId)) {
      if (from < 0) from = pos;
      to = pos + node.nodeSize;
    }
  });
  return from >= 0 ? { from, to } : null;
}

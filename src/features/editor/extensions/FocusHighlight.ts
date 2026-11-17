/**
 * Focus-mode highlighting: marks the current paragraph (and optionally the
 * current sentence) so CSS can dim everything else.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { FocusDim } from '@/types/models';
import { textblockText } from './textblocks';

const focusKey = new PluginKey<FocusDim>('inkwellFocus');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    focusHighlight: {
      setFocusDim: (mode: FocusDim) => ReturnType;
    };
  }
}

const SENTENCE_END = /[.!?…]+["'”’)\]]*\s+/g;

/** Start/end offsets of the sentence containing `offset`. */
export function sentenceBounds(text: string, offset: number): [number, number] {
  let start = 0;
  let end = text.length;
  SENTENCE_END.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SENTENCE_END.exec(text))) {
    const boundary = m.index + m[0].length;
    if (boundary <= offset) start = boundary;
    else {
      end = m.index + m[0].trimEnd().length;
      break;
    }
  }
  return [start, Math.max(start, end)];
}

export const FocusHighlight = Extension.create({
  name: 'focusHighlight',

  addCommands() {
    return {
      setFocusDim:
        (mode) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(focusKey, mode);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<FocusDim>({
        key: focusKey,
        state: {
          init: () => 'off',
          apply: (tr, prev) => (tr.getMeta(focusKey) as FocusDim | undefined) ?? prev,
        },
        props: {
          decorations(state) {
            const mode = focusKey.getState(state);
            if (!mode || mode === 'off') return DecorationSet.empty;
            const { $head } = state.selection;
            if ($head.depth < 1) return DecorationSet.empty;
            const top = $head.before(1);
            const topNode = state.doc.nodeAt(top);
            if (!topNode) return DecorationSet.empty;
            const decos = [Decoration.node(top, top + topNode.nodeSize, { class: 'focus-current' })];
            if (mode === 'sentence' && $head.parent.isTextblock) {
              const text = textblockText($head.parent);
              const [s, e] = sentenceBounds(text, $head.parentOffset);
              const base = $head.start();
              if (e > s) decos.push(Decoration.inline(base + s, base + e, { class: 'focus-sentence' }));
            }
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

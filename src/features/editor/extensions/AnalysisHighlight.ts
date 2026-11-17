/**
 * Proofreading highlights: adverbs, filler words, common misspellings,
 * repeated words and passive voice, shown as underline decorations.
 * Only computed while proofreading mode is on.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { findIssues, type IssueKind } from '@/lib/proofread';
import { forEachTextblock } from './textblocks';

interface AnalysisState {
  kinds: IssueKind[];
  decorations: DecorationSet;
}

export const analysisKey = new PluginKey<AnalysisState>('inkwellAnalysis');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    analysisHighlight: {
      setAnalysisKinds: (kinds: IssueKind[]) => ReturnType;
    };
  }
}

function build(doc: PMNode, kinds: IssueKind[]): DecorationSet {
  if (!kinds.length) return DecorationSet.empty;
  const set = new Set(kinds);
  const decos: Decoration[] = [];
  forEachTextblock(doc, (text, start) => {
    for (const issue of findIssues(text, set)) {
      decos.push(
        Decoration.inline(start + issue.index, start + issue.index + issue.length, {
          class: `hl-${issue.kind}`,
          title: issue.suggestion ? `${issue.message}: “${issue.suggestion}”` : issue.message,
          'data-suggestion': issue.suggestion ?? '',
        }),
      );
    }
  });
  return DecorationSet.create(doc, decos);
}

export const AnalysisHighlight = Extension.create({
  name: 'analysisHighlight',

  addCommands() {
    return {
      setAnalysisKinds:
        (kinds) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(analysisKey, kinds);
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<AnalysisState>({
        key: analysisKey,
        state: {
          init: () => ({ kinds: [], decorations: DecorationSet.empty }),
          apply(tr, prev) {
            const meta = tr.getMeta(analysisKey) as IssueKind[] | undefined;
            if (meta) return { kinds: meta, decorations: build(tr.doc, meta) };
            if (tr.docChanged && prev.kinds.length) return { kinds: prev.kinds, decorations: build(tr.doc, prev.kinds) };
            return prev;
          },
        },
        props: {
          decorations: (state) => analysisKey.getState(state)?.decorations ?? DecorationSet.empty,
        },
      }),
    ];
  },
});

/**
 * In-document Find & Replace. Matches are computed per textblock (so they
 * work across bold/italic boundaries) and shown as decorations.
 */
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { buildFindRegex, expandReplacement, findAll, type FindOptions } from '@/lib/findRegex';
import { forEachTextblock, LEAF } from './textblocks';

export interface SearchQuery {
  term: string;
  options: FindOptions;
}

export interface SearchMatch {
  from: number;
  to: number;
  text: string;
}

interface SearchState {
  query: SearchQuery | null;
  matches: SearchMatch[];
  current: number;
  decorations: DecorationSet;
}

export const searchKey = new PluginKey<SearchState>('inkwellSearch');

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    search: {
      setSearchQuery: (query: SearchQuery | null) => ReturnType;
      gotoSearchMatch: (index: number) => ReturnType;
      replaceCurrentMatch: (replacement: string) => ReturnType;
      replaceAllMatches: (replacement: string) => ReturnType;
    };
  }
}

export function computeMatches(doc: PMNode, query: SearchQuery | null): SearchMatch[] {
  if (!query?.term) return [];
  const re = buildFindRegex(query.term, query.options);
  if (!re) return [];
  const out: SearchMatch[] = [];
  forEachTextblock(doc, (text, start) => {
    for (const m of findAll(text, re)) {
      if (m.text.includes(LEAF)) continue;
      out.push({ from: start + m.index, to: start + m.index + m.length, text: m.text });
    }
  });
  return out;
}

function decorate(doc: PMNode, matches: SearchMatch[], current: number): DecorationSet {
  if (!matches.length) return DecorationSet.empty;
  return DecorationSet.create(
    doc,
    matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === current ? 'search-match search-match-current' : 'search-match' })),
  );
}

function build(doc: PMNode, query: SearchQuery | null, current: number): SearchState {
  const matches = computeMatches(doc, query);
  const cur = matches.length ? Math.min(Math.max(current, 0), matches.length - 1) : -1;
  return { query, matches, current: cur, decorations: decorate(doc, matches, cur) };
}

export function getSearchState(state: EditorState): SearchState | undefined {
  return searchKey.getState(state);
}

export const SearchHighlight = Extension.create({
  name: 'searchHighlight',

  addCommands() {
    return {
      setSearchQuery:
        (query) =>
        ({ tr, dispatch, state }) => {
          if (dispatch) {
            // Start at the first match after the cursor.
            const matches = computeMatches(state.doc, query);
            const head = state.selection.from;
            const idx = Math.max(0, matches.findIndex((m) => m.from >= head));
            tr.setMeta(searchKey, { query, current: idx });
          }
          return true;
        },
      gotoSearchMatch:
        (index) =>
        ({ tr, dispatch, state }) => {
          const s = searchKey.getState(state);
          if (!s?.matches.length) return false;
          const i = ((index % s.matches.length) + s.matches.length) % s.matches.length;
          const m = s.matches[i];
          if (dispatch) {
            tr.setMeta(searchKey, { query: s.query, current: i });
            tr.setSelection(TextSelection.create(tr.doc, m.from, m.to));
            tr.scrollIntoView();
          }
          return true;
        },
      replaceCurrentMatch:
        (replacement) =>
        ({ tr, dispatch, state }) => {
          const s = searchKey.getState(state);
          if (!s?.query || s.current < 0) return false;
          const m = s.matches[s.current];
          const re = buildFindRegex(s.query.term, s.query.options)!;
          if (dispatch) {
            const text = expandReplacement(m.text, re, replacement, s.query.options.regex);
            replaceRange(tr, m.from, m.to, text);
            tr.setMeta(searchKey, { query: s.query, current: s.current });
          }
          return true;
        },
      replaceAllMatches:
        (replacement) =>
        ({ tr, dispatch, state }) => {
          const s = searchKey.getState(state);
          if (!s?.query || !s.matches.length) return false;
          const re = buildFindRegex(s.query.term, s.query.options)!;
          if (dispatch) {
            for (let i = s.matches.length - 1; i >= 0; i--) {
              const m = s.matches[i];
              replaceRange(tr, m.from, m.to, expandReplacement(m.text, re, replacement, s.query.options.regex));
            }
            tr.setMeta(searchKey, { query: s.query, current: 0 });
          }
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<SearchState>({
        key: searchKey,
        state: {
          init: () => ({ query: null, matches: [], current: -1, decorations: DecorationSet.empty }),
          apply(tr, prev) {
            const meta = tr.getMeta(searchKey) as { query: SearchQuery | null; current: number } | undefined;
            if (meta) return build(tr.doc, meta.query, meta.current);
            if (tr.docChanged && prev.query) return build(tr.doc, prev.query, prev.current);
            return prev;
          },
        },
        props: {
          decorations(state) {
            return searchKey.getState(state)?.decorations ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

/** Replaces a range with text, keeping the marks of the first replaced character. */
export function replaceRange(tr: Transaction, from: number, to: number, text: string) {
  const marks = tr.doc.resolve(from + 1).marks();
  if (text) tr.replaceWith(from, to, tr.doc.type.schema.text(text, marks));
  else tr.delete(from, to);
}

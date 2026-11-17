/**
 * @-mentions of story bible entries (characters, locations, items, lore).
 * Mentions are atoms linking to the entry id; clicking one opens it.
 */
import Mention from '@tiptap/extension-mention';
import { mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import type { BibleEntry } from '@/types/models';
import { useStore } from '@/store';
import { MentionList, type MentionListHandle, type MentionListProps } from './MentionList';

export interface InkMentionOptionsExtra {
  onMentionClick: (id: string) => void;
}

function positionPopup(el: HTMLElement, rect: DOMRect | null | undefined) {
  if (!rect) return;
  const below = rect.bottom + 6;
  const fitsBelow = below + 280 < window.innerHeight;
  el.style.left = `${Math.min(rect.left, window.innerWidth - 330)}px`;
  el.style.top = fitsBelow ? `${below}px` : `${Math.max(8, rect.top - 286)}px`;
}

export function createInkMention(onMentionClick: (id: string) => void) {
  return Mention.extend({
    addAttributes() {
      return {
        ...this.parent?.(),
        kind: {
          default: 'character',
          parseHTML: (el: HTMLElement) => el.getAttribute('data-kind'),
          renderHTML: (attrs: Record<string, unknown>) => ({ 'data-kind': attrs.kind }),
        },
      };
    },
    addProseMirrorPlugins() {
      return [
        ...(this.parent?.() ?? []),
        new Plugin({
          key: new PluginKey('mentionClick'),
          props: {
            handleClickOn(_view, _pos, node) {
              if (node.type.name !== 'mention') return false;
              onMentionClick(String(node.attrs.id));
              return true;
            },
          },
        }),
      ];
    },
  }).configure({
    HTMLAttributes: { class: 'mention' },
    renderText: ({ node }) => String(node.attrs.label ?? ''),
    renderHTML: ({ options, node }) => ['span', mergeAttributes(options.HTMLAttributes, { title: 'Open in Story Bible' }), `@${node.attrs.label ?? ''}`],
    suggestion: {
      char: '@',
      allowSpaces: true,
      items: ({ query }: { query: string }): BibleEntry[] => {
        const q = query.toLowerCase();
        return useStore
          .getState()
          .bible.filter((e) => e.name.toLowerCase().includes(q))
          .sort((a, b) => Number(!a.name.toLowerCase().startsWith(q)) - Number(!b.name.toLowerCase().startsWith(q)) || a.name.localeCompare(b.name))
          .slice(0, 8);
      },
      render: () => {
        let component: ReactRenderer<MentionListHandle, MentionListProps> | null = null;
        let popup: HTMLDivElement | null = null;
        const cleanup = () => {
          popup?.remove();
          component?.destroy();
          popup = null;
          component = null;
        };
        return {
          onStart: (props: SuggestionProps<BibleEntry>) => {
            component = new ReactRenderer(MentionList, {
              props: { items: props.items, command: props.command } as MentionListProps,
              editor: props.editor,
            });
            popup = document.createElement('div');
            popup.style.position = 'fixed';
            popup.style.zIndex = '1500';
            popup.appendChild(component.element);
            document.body.appendChild(popup);
            positionPopup(popup, props.clientRect?.());
          },
          onUpdate: (props: SuggestionProps<BibleEntry>) => {
            component?.updateProps({ items: props.items, command: props.command });
            if (popup) positionPopup(popup, props.clientRect?.());
          },
          onKeyDown: (props: SuggestionKeyDownProps) => {
            if (props.event.key === 'Escape') {
              cleanup();
              return true;
            }
            return component?.ref?.onKeyDown(props.event) ?? false;
          },
          onExit: cleanup,
        };
      },
    },
  });
}

/** Scene break: a block atom rendered as a centered glyph (e.g. ⁂ or * * *). */
import { mergeAttributes, Node, nodeInputRule } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    sceneBreak: {
      insertSceneBreak: () => ReturnType;
    };
  }
}

export const SceneBreak = Node.create({
  name: 'sceneBreak',
  group: 'block',
  atom: true,
  selectable: true,

  parseHTML() {
    return [{ tag: 'hr[data-scene-break]' }, { tag: 'hr' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['hr', mergeAttributes(HTMLAttributes, { 'data-scene-break': '', class: 'scene-break', 'aria-label': 'Scene break' })];
  },

  renderText() {
    return '\n* * *\n';
  },

  addCommands() {
    return {
      insertSceneBreak:
        () =>
        ({ chain }) =>
          chain().insertContent([{ type: this.name }, { type: 'paragraph' }]).run(),
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-Enter': () => this.editor.commands.insertSceneBreak(),
    };
  },

  addInputRules() {
    // Typing "***" + space, "---" or "###" + space on an empty line inserts a break.
    return [nodeInputRule({ find: /^(?:---|\*\*\*\s|###\s)$/, type: this.type })];
  },
});

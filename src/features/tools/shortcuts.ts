/** Keyboard shortcut reference (shown in the cheat sheet; "Mod" = Ctrl or ⌘). */
export interface ShortcutGroup {
  title: string;
  items: [keys: string, action: string][];
}

export const SHORTCUTS: ShortcutGroup[] = [
  {
    title: 'General',
    items: [
      ['Mod+K', 'Command palette — jump to anything, run any action'],
      ['Mod+Shift+F', 'Search the whole project'],
      ['Mod+Shift+H', 'Home — all your projects'],
      ['Mod+S', 'Save now (Inkwell also saves automatically)'],
      ['Mod+.', 'Toggle scratchpad'],
      ['?', 'This cheat sheet'],
      ['Alt+1 … Alt+6', 'Write, Plan, Research, Goals, Export, History'],
      ['Mod+[  /  Mod+]', 'Toggle binder / inspector'],
    ],
  },
  {
    title: 'Writing',
    items: [
      ['Mod+B / I / U', 'Bold, italic, underline'],
      ['Mod+Shift+S', 'Strikethrough'],
      ['Mod+Shift+H', 'Highlight'],
      ['Mod+Alt+1 / 2 / 3', 'Headings'],
      ['Mod+Alt+0', 'Body text'],
      ['Mod+Shift+B', 'Block quote'],
      ['Mod+Shift+7 / 8', 'Numbered / bulleted list'],
      ['Mod+Alt+Enter', 'Scene break (or type *** + space)'],
      ['Mod+Alt+F', 'Footnote'],
      ['Mod+Alt+M', 'Comment on selection'],
      ['Mod+Z / Mod+Shift+Z', 'Undo / redo (continues into saved history)'],
      ['@', 'Mention a character, place or item'],
    ],
  },
  {
    title: 'Editor views',
    items: [
      ['Mod+F', 'Find in document'],
      ['Mod+H', 'Find & replace'],
      ['Enter / Shift+Enter', 'Next / previous match'],
      ['Mod+Shift+Enter', 'Focus mode (Esc to leave)'],
      ['Mod+\\', 'Split editor'],
      ['Mod+Shift+P', 'Snapshot current document'],
      ['Mod+Alt+N', 'New scene after the current one'],
    ],
  },
  {
    title: 'Binder (when focused)',
    items: [
      ['↑ / ↓', 'Move selection'],
      ['← / →', 'Collapse / expand'],
      ['Enter', 'Open'],
      ['F2', 'Rename'],
      ['Delete', 'Move to trash'],
      ['Alt+↑ / Alt+↓', 'Move item up / down'],
      ['Alt+→ / Alt+←', 'Indent / outdent'],
      ['Shift+F10', 'Context menu'],
    ],
  },
];

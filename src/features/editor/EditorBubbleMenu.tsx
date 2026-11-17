import type { ReactElement } from 'react';
import { BubbleMenu, useEditorState, type Editor } from '@tiptap/react';
import { TextSelection } from '@tiptap/pm/state';
import { Divider, IconButton, Paper, Tooltip } from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import BorderColorIcon from '@mui/icons-material/BorderColorOutlined';
import LinkIcon from '@mui/icons-material/Link';
import AddCommentIcon from '@mui/icons-material/AddCommentOutlined';
import MenuBookIcon from '@mui/icons-material/MenuBookOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesomeOutlined';
import type { ID } from '@/types/models';
import { useStore } from '@/store';
import { addCommentToSelection, editLink, selectedWord } from './editorActions';

/** Floating formatting menu shown over a text selection. */
export function EditorBubbleMenu({ editor, docId }: { editor: Editor; docId: ID }) {
  const aiEnabled = useStore((s) => s.settings.ai.enabled);
  const active = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      strike: e.isActive('strike'),
      highlight: e.isActive('highlight'),
      link: e.isActive('link'),
    }),
  });

  const btn = (label: string, icon: ReactElement, onClick: () => void, isActive = false) => (
    <Tooltip title={label}>
      <IconButton
        size="small"
        aria-label={label}
        aria-pressed={isActive}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
        color={isActive ? 'primary' : 'default'}
      >
        {icon}
      </IconButton>
    </Tooltip>
  );

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 120, maxWidth: 'none' }}
      shouldShow={({ editor: e, state }) => e.isEditable && !state.selection.empty && state.selection instanceof TextSelection}
    >
      <Paper elevation={6} sx={{ display: 'flex', alignItems: 'center', px: 0.5, py: 0.25, borderRadius: 3 }} role="toolbar" aria-label="Selection formatting">
        {btn('Bold (Ctrl+B)', <FormatBoldIcon fontSize="small" />, () => editor.chain().focus().toggleBold().run(), active?.bold)}
        {btn('Italic (Ctrl+I)', <FormatItalicIcon fontSize="small" />, () => editor.chain().focus().toggleItalic().run(), active?.italic)}
        {btn('Underline (Ctrl+U)', <FormatUnderlinedIcon fontSize="small" />, () => editor.chain().focus().toggleUnderline().run(), active?.underline)}
        {btn('Strikethrough (Ctrl+Shift+S)', <StrikethroughSIcon fontSize="small" />, () => editor.chain().focus().toggleStrike().run(), active?.strike)}
        {btn('Highlight (Ctrl+Shift+H)', <BorderColorIcon fontSize="small" />, () => editor.chain().focus().toggleHighlight().run(), active?.highlight)}
        {btn('Link', <LinkIcon fontSize="small" />, () => void editLink(editor), active?.link)}
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        {btn('Comment (Ctrl+Alt+M)', <AddCommentIcon fontSize="small" />, () => void addCommentToSelection(editor, docId))}
        {btn('Dictionary & thesaurus', <MenuBookIcon fontSize="small" />, () => {
          const w = selectedWord(editor);
          if (w) useStore.getState().setLookupWord(w);
        })}
        {aiEnabled &&
          btn('Rewrite with AI', <AutoAwesomeIcon fontSize="small" />, () => {
            useStore.getState().setActiveEditor(editor, docId);
            useStore.getState().openDialog('ai');
          })}
      </Paper>
    </BubbleMenu>
  );
}

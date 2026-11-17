import { useState, type MouseEvent, type ReactElement } from 'react';
import { useEditorState } from '@tiptap/react';
import { Box, Divider, IconButton, ListItemIcon, Menu, MenuItem, Popover, Select, Tooltip, Typography } from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import StrikethroughSIcon from '@mui/icons-material/StrikethroughS';
import BorderColorIcon from '@mui/icons-material/BorderColorOutlined';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import FormatAlignJustifyIcon from '@mui/icons-material/FormatAlignJustify';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import SuperscriptIcon from '@mui/icons-material/Superscript';
import AddCommentIcon from '@mui/icons-material/AddCommentOutlined';
import LinkIcon from '@mui/icons-material/Link';
import FindReplaceIcon from '@mui/icons-material/FindReplace';
import SpellcheckIcon from '@mui/icons-material/Spellcheck';
import ViewStreamIcon from '@mui/icons-material/ViewStreamOutlined';
import VerticalSplitIcon from '@mui/icons-material/VerticalSplitOutlined';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import ViewSidebarIcon from '@mui/icons-material/ViewSidebarOutlined';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import { useStore } from '@/store';
import { useLayoutMode } from '@/hooks/useLayoutMode';
import { nearestAncestorOfType, childrenOf } from '@/lib/tree';
import { addCommentToSelection, editLink, insertFootnote } from './editorActions';
import { EditorSettingsForm } from './EditorSettingsForm';
import { RevisionMenu } from './revisions/RevisionMenu';

function TB({
  label,
  icon,
  onClick,
  active,
  disabled,
}: {
  label: string;
  icon: ReactElement;
  onClick: (e: MouseEvent<HTMLElement>) => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <Tooltip title={label}>
      <span>
        <IconButton
          size="small"
          aria-label={label}
          aria-pressed={active ?? undefined}
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onClick}
          sx={active ? { bgcolor: 'action.selected', color: 'primary.main' } : undefined}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  );
}

const ALIGN_ICONS = {
  left: <FormatAlignLeftIcon fontSize="small" />,
  center: <FormatAlignCenterIcon fontSize="small" />,
  right: <FormatAlignRightIcon fontSize="small" />,
  justify: <FormatAlignJustifyIcon fontSize="small" />,
};

/** Formatting toolbar acting on the last focused editor, plus view toggles. */
export function EditorToolbar() {
  const layout = useLayoutMode();
  const editor = useStore((s) => s.activeEditor);
  const docId = useStore((s) => s.activeEditorDocId);
  const activeDocId = useStore((s) => s.activeDocId);
  const scriveningsRootId = useStore((s) => s.scriveningsRootId);
  const splitEnabled = useStore((s) => s.split.enabled);
  const proofreading = useStore((s) => s.proofreading);
  const binderOpen = useStore((s) => s.settings.layout.binderOpen);
  const inspectorOpen = useStore((s) => s.settings.layout.inspectorOpen);
  const [alignAnchor, setAlignAnchor] = useState<HTMLElement | null>(null);
  const [moreAnchor, setMoreAnchor] = useState<HTMLElement | null>(null);
  const [settingsAnchor, setSettingsAnchor] = useState<HTMLElement | null>(null);

  const st = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: !!e?.isActive('bold'),
      italic: !!e?.isActive('italic'),
      underline: !!e?.isActive('underline'),
      strike: !!e?.isActive('strike'),
      highlight: !!e?.isActive('highlight'),
      bullet: !!e?.isActive('bulletList'),
      ordered: !!e?.isActive('orderedList'),
      quote: !!e?.isActive('blockquote'),
      link: !!e?.isActive('link'),
      block: e?.isActive('heading', { level: 1 }) ? 'h1' : e?.isActive('heading', { level: 2 }) ? 'h2' : e?.isActive('heading', { level: 3 }) ? 'h3' : 'p',
      align: ((['center', 'right', 'justify'] as const).find((a) => e?.isActive({ textAlign: a })) ?? 'left') as keyof typeof ALIGN_ICONS,
    }),
  });

  const s = useStore.getState;
  const has = !!editor && !editor.isDestroyed;
  const run = (fn: () => void) => () => has && fn();
  const chain = () => editor!.chain().focus();

  const toggleScrivenings = () => {
    const st2 = s();
    if (st2.scriveningsRootId) return st2.setScrivenings(null);
    const id = st2.activeDocId;
    if (!id) return;
    const doc = st2.docs[id];
    const root = childrenOf(st2.docs, id).length ? doc : nearestAncestorOfType(st2.docs, id, 'chapter') ?? (doc.parentId ? st2.docs[doc.parentId] : null);
    if (root) st2.setScrivenings(root.id);
    else st2.notify('Scrivenings shows a chapter or part as one continuous text — select a scene inside a chapter.', 'info');
  };

  const compactToolbar = layout === 'mobile';

  return (
    <Box
      role="toolbar"
      aria-label="Formatting"
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.25,
        px: 1,
        minHeight: 44,
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        // Wrap on wide screens; scroll horizontally on phones.
        flexWrap: { xs: 'nowrap', md: 'wrap' },
        overflowX: { xs: 'auto', md: 'visible' },
        scrollbarWidth: 'thin',
        flex: '0 0 auto',
      }}
    >
      {layout === 'desktop' && (
        <TB label={binderOpen ? 'Hide binder (Ctrl+[)' : 'Show binder (Ctrl+[)'} icon={<MenuOpenIcon fontSize="small" sx={{ transform: binderOpen ? 'none' : 'scaleX(-1)' }} />} onClick={() => s().updateLayout({ binderOpen: !binderOpen })} />
      )}
      <TB label="Undo (Ctrl+Z)" icon={<UndoIcon fontSize="small" />} disabled={!has} onClick={run(() => editor!.commands.keyboardShortcut('Mod-z'))} />
      <TB label="Redo (Ctrl+Shift+Z)" icon={<RedoIcon fontSize="small" />} disabled={!has} onClick={run(() => editor!.commands.keyboardShortcut('Mod-Shift-z'))} />
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      {!compactToolbar && (
        <Select
          size="small"
          value={st?.block ?? 'p'}
          disabled={!has}
          onChange={(e) => {
            const v = e.target.value;
            if (v === 'p') chain().setParagraph().run();
            else chain().toggleHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 }).run();
          }}
          inputProps={{ 'aria-label': 'Paragraph style' }}
          sx={{ minWidth: 118, height: 32, fontSize: 14, mr: 0.5 }}
        >
          <MenuItem value="p">Body text</MenuItem>
          <MenuItem value="h1">Heading 1</MenuItem>
          <MenuItem value="h2">Heading 2</MenuItem>
          <MenuItem value="h3">Heading 3</MenuItem>
        </Select>
      )}
      <TB label="Bold (Ctrl+B)" icon={<FormatBoldIcon fontSize="small" />} active={st?.bold} disabled={!has} onClick={run(() => chain().toggleBold().run())} />
      <TB label="Italic (Ctrl+I)" icon={<FormatItalicIcon fontSize="small" />} active={st?.italic} disabled={!has} onClick={run(() => chain().toggleItalic().run())} />
      <TB label="Underline (Ctrl+U)" icon={<FormatUnderlinedIcon fontSize="small" />} active={st?.underline} disabled={!has} onClick={run(() => chain().toggleUnderline().run())} />
      {!compactToolbar && (
        <>
          <TB label="Strikethrough (Ctrl+Shift+S)" icon={<StrikethroughSIcon fontSize="small" />} active={st?.strike} disabled={!has} onClick={run(() => chain().toggleStrike().run())} />
          <TB label="Highlight (Ctrl+Shift+H)" icon={<BorderColorIcon fontSize="small" />} active={st?.highlight} disabled={!has} onClick={run(() => chain().toggleHighlight().run())} />
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <TB label="Alignment" icon={ALIGN_ICONS[st?.align ?? 'left']} disabled={!has} onClick={(e) => setAlignAnchor(e.currentTarget)} />
        </>
      )}
      <Menu anchorEl={alignAnchor} open={!!alignAnchor} onClose={() => setAlignAnchor(null)}>
        {(['left', 'center', 'right', 'justify'] as const).map((a) => (
          <MenuItem
            key={a}
            selected={st?.align === a}
            onClick={() => {
              setAlignAnchor(null);
              if (has) chain().setTextAlign(a).run();
            }}
          >
            <ListItemIcon>{ALIGN_ICONS[a]}</ListItemIcon>
            {a.charAt(0).toUpperCase() + a.slice(1)}
          </MenuItem>
        ))}
      </Menu>
      {!compactToolbar && (
        <>
          <TB label="Bulleted list" icon={<FormatListBulletedIcon fontSize="small" />} active={st?.bullet} disabled={!has} onClick={run(() => chain().toggleBulletList().run())} />
          <TB label="Numbered list" icon={<FormatListNumberedIcon fontSize="small" />} active={st?.ordered} disabled={!has} onClick={run(() => chain().toggleOrderedList().run())} />
          <TB label="Block quote" icon={<FormatQuoteIcon fontSize="small" />} active={st?.quote} disabled={!has} onClick={run(() => chain().toggleBlockquote().run())} />
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <TB label="Scene break (Ctrl+Alt+Enter)" icon={<Typography sx={{ fontWeight: 700, fontSize: 14, width: 20 }}>⁂</Typography>} disabled={!has} onClick={run(() => chain().insertSceneBreak().run())} />
          <TB label="Footnote (Ctrl+Alt+F)" icon={<SuperscriptIcon fontSize="small" />} disabled={!has} onClick={run(() => insertFootnote(editor!))} />
          <TB label="Comment (Ctrl+Alt+M)" icon={<AddCommentIcon fontSize="small" />} disabled={!has || !docId} onClick={run(() => void addCommentToSelection(editor!, docId!))} />
          <TB label="Link" icon={<LinkIcon fontSize="small" />} active={st?.link} disabled={!has} onClick={run(() => void editLink(editor!))} />
        </>
      )}
      {compactToolbar && <TB label="More formatting" icon={<MoreHorizIcon fontSize="small" />} disabled={!has} onClick={(e) => setMoreAnchor(e.currentTarget)} />}
      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
      <TB label="Find & replace (Ctrl+H)" icon={<FindReplaceIcon fontSize="small" />} onClick={() => s().setFind({ open: !s().find.open, replace: true })} />

      <Box sx={{ flex: 1, minWidth: 8 }} />

      <RevisionMenu />
      <TB label={proofreading ? 'Proofreading on — highlights adverbs, fillers, typos' : 'Proofreading mode'} icon={<SpellcheckIcon fontSize="small" />} active={proofreading} onClick={() => s().setProofreading(!proofreading)} />
      <TB label="Scrivenings: edit the whole chapter as one text" icon={<ViewStreamIcon fontSize="small" />} active={!!scriveningsRootId} disabled={!activeDocId && !scriveningsRootId} onClick={toggleScrivenings} />
      {layout !== 'mobile' && <TB label="Split editor (Ctrl+\)" icon={<VerticalSplitIcon fontSize="small" />} active={splitEnabled} onClick={() => s().toggleSplit()} />}
      <TB label="Focus mode (Ctrl+Shift+Enter)" icon={<CenterFocusStrongIcon fontSize="small" />} disabled={!activeDocId} onClick={() => s().setFocusMode(true)} />
      <TB label="Editor settings" icon={<TextFieldsIcon fontSize="small" />} onClick={(e) => setSettingsAnchor(e.currentTarget)} />
      {layout === 'desktop' ? (
        <TB label={inspectorOpen ? 'Hide inspector (Ctrl+])' : 'Show inspector (Ctrl+])'} icon={<ViewSidebarIcon fontSize="small" />} active={inspectorOpen} onClick={() => s().updateLayout({ inspectorOpen: !inspectorOpen })} />
      ) : (
        <TB label="Inspector" icon={<ViewSidebarIcon fontSize="small" />} onClick={() => s().setInspectorDrawer(true)} />
      )}

      <Popover
        open={!!settingsAnchor}
        anchorEl={settingsAnchor}
        onClose={() => setSettingsAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { p: 2, width: 320 } } }}
      >
        <Typography variant="subtitle2">Editor settings</Typography>
        <EditorSettingsForm />
      </Popover>
      <Menu anchorEl={moreAnchor} open={!!moreAnchor} onClose={() => setMoreAnchor(null)}>
        {[
          ['Strikethrough', () => chain().toggleStrike().run()],
          ['Highlight', () => chain().toggleHighlight().run()],
          ['Bulleted list', () => chain().toggleBulletList().run()],
          ['Numbered list', () => chain().toggleOrderedList().run()],
          ['Block quote', () => chain().toggleBlockquote().run()],
          ['Heading', () => chain().toggleHeading({ level: 2 }).run()],
          ['Scene break', () => chain().insertSceneBreak().run()],
          ['Footnote', () => insertFootnote(editor!)],
          ['Comment', () => void addCommentToSelection(editor!, docId!)],
        ].map(([label, fn]) => (
          <MenuItem
            key={label as string}
            onClick={() => {
              setMoreAnchor(null);
              if (has) (fn as () => void)();
            }}
          >
            {label as string}
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
}

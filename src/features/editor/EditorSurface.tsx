/** Styled wrapper that applies manuscript typography and editor decorations. */
import { styled, alpha } from '@mui/material/styles';
import type { EditorSettings } from '@/types/models';

interface SurfaceProps {
  es: EditorSettings;
  /** Dims everything except the current paragraph/sentence. */
  dim?: 'off' | 'paragraph' | 'sentence';
  /** Transparent background (focus mode supplies its own). */
  transparent?: boolean;
}

export const EditorSurface = styled('div', {
  shouldForwardProp: (p) => p !== 'es' && p !== 'dim' && p !== 'transparent',
})<SurfaceProps>(({ theme, es, dim = 'off', transparent }) => {
  const sepia = es.paperTheme === 'sepia';
  const fg = sepia ? theme.inkwell.paper.sepiaText : theme.inkwell.paper.pageText;
  const bg = sepia ? theme.inkwell.paper.sepiaBg : theme.inkwell.paper.pageBg;
  const accent = theme.palette.secondary.main;
  const primary = theme.palette.primary.main;
  const glyph = JSON.stringify(es.sceneBreakGlyph || '* * *');

  return {
    color: fg,
    backgroundColor: transparent ? 'transparent' : bg,
    '--ink-fg': fg,
    '& .ProseMirror': {
      outline: 'none',
      fontFamily: es.fontFamily,
      fontSize: es.fontSize,
      lineHeight: es.lineHeight,
      counterReset: 'footnote',
      caretColor: primary,
      wordBreak: 'break-word',
      fontVariantLigatures: 'common-ligatures',
      hyphens: 'auto',
    },
    '& .ProseMirror p': { margin: 0, marginBottom: `${es.paragraphSpacing}em` },
    '& .ProseMirror p + p': { textIndent: `${es.firstLineIndent}em` },
    '& .ProseMirror h1, & .ProseMirror h2, & .ProseMirror h3': {
      fontFamily: es.fontFamily,
      fontWeight: 600,
      lineHeight: 1.3,
      margin: '1.2em 0 0.6em',
    },
    '& .ProseMirror h1': { fontSize: '1.8em', textAlign: 'center' },
    '& .ProseMirror h2': { fontSize: '1.4em' },
    '& .ProseMirror h3': { fontSize: '1.15em' },
    '& .ProseMirror blockquote': {
      margin: '1em 0',
      paddingLeft: '1em',
      borderLeft: `3px solid ${alpha(fg, 0.25)}`,
      fontStyle: 'italic',
    },
    '& .ProseMirror ul, & .ProseMirror ol': { paddingLeft: '1.5em', margin: '0.5em 0' },
    '& .ProseMirror li p': { textIndent: 0 },
    '& .ProseMirror a': { color: primary, textDecoration: 'underline' },
    '& .ProseMirror mark': { backgroundColor: alpha('#ffd54f', 0.55), color: 'inherit', borderRadius: 2, padding: '0 1px' },
    '& .ProseMirror hr.scene-break': {
      border: 'none',
      textAlign: 'center',
      margin: '1.6em 0',
      height: '1.4em',
      cursor: 'pointer',
      '&::after': { content: glyph, letterSpacing: '0.5em', color: alpha(fg, 0.6), fontSize: '1em' },
    },
    '& .ProseMirror-selectednode': { outline: `2px solid ${alpha(primary, 0.6)}`, borderRadius: 4 },
    '& .ProseMirror p.is-editor-empty:first-of-type::before': {
      content: 'attr(data-placeholder)',
      float: 'left',
      color: alpha(fg, 0.4),
      pointerEvents: 'none',
      height: 0,
      textIndent: 0,
    },
    '& .comment-mark': {
      backgroundColor: alpha(accent, 0.22),
      borderBottom: `2px solid ${alpha(accent, 0.8)}`,
      cursor: 'pointer',
    },
    '& .footnote-ref': {
      counterIncrement: 'footnote',
      color: primary,
      cursor: 'pointer',
      fontWeight: 600,
      padding: '0 1px',
      '&::after': { content: '"[" counter(footnote) "]"', fontSize: '0.75em' },
    },
    '& .mention': {
      color: primary,
      backgroundColor: alpha(primary, 0.1),
      borderRadius: 4,
      padding: '0 2px',
      cursor: 'pointer',
      textIndent: 0,
    },
    '& .search-match': { backgroundColor: alpha('#ffeb3b', 0.55), borderRadius: 2 },
    '& .search-match-current': { backgroundColor: '#ff9800', color: '#000' },
    '& .hl-adverb': { textDecoration: 'underline wavy #8e24aa', textUnderlineOffset: 3 },
    '& .hl-filler': { textDecoration: 'underline dotted #1e88e5', textDecorationThickness: 2, textUnderlineOffset: 3 },
    '& .hl-misspelling': { textDecoration: 'underline wavy #e53935', textUnderlineOffset: 3 },
    '& .hl-repeat': { textDecoration: 'underline wavy #fb8c00', textUnderlineOffset: 3 },
    '& .hl-passive': { textDecoration: 'underline #00897b', textDecorationThickness: 2, textUnderlineOffset: 3 },
    ...(dim !== 'off' && {
      '& .ProseMirror > *': { opacity: 0.25, transition: 'opacity 200ms' },
      '& .ProseMirror > .focus-current': { opacity: 1 },
    }),
    ...(dim === 'sentence' && {
      '& .ProseMirror > .focus-current': { opacity: 1, color: alpha(fg, 0.35) },
      '& .ProseMirror .focus-sentence': { color: fg },
    }),
  };
});

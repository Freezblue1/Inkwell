import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  ButtonBase,
  Divider,
  Fade,
  IconButton,
  MenuItem,
  Popover,
  Select,
  Stack,
  ThemeProvider,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  createTheme,
  useMediaQuery,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import PaletteIcon from '@mui/icons-material/PaletteOutlined';
import VerticalAlignCenterIcon from '@mui/icons-material/VerticalAlignCenter';
import VolumeUpIcon from '@mui/icons-material/VolumeUpOutlined';
import VolumeOffIcon from '@mui/icons-material/VolumeOffOutlined';
import { useStore } from '@/store';
import { sceneOf } from '@/theme/scenes';
import { buildTheme } from '@/theme/theme';
import type { Ambient, AmbientSoundChoice } from '@/types/models';
import { EditorSurface } from '../EditorSurface';
import { DocEditor } from '../DocEditor';
import { startAmbientSound, stopAmbientSound } from './ambientSound';
import { FOCUS_THEMES, SOUND_LABELS, plainTheme, resolveFocusTheme, sceneFocusTheme, type FocusSound, type FocusTheme } from './focusThemes';
import { FocusDecor } from './FocusDecor';

function ThemeCard({ t, selected, onPick }: { t: FocusTheme; selected: boolean; onPick: () => void }) {
  return (
    <ButtonBase
      role="radio"
      aria-checked={selected}
      aria-label={`${t.name}: ${t.tagline}`}
      onClick={onPick}
      sx={{
        display: 'block',
        textAlign: 'left',
        borderRadius: 1.5,
        overflow: 'hidden',
        border: 2,
        borderColor: selected ? 'primary.main' : 'divider',
        '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
      }}
    >
      <Box sx={{ height: 46, background: t.background, display: 'grid', placeItems: 'center' }}>
        <Box
          sx={{
            px: 1,
            py: 0.25,
            borderRadius: 0.5,
            background: t.sheet?.bg ?? 'transparent',
            color: t.text,
            fontFamily: t.font ?? 'Georgia, serif',
            textShadow: t.textShadow,
            fontSize: 15,
            lineHeight: 1.2,
          }}
        >
          Aa
        </Box>
      </Box>
      <Box sx={{ px: 1, py: 0.5 }}>
        <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
          {t.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.25 }}>
          {t.tagline}
        </Typography>
      </Box>
    </ButtonBase>
  );
}

/**
 * Focus mode: only the text, on a themed background with an optional gentle
 * animation and ambient sound. Controls fade away while typing and return on
 * mouse movement. Esc exits.
 */
export function FocusMode() {
  const docId = useStore((s) => s.activeDocId);
  const es = useStore((s) => s.settings.editor);
  const density = useStore((s) => s.settings.density);
  const decorOn = useStore((s) => s.settings.jungleDecor !== false);
  const update = useStore((s) => s.updateEditorSettings);
  const setFocusMode = useStore((s) => s.setFocusMode);
  const live = useStore((s) => s.liveStats);
  const sessionStart = useStore((s) => s.sessionStartWords);
  const docs = useStore((s) => s.docs);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const themeMode = useStore((s) => s.settings.themeMode);
  const scene = sceneOf(themeMode);
  const appDark = themeMode === 'dark' || scene?.mode === 'dark' || (themeMode === 'system' && prefersDark);
  const [controls, setControls] = useState(true);
  const [themesAnchor, setThemesAnchor] = useState<HTMLElement | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ft = resolveFocusTheme(es.ambient, appDark, scene);
  const sound: FocusSound = es.ambientSoundKind && es.ambientSoundKind !== 'theme' ? es.ambientSoundKind : ft.sound;

  // Controls and the editor take their colours from the focus theme.
  const muiTheme = useMemo(() => {
    const base = buildTheme(ft.dark ? 'dark' : 'light', density, reducedMotion);
    return createTheme(base, {
      palette: { primary: { main: ft.caret } },
      inkwell: { ...base.inkwell, paper: { ...base.inkwell.paper, pageText: ft.text, sepiaText: ft.text, pageBg: ft.sheet ? '#ffffff' : base.inkwell.paper.pageBg } },
    });
  }, [ft.dark, ft.caret, ft.text, ft.sheet, density, reducedMotion]);

  // Esc exits; typing hides the controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (themesAnchor) return; // closes the theme picker first
        e.preventDefault();
        setFocusMode(false);
      } else if (!e.ctrlKey && !e.metaKey) setControls(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setFocusMode, themesAnchor]);

  useEffect(() => {
    if (es.ambientSound) startAmbientSound(sound);
    else stopAmbientSound();
  }, [es.ambientSound, sound]);
  useEffect(() => () => stopAmbientSound(), []);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => undefined);
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
    };
  }, []);

  const onMouseMove = () => {
    setControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControls(false), 2500);
  };

  if (!docId || !docs[docId]) return null;
  const manuscriptNow = Object.values(docs).reduce((s, d) => (!d.trashed && ['part', 'chapter', 'scene'].includes(d.type) ? s + d.wordCount : s), 0);
  const session = sessionStart === null ? 0 : manuscriptNow - sessionStart;
  const animate = decorOn && !reducedMotion;
  const overlayDecor = ft.decor === 'scanlines';
  const choices: FocusTheme[] = [plainTheme(appDark), ...FOCUS_THEMES, ...(scene ? [sceneFocusTheme(scene)] : [])];
  const pick = (id: Ambient) => update({ ambient: id });

  return (
    <ThemeProvider theme={muiTheme}>
      <Box
        role="dialog"
        aria-modal="true"
        aria-label="Focus mode"
        data-focus-theme={ft.id}
        onMouseMove={onMouseMove}
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 1300,
          background: ft.background,
          display: 'flex',
          flexDirection: 'column',
          transition: 'background 400ms ease',
          '& ::selection': { backgroundColor: ft.selection },
        }}
      >
        {decorOn && !overlayDecor && <FocusDecor kind={ft.decor} animate={animate} />}
        <Fade in={controls}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              px: 2,
              py: 1,
              zIndex: 3,
              color: 'text.primary',
              bgcolor: ft.dark ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.45)',
              backdropFilter: 'blur(8px)',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>
              {docs[docId].title}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
              {(live.docId === docId ? live.words : docs[docId].wordCount).toLocaleString()} words · session {session >= 0 ? '+' : ''}
              {session.toLocaleString()}
            </Typography>
            <Box sx={{ flex: 1 }} />
            <ToggleButtonGroup size="small" exclusive value={es.focusDim} onChange={(_, v) => v && update({ focusDim: v })} aria-label="Dim">
              <ToggleButton value="off">No dim</ToggleButton>
              <ToggleButton value="paragraph">Paragraph</ToggleButton>
              <ToggleButton value="sentence">Sentence</ToggleButton>
            </ToggleButtonGroup>
            <Tooltip title="Typewriter scrolling">
              <ToggleButton size="small" value="tw" selected={es.typewriter} onChange={() => update({ typewriter: !es.typewriter })} aria-label="Typewriter scrolling">
                <VerticalAlignCenterIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
            <Tooltip title="Theme and sound">
              <ToggleButton size="small" value="themes" selected={!!themesAnchor} onChange={(e) => setThemesAnchor(e.currentTarget as HTMLElement)} aria-label="Focus theme" aria-haspopup="dialog">
                <PaletteIcon fontSize="small" />
                <Typography variant="body2" component="span" sx={{ ml: 0.75, display: { xs: 'none', sm: 'inline' } }}>
                  {ft.name}
                </Typography>
              </ToggleButton>
            </Tooltip>
            <Tooltip title={es.ambientSound ? 'Mute ambient sound' : `Play ${SOUND_LABELS[sound].toLowerCase()}`}>
              <IconButton size="small" onClick={() => update({ ambientSound: !es.ambientSound })} aria-label="Toggle ambient sound" aria-pressed={es.ambientSound}>
                {es.ambientSound ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Exit focus mode (Esc)">
              <IconButton onClick={() => setFocusMode(false)} aria-label="Exit focus mode">
                <CloseIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Fade>

        <Popover
          open={!!themesAnchor}
          anchorEl={themesAnchor}
          onClose={() => setThemesAnchor(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          slotProps={{ paper: { sx: { p: 1.5, width: 'min(520px, calc(100vw - 32px))', maxHeight: '80vh' } } }}
        >
          <Typography variant="overline" color="text.secondary">
            Focus theme
          </Typography>
          <Box role="radiogroup" aria-label="Focus theme" sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 1, mt: 0.5 }}>
            {choices.map((t) => (
              <ThemeCard key={t.id} t={t} selected={ft.id === t.id} onPick={() => pick(t.id)} />
            ))}
          </Box>
          <Divider sx={{ my: 1.5 }} />
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <Typography variant="body2">Sound</Typography>
            <Select
              size="small"
              value={es.ambientSoundKind ?? 'theme'}
              onChange={(e) => update({ ambientSoundKind: e.target.value as AmbientSoundChoice, ambientSound: true })}
              inputProps={{ 'aria-label': 'Ambient sound' }}
              sx={{ minWidth: 180 }}
              MenuProps={{ sx: { zIndex: 1400 } }}
            >
              <MenuItem value="theme">Match theme ({SOUND_LABELS[ft.sound]})</MenuItem>
              {(Object.keys(SOUND_LABELS) as FocusSound[]).map((k) => (
                <MenuItem key={k} value={k}>
                  {SOUND_LABELS[k]}
                </MenuItem>
              ))}
            </Select>
            <IconButton size="small" onClick={() => update({ ambientSound: !es.ambientSound })} aria-label={es.ambientSound ? 'Mute' : 'Play'}>
              {es.ambientSound ? <VolumeUpIcon fontSize="small" /> : <VolumeOffIcon fontSize="small" />}
            </IconButton>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            Animated effects follow the “Animated decorations” setting and your system’s reduce-motion preference.
          </Typography>
        </Popover>

        <Box data-scroll-container sx={{ flex: 1, overflowY: 'auto', px: 2, position: 'relative', zIndex: 1 }}>
          <Box
            sx={
              ft.sheet
                ? { maxWidth: es.pageWidth + 128, mx: 'auto', mt: '10vh', mb: es.typewriter ? '45vh' : '10vh', background: ft.sheet.bg, boxShadow: ft.sheet.shadow, borderRadius: '3px', px: { xs: 3, sm: 8 }, py: { xs: 4, sm: 8 }, minHeight: '80vh' }
                : undefined
            }
          >
            <EditorSurface
              es={{ ...es, paperTheme: 'default', fontFamily: ft.font ?? es.fontFamily, fontSize: ft.font?.includes('VT323') ? Math.round(es.fontSize * 1.3) : es.fontSize }}
              transparent
              dim={es.focusDim}
              sx={{
                maxWidth: es.pageWidth,
                mx: 'auto',
                pt: ft.sheet ? 0 : '18vh',
                pb: ft.sheet ? 0 : es.typewriter ? '55vh' : '20vh',
                '& .ProseMirror': ft.textShadow ? { textShadow: ft.textShadow } : undefined,
              }}
            >
              <DocEditor docId={docId} variant="focus" autoFocus dim={es.focusDim} typewriter={es.typewriter} />
            </EditorSurface>
          </Box>
        </Box>
        {decorOn && overlayDecor && (
          <Box sx={{ position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none' }}>
            <FocusDecor kind={ft.decor} animate={animate} />
          </Box>
        )}
      </Box>
    </ThemeProvider>
  );
}

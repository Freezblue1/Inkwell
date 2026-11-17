import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Fade, IconButton, MenuItem, Select, Stack, ThemeProvider, ToggleButton, ToggleButtonGroup, Tooltip, Typography, useMediaQuery } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import VerticalAlignCenterIcon from '@mui/icons-material/VerticalAlignCenter';
import VolumeUpIcon from '@mui/icons-material/VolumeUpOutlined';
import VolumeOffIcon from '@mui/icons-material/VolumeOffOutlined';
import { useStore } from '@/store';
import { buildTheme } from '@/theme/theme';
import type { Ambient } from '@/types/models';
import { EditorSurface } from '../EditorSurface';
import { DocEditor } from '../DocEditor';
import { startAmbientSound, stopAmbientSound } from './ambientSound';

const AMBIENTS: Record<Ambient, { label: string; light: string; dark: string; darkText: boolean }> = {
  none: { label: 'Plain', light: '#ffffff', dark: '#15161c', darkText: false },
  paper: { label: 'Paper', light: 'radial-gradient(circle at 30% 20%, #fbf7ee, #efe6d2)', dark: 'radial-gradient(circle at 30% 20%, #26241f, #191814)', darkText: false },
  dusk: { label: 'Dusk', light: 'linear-gradient(160deg, #2b1f3a 0%, #4f3a5f 55%, #9c6b62 100%)', dark: 'linear-gradient(160deg, #1d1527 0%, #35273f 60%, #5e4140 100%)', darkText: true },
  forest: { label: 'Forest', light: 'linear-gradient(160deg, #0f2a1f 0%, #1d4636 60%, #35603f 100%)', dark: 'linear-gradient(160deg, #0b1e16 0%, #143226 60%, #22412b 100%)', darkText: true },
  ocean: { label: 'Ocean', light: 'linear-gradient(160deg, #0b2239 0%, #134a69 60%, #23708c 100%)', dark: 'linear-gradient(160deg, #081827 0%, #0e3449 60%, #184f63 100%)', darkText: true },
};

/**
 * Focus mode: only the text, on an ambient background. Controls fade away
 * while typing and return on mouse movement. Esc exits.
 */
export function FocusMode() {
  const docId = useStore((s) => s.activeDocId);
  const es = useStore((s) => s.settings.editor);
  const density = useStore((s) => s.settings.density);
  const update = useStore((s) => s.updateEditorSettings);
  const setFocusMode = useStore((s) => s.setFocusMode);
  const live = useStore((s) => s.liveStats);
  const sessionStart = useStore((s) => s.sessionStartWords);
  const docs = useStore((s) => s.docs);
  const prefersDark = useMediaQuery('(prefers-color-scheme: dark)');
  const themeMode = useStore((s) => s.settings.themeMode);
  const isDark = themeMode === 'dark' || themeMode === 'jungle' || (themeMode === 'system' && prefersDark);
  const [controls, setControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ambient = AMBIENTS[es.ambient] ?? AMBIENTS.paper;
  const darkSurface = ambient.darkText || isDark;
  const darkTheme = useMemo(() => buildTheme('dark', density, false), [density]);
  const lightTheme = useMemo(() => buildTheme('light', density, false), [density]);

  // Esc exits; typing hides the controls.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setFocusMode(false);
      } else if (!e.ctrlKey && !e.metaKey) setControls(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setFocusMode]);

  useEffect(() => {
    if (es.ambientSound) startAmbientSound();
    else stopAmbientSound();
    return () => stopAmbientSound();
  }, [es.ambientSound]);

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

  return (
    <ThemeProvider theme={darkSurface ? darkTheme : lightTheme}>
      <Box
        role="dialog"
        aria-modal="true"
        aria-label="Focus mode"
        onMouseMove={onMouseMove}
        sx={{ position: 'fixed', inset: 0, zIndex: 1300, background: isDark && !ambient.darkText ? ambient.dark : ambient.light, display: 'flex', flexDirection: 'column' }}
      >
        <Fade in={controls}>
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ position: 'absolute', top: 0, left: 0, right: 0, px: 2, py: 1, zIndex: 2, color: 'text.primary', bgcolor: 'rgba(0,0,0,0.04)', backdropFilter: 'blur(6px)' }}
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
            <Select size="small" value={es.ambient} onChange={(e) => update({ ambient: e.target.value as Ambient })} inputProps={{ 'aria-label': 'Ambient background' }} sx={{ height: 32 }}>
              {(Object.keys(AMBIENTS) as Ambient[]).map((k) => (
                <MenuItem key={k} value={k}>
                  {AMBIENTS[k].label}
                </MenuItem>
              ))}
            </Select>
            <Tooltip title={es.ambientSound ? 'Mute ambient sound' : 'Play soft rain'}>
              <IconButton size="small" onClick={() => update({ ambientSound: !es.ambientSound })} aria-label="Toggle ambient sound">
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
        <Box data-scroll-container sx={{ flex: 1, overflowY: 'auto', px: 2 }}>
          <EditorSurface
            es={{ ...es, paperTheme: ambient.darkText ? 'default' : es.paperTheme }}
            transparent
            dim={es.focusDim}
            sx={{ maxWidth: es.pageWidth, mx: 'auto', pt: '18vh', pb: es.typewriter ? '55vh' : '20vh' }}
          >
            <DocEditor docId={docId} variant="focus" autoFocus dim={es.focusDim} typewriter={es.typewriter} />
          </EditorSurface>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

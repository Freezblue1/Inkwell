import { useRef, useState, type PointerEvent } from 'react';
import { Box, IconButton, InputBase, Paper, Stack, Tooltip, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import NoteAddIcon from '@mui/icons-material/NoteAddOutlined';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useStore } from '@/store';
import { useDebouncedCallback } from '@/hooks/useDebounced';
import { textToDoc } from '@/lib/text';

/** Floating scratchpad available from anywhere (Ctrl+.). Saved with app settings. */
export default function Scratchpad() {
  const initial = useStore((s) => s.settings.scratchpad);
  const [text, setText] = useState(initial);
  const [pos, setPos] = useState(() => ({ x: Math.max(16, window.innerWidth - 400), y: Math.max(16, window.innerHeight - 420) }));
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  const save = useDebouncedCallback((v: string) => useStore.getState().updateSettings({ scratchpad: v }), 400);
  const close = () => {
    save.flush();
    useStore.getState().closeDialog('scratchpad');
  };

  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
  };
  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    setPos({
      x: Math.min(window.innerWidth - 120, Math.max(0, e.clientX - drag.current.dx)),
      y: Math.min(window.innerHeight - 60, Math.max(0, e.clientY - drag.current.dy)),
    });
  };

  const toNote = async () => {
    if (!text.trim()) return;
    const s = useStore.getState();
    const d = await s.createDoc({ type: 'note', parentId: null, title: `Scratch ${new Date().toLocaleDateString()}`, json: textToDoc(text) });
    setText('');
    save('');
    s.notify('Saved as a note in the binder', 'success', { label: 'Open', run: () => useStore.getState().openDoc(d.id) });
  };

  return (
    <Paper
      elevation={12}
      role="dialog"
      aria-label="Scratchpad"
      sx={{ position: 'fixed', left: pos.x, top: pos.y, width: { xs: 'calc(100vw - 32px)', sm: 360 }, height: 360, zIndex: 1400, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRadius: 3 }}
      onKeyDown={(e) => e.key === 'Escape' && close()}
    >
      <Stack
        direction="row"
        alignItems="center"
        sx={{ px: 1, py: 0.5, bgcolor: 'secondary.main', color: 'secondary.contrastText', cursor: 'move', touchAction: 'none' }}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={() => (drag.current = null)}
      >
        <DragIndicatorIcon fontSize="small" />
        <Typography variant="subtitle2" sx={{ flex: 1, ml: 0.5 }}>
          Scratchpad
        </Typography>
        <Tooltip title="Save as note in binder">
          <IconButton size="small" color="inherit" aria-label="Save as note" onPointerDown={(e) => e.stopPropagation()} onClick={() => void toNote()}>
            <NoteAddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Close (Esc)">
          <IconButton size="small" color="inherit" aria-label="Close scratchpad" onPointerDown={(e) => e.stopPropagation()} onClick={close}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Box sx={{ flex: 1, overflow: 'auto', p: 1.5, bgcolor: (t) => (t.palette.mode === 'dark' ? '#2b2a24' : '#fffdf0') }}>
        <InputBase
          autoFocus
          multiline
          fullWidth
          minRows={12}
          placeholder="Jot anything — a line of dialogue, a name, a plot fix…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            save(e.target.value);
          }}
          inputProps={{ 'aria-label': 'Scratchpad text' }}
          sx={{ fontFamily: '"Courier Prime", monospace', fontSize: 14, lineHeight: 1.6, alignItems: 'flex-start' }}
        />
      </Box>
    </Paper>
  );
}

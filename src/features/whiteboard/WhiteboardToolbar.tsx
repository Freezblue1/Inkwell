import type { ReactElement } from 'react';
import { Box, Divider, IconButton, MenuItem, Paper, Select, ToggleButton, ToggleButtonGroup, Tooltip, Typography } from '@mui/material';
import NearMeIcon from '@mui/icons-material/NearMeOutlined';
import PanToolIcon from '@mui/icons-material/PanToolOutlined';
import EditIcon from '@mui/icons-material/EditOutlined';
import CropSquareIcon from '@mui/icons-material/CropSquare';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ArrowRightAltIcon from '@mui/icons-material/ArrowRightAlt';
import StickyNote2Icon from '@mui/icons-material/StickyNote2Outlined';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import ClearIcon from '@mui/icons-material/Clear';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import CenterFocusWeakIcon from '@mui/icons-material/CenterFocusWeak';
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill';
import CropFreeIcon from '@mui/icons-material/CropFree';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import MapIcon from '@mui/icons-material/MapOutlined';
import { useTheme } from '@mui/material/styles';
import { INK_COLORS, NOTE_COLORS } from '@/lib/whiteboard';

export type WbTool = 'select' | 'hand' | 'pen' | 'rect' | 'ellipse' | 'arrow' | 'note' | 'text' | 'frame' | 'eraser';

export interface WbStyle {
  color: string;
  strokeWidth: number;
  noteColor: string;
  filled: boolean;
}

export const TOOLS: { value: WbTool; label: string; key: string; icon: ReactElement }[] = [
  { value: 'select', label: 'Select & move', key: 'V', icon: <NearMeIcon fontSize="small" /> },
  { value: 'hand', label: 'Pan (or hold Space)', key: 'H', icon: <PanToolIcon fontSize="small" /> },
  { value: 'pen', label: 'Pen', key: 'P', icon: <EditIcon fontSize="small" /> },
  { value: 'rect', label: 'Rectangle', key: 'R', icon: <CropSquareIcon fontSize="small" /> },
  { value: 'ellipse', label: 'Ellipse', key: 'O', icon: <RadioButtonUncheckedIcon fontSize="small" /> },
  { value: 'arrow', label: 'Arrow — start or end on a note to attach it', key: 'A', icon: <ArrowRightAltIcon fontSize="small" /> },
  { value: 'note', label: 'Sticky note', key: 'N', icon: <StickyNote2Icon fontSize="small" /> },
  { value: 'text', label: 'Text', key: 'T', icon: <TextFieldsIcon fontSize="small" /> },
  { value: 'frame', label: 'Frame — groups what you put inside it', key: 'F', icon: <CropFreeIcon fontSize="small" /> },
  { value: 'eraser', label: 'Eraser', key: 'E', icon: <ClearIcon fontSize="small" /> },
];

interface Props {
  tool: WbTool;
  setTool: (t: WbTool) => void;
  style: WbStyle;
  setStyle: (patch: Partial<WbStyle>) => void;
  zoom: number;
  onZoom: (factor: number) => void;
  onFit: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  minimap: boolean;
  onToggleMinimap: () => void;
  onPickImage: () => void;
}

/** Floating tool palette for the whiteboard. */
export function WhiteboardToolbar(p: Props) {
  const theme = useTheme();
  const swatch = (c: string) => (c === 'ink' ? theme.palette.text.primary : c);
  return (
    <Paper
      elevation={4}
      role="toolbar"
      aria-label="Whiteboard tools"
      sx={{ position: 'absolute', top: 12, left: 12, right: { xs: 12, md: 'auto' }, zIndex: 2, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.5, p: 0.5, borderRadius: 3 }}
    >
      <ToggleButtonGroup size="small" exclusive value={p.tool} onChange={(_, v) => v && p.setTool(v)} aria-label="Tool">
        {TOOLS.map((t) => (
          <Tooltip key={t.value} title={`${t.label} (${t.key})`}>
            <ToggleButton value={t.value} aria-label={t.label} sx={{ px: 1 }}>
              {t.icon}
            </ToggleButton>
          </Tooltip>
        ))}
      </ToggleButtonGroup>
      <Tooltip title="Add a picture (I) — or drop / paste one">
        <IconButton size="small" aria-label="Add a picture" onClick={p.onPickImage}>
          <AddPhotoAlternateIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Divider orientation="vertical" flexItem />
      <Box sx={{ display: 'flex', gap: 0.25, px: 0.5 }} role="radiogroup" aria-label="Color">
        {(p.tool === 'note' ? NOTE_COLORS : INK_COLORS).map((c) => {
          const selected = p.tool === 'note' ? p.style.noteColor === c : p.style.color === c;
          return (
            <Box
              key={c}
              component="button"
              role="radio"
              aria-checked={selected}
              aria-label={c === 'ink' ? 'Ink (theme text color)' : `Color ${c}`}
              onClick={() => p.setStyle(p.tool === 'note' ? { noteColor: c } : { color: c })}
              sx={{ width: 20, height: 20, borderRadius: '50%', bgcolor: swatch(c), border: 2, borderColor: selected ? 'primary.main' : 'divider', cursor: 'pointer', p: 0, outlineOffset: 2 }}
            />
          );
        })}
      </Box>
      <Select
        size="small"
        value={p.style.strokeWidth}
        onChange={(e) => p.setStyle({ strokeWidth: Number(e.target.value) })}
        inputProps={{ 'aria-label': 'Stroke width' }}
        sx={{ height: 32, fontSize: 13 }}
      >
        {[2, 4, 8, 12].map((w) => (
          <MenuItem key={w} value={w}>
            <Box sx={{ width: 28, height: w, bgcolor: 'text.primary', borderRadius: 1, mr: 1 }} />
            {w}px
          </MenuItem>
        ))}
      </Select>
      <Tooltip title="Fill shapes">
        <ToggleButton size="small" value="fill" selected={p.style.filled} onChange={() => p.setStyle({ filled: !p.style.filled })} aria-label="Fill shapes" sx={{ px: 1 }}>
          <FormatColorFillIcon fontSize="small" />
        </ToggleButton>
      </Tooltip>
      <Divider orientation="vertical" flexItem />
      <Tooltip title="Undo (Ctrl+Z)">
        <span>
          <IconButton size="small" aria-label="Undo" onClick={p.onUndo} disabled={!p.canUndo}>
            <UndoIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Redo (Ctrl+Shift+Z)">
        <span>
          <IconButton size="small" aria-label="Redo" onClick={p.onRedo} disabled={!p.canRedo}>
            <RedoIcon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
      <Divider orientation="vertical" flexItem />
      <IconButton size="small" aria-label="Zoom out" onClick={() => p.onZoom(1 / 1.25)}>
        <ZoomOutIcon fontSize="small" />
      </IconButton>
      <Typography variant="caption" sx={{ width: 40, textAlign: 'center' }} aria-live="polite">
        {Math.round(p.zoom * 100)}%
      </Typography>
      <IconButton size="small" aria-label="Zoom in" onClick={() => p.onZoom(1.25)}>
        <ZoomInIcon fontSize="small" />
      </IconButton>
      <Tooltip title={p.minimap ? 'Hide minimap (M)' : 'Show minimap (M)'}>
        <ToggleButton size="small" value="minimap" selected={p.minimap} onChange={p.onToggleMinimap} aria-label="Minimap" sx={{ px: 1 }}>
          <MapIcon fontSize="small" />
        </ToggleButton>
      </Tooltip>
      <Tooltip title="Fit everything (Shift+1)">
        <IconButton size="small" aria-label="Fit to content" onClick={p.onFit}>
          <CenterFocusWeakIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </Paper>
  );
}

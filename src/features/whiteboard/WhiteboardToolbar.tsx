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
import FormatColorResetIcon from '@mui/icons-material/FormatColorReset';
import OpacityIcon from '@mui/icons-material/Opacity';
import CropFreeIcon from '@mui/icons-material/CropFree';
import AddPhotoAlternateIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import MapIcon from '@mui/icons-material/MapOutlined';
import LinkIcon from '@mui/icons-material/Link';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import GroupWorkIcon from '@mui/icons-material/GroupWorkOutlined';
import LayersClearIcon from '@mui/icons-material/LayersClearOutlined';
import LockIcon from '@mui/icons-material/LockOutlined';
import LockOpenIcon from '@mui/icons-material/LockOpenOutlined';
import GridOnIcon from '@mui/icons-material/GridOn';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import { useTheme } from '@mui/material/styles';
import { INK_COLORS, NOTE_COLORS, NOTE_TEXT_COLORS, noteFill, type FillMode } from '@/lib/whiteboard';

export type WbTool = 'select' | 'hand' | 'pen' | 'rect' | 'ellipse' | 'arrow' | 'note' | 'text' | 'frame' | 'eraser';

export interface WbStyle {
  color: string;
  strokeWidth: number;
  noteColor: string;
  /** Text colour for new (and selected) sticky notes. */
  noteText: string;
  /** Fill for new shapes: none, see-through or solid. */
  fill: FillMode;
}

export const TOOLS: {
  value: WbTool;
  label: string;
  key: string;
  icon: ReactElement;
}[] = [
  {
    value: 'select',
    label: 'Select & move',
    key: 'V',
    icon: <NearMeIcon fontSize="small" />,
  },
  {
    value: 'hand',
    label: 'Pan (or hold Space)',
    key: 'H',
    icon: <PanToolIcon fontSize="small" />,
  },
  { value: 'pen', label: 'Pen', key: 'P', icon: <EditIcon fontSize="small" /> },
  {
    value: 'rect',
    label: 'Rectangle',
    key: 'R',
    icon: <CropSquareIcon fontSize="small" />,
  },
  {
    value: 'ellipse',
    label: 'Ellipse',
    key: 'O',
    icon: <RadioButtonUncheckedIcon fontSize="small" />,
  },
  {
    value: 'arrow',
    label: 'Arrow — start or end on the edge of a note or shape to attach it',
    key: 'A',
    icon: <ArrowRightAltIcon fontSize="small" />,
  },
  {
    value: 'note',
    label: 'Sticky note',
    key: 'N',
    icon: <StickyNote2Icon fontSize="small" />,
  },
  {
    value: 'text',
    label: 'Text',
    key: 'T',
    icon: <TextFieldsIcon fontSize="small" />,
  },
  {
    value: 'frame',
    label: 'Frame — groups what you put inside it',
    key: 'F',
    icon: <CropFreeIcon fontSize="small" />,
  },
  {
    value: 'eraser',
    label: 'Eraser',
    key: 'E',
    icon: <ClearIcon fontSize="small" />,
  },
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
  /** Add a web link (Google Maps, YouTube… show a live preview). */
  onAddLink?: () => void;
  /** Sticky notes are selected: show note paper and text colours. */
  noteSelection?: { fill: string; text: string } | null;
  /** Fill of the selected shapes (undefined when none are selected, or they differ). */
  fillNow?: FillMode;
  /** Something selected can be turned. */
  canRotate?: boolean;
  onRotate?: (deg: number) => void;
  /** Snap to grid. */
  snapGrid?: boolean;
  onToggleSnap?: () => void;
  canGroup?: boolean;
  canUngroup?: boolean;
  onGroup?: () => void;
  onUngroup?: () => void;
  /** null when nothing is selected. */
  lockState?: 'locked' | 'unlocked' | null;
  onToggleLock?: () => void;
}

/** Floating tool palette for the whiteboard. */
export function WhiteboardToolbar(p: Props) {
  const theme = useTheme();
  const swatch = (c: string) => (c === 'ink' ? theme.palette.text.primary : c);
  const noteMode = p.tool === 'note' || !!p.noteSelection;
  const noteFillNow = p.noteSelection?.fill ?? p.style.noteColor;
  const noteTextNow = p.noteSelection?.text ?? p.style.noteText;
  return (
    <Paper
      elevation={4}
      role="toolbar"
      aria-label="Whiteboard tools"
      sx={{
        position: 'absolute',
        top: 12,
        left: 12,
        right: { xs: 12, md: 'auto' },
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 0.5,
        p: 0.5,
        borderRadius: 3,
      }}
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
      {p.onAddLink && (
        <Tooltip title="Add a link (L) — maps, videos and music show a live preview; or paste or drop a link">
          <IconButton size="small" aria-label="Add a link" onClick={p.onAddLink}>
            <LinkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {p.canGroup && (
        <Tooltip title="Group (Ctrl+G) — select, move and turn them as one">
          <IconButton size="small" aria-label="Group" onClick={p.onGroup}>
            <GroupWorkIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {p.canUngroup && (
        <Tooltip title="Ungroup (Ctrl+Shift+G)">
          <IconButton size="small" aria-label="Ungroup" onClick={p.onUngroup}>
            <LayersClearIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}
      {p.lockState && (
        <Tooltip title={p.lockState === 'locked' ? 'Unlock (Ctrl+Shift+L)' : 'Lock so it can’t be moved or changed (Ctrl+Shift+L)'}>
          <IconButton size="small" aria-label={p.lockState === 'locked' ? 'Unlock' : 'Lock'} aria-pressed={p.lockState === 'locked'} onClick={p.onToggleLock} color={p.lockState === 'locked' ? 'primary' : 'default'}>
            {p.lockState === 'locked' ? <LockIcon fontSize="small" /> : <LockOpenIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      )}
      {p.onToggleSnap && (
        <Tooltip title={`Snap to grid (G) — ${p.snapGrid ? 'on' : 'off'}. Hold Alt to place freely.`}>
          <ToggleButton size="small" value="snap" selected={!!p.snapGrid} onChange={p.onToggleSnap} aria-label="Snap to grid" sx={{ px: 1, border: 0 }}>
            <GridOnIcon fontSize="small" />
          </ToggleButton>
        </Tooltip>
      )}
      {p.canRotate && p.onRotate && (
        <>
          <Tooltip title="Rotate left 15° ( [ ) · Shift+[ for 90° · or drag the round handle">
            <IconButton size="small" aria-label="Rotate left" onClick={() => p.onRotate!(-15)}>
              <RotateLeftIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Rotate right 15° ( ] ) · Shift+] for 90° · double-click the handle to straighten">
            <IconButton size="small" aria-label="Rotate right" onClick={() => p.onRotate!(15)}>
              <RotateRightIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      )}
      <Divider orientation="vertical" flexItem />
      {noteMode ? (
        <>
          <Box sx={{ display: 'flex', gap: 0.25, px: 0.5 }} role="radiogroup" aria-label="Note colour">
            {NOTE_COLORS.map((c) => {
              const selected = noteFill(noteFillNow) === c;
              return (
                <Tooltip key={c} title="Note colour">
                  <Box
                    component="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`Note colour ${c}`}
                    onClick={() => p.setStyle({ noteColor: c })}
                    sx={{
                      width: 20,
                      height: 20,
                      borderRadius: '3px',
                      bgcolor: c,
                      border: 2,
                      borderColor: selected ? 'primary.main' : 'rgba(0,0,0,0.15)',
                      boxShadow: '1px 2px 3px rgba(0,0,0,0.25)',
                      cursor: 'pointer',
                      p: 0,
                      outlineOffset: 2,
                    }}
                  />
                </Tooltip>
              );
            })}
          </Box>
          <Divider orientation="vertical" flexItem />
          <Box sx={{ display: 'flex', gap: 0.25, px: 0.5 }} role="radiogroup" aria-label="Note text colour">
            {NOTE_TEXT_COLORS.map((c) => {
              const selected = noteTextNow === c;
              return (
                <Tooltip key={c} title="Text colour">
                  <Box
                    component="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`Text colour ${c}`}
                    onClick={() => p.setStyle({ noteText: c })}
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: '4px',
                      bgcolor: noteFill(noteFillNow),
                      color: c,
                      fontFamily: '"Caveat", cursive',
                      fontWeight: 700,
                      fontSize: 17,
                      lineHeight: '18px',
                      border: 2,
                      borderColor: selected ? 'primary.main' : 'rgba(0,0,0,0.15)',
                      cursor: 'pointer',
                      p: 0,
                      outlineOffset: 2,
                    }}
                  >
                    A
                  </Box>
                </Tooltip>
              );
            })}
          </Box>
        </>
      ) : (
        <Box sx={{ display: 'flex', gap: 0.25, px: 0.5 }} role="radiogroup" aria-label="Color">
          {INK_COLORS.map((c) => {
            const selected = p.style.color === c;
            return (
              <Box
                key={c}
                component="button"
                role="radio"
                aria-checked={selected}
                aria-label={c === 'ink' ? 'Ink (theme text color)' : `Color ${c}`}
                onClick={() => p.setStyle({ color: c })}
                sx={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  bgcolor: swatch(c),
                  border: 2,
                  borderColor: selected ? 'primary.main' : 'divider',
                  cursor: 'pointer',
                  p: 0,
                  outlineOffset: 2,
                }}
              />
            );
          })}
        </Box>
      )}
      {!noteMode && (
        <>
          <Select
            size="small"
            value={p.style.strokeWidth}
            onChange={(e) => p.setStyle({ strokeWidth: Number(e.target.value) })}
            inputProps={{ 'aria-label': 'Stroke width' }}
            sx={{ height: 32, fontSize: 13 }}
          >
            {[2, 4, 8, 12].map((w) => (
              <MenuItem key={w} value={w}>
                <Box
                  sx={{
                    width: 28,
                    height: w,
                    bgcolor: 'text.primary',
                    borderRadius: 1,
                    mr: 1,
                  }}
                />
                {w}px
              </MenuItem>
            ))}
          </Select>
          <ToggleButtonGroup size="small" exclusive value={p.fillNow ?? p.style.fill} onChange={(_, v: FillMode | null) => v && p.setStyle({ fill: v })} aria-label="Shape fill">
            <Tooltip title="No fill">
              <ToggleButton value="none" aria-label="No fill" sx={{ px: 0.75 }}>
                <FormatColorResetIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
            <Tooltip title="See-through fill">
              <ToggleButton value="transparent" aria-label="See-through fill" sx={{ px: 0.75 }}>
                <OpacityIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
            <Tooltip title="Solid fill">
              <ToggleButton value="solid" aria-label="Solid fill" sx={{ px: 0.75 }}>
                <FormatColorFillIcon fontSize="small" />
              </ToggleButton>
            </Tooltip>
          </ToggleButtonGroup>
        </>
      )}
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

import { useRef, type KeyboardEvent, type PointerEvent } from 'react';
import { Box } from '@mui/material';

interface Props {
  /** "vertical" handle sits between left/right panes; "horizontal" between top/bottom. */
  orientation?: 'vertical' | 'horizontal';
  value: number;
  min: number;
  max: number;
  /** +1 if dragging right/down grows the pane, -1 if it shrinks it. */
  direction?: 1 | -1;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
  label: string;
}

/** Accessible splitter: drag with the pointer or use arrow keys. */
export function ResizeHandle({ orientation = 'vertical', value, min, max, direction = 1, onChange, onCommit, label }: Props) {
  const start = useRef<{ pos: number; value: number } | null>(null);
  const latest = useRef(value);
  latest.current = value;
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const vertical = orientation === 'vertical';

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    start.current = { pos: vertical ? e.clientX : e.clientY, value };
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    const delta = (vertical ? e.clientX : e.clientY) - start.current.pos;
    onChange(clamp(start.current.value + delta * direction));
  };
  const onPointerUp = () => {
    if (start.current) onCommit?.(latest.current);
    start.current = null;
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 48 : 16;
    const grow = vertical ? ['ArrowRight'] : ['ArrowDown'];
    const shrink = vertical ? ['ArrowLeft'] : ['ArrowUp'];
    let next: number | null = null;
    if (grow.includes(e.key)) next = clamp(value + step * direction);
    else if (shrink.includes(e.key)) next = clamp(value - step * direction);
    else if (e.key === 'Home') next = min;
    else if (e.key === 'End') next = max;
    if (next !== null) {
      e.preventDefault();
      onChange(next);
      onCommit?.(next);
    }
  };

  return (
    <Box
      role="separator"
      aria-orientation={vertical ? 'vertical' : 'horizontal'}
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={max}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKeyDown}
      sx={{
        flex: '0 0 auto',
        position: 'relative',
        zIndex: 2,
        cursor: vertical ? 'col-resize' : 'row-resize',
        width: vertical ? 6 : '100%',
        height: vertical ? '100%' : 6,
        mx: vertical ? '-3px' : 0,
        my: vertical ? 0 : '-3px',
        touchAction: 'none',
        '&::after': {
          content: '""',
          position: 'absolute',
          inset: vertical ? '0 2px' : '2px 0',
          bgcolor: 'divider',
          transition: 'background-color 120ms',
        },
        '&:hover::after, &:focus-visible::after': { bgcolor: 'primary.main' },
      }}
    />
  );
}

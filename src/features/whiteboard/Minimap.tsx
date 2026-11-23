/** Overview of the whole board in the corner; click or drag to move the view there. */
import { useRef, type PointerEvent } from 'react';
import { Paper } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { WbElement, Whiteboard } from '@/types/models';
import { elementBounds, noteFill, unionBounds, type Point } from '@/lib/whiteboard';

const W = 200;
const H = 136;

interface Props {
  elements: WbElement[];
  vp: Whiteboard['viewport'];
  /** Canvas size in screen pixels. */
  width: number;
  height: number;
  ink: string;
  onCenter: (world: Point) => void;
}

export function Minimap({ elements, vp, width, height, ink, onCenter }: Props) {
  const theme = useTheme();
  const dragging = useRef(false);
  const view = { x: -vp.x / vp.zoom, y: -vp.y / vp.zoom, w: width / vp.zoom, h: height / vp.zoom };
  const content = unionBounds(elements) ?? view;
  const x0 = Math.min(content.x, view.x);
  const y0 = Math.min(content.y, view.y);
  const x1 = Math.max(content.x + content.w, view.x + view.w);
  const y1 = Math.max(content.y + content.h, view.y + view.h);
  const pad = Math.max(x1 - x0, y1 - y0) * 0.06;
  const world = { x: x0 - pad, y: y0 - pad, w: x1 - x0 + pad * 2, h: y1 - y0 + pad * 2 };
  const k = Math.min(W / world.w, H / world.h);
  const ox = (W - world.w * k) / 2;
  const oy = (H - world.h * k) / 2;
  const sx = (x: number) => ox + (x - world.x) * k;
  const sy = (y: number) => oy + (y - world.y) * k;

  const toWorld = (e: PointerEvent<SVGSVGElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: (e.clientX - r.left - ox) / k + world.x, y: (e.clientY - r.top - oy) / k + world.y };
  };

  const fillOf = (el: WbElement): string => {
    if (el.type === 'note') return noteFill(el.fill);
    if (el.type === 'frame') return `${el.fill}55`;
    if (el.type === 'card' || el.type === 'link') return '#ffffff';
    if (el.type === 'image') return '#9e9e9e';
    return 'none';
  };
  const strokeOf = (el: WbElement) => (el.type === 'frame' ? el.fill : el.color === 'ink' ? ink : el.color);

  return (
    <Paper
      elevation={4}
      sx={{ position: 'absolute', right: 12, bottom: 12, zIndex: 1200, width: W, height: H, overflow: 'hidden', borderRadius: 2, opacity: 0.94, display: { xs: 'none', sm: 'block' } }}
      aria-label="Minimap: click to move the view"
    >
      <svg
        width={W}
        height={H}
        style={{ display: 'block', cursor: 'pointer', touchAction: 'none' }}
        onPointerDown={(e) => {
          dragging.current = true;
          onCenter(toWorld(e));
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* pointer already gone */
          }
        }}
        onPointerMove={(e) => dragging.current && onCenter(toWorld(e))}
        onPointerUp={() => (dragging.current = false)}
      >
        {elements.map((el) => {
          if (el.type === 'arrow') return <line key={el.id} x1={sx(el.x1)} y1={sy(el.y1)} x2={sx(el.x2)} y2={sy(el.y2)} stroke={strokeOf(el)} strokeWidth={1} opacity={0.7} />;
          if (el.type === 'path')
            return <polyline key={el.id} points={el.points.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ')} fill="none" stroke={strokeOf(el)} strokeWidth={1} opacity={0.7} />;
          const b = elementBounds(el);
          return <rect key={el.id} x={sx(b.x)} y={sy(b.y)} width={Math.max(1.5, b.w * k)} height={Math.max(1.5, b.h * k)} rx={1} fill={fillOf(el)} stroke={strokeOf(el)} strokeWidth={0.75} opacity={0.85} />;
        })}
        <rect x={sx(view.x)} y={sy(view.y)} width={view.w * k} height={view.h * k} fill={`${theme.palette.primary.main}18`} stroke={theme.palette.primary.main} strokeWidth={1.5} rx={2} />
      </svg>
    </Paper>
  );
}

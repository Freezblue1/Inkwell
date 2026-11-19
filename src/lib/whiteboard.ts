/** Whiteboard geometry: bounds, hit-testing, moving, resizing and path smoothing. Pure functions. */
import type { ID, WbArrow, WbElement, WbFrame, WbPath } from '@/types/models';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Sticky-note paper colours (bright, like real pads). */
export const NOTE_COLORS = ['#ffe45c', '#ffb25b', '#ff94c2', '#a8e06f', '#7fcffc', '#c3a1f7'];
/** Notes made before the brighter palette keep working: their pale colours map to the new ones. */
const LEGACY_NOTE_COLORS: Record<string, string> = {
  '#fff59d': '#ffe45c',
  '#ffcc80': '#ffb25b',
  '#f8bbd0': '#ff94c2',
  '#c5e1a5': '#a8e06f',
  '#b3e5fc': '#7fcffc',
  '#d1c4e9': '#c3a1f7',
};
export const noteFill = (fill: string): string => LEGACY_NOTE_COLORS[fill.toLowerCase()] ?? fill;
export const NOTE_TEXT_COLORS = ['#3e2723', '#212121', '#c62828', '#1565c0', '#2e7d32', '#6a1b9a', '#ffffff'];
export const DEFAULT_NOTE_TEXT = '#3e2723';

/** A small, stable tilt per note (degrees), so a board looks hand-placed. */
export function noteTilt(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 300) / 100 - 1.5) * 0.9;
}

/** Darkens (amount < 0) or lightens (amount > 0) a #rrggbb colour. */
export function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = (v: number) => Math.round(Math.min(255, Math.max(0, amount < 0 ? v * (1 + amount) : v + (255 - v) * amount)));
  const r = ch(n >> 16);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
export const INK_COLORS = ['ink', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#6d4c41'];
export const TEXT_LINE_HEIGHT = 1.3;
export const NOTE_PADDING = 12;
export const NOTE_FONT_SIZE = 16;
/** Height of a frame's title bar (the part you grab to move it). */
export const FRAME_TITLE_H = 28;
export const FRAME_COLORS = ['#90caf9', '#ef9a9a', '#a5d6a7', '#ffe082', '#ce93d8', '#b0bec5'];

/** Line count estimate used when no canvas is available (tests, SSR). */
function estimateLines(text: string, width: number, fontSize: number): number {
  const charsPerLine = Math.max(1, Math.floor(width / (fontSize * 0.55)));
  return text.split('\n').reduce((n, line) => n + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
}

let measureCtx: CanvasRenderingContext2D | null | undefined;

/** Word-wraps text to a width using canvas text metrics (falls back to an estimate). */
export function wrapText(text: string, width: number, fontSize: number, family = 'Caveat, cursive'): string[] {
  if (measureCtx === undefined) {
    measureCtx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
  }
  const ctx = measureCtx;
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (!ctx) {
      const per = Math.max(1, Math.floor(width / (fontSize * 0.55)));
      if (!para) out.push('');
      for (let i = 0; i < para.length; i += per) out.push(para.slice(i, i + per));
      continue;
    }
    ctx.font = `${fontSize}px ${family}`;
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      const test = line + word;
      if (ctx.measureText(test).width > width && line.trim()) {
        out.push(line.trimEnd());
        line = word.trimStart();
      } else line = test;
    }
    out.push(line);
  }
  return out;
}

export function textHeight(text: string, width: number, fontSize: number): number {
  const lines = typeof document !== 'undefined' ? wrapText(text || ' ', width, fontSize).length : estimateLines(text || ' ', width, fontSize);
  return Math.max(1, lines) * fontSize * TEXT_LINE_HEIGHT;
}

export function elementBounds(el: WbElement): Rect {
  switch (el.type) {
    case 'path': {
      const xs = el.points.map((p) => p[0]);
      const ys = el.points.map((p) => p[1]);
      const x = Math.min(...xs);
      const y = Math.min(...ys);
      return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
    }
    case 'arrow':
      return { x: Math.min(el.x1, el.x2), y: Math.min(el.y1, el.y2), w: Math.abs(el.x2 - el.x1), h: Math.abs(el.y2 - el.y1) };
    case 'text':
      return { x: el.x, y: el.y, w: el.w, h: textHeight(el.text, el.w, el.fontSize) };
    case 'frame':
      // Includes the title bar above the frame.
      return { x: el.x, y: el.y - FRAME_TITLE_H, w: el.w, h: el.h + FRAME_TITLE_H };
    default:
      return { x: el.x, y: el.y, w: el.w, h: el.h };
  }
}

/** Bounds covering several elements (null when empty). */
export function unionBounds(els: WbElement[]): Rect | null {
  if (!els.length) return null;
  const rs = els.map(elementBounds);
  const x = Math.min(...rs.map((r) => r.x));
  const y = Math.min(...rs.map((r) => r.y));
  return { x, y, w: Math.max(...rs.map((r) => r.x + r.w)) - x, h: Math.max(...rs.map((r) => r.y + r.h)) - y };
}

export function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/** Is point p on (or inside) the element? `tol` is in world units. */
export function hitTest(el: WbElement, p: Point, tol = 6): boolean {
  switch (el.type) {
    case 'path': {
      const r = tol + el.strokeWidth / 2;
      if (el.points.length === 1) return Math.hypot(p.x - el.points[0][0], p.y - el.points[0][1]) <= r;
      for (let i = 1; i < el.points.length; i++) {
        const [ax, ay] = el.points[i - 1];
        const [bx, by] = el.points[i];
        if (distToSegment(p, { x: ax, y: ay }, { x: bx, y: by }) <= r) return true;
      }
      return false;
    }
    case 'arrow':
      return distToSegment(p, { x: el.x1, y: el.y1 }, { x: el.x2, y: el.y2 }) <= tol + el.strokeWidth / 2;
    case 'frame': {
      // Only the title bar and the border pick up a frame, so you can still click what's inside it.
      const inside = p.x >= el.x - tol && p.x <= el.x + el.w + tol && p.y >= el.y - FRAME_TITLE_H - tol && p.y <= el.y + el.h + tol;
      if (!inside) return false;
      const onTitle = p.y <= el.y + 2 && p.y >= el.y - FRAME_TITLE_H - tol && p.x <= el.x + Math.max(160, el.w);
      const onBorder = Math.abs(p.x - el.x) <= tol || Math.abs(p.x - el.x - el.w) <= tol || Math.abs(p.y - el.y) <= tol || Math.abs(p.y - el.y - el.h) <= tol;
      return onTitle || onBorder;
    }
    case 'ellipse': {
      const rx = el.w / 2 + tol;
      const ry = el.h / 2 + tol;
      const cx = el.x + el.w / 2;
      const cy = el.y + el.h / 2;
      return ((p.x - cx) ** 2) / (rx * rx) + ((p.y - cy) ** 2) / (ry * ry) <= 1;
    }
    default: {
      const b = elementBounds(el);
      return p.x >= b.x - tol && p.x <= b.x + b.w + tol && p.y >= b.y - tol && p.y <= b.y + b.h + tol;
    }
  }
}

/** Topmost element under a point (last drawn wins). */
export function topmostAt(els: WbElement[], p: Point, tol = 6): WbElement | null {
  for (let i = els.length - 1; i >= 0; i--) if (hitTest(els[i], p, tol)) return els[i];
  return null;
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.w && a.x + a.w >= b.x && a.y <= b.y + b.h && a.y + a.h >= b.y;
}

export function normalizeRect(x1: number, y1: number, x2: number, y2: number): Rect {
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) };
}

export function moveElement<T extends WbElement>(el: T, dx: number, dy: number): T {
  switch (el.type) {
    case 'path':
      return { ...el, points: el.points.map(([x, y]) => [x + dx, y + dy] as [number, number]) };
    case 'arrow':
      return { ...el, x1: el.x1 + dx, y1: el.y1 + dy, x2: el.x2 + dx, y2: el.y2 + dy };
    default:
      return { ...el, x: (el as { x: number }).x + dx, y: (el as { y: number }).y + dy };
  }
}

/** Resizes from the bottom-right corner so that it reaches point p. */
export function resizeElement<T extends WbElement>(el: T, p: Point, min = 16): T {
  switch (el.type) {
    case 'path': {
      const b = elementBounds(el);
      const sx = b.w ? Math.max(min, p.x - b.x) / b.w : 1;
      const sy = b.h ? Math.max(min, p.y - b.y) / b.h : 1;
      return { ...el, points: (el as WbPath).points.map(([x, y]) => [b.x + (x - b.x) * sx, b.y + (y - b.y) * sy] as [number, number]) };
    }
    case 'arrow':
      return { ...el, x2: p.x, y2: p.y };
    case 'text':
      return { ...el, w: Math.max(min * 3, p.x - el.x) };
    case 'image': {
      // Pictures keep their proportions.
      const ratio = el.h / Math.max(1, el.w);
      const w = Math.max(min * 2, p.x - el.x, (p.y - el.y) / ratio);
      return { ...el, w, h: w * ratio };
    }
    default:
      return { ...el, w: Math.max(min, p.x - (el as { x: number }).x), h: Math.max(min, p.y - (el as { y: number }).y) };
  }
}

/** Drops points closer than `minDist` to the previous kept point (keeps the last). */
export function simplifyPoints(points: [number, number][], minDist = 2): [number, number][] {
  if (points.length <= 2) return points;
  const out: [number, number][] = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = out[out.length - 1];
    if (Math.hypot(points[i][0] - px, points[i][1] - py) >= minDist) out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

/** Smooth SVG path through points using quadratic curves between midpoints. */
export function pointsToPath(points: [number, number][]): string {
  if (!points.length) return '';
  if (points.length === 1) {
    const [x, y] = points[0];
    return `M${x} ${y} L${x + 0.1} ${y + 0.1}`;
  }
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    d += ` Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
  }
  const last = points[points.length - 1];
  return `${d} L${last[0]} ${last[1]}`;
}

/** Arrowhead polygon for an arrow ending at (x2, y2). */
export function arrowHead(x1: number, y1: number, x2: number, y2: number, size: number): string {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const p1 = [x2 - size * Math.cos(a - Math.PI / 7), y2 - size * Math.sin(a - Math.PI / 7)];
  const p2 = [x2 - size * Math.cos(a + Math.PI / 7), y2 - size * Math.sin(a + Math.PI / 7)];
  return `${x2},${y2} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`;
}

// ── Frames ────────────────────────────────────────────────────────────────

export function containsRect(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

/** Ids of the elements whose centre lies inside a frame (they move with it). Bigger frames don't count. */
export function elementsInFrame(frame: WbFrame, els: WbElement[]): ID[] {
  const box = { x: frame.x, y: frame.y, w: frame.w, h: frame.h };
  return els
    .filter((e) => {
      if (e.id === frame.id) return false;
      const b = elementBounds(e);
      if (e.type === 'frame' && b.w * b.h >= box.w * box.h) return false;
      const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      return c.x >= box.x && c.x <= box.x + box.w && c.y >= box.y && c.y <= box.y + box.h;
    })
    .map((e) => e.id);
}

/** Frames first (behind everything), then the rest in their stacking order. */
export function paintOrder(els: WbElement[]): WbElement[] {
  return [...els.filter((e) => e.type === 'frame'), ...els.filter((e) => e.type !== 'frame')];
}

// ── Attached arrows ───────────────────────────────────────────────────────

/** Can an arrow end be attached to this element? */
export function isAttachable(el: WbElement): boolean {
  return el.type !== 'arrow' && el.type !== 'path' && el.type !== 'frame';
}

/** Topmost element an arrow end could attach to at p. */
export function attachableAt(els: WbElement[], p: Point, tol = 6, exclude?: ID): WbElement | null {
  for (let i = els.length - 1; i >= 0; i--) {
    const el = els[i];
    if (el.id !== exclude && isAttachable(el) && hitTest(el, p, tol)) return el;
  }
  return null;
}

const centerOf = (r: Rect): Point => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

/** Where a line from the element's centre towards `toward` leaves its outline (plus a small gap). */
export function boundaryPoint(el: WbElement, toward: Point, gap = 6): Point {
  const r = elementBounds(el);
  const c = centerOf(r);
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (!dx && !dy) return c;
  if (el.type === 'ellipse') {
    const rx = r.w / 2 + gap;
    const ry = r.h / 2 + gap;
    const k = 1 / Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2);
    return { x: c.x + dx * k, y: c.y + dy * k };
  }
  const hw = r.w / 2 + gap;
  const hh = r.h / 2 + gap;
  const k = Math.min(dx ? hw / Math.abs(dx) : Infinity, dy ? hh / Math.abs(dy) : Infinity);
  return { x: c.x + dx * k, y: c.y + dy * k };
}

/**
 * Recomputes the ends of attached arrows from the elements they're attached
 * to. Attachments to deleted elements are dropped. Returns the same array
 * when nothing changed.
 */
export function routeConnectors(els: WbElement[]): WbElement[] {
  if (!els.some((e) => e.type === 'arrow' && (e.from || e.to))) return els;
  const byId = new Map(els.map((e) => [e.id, e]));
  let changed = false;
  const out = els.map((el) => {
    if (el.type !== 'arrow' || (!el.from && !el.to)) return el;
    const a = el.from ? byId.get(el.from) : undefined;
    const b = el.to ? byId.get(el.to) : undefined;
    const aOk = a && isAttachable(a) ? a : undefined;
    const bOk = b && isAttachable(b) ? b : undefined;
    const startAim = bOk ? centerOf(elementBounds(bOk)) : { x: el.x2, y: el.y2 };
    const endAim = aOk ? centerOf(elementBounds(aOk)) : { x: el.x1, y: el.y1 };
    const s = aOk ? boundaryPoint(aOk, startAim) : { x: el.x1, y: el.y1 };
    const e = bOk ? boundaryPoint(bOk, endAim) : { x: el.x2, y: el.y2 };
    const next: WbArrow = { ...el, x1: s.x, y1: s.y, x2: e.x, y2: e.y, from: aOk ? el.from : null, to: bOk ? el.to : null };
    if (next.x1 === el.x1 && next.y1 === el.y1 && next.x2 === el.x2 && next.y2 === el.y2 && next.from === el.from && next.to === el.to) return el;
    changed = true;
    return next;
  });
  return changed ? out : els;
}

/**
 * Copies elements with fresh ids. Arrows attached to elements inside the copied
 * set are re-attached to the copies; attachments outside the set are dropped.
 */
export function copyElements(els: WbElement[], makeId: () => string, dx = 0, dy = 0): WbElement[] {
  const ids = new Map(els.map((e) => [e.id, makeId()]));
  return els.map((el) => {
    const moved = { ...moveElement(el, dx, dy), id: ids.get(el.id)! };
    if (moved.type !== 'arrow') return moved;
    return { ...moved, from: moved.from ? ids.get(moved.from) ?? null : null, to: moved.to ? ids.get(moved.to) ?? null : null };
  });
}

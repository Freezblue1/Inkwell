import { describe, expect, it } from 'vitest';
import type { WbArrow, WbElement, WbFrame, WbImage, WbNote, WbPath, WbShape } from '@/types/models';
import {
  arrowHead,
  attachableAt,
  boundaryPoint,
  containsRect,
  copyElements,
  elementBounds,
  elementsInFrame,
  hitTest,
  moveElement,
  normalizeRect,
  paintOrder,
  pointsToPath,
  rectsIntersect,
  resizeElement,
  routeConnectors,
  simplifyPoints,
  topmostAt,
  unionBounds,
} from './whiteboard';

const rect: WbShape = { id: 'r', type: 'rect', x: 10, y: 10, w: 100, h: 50, fill: 'none', color: 'ink', strokeWidth: 2 };
const ellipse: WbShape = { ...rect, id: 'e', type: 'ellipse' };
const path: WbPath = { id: 'p', type: 'path', points: [[0, 0], [50, 0], [50, 50]], color: 'ink', strokeWidth: 4 };
const arrow: WbArrow = { id: 'a', type: 'arrow', x1: 0, y1: 100, x2: 100, y2: 100, color: 'ink', strokeWidth: 2 };
const note: WbNote = { id: 'n', type: 'note', x: 200, y: 200, w: 180, h: 120, text: 'Hi', fill: '#fff59d', color: 'ink', strokeWidth: 1, docId: null };

describe('whiteboard geometry', () => {
  it('computes bounds for every element type', () => {
    expect(elementBounds(rect)).toEqual({ x: 10, y: 10, w: 100, h: 50 });
    expect(elementBounds(path)).toEqual({ x: 0, y: 0, w: 50, h: 50 });
    expect(elementBounds(arrow)).toEqual({ x: 0, y: 100, w: 100, h: 0 });
    expect(unionBounds([rect, note])).toEqual({ x: 10, y: 10, w: 370, h: 310 });
    expect(unionBounds([])).toBeNull();
  });

  it('hit-tests strokes, shapes and ellipses', () => {
    expect(hitTest(path, { x: 25, y: 1 })).toBe(true);
    expect(hitTest(path, { x: 25, y: 30 })).toBe(false);
    expect(hitTest(arrow, { x: 50, y: 103 })).toBe(true);
    expect(hitTest(rect, { x: 60, y: 30 })).toBe(true);
    // Corner of the bounding box is outside the ellipse.
    expect(hitTest(ellipse, { x: 12, y: 12 }, 0)).toBe(false);
    expect(hitTest(ellipse, { x: 60, y: 35 }, 0)).toBe(true);
  });

  it('picks the topmost element', () => {
    const els: WbElement[] = [rect, { ...rect, id: 'top' }];
    expect(topmostAt(els, { x: 50, y: 30 })?.id).toBe('top');
    expect(topmostAt(els, { x: 500, y: 500 })).toBeNull();
  });

  it('moves and resizes elements', () => {
    expect(moveElement(path, 10, 5).points[0]).toEqual([10, 5]);
    expect(moveElement(arrow, 1, 1)).toMatchObject({ x1: 1, y1: 101, x2: 101, y2: 101 });
    expect(moveElement(rect, -10, 0)).toMatchObject({ x: 0, y: 10 });
    expect(resizeElement(rect, { x: 210, y: 110 })).toMatchObject({ w: 200, h: 100 });
    expect(resizeElement(rect, { x: 0, y: 0 })).toMatchObject({ w: 16, h: 16 });
    const scaled = resizeElement(path, { x: 100, y: 100 });
    expect(elementBounds(scaled)).toEqual({ x: 0, y: 0, w: 100, h: 100 });
  });

  it('normalizes and intersects rectangles', () => {
    expect(normalizeRect(10, 10, 0, 0)).toEqual({ x: 0, y: 0, w: 10, h: 10 });
    expect(rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
    expect(rectsIntersect({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 5, h: 5 })).toBe(false);
  });

  it('simplifies and smooths freehand strokes', () => {
    const pts: [number, number][] = [[0, 0], [0.5, 0], [1, 0], [5, 0], [5.2, 0], [10, 0]];
    expect(simplifyPoints(pts, 2)).toEqual([[0, 0], [5, 0], [10, 0]]);
    expect(pointsToPath([[0, 0], [10, 10], [20, 0]])).toBe('M0 0 Q10 10 15 5 L20 0');
    expect(arrowHead(0, 0, 10, 0, 5).startsWith('10,0')).toBe(true);
  });
});

describe('attached arrows, frames, pictures', () => {
  const a: WbNote = { ...note, id: 'A', x: 0, y: 0, w: 100, h: 100 };
  const b: WbNote = { ...note, id: 'B', x: 300, y: 0, w: 100, h: 100 };
  const link: WbArrow = { ...arrow, id: 'L', x1: 0, y1: 0, x2: 0, y2: 0, from: 'A', to: 'B' };

  it('routes attached arrow ends to the outlines, and they follow when a note moves', () => {
    const routed = routeConnectors([a, b, link]);
    const l = routed[2] as WbArrow;
    expect(l.x1).toBeCloseTo(106);
    expect(l.x2).toBeCloseTo(294);
    expect(l.y1).toBeCloseTo(50);
    const moved = routeConnectors([a, moveElement(b, 0, 300), l]);
    const m = moved[2] as WbArrow;
    expect(m.y2).toBeLessThan(300); // now enters B from above
    expect(m.y2).toBeGreaterThan(200);
  });

  it('keeps the arrow where it was when its target is deleted, and drops the link', () => {
    const routed = routeConnectors([a, b, link]);
    const after = routeConnectors([a, routed[2]]);
    const l = after[1] as WbArrow;
    expect(l.to).toBeNull();
    expect(l.x2).toBeCloseTo(294);
    expect(routeConnectors([a])).toEqual([a]);
  });

  it('finds ellipse outlines and attachable elements', () => {
    const ell: WbShape = { ...ellipse, x: 0, y: 0, w: 200, h: 100 };
    const p = boundaryPoint(ell, { x: 500, y: 50 }, 0);
    expect(p.x).toBeCloseTo(200);
    expect(p.y).toBeCloseTo(50);
    expect(attachableAt([a, arrow], { x: 50, y: 50 })?.id).toBe('A');
    expect(attachableAt([a], { x: 50, y: 50 }, 6, 'A')).toBeNull();
  });

  it('copies elements with links re-pointed to the copies', () => {
    let n = 0;
    const copies = copyElements([a, b, link], () => `c${++n}`, 10, 0);
    const l = copies[2] as WbArrow;
    expect(l.from).toBe('c1');
    expect(l.to).toBe('c2');
    const lone = copyElements([link], () => 'x')[0] as WbArrow;
    expect(lone.from).toBeNull();
  });

  it('picks frames by title bar or border only, and knows what they contain', () => {
    const frame: WbFrame = { id: 'F', type: 'frame', x: 0, y: 0, w: 500, h: 300, title: 'Suspects', fill: '#ffe082', color: 'ink', strokeWidth: 2 };
    expect(hitTest(frame, { x: 40, y: -12 })).toBe(true); // title bar
    expect(hitTest(frame, { x: 250, y: 150 })).toBe(false); // empty middle
    expect(hitTest(frame, { x: 500, y: 150 })).toBe(true); // right border
    expect(elementsInFrame(frame, [frame, a, { ...b, x: 440 }, { ...b, id: 'out', x: 470 }])).toEqual(['A', 'B']);
    expect(elementBounds(frame).y).toBeLessThan(0);
    expect(paintOrder([a, frame]).map((e) => e.id)).toEqual(['F', 'A']);
    expect(containsRect({ x: 0, y: 0, w: 10, h: 10 }, { x: 2, y: 2, w: 3, h: 3 })).toBe(true);
  });

  it('resizes pictures keeping their proportions', () => {
    const img: WbImage = { id: 'I', type: 'image', x: 0, y: 0, w: 200, h: 100, assetId: 'x', name: 'map.png', color: 'ink', strokeWidth: 1 };
    const r = resizeElement(img, { x: 400, y: 10 });
    expect(r.w).toBe(400);
    expect(r.h).toBe(200);
  });
});

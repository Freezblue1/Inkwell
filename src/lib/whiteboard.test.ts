import { describe, expect, it } from 'vitest';
import type { WbArrow, WbElement, WbNote, WbPath, WbShape } from '@/types/models';
import { arrowHead, elementBounds, hitTest, moveElement, normalizeRect, pointsToPath, rectsIntersect, resizeElement, simplifyPoints, topmostAt, unionBounds } from './whiteboard';

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

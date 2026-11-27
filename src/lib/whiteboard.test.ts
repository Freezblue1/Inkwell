import { describe, expect, it } from 'vitest';
import type { WbArrow, WbElement, WbFrame, WbImage, WbNote, WbPath, WbShape, WbText } from '@/types/models';
import {
  arrowHead,
  arrowLineEnd,
  attachableAt,
  anchorPoints,
  boundaryPoint,
  connectorEnds,
  containsRect,
  copyElements,
  elementBounds,
  elementsInFrame,
  fillFor,
  fillModeOf,
  hitTest,
  moveElement,
  alignSnap,
  segmentIntersectsRect,
  touchesRect,
  selectedGroups,
  snapToGrid,
  withGroups,
  normalizeAngle,
  rotateElement,
  rotatePoint,
  snapAngle,
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

  it('joins attached arrows at side middles or corners, whichever faces the other end', () => {
    // Side by side: middle of the right side to middle of the left side.
    expect(connectorEnds(a, b, { x: 0, y: 0 }, { x: 0, y: 0 })).toEqual({ start: { x: 106, y: 50 }, end: { x: 294, y: 50 } });
    // Below and a little to the right: still the side middles.
    const below = { ...b, x: 60, y: 300 };
    expect(connectorEnds(a, below, { x: 0, y: 0 }, { x: 0, y: 0 })).toEqual({ start: { x: 50, y: 106 }, end: { x: 110, y: 294 } });
    // Clearly diagonal: corner to corner.
    const diag = connectorEnds(a, { ...b, y: 300 }, { x: 0, y: 0 }, { x: 0, y: 0 });
    expect(diag.start.x).toBeCloseTo(100 + 6 / Math.SQRT2);
    expect(diag.start.y).toBeCloseTo(100 + 6 / Math.SQRT2);
    expect(diag.end.x).toBeCloseTo(300 - 6 / Math.SQRT2);
    expect(diag.end.y).toBeCloseTo(300 - 6 / Math.SQRT2);
    // One free end: the attached end faces it.
    expect(connectorEnds(a, undefined, { x: 0, y: 0 }, { x: 50, y: -200 }).start).toEqual({ x: 50, y: -6 });
  });

  it('puts anchor points on ellipses and turns them with rotated elements', () => {
    const ell: WbShape = { ...ellipse, x: 0, y: 0, w: 200, h: 100 };
    const pts = anchorPoints(ell, 0).map((q) => q.p);
    expect(pts[0].x).toBeCloseTo(200);
    expect(pts[0].y).toBeCloseTo(50);
    expect(pts[2].x).toBeCloseTo(100);
    expect(pts[2].y).toBeCloseTo(100);
    const turned = anchorPoints({ ...a, rotation: 90 }, 0).map((q) => q.p);
    // The right-side middle of a quarter-turned note now sits at the bottom.
    expect(turned[0].x).toBeCloseTo(50);
    expect(turned[0].y).toBeCloseTo(100);
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
    // Only near the edge: the middle of a note is free for pointing at things inside it.
    expect(attachableAt([a, arrow], { x: 97, y: 50 })?.id).toBe('A');
    expect(attachableAt([a, arrow], { x: 106, y: 50 })?.id).toBe('A');
    expect(attachableAt([a, arrow], { x: 50, y: 50 })).toBeNull();
    expect(attachableAt([a], { x: 97, y: 50 }, 6, 'A')).toBeNull();
    expect(attachableAt([ell], { x: 100, y: 2 }, 6)?.id).toBe(ell.id);
    expect(attachableAt([ell], { x: 100, y: 50 }, 6)).toBeNull();
  });

  it('stops the arrow line inside its head', () => {
    const e = arrowLineEnd(0, 0, 100, 0, 20);
    expect(e.x).toBeCloseTo(85);
    expect(arrowLineEnd(0, 0, 10, 0, 20).x).toBeCloseTo(4);
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

describe('rotation', () => {
  const rect: WbShape = { id: 'r', type: 'rect', x: 0, y: 0, w: 100, h: 40, fill: 'none', color: 'ink', strokeWidth: 2 };

  it('rotates points clockwise around a centre and normalises angles', () => {
    const q = rotatePoint({ x: 10, y: 0 }, 90, { x: 0, y: 0 });
    expect(q.x).toBeCloseTo(0);
    expect(q.y).toBeCloseTo(10);
    expect(normalizeAngle(270)).toBe(-90);
    expect(normalizeAngle(-180)).toBe(180);
    expect(snapAngle(47, true)).toBe(45);
    expect(snapAngle(88, false)).toBe(90);
    expect(snapAngle(80, false)).toBe(80);
  });

  it('grows the bounds and hit-tests in the rotated frame', () => {
    const r90 = { ...rect, rotation: 90 };
    const b = elementBounds(r90);
    expect(b.w).toBeCloseTo(40);
    expect(b.h).toBeCloseTo(100);
    expect(b.x).toBeCloseTo(30);
    expect(hitTest(r90, { x: 50, y: -25 }, 0)).toBe(true); // inside once turned upright
    expect(hitTest(r90, { x: 5, y: 20 }, 0)).toBe(false); // inside the unrotated box only
  });

  it('turns a group around its centre: shapes gain rotation, strokes rotate their points, frames stay upright', () => {
    const pivot = { x: 0, y: 0 };
    const moved = rotateElement(rect, 90, pivot);
    expect(moved.rotation).toBe(90);
    expect(moved.x + moved.w / 2).toBeCloseTo(-20); // centre (50,20) → (-20,50)
    expect(moved.y + moved.h / 2).toBeCloseTo(50);
    const path = rotateElement({ id: 'p', type: 'path', points: [[10, 0]], color: 'ink', strokeWidth: 2 }, 90, pivot);
    expect(path.points[0][0]).toBeCloseTo(0);
    expect(path.points[0][1]).toBeCloseTo(10);
    const frame = rotateElement<WbFrame>({ id: 'f', type: 'frame', x: 0, y: 0, w: 100, h: 40, title: 'F', fill: '#90caf9', color: 'ink', strokeWidth: 2 }, 90, pivot);
    expect(frame.rotation).toBeUndefined();
  });

  it('resizes a rotated shape in its own frame, keeping its top-left corner in place', () => {
    const r = { ...rect, rotation: 90 };
    const corner = rotatePoint({ x: 0, y: 0 }, 90, { x: 50, y: 20 });
    // Drag the (local) bottom-right corner to make it 200 × 60.
    const target = rotatePoint({ x: 200, y: 60 }, 90, { x: 50, y: 20 });
    const out = resizeElement(r, target);
    expect(out.w).toBeCloseTo(200);
    expect(out.h).toBeCloseTo(60);
    const c2 = { x: out.x + out.w / 2, y: out.y + out.h / 2 };
    const corner2 = rotatePoint({ x: out.x, y: out.y }, 90, c2);
    expect(corner2.x).toBeCloseTo(corner.x);
    expect(corner2.y).toBeCloseTo(corner.y);
  });

  it('attaches arrows to the rotated outline', () => {
    const r90 = { ...rect, rotation: 90 }; // now 40 wide, 100 tall around (50,20)
    const above = boundaryPoint(r90, { x: 50, y: -500 }, 0);
    expect(above.x).toBeCloseTo(50);
    expect(above.y).toBeCloseTo(-30); // half the (rotated) height above the centre
    const right = boundaryPoint(r90, { x: 500, y: 20 }, 0);
    expect(right.x).toBeCloseTo(70);
  });
});

describe('text boxes and fills', () => {
  const text: WbText = { id: 't', type: 'text', x: 0, y: 0, w: 260, text: 'Hi', fontSize: 20, color: 'ink', strokeWidth: 1 };

  it('fits a text box to its longest line unless it was resized', () => {
    const short = elementBounds({ ...text });
    const long = elementBounds({ ...text, text: 'A much longer line of text\nshort' });
    expect(short.w).toBeLessThan(60);
    expect(long.w).toBeGreaterThan(short.w * 5);
    expect(long.h).toBeCloseTo(2 * 20 * 1.3); // two lines, no wrapping
    const resized = resizeElement({ ...text }, { x: 400, y: 0 });
    expect(resized.autoWidth).toBe(false);
    expect(elementBounds(resized).w).toBe(400);
  });

  it('fills shapes not at all, see-through or solid', () => {
    expect(fillFor('#e53935', 'none')).toBe('none');
    expect(fillFor('#e53935', 'transparent')).toBe('#e5393566');
    expect(fillFor('#e53935', 'solid')).toBe('#e53935');
    expect(fillModeOf('#e5393533')).toBe('transparent');
    expect(fillModeOf('ink')).toBe('solid');
    expect(fillModeOf('none')).toBe('none');
  });
});

describe('groups, grid and guides', () => {
  const box = (id: string, x: number, y: number, extra: Partial<WbShape> = {}): WbShape => ({ id, type: 'rect', x, y, w: 100, h: 50, fill: 'none', color: 'ink', strokeWidth: 2, ...extra });

  it('selects whole groups and knows which groups are fully selected', () => {
    const els = [box('a', 0, 0, { groupId: 'g' }), box('b', 200, 0, { groupId: 'g' }), box('c', 400, 0)];
    expect(withGroups(els, ['a']).sort()).toEqual(['a', 'b']);
    expect(withGroups(els, ['c'])).toEqual(['c']);
    expect(selectedGroups(els, ['a', 'b', 'c'])).toEqual(['g']);
    expect(selectedGroups(els, ['a'])).toEqual([]);
  });

  it('copies groups as new groups, unlocked', () => {
    let n = 0;
    const copies = copyElements([box('a', 0, 0, { groupId: 'g', locked: true }), box('b', 0, 0, { groupId: 'g' })], () => `n${++n}`);
    expect(copies[0].groupId).toBeTruthy();
    expect(copies[0].groupId).not.toBe('g');
    expect(copies[0].groupId).toBe(copies[1].groupId);
    expect(copies[0].locked).toBeUndefined();
  });

  it('snaps to a grid', () => {
    expect(snapToGrid(37, 24)).toBe(48);
    expect(snapToGrid(-13, 24)).toBe(-24);
  });

  it('lines a moving box up with others and returns guide lines', () => {
    const other = { x: 300, y: 100, w: 100, h: 50 };
    // Left edges 3px apart, middles 4px apart vertically.
    const r = alignSnap({ x: 303, y: 206, w: 80, h: 40 }, [other], 6);
    expect(r.dx).toBe(-3);
    expect(r.guides.some((g) => g.x1 === 300 && g.x2 === 300)).toBe(true);
    expect(alignSnap({ x: 600, y: 600, w: 10, h: 10 }, [other], 6)).toEqual({ dx: null, dy: null, guides: [] });
    const mid = alignSnap({ x: 500, y: 121, w: 80, h: 6 }, [other], 6); // centres: 124 vs 125
    expect(mid.dy).toBe(1);
    expect(mid.guides.some((g) => g.y1 === 125 && g.y2 === 125)).toBe(true);
  });
});

describe('arrow selection', () => {
  const arrow: WbArrow = { id: 'ar', type: 'arrow', x1: 0, y1: 0, x2: 200, y2: 200, color: 'ink', strokeWidth: 2, from: null, to: null };

  it('box-selects an arrow only where the line passes, not its corner-to-corner box', () => {
    expect(touchesRect(arrow, { x: 90, y: 90, w: 20, h: 20 })).toBe(true); // on the line
    expect(touchesRect(arrow, { x: 150, y: 10, w: 30, h: 30 })).toBe(false); // inside the old box, off the line
    expect(touchesRect(arrow, { x: -50, y: 120, w: 300, h: 10 })).toBe(true); // a thin box across the line
    expect(segmentIntersectsRect({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: -5, w: 5, h: 10 })).toBe(false);
  });
});

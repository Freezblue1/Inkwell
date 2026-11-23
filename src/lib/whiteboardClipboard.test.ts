import { describe, expect, it } from 'vitest';
import type { WbArrow, WbShape } from '@/types/models';
import { parseClip, placeCopies, serializeClip } from './whiteboardClipboard';

const a: WbShape = { id: 'a', type: 'rect', x: 0, y: 0, w: 100, h: 50, fill: 'none', color: 'ink', strokeWidth: 2, groupId: 'g' };
const b: WbShape = { ...a, id: 'b', x: 200 };
const link: WbArrow = { id: 'l', type: 'arrow', x1: 100, y1: 25, x2: 200, y2: 25, color: 'ink', strokeWidth: 2, from: 'a', to: 'b' };

describe('whiteboard clipboard', () => {
  it('round-trips items through clipboard text and ignores other text', () => {
    expect(parseClip(serializeClip([a, b]))).toEqual([a, b]);
    expect(parseClip('just some words')).toBeNull();
    expect(parseClip('inkwell-whiteboard:{broken')).toBeNull();
    expect(parseClip(null)).toBeNull();
  });

  it('pastes fresh copies centred on the pointer, keeping links and groups inside the copy', () => {
    let n = 0;
    const copies = placeCopies([a, b, link], () => `c${++n}`, { x: 1000, y: 1000 }, 24);
    const [ca, cb, cl] = copies as [WbShape, WbShape, WbArrow];
    expect(copies.map((c) => c.id)).toEqual(['c1', 'c2', 'c3']);
    // The pair (0..300 × 0..50) is centred on (1000, 1000).
    expect(ca.x).toBe(850);
    expect(ca.y).toBe(975);
    expect(cb.x).toBe(1050);
    expect(cl.from).toBe('c1');
    expect(cl.to).toBe('c2');
    expect(ca.groupId).toBe(cb.groupId);
    expect(ca.groupId).not.toBe('g');
  });

  it('offsets copies when there is no pointer position', () => {
    const [c] = placeCopies([a], () => 'x', null, 48) as WbShape[];
    expect([c.x, c.y]).toEqual([48, 48]);
  });
});

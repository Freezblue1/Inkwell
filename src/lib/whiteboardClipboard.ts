/**
 * Copying whiteboard items: a text format for the system clipboard (so items
 * can be pasted into another board, another project or another Inkwell window)
 * and placing pasted copies.
 */
import type { WbElement } from '@/types/models';
import { copyElements, unionBounds, type Point } from './whiteboard';

export const CLIP_PREFIX = 'inkwell-whiteboard:';

export function serializeClip(els: WbElement[]): string {
  return CLIP_PREFIX + JSON.stringify({ version: 1, elements: els });
}

/** The items in clipboard text, or null if it isn't copied whiteboard content. */
export function parseClip(text: string | null | undefined): WbElement[] | null {
  if (!text || !text.startsWith(CLIP_PREFIX)) return null;
  try {
    const data = JSON.parse(text.slice(CLIP_PREFIX.length));
    const els = Array.isArray(data?.elements) ? (data.elements as WbElement[]) : null;
    return els && els.every((e) => e && typeof e.id === 'string' && typeof e.type === 'string') ? els : null;
  } catch {
    return null;
  }
}

/**
 * Fresh copies of `els` (new ids, groups and arrow links kept inside the copy),
 * centred on `at` when given (e.g. the pointer), otherwise shifted by `offset`.
 */
export function placeCopies(els: WbElement[], makeId: () => string, at: Point | null, offset: number): WbElement[] {
  if (!els.length) return [];
  let dx = offset;
  let dy = offset;
  if (at) {
    const b = unionBounds(els)!;
    dx = at.x - (b.x + b.w / 2);
    dy = at.y - (b.y + b.h / 2);
  }
  return copyElements(els, makeId, dx, dy);
}

/**
 * Drag-and-drop projection for the binder tree (adapted from the dnd-kit
 * sortable-tree pattern). Dragging horizontally changes nesting depth.
 */
import { arrayMove } from '@dnd-kit/sortable';
import type { ID, InkDocument } from '@/types/models';
import { canHaveChildren, type FlatNode } from '@/lib/tree';

export const INDENT = 16;

export interface Projection {
  depth: number;
  parentId: ID | null;
}

export function getProjection(items: FlatNode[], activeId: ID, overId: ID, dragOffsetX: number): Projection | null {
  const overIndex = items.findIndex((i) => i.id === overId);
  const activeIndex = items.findIndex((i) => i.id === activeId);
  if (overIndex < 0 || activeIndex < 0) return null;
  const active = items[activeIndex];
  const moved = arrayMove(items, activeIndex, overIndex);
  const prev = moved[overIndex - 1];
  const next = moved[overIndex + 1];
  const projected = active.depth + Math.round(dragOffsetX / INDENT);
  const maxDepth = prev ? (canHaveChildren(prev.doc) ? prev.depth + 1 : prev.depth) : 0;
  const minDepth = next ? next.depth : 0;
  let depth = Math.min(projected, maxDepth);
  depth = Math.max(depth, Math.min(minDepth, maxDepth));
  depth = Math.max(0, depth);

  const parentId = (() => {
    if (depth === 0 || !prev) return null;
    if (depth === prev.depth) return prev.parentId;
    if (depth > prev.depth) return prev.id;
    return (
      moved
        .slice(0, overIndex)
        .reverse()
        .find((i) => i.depth === depth)?.parentId ?? null
    );
  })();
  return { depth, parentId };
}

/** Removes the descendants of the dragged item from the flat list. */
export function removeChildrenOf(items: FlatNode[], id: ID): FlatNode[] {
  const out: FlatNode[] = [];
  let skipDepth: number | null = null;
  for (const item of items) {
    if (skipDepth !== null) {
      if (item.depth > skipDepth) continue;
      skipDepth = null;
    }
    out.push(item);
    if (item.id === id) skipDepth = item.depth;
  }
  return out;
}

/**
 * Converts a drop (within one binder group) into a moveDoc(parentId, index)
 * call, where index is relative to ALL siblings of that parent (root siblings
 * span several groups).
 */
export function resolveDrop(
  groupItems: FlatNode[],
  activeId: ID,
  overId: ID,
  projection: Projection,
  allSiblings: (parentId: ID | null) => InkDocument[],
): { parentId: ID | null; index: number } | null {
  const activeIndex = groupItems.findIndex((i) => i.id === activeId);
  const overIndex = groupItems.findIndex((i) => i.id === overId);
  if (activeIndex < 0 || overIndex < 0) return null;
  const moved = arrayMove(groupItems, activeIndex, overIndex).map((i) => (i.id === activeId ? { ...i, parentId: projection.parentId, depth: projection.depth } : i));
  const groupSiblings = moved.filter((i) => i.parentId === projection.parentId && i.depth === projection.depth);
  const pos = groupSiblings.findIndex((i) => i.id === activeId);
  const after = groupSiblings[pos + 1];
  const before = groupSiblings[pos - 1];
  const siblings = allSiblings(projection.parentId).filter((d) => d.id !== activeId);
  let index: number;
  if (after) index = Math.max(0, siblings.findIndex((d) => d.id === after.id));
  else if (before) index = siblings.findIndex((d) => d.id === before.id) + 1;
  else index = siblings.length;
  return { parentId: projection.parentId, index };
}

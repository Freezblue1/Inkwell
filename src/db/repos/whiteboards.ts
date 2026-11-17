/** Whiteboard persistence. */
import type { ID, Whiteboard } from '@/types/models';
import { db } from '../db';
import { newId } from '@/lib/ids';

export async function listWhiteboards(projectId: ID): Promise<Whiteboard[]> {
  const rows = await db.whiteboards.where('projectId').equals(projectId).toArray();
  return rows.sort((a, b) => a.order - b.order || a.createdAt - b.createdAt);
}

export function makeWhiteboard(projectId: ID, name: string, order: number): Whiteboard {
  const now = Date.now();
  return { id: newId(), projectId, name, elements: [], viewport: { x: 0, y: 0, zoom: 1 }, background: 'dots', order, open: true, createdAt: now, updatedAt: now };
}

/** A saved copy of a board (new ids for the board and its elements). */
export function duplicateWhiteboard(wb: Whiteboard, name: string, order: number): Whiteboard {
  const now = Date.now();
  return { ...wb, id: newId(), name, order, open: true, createdAt: now, updatedAt: now, elements: wb.elements.map((el) => ({ ...el, id: newId() })) };
}

export const isOpen = (wb: Whiteboard) => wb.open !== false;

export const putWhiteboard = (wb: Whiteboard) => db.whiteboards.put({ ...wb, updatedAt: Date.now() });
export const deleteWhiteboard = (id: ID) => db.whiteboards.delete(id);

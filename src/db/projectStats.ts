/** Per-project numbers for the home page: manuscript words, goal, chapters, last edit, and today's words. */
import type { ID, InkDocument } from '@/types/models';
import { manuscriptWordCount } from '@/lib/tree';
import { dayKey } from '@/lib/dates';
import { db } from './db';

export interface ProjectStats {
  words: number;
  targetWords: number | null;
  deadline: string | null;
  chapters: number;
  lastEdited: number;
  todayWords: number;
}

export async function loadProjectStats(): Promise<Record<ID, ProjectStats>> {
  const [docs, goals, today] = await Promise.all([db.documents.toArray(), db.goals.toArray(), db.sessions.where('date').equals(dayKey()).toArray()]);
  const byProject = new Map<ID, Record<ID, InkDocument>>();
  for (const d of docs) {
    let map = byProject.get(d.projectId);
    if (!map) byProject.set(d.projectId, (map = {}));
    map[d.id] = d;
  }
  const out: Record<ID, ProjectStats> = {};
  for (const [pid, map] of byProject) {
    const list = Object.values(map);
    out[pid] = {
      words: manuscriptWordCount(map),
      targetWords: null,
      deadline: null,
      chapters: list.filter((d) => d.type === 'chapter' && !d.trashed).length,
      lastEdited: list.reduce((m, d) => Math.max(m, d.updatedAt), 0),
      todayWords: 0,
    };
  }
  for (const g of goals) {
    if (out[g.projectId]) {
      out[g.projectId].targetWords = g.targetWords || null;
      out[g.projectId].deadline = g.deadline;
    }
  }
  for (const s of today) if (out[s.projectId]) out[s.projectId].todayWords += Math.max(0, s.net);
  return out;
}

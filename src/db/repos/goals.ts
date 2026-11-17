/** Goals and the daily writing log. */
import type { Goal, ID, WritingSession } from '@/types/models';
import { db } from '../db';
import { dayKey } from '@/lib/dates';

export const getGoal = (projectId: ID) => db.goals.get(projectId);
export const putGoal = (g: Goal) => db.goals.put(g);

export async function listSessions(projectId: ID): Promise<WritingSession[]> {
  const rows = await db.sessions.where('projectId').equals(projectId).toArray();
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}

/** Records a word-count change for today. Returns the updated session row. */
export async function recordWords(projectId: ID, delta: number, sprintsDelta = 0, date = dayKey()): Promise<WritingSession> {
  const id = `${projectId}:${date}`;
  return db.transaction('rw', db.sessions, async () => {
    const cur =
      (await db.sessions.get(id)) ??
      ({ id, projectId, date, added: 0, removed: 0, net: 0, sprints: 0, updatedAt: 0 } satisfies WritingSession);
    const next: WritingSession = {
      ...cur,
      added: cur.added + Math.max(0, delta),
      removed: cur.removed + Math.max(0, -delta),
      net: cur.net + delta,
      sprints: cur.sprints + sprintsDelta,
      updatedAt: Date.now(),
    };
    await db.sessions.put(next);
    return next;
  });
}

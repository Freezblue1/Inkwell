/** Story bible, tags, plot threads and comments. */
import type { BibleEntry, ID, InkComment, PlotThread, Project, Tag } from '@/types/models';
import { db } from '../db';

/** Bible entries visible in a project: its own plus any shared with its series. */
export async function listBible(project: Project): Promise<BibleEntry[]> {
  const own = await db.bible.where('projectId').equals(project.id).toArray();
  if (!project.seriesId) return own;
  const shared = await db.bible.where('seriesId').equals(project.seriesId).toArray();
  const map = new Map<ID, BibleEntry>();
  [...own, ...shared].forEach((e) => map.set(e.id, e));
  return [...map.values()];
}

export const putBibleEntry = (e: BibleEntry) => db.bible.put(e);
export const deleteBibleEntry = (id: ID) => db.bible.delete(id);

export const listTags = (projectId: ID) => db.tags.where('projectId').equals(projectId).toArray();
export const putTag = (t: Tag) => db.tags.put(t);

export const listPlotThreads = (projectId: ID) => db.plotThreads.where('projectId').equals(projectId).toArray();
export const putPlotThread = (t: PlotThread) => db.plotThreads.put(t);
export const deletePlotThread = (id: ID) => db.plotThreads.delete(id);

export const listComments = (projectId: ID) => db.comments.where('projectId').equals(projectId).toArray();
export const putComment = (c: InkComment) => db.comments.put(c);
export const deleteComment = (id: ID) => db.comments.delete(id);

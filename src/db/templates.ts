/** Project templates: Novel, Novella, Short story, Series. */
import type { ID, ProjectKind, Series } from '@/types/models';
import { BundleBuilder } from './builder';
import { importBundle } from './bundle';
import { db } from './db';
import { makeGoal, makeProject, TARGETS_BY_KIND } from '@/lib/defaults';
import { newId } from '@/lib/ids';

export interface NewProjectInput {
  title: string;
  author: string;
  kind: ProjectKind;
  /** Existing series to join (series template creates one when omitted). */
  seriesId?: ID | null;
  seriesName?: string;
}

export const PROJECT_TEMPLATES: { kind: ProjectKind; name: string; description: string }[] = [
  { kind: 'novel', name: 'Novel', description: 'Parts, chapters and scenes with front & back matter. 80,000-word goal.' },
  { kind: 'novella', name: 'Novella', description: 'Chapters and scenes, lighter front matter. 30,000-word goal.' },
  { kind: 'short-story', name: 'Short story', description: 'A handful of scenes. 5,000-word goal.' },
  { kind: 'series', name: 'Series', description: 'A book in a series that shares one story bible with its siblings.' },
];

export async function createProjectFromTemplate(input: NewProjectInput): Promise<ID> {
  let seriesId = input.seriesId ?? null;
  let series: Series | null = null;
  if (input.kind === 'series' && !seriesId) {
    series = { id: newId(), name: input.seriesName || `${input.title || 'Untitled'} series`, createdAt: Date.now() };
    await db.series.put(series);
    seriesId = series.id;
  } else if (seriesId) {
    series = (await db.series.get(seriesId)) ?? null;
  }
  const project = makeProject({ title: input.title, author: input.author, kind: input.kind, seriesId });
  if (seriesId) {
    const siblings = await db.projects.where('seriesId').equals(seriesId).count();
    project.seriesOrder = siblings + 1;
  }
  const b = new BundleBuilder(project);
  b.series = series;
  b.goal = makeGoal(project.id, TARGETS_BY_KIND[input.kind]);

  const scene = (title: string, parent: Parameters<typeof b.add>[2]) =>
    b.add('scene', title, parent, { paras: [''], status: 'Draft' });

  switch (input.kind) {
    case 'novel':
    case 'series': {
      b.add('frontmatter', 'Title Page', null, { paras: [project.title, input.author ? `by ${input.author}` : ''] });
      b.add('frontmatter', 'Dedication', null, { paras: ['For …'] });
      const part = b.add('part', 'Part One', null, { status: 'Outline' });
      const ch = b.add('chapter', 'Chapter 1', part, { status: 'Draft' });
      scene('Scene 1', ch);
      b.add('backmatter', 'Acknowledgements', null, { paras: [''] });
      b.add('backmatter', 'About the Author', null, { paras: [''] });
      b.add('note', 'Ideas', null, { paras: ['Loose ideas, lines and questions go here.'] });
      break;
    }
    case 'novella': {
      b.add('frontmatter', 'Title Page', null, { paras: [project.title] });
      const ch = b.add('chapter', 'Chapter 1', null);
      scene('Scene 1', ch);
      b.add('backmatter', 'About the Author', null, { paras: [''] });
      b.add('note', 'Ideas', null, { paras: [''] });
      break;
    }
    case 'short-story': {
      scene('Opening', null);
      scene('Turn', null);
      scene('Ending', null);
      b.add('note', 'Notes', null, { paras: [''] });
      break;
    }
  }
  return importBundle(b.toBundle(), { keepIds: true });
}

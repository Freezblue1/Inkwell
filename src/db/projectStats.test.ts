import { describe, expect, it } from 'vitest';
import { createSampleProject } from './sample';
import { createProjectFromTemplate } from './templates';
import { loadProjectStats } from './projectStats';
import { listDocs } from './repos/documents';
import { manuscriptWordCount } from '@/lib/tree';

describe('home page project stats', () => {
  it('reports each project’s manuscript words, goal and chapters', async () => {
    const sample = await createSampleProject();
    const empty = await createProjectFromTemplate({ title: 'Blank', author: '', kind: 'novella' });
    const stats = await loadProjectStats();
    const docs = Object.fromEntries((await listDocs(sample)).map((d) => [d.id, d]));
    expect(stats[sample].words).toBe(manuscriptWordCount(docs));
    expect(stats[sample].words).toBeGreaterThan(0);
    expect(stats[sample].targetWords).toBeGreaterThan(0);
    expect(stats[sample].chapters).toBeGreaterThan(0);
    expect(stats[empty]).toMatchObject({ words: 0, targetWords: 30000, chapters: 1 });
  });
});

/** Writes an import plan to the database: as a new project, or appended to an existing one. */
import type { ID, InkDocument, ProjectKind } from '@/types/models';
import { blocksToDoc, type ImportNode } from '@/lib/import/blocks';
import { planStats, type ImportPlan } from '@/lib/import/structure';
import { makeDocument, makeGoal, makeProject, TARGETS_BY_KIND } from '@/lib/defaults';
import { countWords } from '@/lib/wordCount';
import { docToCountableText } from '@/lib/text';
import { BundleBuilder } from './builder';
import { importBundle } from './bundle';
import { buildContentRow } from './repos/documents';
import { db } from './db';

function kindFor(plan: ImportPlan): ProjectKind {
  const s = planStats(plan.nodes);
  if (s.chapters === 0 && s.words < 20000) return 'short-story';
  return s.words < 50000 ? 'novella' : 'novel';
}

const metaOf = (n: ImportNode): Partial<InkDocument['metadata']> => ({ special: n.special ?? null, specialLabel: n.specialLabel ?? '', notes: n.notes ?? '' });
const statusOf = (n: ImportNode) => n.status ?? (n.kind === 'scene' || n.kind === 'chapter' ? 'Draft' : '');

export async function importAsNewProject(plan: ImportPlan, input: { title: string; author: string }): Promise<ID> {
  const kind = kindFor(plan);
  const project = makeProject({ title: input.title.trim() || 'Imported manuscript', author: input.author.trim(), kind });
  const b = new BundleBuilder(project);
  const words = planStats(plan.nodes).words;
  b.goal = makeGoal(project.id, Math.max(TARGETS_BY_KIND[kind], Math.ceil((words * 1.05) / 5000) * 5000));
  const add = (n: ImportNode, parent: InkDocument | null) => {
    if (!n.include) return;
    const doc = b.add(n.kind, n.title || 'Untitled', parent, {
      json: n.blocks.length || n.kind === 'scene' || n.kind === 'frontmatter' || n.kind === 'backmatter' || n.kind === 'note' ? blocksToDoc(n.blocks) : undefined,
      synopsis: n.synopsis ?? '',
      status: statusOf(n),
      metadata: metaOf(n),
    });
    n.children.forEach((c) => add(c, doc));
  };
  plan.nodes.forEach((n) => add(n, null));
  return importBundle(b.toBundle(), { keepIds: true });
}

/** Appends the imported items after the existing ones (manuscript, front/back matter and notes each keep their own group). */
export async function importIntoProject(projectId: ID, plan: ImportPlan): Promise<{ created: number; firstId: ID | null }> {
  const existing = await db.documents.where('projectId').equals(projectId).toArray();
  const rootOrders = existing.filter((d) => d.parentId === null).map((d) => d.order);
  let rootOrder = rootOrders.length ? Math.max(...rootOrders) + 1 : 0;
  const docs: InkDocument[] = [];
  const contents: ReturnType<typeof buildContentRow>[] = [];
  const now = Date.now();
  let firstId: ID | null = null;
  let firstOther: ID | null = null;

  const add = (n: ImportNode, parentId: ID | null, order: number) => {
    if (!n.include) return;
    const doc = makeDocument(projectId, n.kind, n.title || 'Untitled', parentId, order, {
      synopsis: n.synopsis ?? '',
      status: statusOf(n),
      metadata: metaOf(n) as InkDocument['metadata'],
    });
    if (n.blocks.length || n.kind === 'scene' || n.kind === 'frontmatter' || n.kind === 'backmatter' || n.kind === 'note') {
      const json = blocksToDoc(n.blocks);
      doc.wordCount = countWords(docToCountableText(json));
      contents.push(buildContentRow(doc.id, projectId, json, now));
    }
    // Open the first imported scene afterwards (or the first page of anything else).
    if (!firstId && n.kind === 'scene') firstId = doc.id;
    if (!firstOther && n.kind !== 'part' && n.kind !== 'chapter') firstOther = doc.id;
    docs.push(doc);
    let i = 0;
    for (const c of n.children) {
      if (c.include) add(c, doc.id, i++);
    }
  };
  for (const n of plan.nodes) if (n.include) add(n, null, rootOrder++);

  await db.transaction('rw', [db.documents, db.contents, db.projects], async () => {
    await db.documents.bulkPut(docs);
    await db.contents.bulkPut(contents);
    await db.projects.update(projectId, { updatedAt: now });
  });
  return { created: docs.length, firstId: firstId ?? firstOther };
}

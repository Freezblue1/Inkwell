/**
 * Project bundles: a portable JSON form of a whole project. Used for backup
 * files (.inkwell), restore/import, rolling backups, templates and the demo.
 */
import type { JSONContent } from '@tiptap/core';
import type {
  BibleEntry,
  ExportProfile,
  Goal,
  ID,
  InkComment,
  InkDocument,
  PlotThread,
  Project,
  Series,
  Snapshot,
  Tag,
  Whiteboard,
  WritingSession,
} from '@/types/models';
import { db } from './db';
import { buildContentRow } from './repos/documents';
import { blobToDataUrl, dataUrlToBlob } from './repos/assets';
import { newId } from '@/lib/ids';
import { docToCountableText } from '@/lib/text';
import { countWords } from '@/lib/wordCount';

export const BUNDLE_FORMAT = 'inkwell-project';
export const BUNDLE_VERSION = 1;

export interface BundleAsset {
  id: ID;
  name: string;
  mime: string;
  size: number;
  createdAt: number;
  dataUrl: string;
}

export interface ProjectBundle {
  format: typeof BUNDLE_FORMAT;
  version: number;
  exportedAt: number;
  project: Project;
  series: Series | null;
  documents: InkDocument[];
  contents: { docId: ID; json: JSONContent }[];
  bible: BibleEntry[];
  tags: Tag[];
  plotThreads: PlotThread[];
  comments: InkComment[];
  goal: Goal | null;
  sessions: WritingSession[];
  exportProfiles: ExportProfile[];
  snapshots: Snapshot[];
  assets: BundleAsset[];
  /** Added in schema v3; optional so older backups still import. */
  whiteboards?: Whiteboard[];
}

/** Serializes a project. Assets are embedded as data URLs unless `includeAssets` is false. */
export async function exportBundle(projectId: ID, opts: { includeAssets?: boolean; includeSnapshots?: boolean } = {}): Promise<ProjectBundle> {
  const { includeAssets = true, includeSnapshots = true } = opts;
  const project = await db.projects.get(projectId);
  if (!project) throw new Error('Project not found');
  const whiteboards = await db.whiteboards.where('projectId').equals(projectId).toArray();
  const [series, documents, contents, bible, tags, plotThreads, comments, goal, sessions, exportProfiles, snapshots, assets] =
    await Promise.all([
      project.seriesId ? db.series.get(project.seriesId) : Promise.resolve(undefined),
      db.documents.where('projectId').equals(projectId).toArray(),
      db.contents.where('projectId').equals(projectId).toArray(),
      db.bible.where('projectId').equals(projectId).toArray(),
      db.tags.where('projectId').equals(projectId).toArray(),
      db.plotThreads.where('projectId').equals(projectId).toArray(),
      db.comments.where('projectId').equals(projectId).toArray(),
      db.goals.get(projectId),
      db.sessions.where('projectId').equals(projectId).toArray(),
      db.exportProfiles.where('projectId').equals(projectId).toArray(),
      includeSnapshots ? db.snapshots.where('projectId').equals(projectId).toArray() : Promise.resolve([]),
      includeAssets ? db.assets.where('projectId').equals(projectId).toArray() : Promise.resolve([]),
    ]);
  // Shared series entries are included so the backup is self-contained.
  const sharedBible = project.seriesId ? await db.bible.where('seriesId').equals(project.seriesId).toArray() : [];
  const bibleMap = new Map<ID, BibleEntry>();
  [...bible, ...sharedBible].forEach((b) => bibleMap.set(b.id, b));

  const bundleAssets: BundleAsset[] = [];
  for (const a of assets) {
    bundleAssets.push({ id: a.id, name: a.name, mime: a.mime, size: a.size, createdAt: a.createdAt, dataUrl: await blobToDataUrl(a.blob) });
  }
  return {
    format: BUNDLE_FORMAT,
    version: BUNDLE_VERSION,
    exportedAt: Date.now(),
    project,
    series: series ?? null,
    documents,
    contents: contents.map((c) => ({ docId: c.docId, json: c.json })),
    bible: [...bibleMap.values()],
    tags,
    plotThreads,
    comments,
    goal: goal ?? null,
    sessions,
    exportProfiles,
    snapshots,
    assets: bundleAssets,
    whiteboards,
  };
}

export function isProjectBundle(x: unknown): x is ProjectBundle {
  return !!x && typeof x === 'object' && (x as ProjectBundle).format === BUNDLE_FORMAT && !!(x as ProjectBundle).project;
}

/**
 * Writes a bundle to the database as a NEW project (all ids are remapped so an
 * import never overwrites existing data). Returns the new project id.
 */
export async function importBundle(
  bundle: ProjectBundle,
  opts: { titleSuffix?: string; keepIds?: boolean; /** Keep the bundle's updatedAt, and this lastOpenedAt (folder sync). */ keepTimes?: { lastOpenedAt: number } } = {},
): Promise<ID> {
  if (!isProjectBundle(bundle)) throw new Error('This file is not an Inkwell project backup.');
  if (bundle.version > BUNDLE_VERSION) throw new Error('This backup was made by a newer version of Inkwell.');

  const map = new Map<ID, ID>();
  const remap = (id: ID | null | undefined): ID | null => {
    if (!id) return null;
    if (opts.keepIds) return id;
    let n = map.get(id);
    if (!n) {
      n = newId();
      map.set(id, n);
    }
    return n;
  };
  const remapList = (ids: ID[] | undefined) => (ids ?? []).map((i) => remap(i)!).filter(Boolean);
  const now = Date.now();
  const pid = remap(bundle.project.id)!;

  // Series: reuse an existing series with the same id if present.
  let seriesId: ID | null = null;
  if (bundle.series) {
    const existing = await db.series.get(bundle.series.id);
    seriesId = existing ? existing.id : bundle.series.id;
    if (!existing) await db.series.put(bundle.series);
  }

  const project: Project = {
    ...bundle.project,
    id: pid,
    seriesId,
    title: bundle.project.title + (opts.titleSuffix ?? ''),
    labels: bundle.project.labels.map((l) => ({ ...l, id: remap(l.id)! })),
    customFields: bundle.project.customFields.map((f) => ({ ...f, id: remap(f.id)! })),
    updatedAt: opts.keepTimes ? bundle.project.updatedAt : now,
    lastOpenedAt: opts.keepTimes ? opts.keepTimes.lastOpenedAt : now,
  };

  const documents: InkDocument[] = bundle.documents.map((d) => ({
    ...d,
    id: remap(d.id)!,
    projectId: pid,
    parentId: remap(d.parentId),
    label: remap(d.label),
    metadata: {
      ...d.metadata,
      pov: remap(d.metadata.pov),
      locationId: remap(d.metadata.locationId),
      linkedIds: remapList(d.metadata.linkedIds),
      mentionIds: remapList(d.metadata.mentionIds),
      assetId: remap(d.metadata.assetId ?? null),
      custom: Object.fromEntries(Object.entries(d.metadata.custom ?? {}).map(([k, v]) => [remap(k)!, v])),
    },
  }));

  // Rewrite ids embedded in TipTap JSON (mentions, comments).
  const rewriteJson = (json: JSONContent): JSONContent => {
    if (opts.keepIds) return json;
    const walk = (n: JSONContent): JSONContent => {
      const out: JSONContent = { ...n };
      if (n.type === 'mention' && n.attrs?.id) out.attrs = { ...n.attrs, id: remap(String(n.attrs.id)) };
      if (n.marks) out.marks = n.marks.map((m) => (m.type === 'comment' && m.attrs?.commentId ? { ...m, attrs: { ...m.attrs, commentId: remap(String(m.attrs.commentId)) } } : m));
      if (n.content) out.content = n.content.map(walk);
      return out;
    };
    return walk(json);
  };

  const contents = bundle.contents.map((c) => buildContentRow(remap(c.docId)!, pid, rewriteJson(c.json), now));
  // Recompute word counts from the text (backups may be hand-edited).
  const wc = new Map(bundle.contents.map((c) => [remap(c.docId)!, countWords(docToCountableText(c.json))]));
  documents.forEach((d) => {
    if (wc.has(d.id)) d.wordCount = wc.get(d.id)!;
  });

  const bible = bundle.bible.map((b) => {
    const shared = !!b.seriesId && !!seriesId && b.seriesId === seriesId;
    const base = {
      ...b,
      id: opts.keepIds || shared ? b.id : remap(b.id)!,
      projectId: pid,
      seriesId: shared ? seriesId : null,
      imageAssetId: remap(b.imageAssetId),
      linkedIds: remapList(b.linkedIds),
    };
    if (base.kind === 'character') {
      return { ...base, relationships: base.relationships.map((r) => ({ ...r, targetId: remap(r.targetId)! })) };
    }
    return base;
  }) as BibleEntry[];

  // Old → new bible ids (shared series entries keep theirs), for whiteboard cards.
  const bibleIds = new Map(bundle.bible.map((b, i) => [b.id, bible[i].id]));
  const tags = bundle.tags.map((t) => ({ ...t, id: remap(t.id)!, projectId: pid }));
  const plotThreads = bundle.plotThreads.map((t) => ({
    ...t,
    id: remap(t.id)!,
    projectId: pid,
    cells: Object.fromEntries(Object.entries(t.cells).map(([k, v]) => [remap(k)!, v])),
  }));
  const comments = bundle.comments.map((c) => ({ ...c, id: remap(c.id)!, projectId: pid, docId: remap(c.docId)! }));
  const goal = bundle.goal ? { ...bundle.goal, id: pid, projectId: pid } : null;
  const sessions = bundle.sessions.map((s) => ({ ...s, projectId: pid, id: `${pid}:${s.date}` }));
  const exportProfiles = bundle.exportProfiles.map((p) => ({
    ...p,
    id: remap(p.id)!,
    projectId: pid,
    includeLabels: remapList(p.includeLabels),
    excludedDocIds: remapList(p.excludedDocIds),
    includeFrontMatter: remapList(p.includeFrontMatter),
    includeBackMatter: remapList(p.includeBackMatter),
  }));
  const snapshots = bundle.snapshots.map((s) => ({
    ...s,
    id: remap(s.id)!,
    projectId: pid,
    docId: remap(s.docId),
    json: s.json ? rewriteJson(s.json) : null,
    projectData: s.projectData
      ? {
          docs: s.projectData.docs.map((d) => ({ ...d, id: remap(d.id)!, projectId: pid, parentId: remap(d.parentId), label: remap(d.label) })),
          contents: s.projectData.contents.map((c) => ({ ...c, docId: remap(c.docId)!, json: rewriteJson(c.json) })),
        }
      : null,
  }));
  const whiteboards: Whiteboard[] = (bundle.whiteboards ?? []).map((w) => ({
    ...w,
    id: remap(w.id)!,
    projectId: pid,
    elements: w.elements.map((el) => {
      const id = opts.keepIds ? el.id : remap(el.id)!;
      switch (el.type) {
        case 'note':
          return { ...el, id, docId: remap(el.docId) };
        case 'arrow':
          return { ...el, id, from: remap(el.from ?? null), to: remap(el.to ?? null) };
        case 'card':
          return { ...el, id, bibleId: bibleIds.get(el.bibleId) ?? el.bibleId };
        case 'image':
          return { ...el, id, assetId: remap(el.assetId)! };
        default:
          return { ...el, id };
      }
    }),
  }));
  const assets = await Promise.all(
    bundle.assets.map(async (a) => ({
      id: remap(a.id)!,
      projectId: pid,
      name: a.name,
      mime: a.mime,
      size: a.size,
      createdAt: a.createdAt,
      blob: await dataUrlToBlob(a.dataUrl),
    })),
  );

  await db.transaction(
    'rw',
    [db.projects, db.documents, db.contents, db.bible, db.tags, db.plotThreads, db.comments, db.goals, db.sessions, db.exportProfiles, db.snapshots, db.assets, db.whiteboards],
    async () => {
      await db.whiteboards.bulkPut(whiteboards);
      await db.projects.put(project);
      await db.documents.bulkPut(documents);
      await db.contents.bulkPut(contents);
      await db.bible.bulkPut(bible);
      await db.tags.bulkPut(tags);
      await db.plotThreads.bulkPut(plotThreads);
      await db.comments.bulkPut(comments);
      if (goal) await db.goals.put(goal);
      await db.sessions.bulkPut(sessions);
      await db.exportProfiles.bulkPut(exportProfiles);
      await db.snapshots.bulkPut(snapshots);
      await db.assets.bulkPut(assets);
    },
  );
  return pid;
}

/** Deletes a project and every row that belongs to it (optionally keeping its snapshots and rolling backups). */
export async function deleteProjectData(projectId: ID, opts: { keepHistory?: boolean } = {}): Promise<void> {
  const history = [db.snapshots, db.backups];
  const tables = [db.documents, db.contents, db.revisions, db.bible, db.tags, db.plotThreads, db.comments, db.goals, db.sessions, db.exportProfiles, db.assets, db.whiteboards, ...(opts.keepHistory ? [] : history)];
  await db.transaction('rw', [db.projects, ...tables], async () => {
    for (const t of tables) await t.where('projectId').equals(projectId).delete();
    await db.projects.delete(projectId);
  });
}

const MAX_ROLLING_BACKUPS = 5;

/** Saves a compact rolling backup (no assets/snapshots); keeps the latest five. */
export async function createRollingBackup(projectId: ID): Promise<void> {
  const bundle = await exportBundle(projectId, { includeAssets: false, includeSnapshots: false });
  const words = bundle.documents
    .filter((d) => !d.trashed && ['part', 'chapter', 'scene'].includes(d.type))
    .reduce((s, d) => s + d.wordCount, 0);
  await db.backups.add({ id: newId(), projectId, createdAt: Date.now(), wordCount: words, data: JSON.stringify(bundle) });
  const keys = await db.backups.where('projectId').equals(projectId).sortBy('createdAt');
  if (keys.length > MAX_ROLLING_BACKUPS) await db.backups.bulkDelete(keys.slice(0, keys.length - MAX_ROLLING_BACKUPS).map((b) => b.id));
}

export async function listRollingBackups(projectId: ID) {
  const rows = await db.backups.where('projectId').equals(projectId).sortBy('createdAt');
  return rows.reverse();
}

/**
 * IndexedDB schema (Dexie) with versioned migrations.
 *
 * Adding a migration: declare `this.version(N).stores({...changed tables})`
 * with an optional `.upgrade(tx => …)` that rewrites existing rows. Never edit
 * an already-shipped version block — always add a new one.
 */
import Dexie, { type Table } from 'dexie';
import type {
  Asset,
  Backup,
  BibleEntry,
  DocumentContent,
  ExportProfile,
  Goal,
  ID,
  InkComment,
  InkDocument,
  PlotThread,
  Project,
  Revision,
  Series,
  Settings,
  Snapshot,
  Tag,
  Whiteboard,
  WritingSession,
} from '@/types/models';
import { defaultMetadata } from '@/lib/defaults';

export const DB_NAME = 'inkwell';

export class InkwellDB extends Dexie {
  projects!: Table<Project, ID>;
  series!: Table<Series, ID>;
  documents!: Table<InkDocument, ID>;
  contents!: Table<DocumentContent, ID>;
  revisions!: Table<Revision, ID>;
  snapshots!: Table<Snapshot, ID>;
  bible!: Table<BibleEntry, ID>;
  tags!: Table<Tag, ID>;
  plotThreads!: Table<PlotThread, ID>;
  comments!: Table<InkComment, ID>;
  goals!: Table<Goal, ID>;
  sessions!: Table<WritingSession, ID>;
  exportProfiles!: Table<ExportProfile, ID>;
  assets!: Table<Asset, ID>;
  backups!: Table<Backup, ID>;
  settings!: Table<Settings, string>;
  whiteboards!: Table<Whiteboard, ID>;

  constructor(name = DB_NAME) {
    super(name);

    // v1 — initial schema.
    this.version(1).stores({
      projects: 'id, updatedAt, lastOpenedAt, seriesId',
      series: 'id',
      documents: 'id, projectId, parentId, [projectId+type], updatedAt',
      // `*words` is a multi-entry index used for full-text search.
      contents: 'docId, projectId, updatedAt, *words',
      snapshots: 'id, projectId, docId, createdAt, [docId+createdAt], [projectId+scope]',
      bible: 'id, projectId, seriesId, kind, updatedAt',
      tags: 'id, projectId',
      plotThreads: 'id, projectId',
      comments: 'id, projectId, docId',
      goals: 'id, projectId',
      sessions: 'id, projectId, date, [projectId+date]',
      exportProfiles: 'id, projectId',
      assets: 'id, projectId',
      settings: 'id',
    });

    // v2 — persistent-undo revisions and rolling backups; normalize metadata.
    this.version(2)
      .stores({
        revisions: 'id, docId, projectId, createdAt, [docId+createdAt]',
        backups: 'id, projectId, createdAt',
      })
      .upgrade((tx) =>
        tx
          .table('documents')
          .toCollection()
          .modify((doc: InkDocument) => {
            doc.metadata = defaultMetadata(doc.metadata ?? {});
            doc.trashedAt ??= null;
          }),
      );

    // v3 — whiteboards; special (unnumbered) chapters in document metadata.
    this.version(3)
      .stores({
        whiteboards: 'id, projectId, updatedAt',
      })
      .upgrade((tx) =>
        tx
          .table('documents')
          .toCollection()
          .modify((doc: InkDocument) => {
            doc.metadata.special ??= null;
            doc.metadata.specialLabel ??= '';
          }),
      );
  }
}

export const db = new InkwellDB();

/** Ask the browser to keep our storage (not evict it under pressure). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignore */
  }
  return false;
}

export interface StorageInfo {
  usage: number;
  quota: number;
  ratio: number;
}

export async function getStorageInfo(): Promise<StorageInfo | null> {
  try {
    if (!navigator.storage?.estimate) return null;
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    return { usage, quota, ratio: quota ? usage / quota : 0 };
  } catch {
    return null;
  }
}

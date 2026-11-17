/** Fluent helper for assembling project bundles (templates, demo content). */
import type { JSONContent } from '@tiptap/core';
import type { BibleEntry, BibleKind, DocType, ExportProfile, Goal, ID, InkDocument, PlotThread, Project, Series, Whiteboard, WritingSession } from '@/types/models';
import { BUNDLE_FORMAT, BUNDLE_VERSION, type ProjectBundle } from './bundle';
import { makeDocument, makeExportProfile } from '@/lib/defaults';
import { paragraphsToDoc } from '@/lib/text';
import { newId } from '@/lib/ids';
import { makeBibleEntry } from '@/lib/bible';

export interface AddDocOptions {
  synopsis?: string;
  paras?: string[];
  json?: JSONContent;
  status?: string;
  label?: ID | null;
  target?: number | null;
  metadata?: Partial<InkDocument['metadata']>;
}

export class BundleBuilder {
  readonly docs: InkDocument[] = [];
  readonly contents: { docId: ID; json: JSONContent }[] = [];
  readonly bible: BibleEntry[] = [];
  readonly plotThreads: PlotThread[] = [];
  readonly sessions: WritingSession[] = [];
  readonly whiteboards: Whiteboard[] = [];
  goal: Goal | null = null;
  series: Series | null = null;
  profiles: ExportProfile[];

  constructor(readonly project: Project) {
    this.profiles = [makeExportProfile(project.id, project.author)];
  }

  add(type: DocType, title: string, parent: InkDocument | null, opts: AddDocOptions = {}): InkDocument {
    const siblings = this.docs.filter((d) => d.parentId === (parent?.id ?? null));
    const doc = makeDocument(this.project.id, type, title, parent?.id ?? null, siblings.length, {
      synopsis: opts.synopsis ?? '',
      status: opts.status ?? (type === 'scene' || type === 'chapter' ? 'Draft' : ''),
      label: opts.label ?? null,
      targetWordCount: opts.target ?? null,
      metadata: { ...opts.metadata } as InkDocument['metadata'],
    });
    this.docs.push(doc);
    const json = opts.json ?? (opts.paras ? paragraphsToDoc(opts.paras) : null);
    if (json) this.contents.push({ docId: doc.id, json });
    return doc;
  }

  addBible<T extends BibleEntry>(kind: BibleKind, fields: Partial<T> & { name: string }): T {
    const entry = makeBibleEntry<T>(this.project.id, kind, fields);
    this.bible.push(entry);
    return entry;
  }

  addThread(name: string, color: string, cells: Record<ID, string> = {}): PlotThread {
    const t: PlotThread = {
      id: newId(),
      projectId: this.project.id,
      name,
      color,
      order: this.plotThreads.length,
      cells: Object.fromEntries(Object.entries(cells).map(([k, note]) => [k, { on: true, note }])),
    };
    this.plotThreads.push(t);
    return t;
  }

  toBundle(): ProjectBundle {
    return {
      format: BUNDLE_FORMAT,
      version: BUNDLE_VERSION,
      exportedAt: Date.now(),
      project: this.project,
      series: this.series,
      documents: this.docs,
      contents: this.contents,
      bible: this.bible,
      tags: [],
      plotThreads: this.plotThreads,
      comments: [],
      goal: this.goal,
      sessions: this.sessions,
      exportProfiles: this.profiles,
      snapshots: [],
      assets: [],
      whiteboards: this.whiteboards,
    };
  }
}

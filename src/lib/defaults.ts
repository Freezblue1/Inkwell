/** Factory functions for default records. */
import type {
  DocMetadata,
  DocType,
  ExportProfile,
  Goal,
  ID,
  InkDocument,
  Label,
  Project,
  ProjectKind,
  Settings,
} from '@/types/models';
import { DEFAULT_STATUSES } from '@/types/models';
import { newId } from './ids';

export const DEFAULT_LABELS: Omit<Label, 'id'>[] = [
  { name: 'Main plot', color: '#3949ab' },
  { name: 'Subplot', color: '#00897b' },
  { name: 'Flashback', color: '#8e24aa' },
  { name: 'Needs work', color: '#e53935' },
];

export const STATUS_COLORS: Record<string, string> = {
  Idea: '#9e9e9e',
  Outline: '#5c6bc0',
  Draft: '#fb8c00',
  Revision: '#8e24aa',
  Final: '#43a047',
};

/** Color for a status, with a stable hash-based fallback for custom statuses. */
export function statusColor(status: string): string {
  if (STATUS_COLORS[status]) return STATUS_COLORS[status];
  const palette = ['#00838f', '#6d4c41', '#c2185b', '#558b2f', '#3949ab', '#f4511e'];
  let h = 0;
  for (const c of status) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

export const TARGETS_BY_KIND: Record<ProjectKind, number> = {
  novel: 80000,
  novella: 30000,
  'short-story': 5000,
  series: 80000,
};

export function defaultMetadata(partial: Partial<DocMetadata> = {}): DocMetadata {
  return {
    pov: null,
    locationId: null,
    timelineDate: '',
    timelineTime: '',
    tags: [],
    custom: {},
    linkedIds: [],
    mentionIds: [],
    notes: '',
    icon: '',
    color: '',
    corkPos: null,
    special: null,
    specialLabel: '',
    ...partial,
  };
}

export function makeDocument(
  projectId: ID,
  type: DocType,
  title: string,
  parentId: ID | null,
  order: number,
  extra: Partial<InkDocument> = {},
): InkDocument {
  const now = Date.now();
  return {
    id: newId(),
    projectId,
    parentId,
    type,
    title,
    synopsis: '',
    status: type === 'scene' || type === 'chapter' ? 'Draft' : '',
    label: null,
    order,
    wordCount: 0,
    targetWordCount: null,
    createdAt: now,
    updatedAt: now,
    trashed: false,
    trashedAt: null,
    ...extra,
    metadata: defaultMetadata(extra.metadata),
  };
}

export function makeProject(input: {
  title: string;
  author?: string;
  kind: ProjectKind;
  seriesId?: ID | null;
  isDemo?: boolean;
}): Project {
  const now = Date.now();
  return {
    id: newId(),
    title: input.title || 'Untitled Novel',
    subtitle: '',
    author: input.author ?? '',
    kind: input.kind,
    seriesId: input.seriesId ?? null,
    seriesOrder: 1,
    statuses: [...DEFAULT_STATUSES],
    labels: DEFAULT_LABELS.map((l) => ({ ...l, id: newId() })),
    customFields: [],
    isDemo: input.isDemo ?? false,
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
  };
}

export function makeGoal(projectId: ID, targetWords: number, deadline: string | null = null): Goal {
  return {
    id: projectId,
    projectId,
    targetWords,
    deadline,
    writingDays: [1, 2, 3, 4, 5],
    sessionTarget: 500,
    sprintMinutes: 25,
    breakMinutes: 5,
  };
}

export function makeExportProfile(projectId: ID, author = ''): ExportProfile {
  const surname = author.trim().split(/\s+/).pop() ?? '';
  return {
    id: newId(),
    projectId,
    name: 'Default',
    // Values below are the Paperback preset (see templatePreset in lib/export/trim).
    template: 'paperback',
    trim: '5.5x8.5',
    margins: { top: 0.75, bottom: 0.75, inside: 0.875, outside: 0.625 },
    bodyFont: 'EB Garamond',
    fontSize: 11.5,
    lineHeight: 1.4,
    paragraphSpacing: 0,
    firstLineIndent: 1.5,
    justify: true,
    dropCaps: true,
    runningHeaders: true,
    titlePage: true,
    copyrightPage: true,
    copyrightText: `Copyright © ${new Date().getFullYear()} ${author}. All rights reserved.`,
    dedication: '',
    toc: true,
    chapterHeadingStyle: 'number-title',
    sceneBreakGlyph: '* * *',
    authorName: author,
    authorSurname: surname,
    includeStatuses: [],
    includeLabels: [],
    excludedDocIds: [],
    includeFrontMatter: [],
    includeBackMatter: [],
    includeComments: false,
  };
}

export const MANUSCRIPT_FONTS = [
  { label: 'Literata', value: '"Literata", Georgia, serif' },
  { label: 'Merriweather', value: '"Merriweather", Georgia, serif' },
  { label: 'EB Garamond', value: '"EB Garamond", Garamond, serif' },
  { label: 'Courier Prime', value: '"Courier Prime", "Courier New", monospace' },
  { label: 'Times (Tinos)', value: '"Tinos", "Times New Roman", Times, serif' },
  { label: 'System Sans', value: '"Roboto", system-ui, sans-serif' },
];

export function defaultSettings(): Settings {
  return {
    id: 'app',
    themeMode: 'system',
    density: 'comfortable',
    editor: {
      fontFamily: MANUSCRIPT_FONTS[0].value,
      fontSize: 18,
      lineHeight: 1.7,
      paragraphSpacing: 0,
      pageWidth: 720,
      firstLineIndent: 1.5,
      spellcheck: true,
      paperTheme: 'default',
      typewriter: false,
      focusDim: 'paragraph',
      ambient: 'paper',
      ambientSound: false,
      sceneBreakGlyph: '⁂',
    },
    layout: {
      binderOpen: true,
      inspectorOpen: true,
      binderWidth: 288,
      inspectorWidth: 320,
      splitRatio: 0.5,
    },
    ai: {
      enabled: false,
      provider: 'anthropic',
      apiKey: '',
      model: 'claude-sonnet-5-5',
      baseUrl: '',
    },
    scratchpad: '',
    lastProjectId: null,
    outlinerColumns: ['title', 'synopsis', 'status', 'pov', 'words', 'target', 'label'],
    jungleDecor: true,
  };
}

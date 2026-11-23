/**
 * Inkwell data model.
 *
 * Every record is scoped to a project via `projectId` (except Settings and
 * Series). Timestamps are epoch milliseconds; calendar days are YYYY-MM-DD
 * strings in local time.
 *
 * Naming note: the manuscript "Document" type is called `InkDocument` in code
 * (and `Comment` → `InkComment`, `Location` → `LocationEntry`) so it never
 * shadows the DOM globals of the same name.
 */
import type { JSONContent } from '@tiptap/core';

export type ID = string;
export type Timestamp = number;
/** Local calendar day, e.g. "2026-11-09". */
export type DayKey = string;

export type ProjectKind = 'novel' | 'novella' | 'short-story' | 'series';

/** Binder node types. Parts/chapters/scenes form the manuscript. */
export type DocType = 'part' | 'chapter' | 'scene' | 'note' | 'research' | 'frontmatter' | 'backmatter';

/** Sub-type for research items. */
export type ResearchKind = 'folder' | 'note' | 'link' | 'image' | 'pdf';

export const DEFAULT_STATUSES = ['Idea', 'Outline', 'Draft', 'Revision', 'Final'];

/**
 * Special (unnumbered) chapters. A chapter with `metadata.special` set is
 * compiled under its own heading ("Prologue") and skipped by chapter numbering.
 */
export type SpecialChapter = 'prologue' | 'epilogue' | 'interlude' | 'foreword' | 'introduction' | 'afterword' | 'custom';

export interface Label {
  id: ID;
  name: string;
  color: string;
}

export interface CustomFieldDef {
  id: ID;
  name: string;
  type: 'text' | 'number' | 'date';
}

/** A series groups several projects that share a story bible. */
export interface Series {
  id: ID;
  name: string;
  createdAt: Timestamp;
}

export interface Project {
  id: ID;
  title: string;
  subtitle: string;
  author: string;
  kind: ProjectKind;
  /** Projects in the same series share bible entries flagged with this id. */
  seriesId: ID | null;
  seriesOrder: number;
  /** Ordered list of statuses (defaults + custom). */
  statuses: string[];
  labels: Label[];
  customFields: CustomFieldDef[];
  /** True for the bundled sample novel, so it can be removed in one click. */
  isDemo: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastOpenedAt: Timestamp;
}

/** Free-form metadata attached to binder documents (shown in the Inspector). */
export interface DocMetadata {
  /** Point-of-view character (bible entry id). */
  pov: ID | null;
  /** Primary location (bible entry id). */
  locationId: ID | null;
  /** In-story date (YYYY-MM-DD) and time (HH:mm) for the timeline. */
  timelineDate: string;
  timelineTime: string;
  /** Keywords. */
  tags: string[];
  /** Values for project custom fields, keyed by CustomFieldDef.id. */
  custom: Record<ID, string>;
  /** Manually linked bible entries / notes. */
  linkedIds: ID[];
  /** Bible entries @-mentioned in the text (derived on save). */
  mentionIds: ID[];
  /** Inspector notes (separate from the synopsis). */
  notes: string;
  /** Binder icon key and optional tint. */
  icon: string;
  color: string;
  /** Position on the freeform corkboard. */
  corkPos: { x: number; y: number } | null;
  /** Special chapter type (prologue, epilogue…); null for a regular numbered chapter. */
  special: SpecialChapter | null;
  /** Heading used when special === 'custom' (e.g. "Coda", "Part Zero"). */
  specialLabel: string;
  /** Research-only fields. */
  researchKind?: ResearchKind;
  url?: string;
  assetId?: ID | null;
}

/**
 * A binder item. Text lives in the separate `contents` table (DocumentContent)
 * so the binder can load hundreds of documents without parsing their text.
 */
export interface InkDocument {
  id: ID;
  projectId: ID;
  parentId: ID | null;
  type: DocType;
  title: string;
  synopsis: string;
  status: string;
  /** Label id (see Project.labels). */
  label: ID | null;
  /** Sort order among siblings. */
  order: number;
  /** Cached word count of this document's own text (not its children). */
  wordCount: number;
  targetWordCount: number | null;
  metadata: DocMetadata;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  trashed: boolean;
  trashedAt: Timestamp | null;
}

/** The text of a document: TipTap JSON plus derived plain text and search tokens. */
export interface DocumentContent {
  docId: ID;
  projectId: ID;
  json: JSONContent;
  text: string;
  /** Unique lowercase tokens — a Dexie multi-entry index for full-text search. */
  words: string[];
  updatedAt: Timestamp;
}

/** Coarse rolling history of a document, used for persistent undo across sessions. */
export interface Revision {
  id: ID;
  docId: ID;
  projectId: ID;
  createdAt: Timestamp;
  json: JSONContent;
  text: string;
}

export type SnapshotReason = 'manual' | 'daily' | 'major-edit' | 'pre-restore';

export interface ProjectSnapshotData {
  docs: InkDocument[];
  contents: { docId: ID; json: JSONContent; text: string }[];
}

/** A named version of one document or of the whole project. */
export interface Snapshot {
  id: ID;
  projectId: ID;
  /** Null for project-level snapshots. */
  docId: ID | null;
  scope: 'document' | 'project';
  name: string;
  auto: boolean;
  reason: SnapshotReason;
  createdAt: Timestamp;
  wordCount: number;
  json: JSONContent | null;
  text: string;
  projectData: ProjectSnapshotData | null;
}

export type BibleKind = 'character' | 'location' | 'item' | 'lore';

export interface Relationship {
  targetId: ID;
  type: string;
}

interface BibleBase {
  id: ID;
  projectId: ID;
  /** When set, the entry is shared with every project in this series. */
  seriesId: ID | null;
  kind: BibleKind;
  name: string;
  summary: string;
  imageAssetId: ID | null;
  tags: string[];
  /** Cross-links to other bible entries. */
  linkedIds: ID[];
  /** Whiteboard tabs about this entry (missing in older data). */
  boardIds?: ID[];
  notes: string;
  color: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Character extends BibleBase {
  kind: 'character';
  role: string;
  age: string;
  appearance: string;
  personality: string;
  goals: string;
  flaws: string;
  arc: string;
  relationships: Relationship[];
}

export interface LocationEntry extends BibleBase {
  kind: 'location';
  locationType: string;
  description: string;
  sensory: string;
  significance: string;
}

export interface ItemEntry extends BibleBase {
  kind: 'item';
  description: string;
  origin: string;
  significance: string;
}

export interface LoreNote extends BibleBase {
  kind: 'lore';
  category: string;
  body: string;
}

export type BibleEntry = Character | LocationEntry | ItemEntry | LoreNote;

export interface Tag {
  id: ID;
  projectId: ID;
  name: string;
  color: string;
}

export interface PlotCell {
  on: boolean;
  note: string;
}

/** A row in the plot grid; cells are keyed by scene/document id. */
export interface PlotThread {
  id: ID;
  projectId: ID;
  name: string;
  color: string;
  order: number;
  cells: Record<ID, PlotCell>;
}

/** An inline comment; the text range carries a `comment` mark with this id. */
export interface InkComment {
  id: ID;
  projectId: ID;
  docId: ID;
  quote: string;
  text: string;
  resolved: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** Project-level writing goal. One per project (id === projectId). */
export interface Goal {
  id: ID;
  projectId: ID;
  targetWords: number;
  /** YYYY-MM-DD or null. */
  deadline: DayKey | null;
  /** Days of the week you write, 0 = Sunday … 6 = Saturday. */
  writingDays: number[];
  sessionTarget: number;
  sprintMinutes: number;
  breakMinutes: number;
}

/** Daily writing log (one record per project per day). */
export interface WritingSession {
  /** `${projectId}:${date}` */
  id: ID;
  projectId: ID;
  date: DayKey;
  added: number;
  removed: number;
  net: number;
  sprints: number;
  updatedAt: Timestamp;
}

export type ExportTemplate = 'manuscript' | 'paperback' | 'ebook';
export type TrimSize = '5x8' | '5.25x8' | '5.5x8.5' | '6x9' | 'letter' | 'a4';
export type ChapterHeadingStyle = 'number' | 'title' | 'number-title' | 'ornamental';

export interface ExportProfile {
  id: ID;
  projectId: ID;
  name: string;
  template: ExportTemplate;
  trim: TrimSize;
  /** Margins in inches. */
  margins: { top: number; bottom: number; inside: number; outside: number };
  bodyFont: string;
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  firstLineIndent: number;
  justify: boolean;
  dropCaps: boolean;
  runningHeaders: boolean;
  titlePage: boolean;
  copyrightPage: boolean;
  copyrightText: string;
  dedication: string;
  toc: boolean;
  chapterHeadingStyle: ChapterHeadingStyle;
  sceneBreakGlyph: string;
  authorName: string;
  authorSurname: string;
  /** Compile filters. Empty arrays mean "include all". */
  includeStatuses: string[];
  includeLabels: ID[];
  excludedDocIds: ID[];
  includeFrontMatter: ID[];
  includeBackMatter: ID[];
  includeComments: boolean;
}

/** Whiteboard element colors: a hex value, or "ink" (the theme's text color). */
export type WbColor = string;

interface WbBase {
  id: ID;
  color: WbColor;
  strokeWidth: number;
  /**
   * Clockwise rotation in degrees around the element's centre (shapes, notes,
   * text, pictures, cards). Pen strokes and arrows store rotated points instead;
   * frames stay upright.
   */
  rotation?: number;
  /** Elements sharing a group id are selected, moved and turned together. */
  groupId?: ID;
  /** Locked elements can be selected but not moved, resized, restyled, edited or deleted. */
  locked?: boolean;
}

export interface WbPath extends WbBase {
  type: 'path';
  /** Absolute world coordinates. */
  points: [number, number][];
}

export interface WbShape extends WbBase {
  type: 'rect' | 'ellipse';
  x: number;
  y: number;
  w: number;
  h: number;
  /** Fill color or "none". */
  fill: string;
}

export interface WbArrow extends WbBase {
  type: 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Elements the ends are attached to (they follow when those move). */
  from?: ID | null;
  to?: ID | null;
  /** Optional label at the middle ("motive", "sister of"…). */
  label?: string;
}

export interface WbNote extends WbBase {
  type: 'note';
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  fill: string;
  /** Text colour; dark brown ink when missing. */
  textColor?: string;
  /** Optional link to a binder document (a "scene card"). */
  docId: ID | null;
}

export interface WbText extends WbBase {
  type: 'text';
  x: number;
  y: number;
  w: number;
  text: string;
  fontSize: number;
  /** The box hugs the text (no wrapping) unless it was resized by hand (false: wraps at w). */
  autoWidth?: boolean;
}

/** A picture stored in the project's assets. */
export interface WbImage extends WbBase {
  type: 'image';
  x: number;
  y: number;
  w: number;
  h: number;
  assetId: ID;
  name: string;
}

/** A card showing a Story Bible entry (name, summary, portrait), kept up to date. */
export interface WbCard extends WbBase {
  type: 'card';
  x: number;
  y: number;
  w: number;
  h: number;
  bibleId: ID;
}

/** A titled area that groups what's inside it; moving it moves its contents. */
export interface WbFrame extends WbBase {
  type: 'frame';
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  fill: string;
}

/** A web link, with a live preview for sites that allow it (Google Maps, YouTube…). */
export interface WbLink extends WbBase {
  type: 'link';
  x: number;
  y: number;
  w: number;
  h: number;
  url: string;
  title: string;
  /** Show the live preview (false: just the link card). */
  preview: boolean;
}

export type WbElement = WbPath | WbShape | WbArrow | WbNote | WbText | WbImage | WbCard | WbFrame | WbLink;

/** A freeform whiteboard (brainstorms, maps, mind maps). Several per project. */
export interface WhiteboardGroup {
  id: ID;
  name: string;
  color: string;
}

export interface Whiteboard {
  id: ID;
  projectId: ID;
  name: string;
  elements: WbElement[];
  viewport: { x: number; y: number; zoom: number };
  background: 'dots' | 'grid' | 'plain';
  order: number;
  /** Shown as a tab. Closed boards stay saved and can be reopened (undefined = open, for older data). */
  open?: boolean;
  /** Tab group this board belongs to (its tabs sit together under a coloured label). */
  group?: WhiteboardGroup | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/** A binary file (image, PDF) stored in IndexedDB. */
export interface Asset {
  id: ID;
  projectId: ID;
  name: string;
  mime: string;
  size: number;
  blob: Blob;
  createdAt: Timestamp;
}

/** Rolling project backups kept automatically (latest N). */
export interface Backup {
  id: ID;
  projectId: ID;
  createdAt: Timestamp;
  wordCount: number;
  data: string;
}

/** Besides light/dark/system: illustrated themes (jungle, ocean, space, library, sakura); see theme/scenes.ts. */
export type ThemeMode = 'light' | 'dark' | 'system' | 'jungle' | 'ocean' | 'space' | 'library' | 'sakura';
export type Density = 'comfortable' | 'compact';
export type PaperTheme = 'default' | 'sepia';
export type FocusDim = 'off' | 'paragraph' | 'sentence';
/** Focus mode themes (see features/editor/focus/focusThemes.ts); 'scene' follows the illustrated app theme. */
export type Ambient = 'none' | 'paper' | 'typewriter' | 'candlelight' | 'rain' | 'midnight' | 'snow' | 'forest' | 'ocean' | 'dusk' | 'terminal' | 'scene';
/** 'theme' plays the focus theme's own sound. */
export type AmbientSoundChoice = 'theme' | 'rain' | 'fire' | 'waves' | 'wind' | 'brown';

export interface EditorSettings {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  paragraphSpacing: number;
  /** Width of the text column in px. */
  pageWidth: number;
  /** First-line indent in em. */
  firstLineIndent: number;
  spellcheck: boolean;
  paperTheme: PaperTheme;
  typewriter: boolean;
  focusDim: FocusDim;
  ambient: Ambient;
  ambientSound: boolean;
  ambientSoundKind: AmbientSoundChoice;
  sceneBreakGlyph: string;
}

export type AIProvider = 'anthropic' | 'openai-compatible';

export interface AISettings {
  enabled: boolean;
  provider: AIProvider;
  apiKey: string;
  model: string;
  baseUrl: string;
}

export interface LayoutSettings {
  binderOpen: boolean;
  inspectorOpen: boolean;
  binderWidth: number;
  inspectorWidth: number;
  splitRatio: number;
}

/** App-wide preferences (singleton row with id "app"). */
export interface Settings {
  id: 'app';
  themeMode: ThemeMode;
  density: Density;
  editor: EditorSettings;
  layout: LayoutSettings;
  ai: AISettings;
  scratchpad: string;
  lastProjectId: ID | null;
  outlinerColumns: string[];
  /** Illustrated themes: show animated decorations (vines, bubbles, stars…). Name kept for older settings. */
  jungleDecor: boolean;
}

/** Story bible factories and field schemas. */
import type { BibleEntry, BibleKind, ID } from '@/types/models';
import { newId } from './ids';

export const BIBLE_KIND_LABELS: Record<BibleKind, { singular: string; plural: string }> = {
  character: { singular: 'Character', plural: 'Characters' },
  location: { singular: 'Location', plural: 'Locations' },
  item: { singular: 'Item', plural: 'Items' },
  lore: { singular: 'Lore note', plural: 'World & Lore' },
};

export interface BibleField {
  key: string;
  label: string;
  multiline?: boolean;
  placeholder?: string;
}

/** Template fields per kind (rendered generically by the entry editor). */
export const BIBLE_FIELDS: Record<BibleKind, BibleField[]> = {
  character: [
    { key: 'role', label: 'Role', placeholder: 'Protagonist, mentor, antagonist…' },
    { key: 'age', label: 'Age' },
    { key: 'summary', label: 'One-line summary', multiline: true },
    { key: 'appearance', label: 'Appearance', multiline: true },
    { key: 'personality', label: 'Personality', multiline: true },
    { key: 'goals', label: 'Goals & motivation', multiline: true },
    { key: 'flaws', label: 'Flaws & fears', multiline: true },
    { key: 'arc', label: 'Character arc', multiline: true },
  ],
  location: [
    { key: 'locationType', label: 'Type', placeholder: 'City, ship, tavern…' },
    { key: 'summary', label: 'Summary', multiline: true },
    { key: 'description', label: 'Description', multiline: true },
    { key: 'sensory', label: 'Sights, sounds & smells', multiline: true },
    { key: 'significance', label: 'Significance to the story', multiline: true },
  ],
  item: [
    { key: 'summary', label: 'Summary', multiline: true },
    { key: 'description', label: 'Description', multiline: true },
    { key: 'origin', label: 'Origin', multiline: true },
    { key: 'significance', label: 'Significance', multiline: true },
  ],
  lore: [
    { key: 'category', label: 'Category', placeholder: 'History, magic, religion, politics…' },
    { key: 'summary', label: 'Summary', multiline: true },
    { key: 'body', label: 'Details', multiline: true },
  ],
};

const KIND_DEFAULTS: Record<BibleKind, Record<string, unknown>> = {
  character: { role: '', age: '', appearance: '', personality: '', goals: '', flaws: '', arc: '', relationships: [] },
  location: { locationType: '', description: '', sensory: '', significance: '' },
  item: { description: '', origin: '', significance: '' },
  lore: { category: '', body: '' },
};

export function makeBibleEntry<T extends BibleEntry = BibleEntry>(
  projectId: ID,
  kind: BibleKind,
  fields: Partial<T> & { name?: string } = {},
): T {
  const now = Date.now();
  return {
    id: newId(),
    projectId,
    seriesId: null,
    kind,
    name: `New ${BIBLE_KIND_LABELS[kind].singular.toLowerCase()}`,
    summary: '',
    imageAssetId: null,
    tags: [],
    linkedIds: [],
    notes: '',
    color: '',
    createdAt: now,
    updatedAt: now,
    ...KIND_DEFAULTS[kind],
    ...fields,
  } as unknown as T;
}

/** Short descriptive line for cards and search results. */
export function bibleSubtitle(e: BibleEntry): string {
  switch (e.kind) {
    case 'character':
      return [e.role, e.age && `age ${e.age}`].filter(Boolean).join(' · ');
    case 'location':
      return e.locationType;
    case 'lore':
      return e.category;
    default:
      return '';
  }
}

/** All searchable text of an entry. */
export function bibleSearchText(e: BibleEntry): string {
  return Object.values(e)
    .filter((v) => typeof v === 'string')
    .join('\n');
}

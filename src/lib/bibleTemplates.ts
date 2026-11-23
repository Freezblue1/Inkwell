/**
 * Story Bible templates: starting points for new entries. Built-in templates
 * fill the fields with headings to answer (not text to delete); writers can
 * also save any entry as their own template (kept on this device, for every
 * project).
 */
import type { BibleEntry, BibleKind } from '@/types/models';
import { newId } from './ids';

export interface BibleTemplate {
  id: string;
  kind: BibleKind;
  name: string;
  description: string;
  /** Field values to start with (name excluded: the entry is named "New …"). */
  fields: Record<string, string>;
  /** Saved by the writer (can be deleted). */
  custom?: boolean;
}

const prompts = (...lines: string[]) => lines.map((l) => `${l}: `).join('\n');

export const BUILTIN_TEMPLATES: BibleTemplate[] = [
  // Characters
  {
    id: 'char-protagonist',
    kind: 'character',
    name: 'Protagonist',
    description: 'Want, need, wound and the arc between them',
    fields: {
      role: 'Protagonist',
      goals: prompts('Wants (outer goal)', 'Needs (inner truth)', 'Stakes if they fail'),
      flaws: prompts('Wound (backstory)', 'The lie they believe', 'Biggest fear'),
      arc: prompts('Starts as', 'Turning point', 'Ends as'),
      personality: prompts('Three words', 'How others see them', 'Secret'),
    },
  },
  {
    id: 'char-antagonist',
    kind: 'character',
    name: 'Antagonist',
    description: 'A villain with reasons, methods and a mirror',
    fields: {
      role: 'Antagonist',
      goals: prompts('Wants', 'Why they believe they are right', 'What they will sacrifice'),
      personality: prompts('Methods', 'Strengths', 'How they mirror the protagonist'),
      flaws: prompts('Weakness', 'What could stop them'),
      arc: prompts('Escalation', 'Final confrontation'),
    },
  },
  {
    id: 'char-mentor',
    kind: 'character',
    name: 'Mentor',
    description: 'What they teach, what they hide',
    fields: {
      role: 'Mentor',
      goals: prompts('What they teach', 'Why they help'),
      personality: prompts('Teaching style', 'Past'),
      flaws: prompts('What they hide', 'Their limit'),
      arc: prompts('Fate'),
    },
  },
  {
    id: 'char-love',
    kind: 'character',
    name: 'Love interest',
    description: 'Attraction, conflict and what keeps them apart',
    fields: {
      role: 'Love interest',
      goals: prompts('Wants', 'What they bring out in the protagonist'),
      personality: prompts('First impression', 'What attracts', 'What clashes'),
      flaws: prompts('What keeps them apart'),
      arc: prompts('Meeting', 'Crisis', 'Resolution'),
    },
  },
  {
    id: 'char-side',
    kind: 'character',
    name: 'Side character',
    description: 'A quick sketch: role, voice, one detail',
    fields: {
      role: 'Side character',
      personality: prompts('Voice / way of speaking', 'Memorable detail'),
      goals: prompts('Wants', 'Function in the story'),
    },
  },
  // Locations
  {
    id: 'loc-city',
    kind: 'location',
    name: 'City or town',
    description: 'Districts, rulers, mood and daily life',
    fields: {
      locationType: 'City',
      description: prompts('Districts', 'Who rules', 'Economy', 'Population'),
      sensory: prompts('Sounds', 'Smells', 'Light and weather'),
      significance: prompts('Why the story comes here', 'Scenes set here'),
    },
  },
  {
    id: 'loc-interior',
    kind: 'location',
    name: 'Building or room',
    description: 'Layout, owner and what is hidden there',
    fields: {
      locationType: 'Building',
      description: prompts('Layout', 'Owner', 'Notable objects', 'What is hidden here'),
      sensory: prompts('Light', 'Sounds', 'Smell', 'Temperature'),
      significance: prompts('What happens here'),
    },
  },
  {
    id: 'loc-wild',
    kind: 'location',
    name: 'Wilderness',
    description: 'Terrain, dangers, travel and creatures',
    fields: {
      locationType: 'Wilderness',
      description: prompts('Terrain', 'Climate', 'Dangers', 'How long to cross'),
      sensory: prompts('Sounds', 'Smells', 'Colours'),
      significance: prompts('Why characters go there'),
    },
  },
  {
    id: 'loc-realm',
    kind: 'location',
    name: 'Country or realm',
    description: 'Government, borders, culture and conflicts',
    fields: {
      locationType: 'Realm',
      description: prompts('Government', 'Borders and neighbours', 'Culture', 'Conflicts'),
      significance: prompts('Role in the story'),
    },
  },
  // Items
  {
    id: 'item-weapon',
    kind: 'item',
    name: 'Weapon',
    description: 'Make, history and who has wielded it',
    fields: {
      description: prompts('Appearance', 'Material', 'What makes it special'),
      origin: prompts('Maker', 'Previous owners'),
      significance: prompts('Who carries it now', 'Where it matters in the plot'),
    },
  },
  {
    id: 'item-artifact',
    kind: 'item',
    name: 'Magical artifact',
    description: 'Powers, costs and rules',
    fields: {
      description: prompts('Appearance', 'Powers', 'Cost or price of use', 'Rules and limits'),
      origin: prompts('Created by', 'Lost or found'),
      significance: prompts('Who wants it', 'What happens if it is used'),
    },
  },
  {
    id: 'item-clue',
    kind: 'item',
    name: 'Clue or document',
    description: 'What it reveals and who finds it',
    fields: {
      description: prompts('What it looks like', 'What it says'),
      origin: prompts('Who made it', 'Where it was found'),
      significance: prompts('What it reveals', 'Who finds it and when', 'Red herring?'),
    },
  },
  {
    id: 'item-heirloom',
    kind: 'item',
    name: 'Heirloom',
    description: 'A keepsake carrying family history',
    fields: {
      description: prompts('Appearance', 'Condition'),
      origin: prompts('Family history', 'How it was passed down'),
      significance: prompts('What it means to its owner'),
    },
  },
  // World & lore
  {
    id: 'lore-magic',
    kind: 'lore',
    name: 'Magic system',
    description: 'Source, cost, rules and who can use it',
    fields: {
      category: 'Magic',
      body: prompts('Source', 'Who can use it', 'Cost and limits', 'Rules', 'How it looks on the page', 'What it cannot do'),
    },
  },
  {
    id: 'lore-religion',
    kind: 'lore',
    name: 'Religion',
    description: 'Beliefs, rituals and power',
    fields: {
      category: 'Religion',
      body: prompts('Gods or beliefs', 'Rituals and holy days', 'Clergy', 'Taboos', 'Political power', 'Heresies'),
    },
  },
  {
    id: 'lore-faction',
    kind: 'lore',
    name: 'Faction or organisation',
    description: 'Goals, leaders, resources and rivals',
    fields: {
      category: 'Faction',
      body: prompts('Goal', 'Leader', 'Members', 'Resources', 'Symbol', 'Allies and rivals', 'Secrets'),
    },
  },
  {
    id: 'lore-history',
    kind: 'lore',
    name: 'Historical event',
    description: 'What happened, who was there, what it changed',
    fields: {
      category: 'History',
      body: prompts('When', 'What happened', 'Who was involved', 'Consequences', 'How people remember it'),
    },
  },
  {
    id: 'lore-culture',
    kind: 'lore',
    name: 'Culture or people',
    description: 'Customs, values, food, language',
    fields: {
      category: 'Culture',
      body: prompts('Values', 'Customs and festivals', 'Food', 'Clothing', 'Language and names', 'Attitude to outsiders'),
    },
  },
  {
    id: 'lore-creature',
    kind: 'lore',
    name: 'Creature or species',
    description: 'Appearance, habitat, behaviour',
    fields: {
      category: 'Creature',
      body: prompts('Appearance', 'Habitat', 'Diet', 'Behaviour', 'Danger to people', 'Legends about it'),
    },
  },
  {
    id: 'lore-tech',
    kind: 'lore',
    name: 'Technology',
    description: 'How it works and how it changed society',
    fields: {
      category: 'Technology',
      body: prompts('What it does', 'How it works', 'Who controls it', 'How it changed society', 'Limits'),
    },
  },
];

const STORE_KEY = 'inkwell:bibleTemplates';
const SKIP = new Set(['id', 'projectId', 'seriesId', 'kind', 'name', 'imageAssetId', 'tags', 'linkedIds', 'relationships', 'createdAt', 'updatedAt', 'color']);

export function loadCustomTemplates(): BibleTemplate[] {
  try {
    const list = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]');
    return Array.isArray(list) ? list.filter((t) => t && t.id && t.kind && t.name).map((t) => ({ ...t, custom: true })) : [];
  } catch {
    return [];
  }
}

function saveCustomTemplates(list: BibleTemplate[]) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(list.map(({ custom: _c, ...t }) => t)));
  } catch {
    /* storage full or blocked */
  }
}

/** Turns an entry into a template: its text fields, without its name, links or picture. */
export function templateFromEntry(entry: BibleEntry, name: string, description = ''): BibleTemplate {
  const fields: Record<string, string> = {};
  for (const [k, v] of Object.entries(entry)) if (!SKIP.has(k) && typeof v === 'string' && v.trim()) fields[k] = v;
  return { id: `custom-${newId()}`, kind: entry.kind, name, description: description || `Saved from “${entry.name}”`, fields, custom: true };
}

export function addCustomTemplate(t: BibleTemplate) {
  saveCustomTemplates([...loadCustomTemplates(), t]);
}

export function deleteCustomTemplate(id: string) {
  saveCustomTemplates(loadCustomTemplates().filter((t) => t.id !== id));
}

export function templatesFor(kind: BibleKind): { builtin: BibleTemplate[]; custom: BibleTemplate[] } {
  return { builtin: BUILTIN_TEMPLATES.filter((t) => t.kind === kind), custom: loadCustomTemplates().filter((t) => t.kind === kind) };
}

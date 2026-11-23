import { describe, expect, it } from 'vitest';
import { BIBLE_FIELDS, makeBibleEntry } from './bible';
import { addCustomTemplate, BUILTIN_TEMPLATES, deleteCustomTemplate, templateFromEntry, templatesFor } from './bibleTemplates';
import type { Character } from '@/types/models';

// A small in-memory localStorage (the tests run without a browser).
const mem = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

describe('story bible templates', () => {
  it('has templates for every kind, filling only fields that kind has', () => {
    for (const kind of ['character', 'location', 'item', 'lore'] as const) {
      const list = BUILTIN_TEMPLATES.filter((t) => t.kind === kind);
      expect(list.length).toBeGreaterThanOrEqual(4);
      const keys = new Set(BIBLE_FIELDS[kind].map((f) => f.key).concat('notes'));
      for (const t of list) for (const k of Object.keys(t.fields)) expect(keys.has(k), `${t.name}: ${k}`).toBe(true);
    }
  });

  it('starts a new entry from a template', () => {
    const t = BUILTIN_TEMPLATES.find((x) => x.id === 'char-antagonist')!;
    const e = makeBibleEntry<Character>('p', 'character', t.fields as Partial<Character>);
    expect(e.role).toBe('Antagonist');
    expect(e.goals).toContain('Why they believe they are right: ');
    expect(e.name).toBe('New character');
  });

  it('saves an entry as a template (text fields only) and deletes it', () => {
    localStorage.clear();
    const e = makeBibleEntry<Character>('p', 'character', { name: 'Mara', role: 'Archivist', goals: 'Find the truth', tags: ['x'] });
    const t = templateFromEntry(e, 'Archivist type');
    expect(t.fields).toEqual({ role: 'Archivist', goals: 'Find the truth' });
    addCustomTemplate(t);
    expect(templatesFor('character').custom.map((c) => c.name)).toEqual(['Archivist type']);
    expect(templatesFor('location').custom).toEqual([]);
    deleteCustomTemplate(t.id);
    expect(templatesFor('character').custom).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { generateNameDetails, NAME_STYLE_LABELS, NAME_STYLES, type NameStyle } from './names';

const seeded = (s = 1) => {
  let seed = s;
  return () => (seed = (seed * 16807) % 2147483647) / 2147483647;
};

describe('name generator', () => {
  it('never repeats a first name or surname within a batch', () => {
    for (const [style] of NAME_STYLE_LABELS) {
      const names = generateNameDetails({ style, count: 12, rnd: seeded(7) });
      expect(names.length, style).toBe(12);
      expect(new Set(names.map((n) => n.first)).size, style).toBe(12);
      expect(new Set(names.map((n) => n.surname)).size, style).toBe(12);
    }
  });

  it('picks names from the right generation for the age', () => {
    const english = NAME_STYLES.english.regions[0];
    const old = new Set([...english.feminine.old, ...english.masculine.old]);
    const young = new Set([...english.feminine.young, ...english.masculine.young]);
    const kids = generateNameDetails({ style: 'english', age: 'child', count: 20, rnd: seeded(3) });
    expect(kids.every((n) => young.has(n.first))).toBe(true);
    const elders = generateNameDetails({ style: 'english', age: 'elderly', count: 20, rnd: seeded(3) });
    expect(elders.filter((n) => old.has(n.first)).length).toBeGreaterThanOrEqual(15);
    expect(elders.some((n) => young.has(n.first))).toBe(false);
  });

  it('gives women the feminine form of surnames where the language has one', () => {
    const names = generateNameDetails({ style: 'slavic', gender: 'feminine', count: 30, rnd: seeded(11) });
    for (const n of names) {
      if (n.origin === 'Russian') expect(n.surname).toMatch(/(ova|eva|ina|yna)$/);
      if (n.origin === 'Czech') expect(n.surname).toMatch(/(ová|á)$/);
      if (n.origin === 'Polish') expect(n.surname).not.toMatch(/ski$/);
    }
    const greek = generateNameDetails({ style: 'greek', gender: 'feminine', count: 20, rnd: seeded(5) });
    for (const n of greek) expect(n.surname).not.toMatch(/(os|is)$/);
  });

  it('steers successive batches away from names just shown', () => {
    const recent = new Set<string>();
    const rnd = seeded(9);
    const a = generateNameDetails({ style: 'french', gender: 'feminine', age: 'elderly', count: 8, rnd, recent });
    const b = generateNameDetails({ style: 'french', gender: 'feminine', age: 'elderly', count: 8, rnd, recent });
    const firstA = new Set(a.map((n) => n.first));
    expect(b.filter((n) => firstA.has(n.first)).length).toBeLessThanOrEqual(1);
  });

  it('makes younger fantasy names shorter than older ones', () => {
    const avg = (age: 'child' | 'elderly') => {
      const names = generateNameDetails({ style: 'fantasy', age, count: 40, rnd: seeded(13) });
      return names.reduce((s, n) => s + n.first.length, 0) / names.length;
    };
    expect(avg('child')).toBeLessThan(avg('elderly'));
  });

  it('has no duplicated names inside a list', () => {
    for (const [style, data] of Object.entries(NAME_STYLES) as [NameStyle, (typeof NAME_STYLES)['english']][]) {
      for (const r of data.regions) {
        for (const list of [...Object.values(r.feminine), ...Object.values(r.masculine), r.surnames]) {
          expect(new Set(list).size, `${style}/${r.origin}: ${list.find((x, i) => list.indexOf(x) !== i)}`).toBe(list.length);
        }
      }
    }
  });
});

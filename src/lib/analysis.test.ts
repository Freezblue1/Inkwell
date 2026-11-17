import { describe, expect, it } from 'vitest';
import { analyzeText, countSyllables, dialogueWordCount, splitSentences } from './analysis';
import { buildFindRegex, expandReplacement, findAll, isInvalidRegex } from './findRegex';
import { findIssues } from './proofread';
import { fuzzyScore } from './fuzzy';
import { generateNames } from './names';

describe('analysis', () => {
  it('counts syllables reasonably', () => {
    expect(countSyllables('cat')).toBe(1);
    expect(countSyllables('lighthouse')).toBe(2);
    expect(countSyllables('wonderful')).toBe(3);
  });
  it('splits sentences without breaking on Mr.', () => {
    expect(splitSentences('Mr. Venn waited. Then he spoke! Did she listen?')).toHaveLength(3);
  });
  it('measures dialogue', () => {
    expect(dialogueWordCount('“Go home,” he said. "Now please."')).toBe(4);
  });
  it('produces a full report', () => {
    const text = 'She walked slowly. She walked quickly to the door. “Really?” she said. Really, she just walked away very slowly.';
    const a = analyzeText(text);
    expect(a.words).toBe(19);
    expect(a.sentences).toBe(4);
    expect(a.adverbs.find((x) => x.word === 'slowly')?.count).toBe(2);
    expect(a.fillers.some((f) => f.word === 'just')).toBe(true);
    expect(a.dialogueWords).toBe(1);
    expect(a.overused[0].word).toBe('walked');
    expect(a.fleschReadingEase).toBeGreaterThan(50);
  });
  it('finds repeated phrases', () => {
    const a = analyzeText('the brass ledger was gone. the brass ledger was found. the brass ledger burned.');
    expect(a.repeatedPhrases[0].word).toContain('brass ledger');
  });
  it('handles empty text', () => {
    expect(analyzeText('').words).toBe(0);
  });
});

describe('find & replace regexes', () => {
  it('escapes plain queries and respects case', () => {
    const re = buildFindRegex('a.b', { caseSensitive: false, wholeWord: false, regex: false })!;
    expect(findAll('A.B axb a.b', re).map((m) => m.text)).toEqual(['A.B', 'a.b']);
    const cs = buildFindRegex('Mara', { caseSensitive: true, wholeWord: false, regex: false })!;
    expect(findAll('mara Mara', cs)).toHaveLength(1);
  });
  it('matches whole words only (unicode aware)', () => {
    const re = buildFindRegex('art', { caseSensitive: false, wholeWord: true, regex: false })!;
    expect(findAll('art start artful café art', re)).toHaveLength(2);
  });
  it('supports regex groups in replacements', () => {
    const re = buildFindRegex('(\\w+)@', { caseSensitive: false, wholeWord: false, regex: true })!;
    expect(expandReplacement('mara@', re, '<$1>', true)).toBe('<mara>');
    expect(isInvalidRegex('(', { caseSensitive: false, wholeWord: false, regex: true })).toBe(true);
  });
});

describe('proofreading', () => {
  it('flags adverbs, misspellings, repeats and passive voice', () => {
    const kinds = new Set(['adverb', 'misspelling', 'repeat', 'passive', 'filler'] as const);
    const issues = findIssues('He quickly saw teh the the door was opened. It was just fine.', new Set(kinds));
    const k = issues.map((i) => i.kind);
    expect(k).toContain('adverb');
    expect(k).toContain('misspelling');
    expect(k).toContain('repeat');
    expect(k).toContain('passive');
    expect(k).toContain('filler');
    expect(issues.find((i) => i.kind === 'misspelling')?.suggestion).toBe('the');
  });
  it('does not flag non-adverb -ly words', () => {
    expect(findIssues('The family was friendly and lonely.', new Set(['adverb'] as const))).toHaveLength(0);
  });
});

describe('tools', () => {
  it('fuzzy scores prefer prefix matches and reject non-matches', () => {
    expect(fuzzyScore('cork', 'Open corkboard')).toBeGreaterThan(fuzzyScore('cork', 'Clock work'));
    expect(fuzzyScore('xyz', 'Open corkboard')).toBe(-1);
  });
  it('generates unique names deterministically with a seeded rng', () => {
    let seed = 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const names = generateNames('fantasy', 'any', 10, rnd);
    expect(new Set(names).size).toBe(names.length);
    expect(names.length).toBe(10);
  });
});

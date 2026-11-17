import { describe, expect, it } from 'vitest';
import { countCharacters, countWords, formatReadingTime, indexTokens, readingTimeMinutes, tokenize } from './wordCount';
import { docToCountableText, docToText, paragraphsToDoc, extractMentionIds } from './text';

describe('countWords', () => {
  it('counts simple words', () => {
    expect(countWords('The quick brown fox')).toBe(4);
  });
  it('handles empty and whitespace', () => {
    expect(countWords('')).toBe(0);
    expect(countWords('   \n\t ')).toBe(0);
  });
  it('treats contractions and hyphenated words as one word', () => {
    // Don't · stop · the · well-known · rock'n'roll · band
    expect(countWords("Don't stop the well-known rock'n'roll band")).toBe(6);
    expect(countWords('It’s Mara’s coat')).toBe(3);
  });
  it('splits on em dashes, slashes and ellipses', () => {
    expect(countWords('wait—what?')).toBe(2);
    expect(countWords('and/or')).toBe(2);
    expect(countWords('so…then')).toBe(2);
  });
  it('ignores punctuation-only tokens', () => {
    expect(countWords('* * * — … !')).toBe(0);
  });
  it('counts numbers and non-Latin scripts', () => {
    expect(countWords('In 1891 there were 3 keepers')).toBe(6);
    expect(countWords('Привет мир')).toBe(2);
    expect(countWords('café naïve')).toBe(2);
  });
  it('is stable on long text', () => {
    const text = 'word '.repeat(150_000);
    expect(countWords(text)).toBe(150_000);
  });
});

describe('characters, tokens and reading time', () => {
  it('counts characters with and without spaces', () => {
    expect(countCharacters('a b c')).toBe(5);
    expect(countCharacters('a b c', false)).toBe(3);
    expect(countCharacters('😀a')).toBe(2);
  });
  it('tokenizes', () => {
    expect(tokenize('Hello, world!')).toEqual(['Hello', 'world']);
  });
  it('estimates reading time at 250 wpm', () => {
    expect(readingTimeMinutes(0)).toBe(0);
    expect(readingTimeMinutes(10)).toBe(1);
    expect(readingTimeMinutes(2500)).toBe(10);
    expect(formatReadingTime(250 * 90)).toBe('1 h 30 min');
  });
  it('builds a unique lowercase search index', () => {
    expect(indexTokens('The the THE cat a')).toEqual(['the', 'cat']);
  });
});

describe('TipTap JSON → text', () => {
  const doc = {
    type: 'doc',
    content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Hello ' }, { type: 'mention', attrs: { id: 'c1', label: 'Mara Quill' } }, { type: 'text', text: '.' }] },
      { type: 'sceneBreak' },
      { type: 'paragraph', content: [{ type: 'text', text: 'Note' }, { type: 'footnote', attrs: { text: 'a long footnote here' } }] },
    ],
  };
  it('renders plain text with scene breaks', () => {
    expect(docToText(doc)).toBe('Hello Mara Quill.\n\n* * *\n\nNote');
  });
  it('excludes scene breaks and footnotes from countable text', () => {
    expect(countWords(docToCountableText(doc))).toBe(4);
  });
  it('extracts mention ids', () => {
    expect(extractMentionIds(doc)).toEqual(['c1']);
  });
  it('parses the template mini-syntax', () => {
    const d = paragraphsToDoc(['*Hi* there', '* * *', '**Bold**']);
    expect(d.content?.[0].content?.[0]).toMatchObject({ text: 'Hi', marks: [{ type: 'italic' }] });
    expect(d.content?.[1].type).toBe('sceneBreak');
    expect(d.content?.[2].content?.[0].marks?.[0].type).toBe('bold');
  });
});

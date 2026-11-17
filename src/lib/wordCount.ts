/**
 * Word and character counting.
 *
 * A "word" is a run of letters/digits, optionally joined by apostrophes or
 * hyphens ("don't", "well-known", "rock'n'roll"). Em/en dashes, slashes and
 * ellipses separate words. Works for any Unicode script that uses spaces.
 */
const WORD_RE = /[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu;

export function countWords(text: string): number {
  if (!text) return 0;
  let n = 0;
  WORD_RE.lastIndex = 0;
  while (WORD_RE.exec(text)) n++;
  return n;
}

/** Returns the words of a text (same rules as countWords). */
export function tokenize(text: string): string[] {
  return text.match(WORD_RE) ?? [];
}

export function countCharacters(text: string, includeSpaces = true): number {
  if (!text) return 0;
  const chars = Array.from(includeSpaces ? text.replace(/\n/g, '') : text.replace(/\s/g, ''));
  return chars.length;
}

/** Reading time in minutes at a given words-per-minute rate (default 250). */
export function readingTimeMinutes(words: number, wpm = 250): number {
  if (words <= 0) return 0;
  return Math.max(1, Math.round(words / wpm));
}

export function formatReadingTime(words: number): string {
  const min = readingTimeMinutes(words);
  if (min === 0) return '0 min';
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** Compact number formatting: 1234 → "1,234", 152340 → "152.3k". */
export function formatCount(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 10000) return `${(n / 1000).toFixed(1)}k`;
  return n.toLocaleString();
}

/** Unique lowercase tokens for the full-text search index. */
export function indexTokens(text: string, max = 4000): string[] {
  const set = new Set<string>();
  for (const w of tokenize(text.toLowerCase())) {
    if (w.length < 2) continue;
    set.add(w.replace(/’/g, "'"));
    if (set.size >= max) break;
  }
  return [...set];
}

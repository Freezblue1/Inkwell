/** Builds search regexes for Find & Replace (case, whole word, regex options). */

export interface FindOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
  regex: boolean;
}

export const DEFAULT_FIND_OPTIONS: FindOptions = { caseSensitive: false, wholeWord: false, regex: false };

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Returns a global regex for the query, or null if empty/invalid. */
export function buildFindRegex(query: string, opts: FindOptions): RegExp | null {
  if (!query) return null;
  let source = opts.regex ? query : escapeRegExp(query);
  if (opts.wholeWord) source = `(?<![\\p{L}\\p{N}_])(?:${source})(?![\\p{L}\\p{N}_])`;
  try {
    return new RegExp(source, `gu${opts.caseSensitive ? '' : 'i'}`);
  } catch {
    return null;
  }
}

/** True if the query is an invalid regular expression. */
export function isInvalidRegex(query: string, opts: FindOptions): boolean {
  return !!query && opts.regex && buildFindRegex(query, opts) === null;
}

export interface TextMatch {
  index: number;
  length: number;
  text: string;
}

/** All non-empty matches of a regex in a string. */
export function findAll(text: string, re: RegExp): TextMatch[] {
  const out: TextMatch[] = [];
  re.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m[0].length === 0) {
      re.lastIndex++;
      continue;
    }
    out.push({ index: m.index, length: m[0].length, text: m[0] });
  }
  return out;
}

/** Expands $1, $&, … in a replacement for one matched string (regex mode). */
export function expandReplacement(matched: string, re: RegExp, replacement: string, regexMode: boolean): string {
  if (!regexMode) return replacement;
  const single = new RegExp(re.source, re.flags.replace('g', ''));
  return matched.replace(single, replacement);
}

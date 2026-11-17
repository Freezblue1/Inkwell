/** Finds proofreading issues in a block of text (used by editor highlights). */
import { FILLER_WORDS, isAdverb, MISSPELLINGS } from './wordLists';

export type IssueKind = 'adverb' | 'filler' | 'misspelling' | 'repeat' | 'passive';

export interface TextIssue {
  index: number;
  length: number;
  kind: IssueKind;
  message: string;
  suggestion?: string;
}

const WORD = /[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu;
const FILLER_RE = new RegExp(`(?<![\\p{L}])(?:${FILLER_WORDS.map((w) => w.replace(/ /g, '\\s+')).join('|')})(?![\\p{L}])`, 'giu');
const PASSIVE_RE = /\b(?:am|is|are|was|were|be|been|being)\s+(?:\w+ly\s+)?(\w+ed|built|done|made|seen|taken|given|known|shown|written|told|found|held|kept|left|lost|paid|sent|thrown|broken|chosen|driven|eaten|fallen|forgotten|hidden|stolen|struck|worn)\b/giu;

export function findIssues(text: string, kinds: Set<IssueKind>): TextIssue[] {
  const issues: TextIssue[] = [];
  let prevWord = '';
  let prevEnd = -1;

  WORD.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WORD.exec(text))) {
    const word = m[0];
    const lower = word.toLowerCase();
    if (kinds.has('adverb') && isAdverb(word)) {
      issues.push({ index: m.index, length: word.length, kind: 'adverb', message: 'Adverb — could a stronger verb do the work?' });
    }
    if (kinds.has('misspelling') && MISSPELLINGS[lower]) {
      issues.push({ index: m.index, length: word.length, kind: 'misspelling', message: `Possible misspelling`, suggestion: MISSPELLINGS[lower] });
    }
    if (kinds.has('repeat') && lower === prevWord && /^\s+$/.test(text.slice(prevEnd, m.index)) && !/^\d+$/.test(lower)) {
      issues.push({ index: m.index, length: word.length, kind: 'repeat', message: `Repeated word “${word}”`, suggestion: '' });
    }
    prevWord = lower;
    prevEnd = m.index + word.length;
  }

  if (kinds.has('filler')) {
    FILLER_RE.lastIndex = 0;
    while ((m = FILLER_RE.exec(text))) {
      issues.push({ index: m.index, length: m[0].length, kind: 'filler', message: 'Filler word — consider cutting it' });
    }
  }
  if (kinds.has('passive')) {
    PASSIVE_RE.lastIndex = 0;
    while ((m = PASSIVE_RE.exec(text))) {
      issues.push({ index: m.index, length: m[0].length, kind: 'passive', message: 'Possible passive voice' });
    }
  }
  return issues.sort((a, b) => a.index - b.index);
}

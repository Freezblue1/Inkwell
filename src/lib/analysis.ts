/**
 * Local writing analysis (no AI): overused words, adverbs, filler words,
 * sentence-length variety, readability, repeated phrases and the ratio of
 * dialogue to narration.
 */
import { FILLER_WORDS, STOPWORDS, isAdverb } from './wordLists';
import { tokenize } from './wordCount';

export interface WordStat {
  word: string;
  count: number;
}

export interface Analysis {
  words: number;
  sentences: number;
  paragraphs: number;
  avgSentenceLength: number;
  sentenceLengthStdDev: number;
  /** Counts of sentences by length bucket: 1–5, 6–10, 11–20, 21–30, 31–40, 41+. */
  sentenceBuckets: { label: string; count: number }[];
  longestSentence: string;
  fleschReadingEase: number;
  fleschKincaidGrade: number;
  overused: (WordStat & { per1000: number })[];
  adverbs: WordStat[];
  adverbCount: number;
  fillers: WordStat[];
  fillerCount: number;
  repeatedPhrases: WordStat[];
  dialogueWords: number;
  narrationWords: number;
  dialogueRatio: number;
}

/** Heuristic English syllable count. */
export function countSyllables(word: string): number {
  let w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return 0;
  if (w.length <= 3) return 1;
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = w.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups?.length ?? 1);
}

/** Splits text into sentences (keeps abbreviations like "Mr." mostly intact). */
export function splitSentences(text: string): string[] {
  const protectedText = text.replace(/\b(Mr|Mrs|Ms|Dr|St|Prof|Sr|Jr|vs|etc|e\.g|i\.e)\./gi, '$1․');
  // Only split when the next sentence starts with a capital or digit, so
  // dialogue tags stay attached: “Really?” she said.
  return protectedText
    .split(/(?<=[.!?…]["'”’)\]]*)\s+(?=["'“‘(\[]?[\p{Lu}\d])|\n+/u)
    .map((s) => s.replace(/․/g, '.').trim())
    .filter((s) => tokenize(s).length > 0);
}

/** Words inside quotation marks (straight or curly double quotes). */
export function dialogueWordCount(text: string): number {
  let n = 0;
  const re = /“([^”]*)”|"([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) n += tokenize(m[1] ?? m[2] ?? '').length;
  return n;
}

function topCounts(map: Map<string, number>, limit: number, min = 1): WordStat[] {
  return [...map.entries()]
    .filter(([, c]) => c >= min)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([word, count]) => ({ word, count }));
}

export function analyzeText(text: string): Analysis {
  const words = tokenize(text);
  const lower = words.map((w) => w.toLowerCase().replace(/’/g, "'"));
  const sentences = splitSentences(text);
  const lengths = sentences.map((s) => tokenize(s).length);
  const total = words.length;
  const avg = lengths.length ? total / lengths.length : 0;
  const variance = lengths.length ? lengths.reduce((s, l) => s + (l - avg) ** 2, 0) / lengths.length : 0;
  const syllables = lower.reduce((s, w) => s + countSyllables(w), 0);

  const ease = total && lengths.length ? 206.835 - 1.015 * (total / lengths.length) - 84.6 * (syllables / total) : 0;
  const grade = total && lengths.length ? 0.39 * (total / lengths.length) + 11.8 * (syllables / total) - 15.59 : 0;

  const freq = new Map<string, number>();
  const adverbs = new Map<string, number>();
  lower.forEach((w) => {
    if (w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w)) freq.set(w, (freq.get(w) ?? 0) + 1);
    if (isAdverb(w)) adverbs.set(w, (adverbs.get(w) ?? 0) + 1);
  });

  const fillers = new Map<string, number>();
  const lowerText = text.toLowerCase();
  for (const f of FILLER_WORDS) {
    const re = new RegExp(`(?<![\\p{L}])${f.replace(/ /g, '\\s+')}(?![\\p{L}])`, 'gu');
    const c = lowerText.match(re)?.length ?? 0;
    if (c) fillers.set(f, c);
  }

  // Repeated 3- and 4-word phrases that aren't all stopwords.
  const phrases = new Map<string, number>();
  for (const n of [4, 3]) {
    for (let i = 0; i + n <= lower.length; i++) {
      const gram = lower.slice(i, i + n);
      if (gram.every((g) => STOPWORDS.has(g))) continue;
      const key = gram.join(' ');
      phrases.set(key, (phrases.get(key) ?? 0) + 1);
    }
  }
  const repeated = topCounts(phrases, 40, 2).filter((p, _i, all) => !all.some((o) => o.word !== p.word && o.word.includes(p.word) && o.count >= p.count)).slice(0, 15);

  const buckets = [
    { label: '1–5', min: 1, max: 5 },
    { label: '6–10', min: 6, max: 10 },
    { label: '11–20', min: 11, max: 20 },
    { label: '21–30', min: 21, max: 30 },
    { label: '31–40', min: 31, max: 40 },
    { label: '41+', min: 41, max: Infinity },
  ].map((b) => ({ label: b.label, count: lengths.filter((l) => l >= b.min && l <= b.max).length }));

  const dialogue = dialogueWordCount(text);
  const longestIdx = lengths.indexOf(Math.max(0, ...lengths));

  return {
    words: total,
    sentences: sentences.length,
    paragraphs: text.split(/\n{2,}/).filter((p) => p.trim()).length,
    avgSentenceLength: Math.round(avg * 10) / 10,
    sentenceLengthStdDev: Math.round(Math.sqrt(variance) * 10) / 10,
    sentenceBuckets: buckets,
    longestSentence: longestIdx >= 0 ? sentences[longestIdx] ?? '' : '',
    fleschReadingEase: Math.round(Math.max(0, Math.min(100, ease))),
    fleschKincaidGrade: Math.round(Math.max(0, grade) * 10) / 10,
    overused: topCounts(freq, 15, 3).map((w) => ({ ...w, per1000: Math.round((w.count / Math.max(1, total)) * 10000) / 10 })),
    adverbs: topCounts(adverbs, 15),
    adverbCount: [...adverbs.values()].reduce((a, b) => a + b, 0),
    fillers: topCounts(fillers, 15),
    fillerCount: [...fillers.values()].reduce((a, b) => a + b, 0),
    repeatedPhrases: repeated,
    dialogueWords: dialogue,
    narrationWords: Math.max(0, total - dialogue),
    dialogueRatio: total ? Math.round((dialogue / total) * 100) : 0,
  };
}

export function readabilityLabel(ease: number): string {
  if (ease >= 90) return 'Very easy';
  if (ease >= 80) return 'Easy';
  if (ease >= 70) return 'Fairly easy';
  if (ease >= 60) return 'Plain English';
  if (ease >= 50) return 'Fairly difficult';
  if (ease >= 30) return 'Difficult';
  return 'Very difficult';
}

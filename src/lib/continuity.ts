/**
 * Continuity checker and dialogue extraction. Pure functions over the
 * manuscript's plain text and the Story Bible's characters:
 *  - where each character appears, chapter by chapter;
 *  - characters who vanish for too many chapters;
 *  - names spelled two ways ("Tobiah" / "Tobias", "MacLeod" / "Macleod");
 *  - eyes or hair described two different ways (including the Bible entry);
 *  - every line of dialogue with its (likely) speaker, plus voice stats.
 */
import type { ID } from '@/types/models';

export interface Unit {
  id: ID;
  /** "Chapter 3", "Prologue", or the scene title for loose scenes. */
  label: string;
  title: string;
}

export interface SceneText {
  docId: ID;
  unitId: ID;
  title: string;
  text: string;
}

export interface CharacterInput {
  id: ID;
  name: string;
  /** Bible "appearance" text (for eye/hair colour). */
  appearance?: string;
}

export interface Occurrence {
  docId: ID | 'bible';
  snippet: string;
  /** The exact words found (used to jump to them in the editor). */
  match?: string;
}

export type Issue =
  | { kind: 'attribute'; key: string; characterId: ID; attr: 'eyes' | 'hair'; values: { value: string; occurrences: Occurrence[] }[] }
  | { kind: 'spelling'; key: string; characterId: ID; canonical: string; variant: string; occurrences: Occurrence[] }
  | { kind: 'absence'; key: string; characterId: ID; fromUnit: number; toUnit: number; length: number; trailing: boolean };

// ── Names ─────────────────────────────────────────────────────────────────

const TITLES = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'doctor', 'sir', 'lady', 'lord', 'captain', 'professor', 'the', 'of', 'de', 'van', 'von', 'der', 'la', 'le', 'du', 'st', 'saint', 'king', 'queen', 'prince', 'princess', 'aunt', 'uncle', 'old', 'young']);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Name parts that identify a character on their own ("Mara", "Quill"). */
export function nameParts(name: string): string[] {
  return name
    .split(/[\s.]+/)
    .map((p) => p.replace(/[^\p{L}'’-]/gu, ''))
    .filter((p) => p.length >= 3 && !TITLES.has(p.toLowerCase()) && /^\p{Lu}/u.test(p));
}

export interface NameMatcher {
  /** characterId → regex finding the character in text */
  patterns: Map<ID, RegExp>;
  /** every token that names someone (for "is this word a known name?") */
  known: Set<string>;
  /** part → characterIds using it */
  owners: Map<string, ID[]>;
}

/** Full names always count; a single part counts only if no other character shares it. */
export function buildMatcher(chars: CharacterInput[]): NameMatcher {
  const owners = new Map<string, ID[]>();
  for (const c of chars) for (const p of new Set(nameParts(c.name))) owners.set(p, [...(owners.get(p) ?? []), c.id]);
  const patterns = new Map<ID, RegExp>();
  const known = new Set<string>();
  for (const c of chars) {
    const forms = new Set<string>();
    if (c.name.trim()) forms.add(c.name.trim());
    for (const p of nameParts(c.name)) {
      known.add(p);
      if ((owners.get(p) ?? []).length === 1) forms.add(p);
    }
    const list = [...forms].sort((a, b) => b.length - a.length).map(escapeRe);
    if (list.length) patterns.set(c.id, new RegExp(`(?<![\\p{L}])(?:${list.join('|')})(?:['’]s)?(?![\\p{L}])`, 'gu'));
  }
  return { patterns, known, owners };
}

function countMatches(re: RegExp, text: string): number {
  re.lastIndex = 0;
  let n = 0;
  while (re.exec(text)) n++;
  return n;
}

// ── Appearances ───────────────────────────────────────────────────────────

/** counts[characterId][unitIndex] = mentions */
export function appearances(units: Unit[], scenes: SceneText[], m: NameMatcher): Map<ID, number[]> {
  const idx = new Map(units.map((u, i) => [u.id, i]));
  const out = new Map<ID, number[]>();
  for (const [id, re] of m.patterns) {
    const row = new Array(units.length).fill(0);
    for (const s of scenes) {
      const i = idx.get(s.unitId);
      if (i !== undefined) row[i] += countMatches(re, s.text);
    }
    out.set(id, row);
  }
  return out;
}

/** Stretches of `threshold`+ chapters without a character (between appearances, or at the end for regulars). */
export function absences(counts: Map<ID, number[]>, threshold: number): Issue[] {
  const issues: Issue[] = [];
  for (const [id, row] of counts) {
    const seen = row.map((n, i) => (n > 0 ? i : -1)).filter((i) => i >= 0);
    if (seen.length < 2) continue;
    for (let k = 1; k < seen.length; k++) {
      const gap = seen[k] - seen[k - 1] - 1;
      if (gap >= threshold) issues.push({ kind: 'absence', key: `absence:${id}:${seen[k - 1]}`, characterId: id, fromUnit: seen[k - 1] + 1, toUnit: seen[k] - 1, length: gap, trailing: false });
    }
    const last = seen[seen.length - 1];
    const tail = row.length - 1 - last;
    if (seen.length >= 3 && tail >= threshold) issues.push({ kind: 'absence', key: `absence:${id}:end`, characterId: id, fromUnit: last + 1, toUnit: row.length - 1, length: tail, trailing: true });
  }
  return issues;
}

// ── Spelling ──────────────────────────────────────────────────────────────

export function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

/** Capitalised words that are usually ordinary words, not misspelt names. */
const COMMON = new Set(
  'The This That Then There These Those They Their Them When Where What Which While Who Why How With Without Would Could Should Will Shall Might Must May Many Much More Most Mark Marks Maria Mary Marry Mars Main Make Made Male Mile Mine Mind Miss Mist Most Mother Father Sister Brother Grace Rose Hope Faith Joy Dawn Eve Iris Ivy Lily Pearl Ruby Violet Amber Hazel Summer Autumn Winter Spring Monday Tuesday Wednesday Thursday Friday Saturday Sunday January February March April June July August September October November December North South East West Lord Lady King Queen God Hell Heaven Never Nothing Nobody None Once Only Over Under Into Onto Upon After Before Again Still Even Ever Every Each Both Just Like Love Here Have Has Had Having Being Been Some Such Sure Very Well Yes Your Yours Mine Ours Oh Ah Hmm Okay Please Thanks Good Great Little Long Last Next First Second Third Something Somewhere Someone Anything Everything Everyone Tomorrow Today Tonight Yesterday Because Though Although Whatever Whoever Above Below Behind Beside Between Beyond Inside Outside Across Around Along Among Against Toward Towards'.split(' '),
);

export function spellingVariants(scenes: SceneText[], chars: CharacterInput[], m: NameMatcher): Issue[] {
  const words = new Map<string, { count: number; occ: Occurrence[] }>();
  const re = /(?<![\p{L}])\p{Lu}[\p{L}'’-]*\p{L}(?![\p{L}])/gu;
  for (const s of scenes) {
    re.lastIndex = 0;
    let mt: RegExpExecArray | null;
    while ((mt = re.exec(s.text))) {
      const w = mt[0].replace(/['’]s$/, '');
      const e = words.get(w) ?? { count: 0, occ: [] };
      e.count++;
      if (e.occ.length < 6) e.occ.push({ docId: s.docId, snippet: snippetAround(s.text, mt.index, w.length), match: mt[0] });
      words.set(w, e);
    }
  }
  const issues: Issue[] = [];
  const seen = new Set<string>();
  for (const c of chars) {
    for (const part of nameParts(c.name)) {
      if (part.length < 4) continue;
      const canonicalCount = words.get(part)?.count ?? 0;
      for (const [w, info] of words) {
        if (w === part || m.known.has(w) || COMMON.has(w) || w[0] !== part[0]) continue;
        const sameLetters = w.toLowerCase() === part.toLowerCase();
        const limit = part.length >= 7 ? 2 : 1;
        if (!sameLetters && (Math.abs(w.length - part.length) > limit || levenshtein(w.toLowerCase(), part.toLowerCase()) > limit)) continue;
        // A misspelling is the rare form; two equally common forms are probably two people.
        if (!sameLetters && canonicalCount > 0 && info.count > Math.max(3, canonicalCount)) continue;
        const key = `spelling:${c.id}:${w}`;
        if (seen.has(key)) continue;
        seen.add(key);
        issues.push({ kind: 'spelling', key, characterId: c.id, canonical: part, variant: w, occurrences: info.occ });
      }
    }
  }
  return issues;
}

// ── Eye and hair colour ───────────────────────────────────────────────────

const EYE_COLORS: Record<string, string> = {
  blue: 'blue', green: 'green', brown: 'brown', hazel: 'hazel', grey: 'grey', gray: 'grey', amber: 'amber', black: 'black', violet: 'violet',
  golden: 'gold', gold: 'gold', silver: 'silver', dark: 'dark', milky: 'milky', copper: 'copper', turquoise: 'turquoise', emerald: 'green', sapphire: 'blue', chocolate: 'brown',
};
const HAIR_COLORS: Record<string, string> = {
  blonde: 'blonde', blond: 'blonde', fair: 'blonde', golden: 'blonde', red: 'red', ginger: 'red', copper: 'red', auburn: 'auburn', black: 'black', raven: 'black',
  brown: 'brown', chestnut: 'brown', brunette: 'brown', grey: 'grey', gray: 'grey', white: 'white', silver: 'grey', dark: 'dark',
};
const EYE_WORDS = Object.keys(EYE_COLORS).join('|');
const HAIR_WORDS = Object.keys(HAIR_COLORS).join('|');
const ATTR_PATTERNS: { attr: 'eyes' | 'hair'; re: RegExp; map: Record<string, string> }[] = [
  { attr: 'eyes', re: new RegExp(`\\b(${EYE_WORDS})(?:[- ](?:${EYE_WORDS}|\\w+ish))?\\s+eyes?\\b`, 'gi'), map: EYE_COLORS },
  { attr: 'eyes', re: new RegExp(`\\beyes\\s+(?:were|was|are|is|of|gleamed|glinted|shone|flashed)\\s+(?:a\\s+|an\\s+|the\\s+)?(?:\\w+\\s+)?(${EYE_WORDS})\\b`, 'gi'), map: EYE_COLORS },
  { attr: 'hair', re: new RegExp(`\\b(${HAIR_WORDS})(?:[- ]\\w+)?\\s+(?:hair|curls|locks|braids?|plaits?|ponytail|mane)\\b`, 'gi'), map: HAIR_COLORS },
  { attr: 'hair', re: new RegExp(`\\bhair\\s+(?:was|is|were|of|had\\s+turned|had\\s+gone)\\s+(?:a\\s+|the\\s+)?(?:\\w+\\s+)?(${HAIR_WORDS})\\b`, 'gi'), map: HAIR_COLORS },
];

export function splitSentences(paragraph: string): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = [];
  const re = /[^.!?…]+(?:[.!?…]+["”’)]*|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(paragraph))) {
    if (m[0].trim()) out.push({ text: m[0], start: m.index });
    if (m.index === re.lastIndex) re.lastIndex++;
  }
  return out;
}

const paragraphsOf = (text: string) => text.split(/\n{2,}|\n/).filter((p) => p.trim());

/** Which character a position in a paragraph is most likely about: the last one named before it. */
function lastNamedBefore(text: string, pos: number, m: NameMatcher): ID | null {
  let best: { id: ID; at: number } | null = null;
  for (const [id, re] of m.patterns) {
    re.lastIndex = 0;
    let mt: RegExpExecArray | null;
    while ((mt = re.exec(text)) && mt.index < pos) if (!best || mt.index > best.at) best = { id, at: mt.index };
  }
  return best?.id ?? null;
}

export function attributeIssues(scenes: SceneText[], chars: CharacterInput[], m: NameMatcher): Issue[] {
  const found = new Map<string, Map<string, Occurrence[]>>(); // `${charId}|${attr}` → value → occurrences
  const record = (charId: ID, attr: string, value: string, occ: Occurrence) => {
    const k = `${charId}|${attr}`;
    const byValue = found.get(k) ?? new Map<string, Occurrence[]>();
    const list = byValue.get(value) ?? [];
    if (list.length < 6) list.push(occ);
    byValue.set(value, list);
    found.set(k, byValue);
  };
  // The Story Bible is the reference description.
  for (const c of chars) {
    if (!c.appearance) continue;
    for (const p of ATTR_PATTERNS) {
      p.re.lastIndex = 0;
      let mt: RegExpExecArray | null;
      while ((mt = p.re.exec(c.appearance))) record(c.id, p.attr, p.map[mt[1].toLowerCase()], { docId: 'bible', snippet: c.appearance });
    }
  }
  for (const s of scenes) {
    let carry: ID | null = null; // last character named in the previous paragraph
    for (const para of paragraphsOf(s.text)) {
      for (const p of ATTR_PATTERNS) {
        p.re.lastIndex = 0;
        let mt: RegExpExecArray | null;
        while ((mt = p.re.exec(para))) {
          const who = lastNamedBefore(para, mt.index, m) ?? carry;
          if (who) record(who, p.attr, p.map[mt[1].toLowerCase()], { docId: s.docId, snippet: snippetAround(para, mt.index, mt[0].length), match: mt[0] });
        }
      }
      carry = lastNamedBefore(para, para.length, m) ?? carry;
    }
  }
  const issues: Issue[] = [];
  for (const [k, byValue] of found) {
    if (byValue.size < 2) continue;
    const [characterId, attr] = k.split('|') as [ID, 'eyes' | 'hair'];
    issues.push({
      kind: 'attribute',
      key: `attribute:${characterId}:${attr}:${[...byValue.keys()].sort().join('/')}`,
      characterId,
      attr,
      values: [...byValue].map(([value, occurrences]) => ({ value, occurrences })),
    });
  }
  return issues;
}

export function snippetAround(text: string, index: number, length: number, radius = 60): string {
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + length + radius);
  return `${start > 0 ? '…' : ''}${text.slice(start, end).replace(/\s+/g, ' ').trim()}${end < text.length ? '…' : ''}`;
}

export interface ContinuityReport {
  counts: Map<ID, number[]>;
  issues: Issue[];
}

export function analyseContinuity(units: Unit[], scenes: SceneText[], chars: CharacterInput[], absenceThreshold = 5): ContinuityReport {
  const m = buildMatcher(chars);
  const counts = appearances(units, scenes, m);
  return {
    counts,
    issues: [...attributeIssues(scenes, chars, m), ...spellingVariants(scenes, chars, m), ...absences(counts, absenceThreshold)],
  };
}

// ── Dialogue ──────────────────────────────────────────────────────────────

export interface DialogueLine {
  docId: ID;
  unitId: ID;
  text: string;
  speakerId: ID | null;
  /** "tag": named in a dialogue tag ("Mara said"); "context": inferred; null: unknown. */
  how: 'tag' | 'context' | null;
}

const SPEECH = 'said|says|asked|asks|replied|replies|answered|whispered|murmured|muttered|shouted|yelled|called|cried|snapped|added|began|continued|told|explained|insisted|admitted|demanded|laughed|sighed|breathed|hissed|growled|offered|agreed|protested|warned|repeated|went on|pressed|managed|announced|declared|wondered|suggested|retorted|grumbled|teased';
const QUOTE_RE = /[“"]([^”"]+)[”"]/g;

export function extractDialogue(scenes: SceneText[], chars: CharacterInput[]): DialogueLine[] {
  const m = buildMatcher(chars);
  const lines: DialogueLine[] = [];
  const nameAlt = (id: ID) => m.patterns.get(id)?.source ?? '';
  const ids = [...m.patterns.keys()];
  const tagAfter = ids.map((id) => ({ id, re: new RegExp(`^\\s*[,—–-]?\\s*(?:(?:${nameAlt(id)})\\s+(?:${SPEECH})|(?:${SPEECH})\\s+(?:${nameAlt(id)}))`, 'iu') }));
  const tagBefore = ids.map((id) => ({ id, re: new RegExp(`(?:${nameAlt(id)})\\s+(?:${SPEECH})[^.!?“"]{0,40}[,:]?\\s*$`, 'iu') }));
  const pronounTag = new RegExp(`^\\s*[,—–-]?\\s*(?:(?:he|she|they)\\s+(?:${SPEECH})|(?:${SPEECH})\\s+(?:he|she|they))`, 'i');

  for (const s of scenes) {
    const recent: (ID | null)[] = []; // speakers of previous dialogue paragraphs
    let lastNamed: ID | null = null;
    let prevNarration: ID[] | null = null; // characters named in the previous paragraph, if it had no dialogue
    let prevWasDialogue = false;
    for (const para of paragraphsOf(s.text)) {
      const quotes: { text: string; start: number; end: number }[] = [];
      QUOTE_RE.lastIndex = 0;
      let q: RegExpExecArray | null;
      while ((q = QUOTE_RE.exec(para))) quotes.push({ text: q[1].trim(), start: q.index, end: q.index + q[0].length });
      const narration = para.replace(QUOTE_RE, ' ¶ ');
      const namedIn = (text: string) =>
        ids.filter((id) => {
          const re = m.patterns.get(id)!;
          re.lastIndex = 0;
          return re.test(text);
        });
      if (!quotes.length) {
        lastNamed = lastNamedBefore(para, para.length, m) ?? lastNamed;
        prevNarration = namedIn(para);
        prevWasDialogue = false;
        continue;
      }
      const bare = narration.replace(/¶/g, '').trim() === '';
      let speaker: ID | null = null;
      let how: DialogueLine['how'] = null;
      // 1. A dialogue tag right after or before a quote.
      for (const qt of quotes) {
        const after = para.slice(qt.end, qt.end + 80);
        const before = para.slice(Math.max(0, qt.start - 80), qt.start);
        const hit = tagAfter.find((t) => t.re.test(after)) ?? tagBefore.find((t) => t.re.test(before));
        if (hit) {
          speaker = hit.id;
          how = 'tag';
          break;
        }
      }
      // 2. "she said" → someone introducing themselves ("Ines Arroyo," she called), or the last character named nearby.
      if (!speaker && quotes.some((qt) => pronounTag.test(para.slice(qt.end, qt.end + 40)))) {
        const intro = chars.find((c) => c.name.trim() && quotes[0].text.replace(/[,.!]+$/, '').trim() === c.name.trim());
        const named = intro?.id ?? lastNamedBefore(narration, narration.length, m) ?? lastNamed;
        if (named) {
          speaker = named;
          how = 'context';
        }
      }
      // 3. The narration names exactly one character.
      if (!speaker) {
        const named = namedIn(narration);
        if (named.length === 1) {
          speaker = named[0];
          how = 'context';
        }
      }
      // 3b. A bare line right after a paragraph about one character is usually theirs.
      if (!speaker && bare && !prevWasDialogue && prevNarration?.length === 1) {
        speaker = prevNarration[0];
        how = 'context';
      }
      // 4. Back-and-forth: a bare line answers the previous speaker, so it's the one before.
      if (!speaker && bare && recent.length >= 2 && recent[recent.length - 2] && recent[recent.length - 1] !== recent[recent.length - 2]) {
        speaker = recent[recent.length - 2];
        how = 'context';
      }
      // 5. Taking turns: a reply ("He poured…") after someone's line comes from the other person in the exchange.
      if (!speaker && prevWasDialogue && recent[recent.length - 1]) {
        const prev = recent[recent.length - 1]!;
        const other = [...recent].reverse().find((r) => r && r !== prev) ?? (lastNamed && lastNamed !== prev ? lastNamed : null);
        if (other) {
          speaker = other;
          how = 'context';
        }
      }
      for (const qt of quotes) if (qt.text) lines.push({ docId: s.docId, unitId: s.unitId, text: qt.text, speakerId: speaker, how });
      recent.push(speaker);
      lastNamed = lastNamedBefore(narration, narration.length, m) ?? speaker ?? lastNamed;
      prevWasDialogue = true;
      prevNarration = null;
    }
  }
  return lines;
}

export interface VoiceStats {
  lines: number;
  words: number;
  avgWordsPerLine: number;
  avgSentenceLength: number;
  questionPct: number;
  exclamationPct: number;
  contractionsPer100: number;
  /** Words this character uses noticeably more than everyone else. */
  signature: { word: string; count: number }[];
  /** Phrases they repeat. */
  phrases: { phrase: string; count: number }[];
}

const STOP = new Set('a an the and or but if of to in on at by for with from as is are was were be been am i you he she it we they me him her us them my your his its our their this that these those not no do does did have has had will would can could shall should may might must so just then than there here what who how why when where which all some any one get got go going know like oh well yes yeah'.split(' '));
const tokens = (s: string) => s.toLowerCase().match(/[\p{L}'’]+/gu) ?? [];

export function voiceStats(lines: DialogueLine[], all: DialogueLine[]): VoiceStats {
  const text = lines.map((l) => l.text);
  const words = text.flatMap(tokens);
  const sentences = text.flatMap((t) => splitSentences(t));
  const count = (pred: (t: string) => boolean) => text.filter(pred).length;
  const freq = (ws: string[]) => {
    const f = new Map<string, number>();
    for (const w of ws) if (!STOP.has(w) && w.length > 2) f.set(w, (f.get(w) ?? 0) + 1);
    return f;
  };
  const mine = freq(words);
  const everyone = freq(all.flatMap((l) => tokens(l.text)));
  const total = Math.max(1, words.length);
  const totalAll = Math.max(1, all.reduce((n, l) => n + tokens(l.text).length, 0));
  const signature = [...mine]
    .filter(([, n]) => n >= 2)
    .map(([word, n]) => ({ word, count: n, score: (n / total) / (((everyone.get(word) ?? n) + 1) / totalAll) }))
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 12)
    .map(({ word, count: c }) => ({ word, count: c }));
  const bigrams = new Map<string, number>();
  for (const t of text) {
    const ws = tokens(t);
    for (let i = 0; i < ws.length - 1; i++) {
      if (STOP.has(ws[i]) && STOP.has(ws[i + 1])) continue;
      const k = `${ws[i]} ${ws[i + 1]}`;
      bigrams.set(k, (bigrams.get(k) ?? 0) + 1);
    }
  }
  const phrases = [...bigrams].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([phrase, c]) => ({ phrase, count: c }));
  const contractions = words.filter((w) => /['’](s|t|re|ve|ll|d|m)$/.test(w) || /n['’]t$/.test(w)).length;
  const n = Math.max(1, lines.length);
  return {
    lines: lines.length,
    words: words.length,
    avgWordsPerLine: Math.round((words.length / n) * 10) / 10,
    avgSentenceLength: Math.round((words.length / Math.max(1, sentences.length)) * 10) / 10,
    questionPct: Math.round((count((t) => t.includes('?')) / n) * 100),
    exclamationPct: Math.round((count((t) => t.includes('!')) / n) * 100),
    contractionsPer100: Math.round((contractions / total) * 1000) / 10,
    signature,
    phrases,
  };
}

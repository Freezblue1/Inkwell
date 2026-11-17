/**
 * Dictionary/thesaurus lookup using free public APIs (dictionaryapi.dev for
 * definitions, Datamuse for synonyms), with a small built-in offline list.
 */

export interface Definition {
  partOfSpeech: string;
  meaning: string;
  example?: string;
}

export interface LookupResult {
  word: string;
  phonetic?: string;
  definitions: Definition[];
  synonyms: string[];
  related: string[];
  offline: boolean;
}

/** Common words writers overuse, with alternatives (offline fallback). */
export const OFFLINE_SYNONYMS: Record<string, string[]> = {
  said: ['replied', 'murmured', 'answered', 'whispered', 'called', 'admitted', 'offered', 'insisted'],
  walked: ['strode', 'ambled', 'trudged', 'wandered', 'paced', 'marched', 'crept', 'shuffled'],
  looked: ['glanced', 'stared', 'peered', 'gazed', 'studied', 'watched', 'eyed', 'squinted'],
  big: ['vast', 'huge', 'immense', 'hulking', 'towering', 'sprawling', 'massive'],
  small: ['tiny', 'slight', 'compact', 'meagre', 'minute', 'narrow', 'modest'],
  good: ['fine', 'decent', 'solid', 'excellent', 'worthy', 'sound', 'kind'],
  bad: ['poor', 'grim', 'awful', 'dire', 'rotten', 'wicked', 'faulty'],
  happy: ['glad', 'content', 'cheerful', 'elated', 'delighted', 'buoyant'],
  sad: ['sorrowful', 'downcast', 'glum', 'melancholy', 'forlorn', 'bleak'],
  angry: ['furious', 'irate', 'livid', 'cross', 'seething', 'indignant'],
  very: ['deeply', 'truly', 'remarkably', '(or cut it and choose a stronger word)'],
  really: ['truly', 'genuinely', '(often better cut)'],
  run: ['dash', 'sprint', 'race', 'bolt', 'hurry', 'scramble'],
  ran: ['dashed', 'sprinted', 'raced', 'bolted', 'hurried', 'fled'],
  went: ['headed', 'set off', 'left', 'moved', 'travelled', 'proceeded'],
  got: ['obtained', 'received', 'fetched', 'became', 'grew'],
  thing: ['object', 'item', 'matter', 'detail', 'affair'],
  beautiful: ['lovely', 'striking', 'radiant', 'exquisite', 'graceful'],
  dark: ['dim', 'murky', 'shadowy', 'gloomy', 'unlit', 'inky'],
  quiet: ['hushed', 'still', 'silent', 'muted', 'soft', 'calm'],
  smile: ['grin', 'smirk', 'beam', 'simper'],
  smiled: ['grinned', 'beamed', 'smirked', 'brightened'],
  nodded: ['agreed', 'inclined their head', 'acknowledged'],
  turned: ['spun', 'pivoted', 'swivelled', 'wheeled'],
  felt: ['sensed', 'noticed', 'experienced', 'knew'],
  suddenly: ['abruptly', 'without warning', '(often better cut)'],
};

async function fetchJson<T>(url: string, ms = 6000): Promise<T | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

interface DictEntry {
  word: string;
  phonetic?: string;
  meanings: { partOfSpeech: string; definitions: { definition: string; example?: string }[]; synonyms?: string[] }[];
}

export async function lookupWord(raw: string): Promise<LookupResult> {
  const word = raw.toLowerCase().replace(/[^\p{L}'-]/gu, '');
  const offline = OFFLINE_SYNONYMS[word] ?? [];
  if (typeof navigator !== 'undefined' && !navigator.onLine) return { word, definitions: [], synonyms: offline, related: [], offline: true };

  const [dict, syn, rel] = await Promise.all([
    fetchJson<DictEntry[]>(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`),
    fetchJson<{ word: string }[]>(`https://api.datamuse.com/words?rel_syn=${encodeURIComponent(word)}&max=30`),
    fetchJson<{ word: string }[]>(`https://api.datamuse.com/words?ml=${encodeURIComponent(word)}&max=20`),
  ]);
  if (!dict && !syn && !rel) return { word, definitions: [], synonyms: offline, related: [], offline: true };

  const definitions: Definition[] = [];
  const dictSyn = new Set<string>();
  dict?.forEach((e) =>
    e.meanings.forEach((m) => {
      m.synonyms?.forEach((s) => dictSyn.add(s));
      m.definitions.slice(0, 3).forEach((d) => definitions.push({ partOfSpeech: m.partOfSpeech, meaning: d.definition, example: d.example }));
    }),
  );
  const synonyms = [...new Set([...(syn ?? []).map((s) => s.word), ...dictSyn, ...offline])].slice(0, 30);
  const related = (rel ?? []).map((r) => r.word).filter((w) => !synonyms.includes(w) && w !== word).slice(0, 16);
  return { word, phonetic: dict?.[0]?.phonetic, definitions: definitions.slice(0, 8), synonyms, related, offline: false };
}

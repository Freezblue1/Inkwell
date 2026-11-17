import { describe, expect, it } from 'vitest';
import { absences, analyseContinuity, buildMatcher, extractDialogue, levenshtein, nameParts, voiceStats, type SceneText, type Unit } from './continuity';

const chars = [
  { id: 'mara', name: 'Mara Quill', appearance: 'Ink-stained fingers and grey eyes.' },
  { id: 'tob', name: 'Tobiah Venn', appearance: 'Tall, with red hair.' },
  { id: 'ines', name: 'Ines Arroyo' },
];
const units: Unit[] = Array.from({ length: 8 }, (_, i) => ({ id: `u${i}`, label: `Chapter ${i + 1}`, title: `T${i}` }));
const scene = (i: number, text: string): SceneText => ({ docId: `d${i}`, unitId: `u${i}`, title: `Scene ${i}`, text });

describe('names', () => {
  it('splits names into identifying parts and skips titles', () => {
    expect(nameParts('Captain Mara Quill')).toEqual(['Mara', 'Quill']);
    expect(nameParts('Dr. Al Li')).toEqual([]);
  });
  it('only lets a shared surname count with the full name', () => {
    const m = buildMatcher([{ id: 'a', name: 'Anna Venn' }, { id: 'b', name: 'Tobiah Venn' }]);
    const a = m.patterns.get('a')!;
    a.lastIndex = 0;
    expect(a.test('Venn walked in.')).toBe(false);
    a.lastIndex = 0;
    expect(a.test('Anna’s coat')).toBe(true);
  });
  it('measures edit distance', () => {
    expect(levenshtein('tobiah', 'tobias')).toBe(1);
    expect(levenshtein('mara', 'marra')).toBe(1);
  });
});

describe('continuity checks', () => {
  const scenes = [
    scene(0, 'Mara Quill looked at the sea. Her grey eyes narrowed.\n\nTobiah Venn poured the tea.'),
    scene(1, 'Mara wrote it down. Tobiah frowned, red hair in his eyes.'),
    scene(2, 'Mara walked to the harbour. Her blue eyes stung in the wind.'),
    scene(3, 'Tobias laughed at nothing.'),
    scene(4, 'Rain.'),
    scene(5, 'Rain again.'),
    scene(6, 'Mara read the ledger. Tobiah sighed.'),
    scene(7, 'More rain.'),
  ];
  const report = analyseContinuity(units, scenes, chars, 3);

  it('counts appearances per chapter', () => {
    expect(report.counts.get('mara')).toEqual([1, 1, 1, 0, 0, 0, 1, 0]);
    expect(report.counts.get('ines')).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('flags eyes described two ways, including the Story Bible', () => {
    const eyes = report.issues.find((i) => i.kind === 'attribute' && i.characterId === 'mara' && i.attr === 'eyes');
    expect(eyes && eyes.kind === 'attribute' && eyes.values.map((v) => v.value).sort()).toEqual(['blue', 'grey']);
    expect(eyes && eyes.kind === 'attribute' && eyes.values.find((v) => v.value === 'grey')!.occurrences.some((o) => o.docId === 'bible')).toBe(true);
    // Tobiah's hair is red in the Bible and in the text: no issue.
    expect(report.issues.some((i) => i.kind === 'attribute' && i.characterId === 'tob')).toBe(false);
  });

  it('flags a name spelled two ways', () => {
    const sp = report.issues.find((i) => i.kind === 'spelling');
    expect(sp).toMatchObject({ characterId: 'tob', canonical: 'Tobiah', variant: 'Tobias' });
  });

  it('flags characters missing for too many chapters', () => {
    const gap = report.issues.find((i) => i.kind === 'absence' && i.characterId === 'mara');
    expect(gap).toMatchObject({ fromUnit: 3, toUnit: 5, length: 3, trailing: false });
    expect(absences(new Map([['x', [1, 1, 1, 0, 0, 0, 0]]]), 3)).toMatchObject([{ trailing: true, length: 4 }]);
  });
});

describe('dialogue', () => {
  const text = [
    '“North steps. With a teapot.” Mara watched his good eye. “Who is E. Sallow?”',
    '“I’m not doing riddles tonight, Tobiah.”',
    '“A wall,” Tobiah said. “Go to bed, Mara. Some things are better drowned.”',
    '“Fine.”',
    'Mara said, “I will find out anyway.”',
    '“Who’s there?” she asked.',
  ].join('\n\n');
  const lines = extractDialogue([scene(0, text)], chars);

  it('attributes lines from tags, context and back-and-forth', () => {
    const who = lines.map((l) => [l.text.slice(0, 12), l.speakerId, l.how]);
    expect(who[0]).toEqual(['North steps.', 'mara', 'context']);
    expect(who[1]).toEqual(['Who is E. Sa', 'mara', 'context']);
    expect(who[3]).toEqual(['A wall,', 'tob', 'tag']);
    expect(who[4]).toEqual(['Go to bed, M', 'tob', 'tag']); // the vocative "Mara" isn't the speaker
    expect(lines.find((l) => l.text === 'I will find out anyway.')?.speakerId).toBe('mara');
    expect(lines.find((l) => l.text === 'Who’s there?')).toMatchObject({ speakerId: 'mara', how: 'context' });
  });

  it('follows a two-person exchange through action beats and self-introductions', () => {
    const exchange = [
      'Tobiah Venn read the page twice and handed it back.',
      '“Where did the sea give you this?”',
      '“North steps.” Mara watched his good eye. “Who is E. Sallow?”',
      '“A harbourmaster.” He busied himself with the kettle.',
      '“Ines Arroyo,” she called up the steps. “Mainland Survey.”',
    ].join('\n\n');
    const ls = extractDialogue([scene(1, exchange)], chars);
    const by = (t: string) => ls.find((l) => l.text.startsWith(t))?.speakerId;
    expect(by('Where did')).toBe('tob');
    expect(by('Who is')).toBe('mara');
    expect(by('A harbourmaster')).toBe('tob');
    expect(by('Ines Arroyo')).toBe('ines');
  });

  it('summarises a character’s voice', () => {
    const tob = lines.filter((l) => l.speakerId === 'tob');
    const s = voiceStats(tob, lines);
    expect(s.lines).toBe(tob.length);
    expect(s.words).toBeGreaterThan(5);
    expect(s.questionPct).toBe(0);
  });
});

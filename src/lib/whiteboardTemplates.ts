/**
 * Starter templates for whiteboards: plot diagram, three-act structure,
 * murder board, family tree, and a character web built from the Story Bible.
 * Each returns elements laid out around (0, 0); the editor centres them.
 */
import type { BibleEntry, Character, ID, WbArrow, WbCard, WbElement, WbFrame, WbNote, WbPath, WbText } from '@/types/models';
import { routeConnectors } from './whiteboard';

export type TemplateId = 'plot' | 'three-act' | 'murder' | 'family' | 'web';

export interface TemplateInfo {
  id: TemplateId;
  name: string;
  description: string;
  /** Needs characters in the Story Bible. */
  needsCharacters?: boolean;
}

export const TEMPLATES: TemplateInfo[] = [
  { id: 'plot', name: 'Plot diagram', description: 'Freytag’s pyramid: exposition, rising action, climax, falling action, resolution' },
  { id: 'three-act', name: 'Three-act structure', description: 'Setup, confrontation and resolution, with the key turning points' },
  { id: 'murder', name: 'Murder board', description: 'Victim, suspects, clues and a timeline, joined with red string' },
  { id: 'family', name: 'Family tree', description: 'Three generations of placeholder cards, already connected' },
  { id: 'web', name: 'Character web', description: 'Your Story Bible characters as cards, joined by their relationships', needsCharacters: true },
];

const YELLOW = '#fff59d';
const ORANGE = '#ffcc80';
const PINK = '#f8bbd0';
const GREEN = '#c5e1a5';
const BLUE = '#b3e5fc';
const PURPLE = '#d1c4e9';
const RED = '#e53935';

function builder(makeId: () => string) {
  const els: WbElement[] = [];
  const add = <T extends WbElement>(el: T): T => {
    els.push(el);
    return el;
  };
  return {
    els,
    note: (x: number, y: number, text: string, fill = YELLOW, w = 180, h = 110) =>
      add<WbNote>({ id: makeId(), type: 'note', x, y, w, h, text, fill, color: 'ink', strokeWidth: 1, docId: null }),
    frame: (x: number, y: number, w: number, h: number, title: string, fill: string) =>
      add<WbFrame>({ id: makeId(), type: 'frame', x, y, w, h, title, fill, color: 'ink', strokeWidth: 2 }),
    text: (x: number, y: number, text: string, fontSize = 36, w = 600) => add<WbText>({ id: makeId(), type: 'text', x, y, w, text, fontSize, color: 'ink', strokeWidth: 1 }),
    arrow: (from: ID, to: ID, label = '', color = 'ink', strokeWidth = 3) =>
      add<WbArrow>({ id: makeId(), type: 'arrow', x1: 0, y1: 0, x2: 0, y2: 0, from, to, label: label || undefined, color, strokeWidth }),
    card: (x: number, y: number, bibleId: ID) => add<WbCard>({ id: makeId(), type: 'card', x, y, w: 220, h: 120, bibleId, color: 'ink', strokeWidth: 1 }),
    path: (points: [number, number][], color = 'ink', strokeWidth = 4) => add<WbPath>({ id: makeId(), type: 'path', points, color, strokeWidth }),
  };
}

function plot(b: ReturnType<typeof builder>) {
  b.text(-120, -330, 'Plot diagram', 40, 400);
  b.path([[-560, 120], [-300, 120], [0, -200], [260, 120], [560, 120]], 'ink', 5);
  b.note(-600, 150, 'Exposition\nWho, where, and what “normal” looks like', BLUE);
  b.note(-380, 150, 'Inciting incident\nThe event that starts the story', ORANGE);
  b.note(-330, -120, 'Rising action\nComplications, raising the stakes', YELLOW);
  b.note(-90, -330, 'Climax\nThe turning point; highest tension', PINK, 200);
  b.note(150, -120, 'Falling action\nConsequences unfold', GREEN);
  b.note(420, 150, 'Resolution\nThe new normal', PURPLE);
}

function threeAct(b: ReturnType<typeof builder>) {
  b.text(-200, -330, 'Three-act structure', 40, 500);
  const acts: [string, string, string[]][] = [
    ['Act I — Setup (25%)', BLUE, ['Opening image\nThe hero’s ordinary world', 'Inciting incident\nSomething disrupts it', 'Plot point 1\nNo turning back']],
    ['Act II — Confrontation (50%)', YELLOW, ['Rising obstacles\nTrying and failing', 'Midpoint\nA reversal or revelation', 'Plot point 2\nAll is lost']],
    ['Act III — Resolution (25%)', GREEN, ['Dark night of the soul', 'Climax\nThe final confrontation', 'Resolution\nWhat changed']],
  ];
  const notes: ID[] = [];
  acts.forEach(([title, fill, beats], i) => {
    const x = -630 + i * 430;
    b.frame(x, -240, 400, 470, title, fill);
    beats.forEach((beat, k) => notes.push(b.note(x + 30, -215 + k * 150, beat, fill, 340, 120).id));
  });
  for (let i = 0; i < notes.length - 1; i += 3) {
    b.arrow(notes[i], notes[i + 1]);
    b.arrow(notes[i + 1], notes[i + 2]);
  }
  b.arrow(notes[2], notes[3]);
  b.arrow(notes[5], notes[6]);
}

function murder(b: ReturnType<typeof builder>) {
  b.text(-170, -400, 'Murder board', 44, 400);
  b.frame(-170, -320, 340, 200, 'Victim', PINK);
  const victim = b.note(-110, -290, 'The victim\nName, time and place of death', '#ffffff', 220, 130);
  b.frame(-700, -60, 1400, 230, 'Suspects', YELLOW);
  const suspects = [-660, -320, 20, 360].map((x, i) => b.note(x, -30, `Suspect ${i + 1}\nMotive · Means · Opportunity`, YELLOW, 300, 150));
  ['motive?', 'alibi?', 'the will', 'jealousy'].forEach((label, i) => b.arrow(suspects[i].id, victim.id, label, RED, 3));
  b.frame(-700, 220, 680, 220, 'Clues', BLUE);
  const clues = [-680, -460, -240].map((x, i) => b.note(x, 255, `Clue ${i + 1}\nWhere was it found?`, '#ffffff', 200, 130));
  b.arrow(clues[0].id, suspects[1].id, '', RED, 2);
  b.arrow(clues[2].id, suspects[2].id, '', RED, 2);
  b.frame(20, 220, 680, 220, 'Timeline', GREEN);
  ['Evening\nLast seen alive', 'Midnight\nThe crime', 'Morning\nBody found'].forEach((t, i) => b.note(50 + i * 215, 255, t, GREEN, 195, 130));
}

function family(b: ReturnType<typeof builder>) {
  b.text(-130, -420, 'Family tree', 40, 400);
  const g1 = [b.note(-430, -330, 'Grandfather\nName · born–died', BLUE), b.note(-200, -330, 'Grandmother\nName · born–died', PINK), b.note(200, -330, 'Grandfather\nName · born–died', BLUE), b.note(430, -330, 'Grandmother\nName · born–died', PINK)];
  b.arrow(g1[0].id, g1[1].id, 'married');
  b.arrow(g1[2].id, g1[3].id, 'married');
  const g2 = [b.note(-315, -100, 'Father\nName · born', BLUE), b.note(315, -100, 'Mother\nName · born', PINK)];
  b.arrow(g1[1].id, g2[0].id, 'son');
  b.arrow(g1[2].id, g2[1].id, 'daughter');
  b.arrow(g2[0].id, g2[1].id, 'married');
  const kids = [b.note(-330, 150, 'Child\nThe protagonist?', YELLOW), b.note(0, 150, 'Child', YELLOW), b.note(330, 150, 'Child', YELLOW)];
  for (const k of kids) {
    b.arrow(g2[0].id, k.id);
    b.arrow(g2[1].id, k.id);
  }
}

function web(b: ReturnType<typeof builder>, bible: BibleEntry[]) {
  const chars = bible.filter((e): e is Character => e.kind === 'character').slice(0, 24);
  b.text(-150, -480, 'Character web', 40, 400);
  const r = Math.max(260, chars.length * 55);
  const cards = new Map<ID, ID>();
  chars.forEach((c, i) => {
    const a = (i / Math.max(1, chars.length)) * Math.PI * 2 - Math.PI / 2;
    cards.set(c.id, b.card(Math.cos(a) * r - 110, Math.sin(a) * r - 60, c.id).id);
  });
  const seen = new Set<string>();
  for (const c of chars) {
    for (const rel of c.relationships ?? []) {
      const from = cards.get(c.id);
      const to = cards.get(rel.targetId);
      const key = [c.id, rel.targetId].sort().join('|');
      if (!from || !to || seen.has(key)) continue;
      seen.add(key);
      b.arrow(from, to, rel.type);
    }
  }
}

/** Builds a template's elements around (0, 0), with attached arrows already routed. */
export function buildTemplate(id: TemplateId, makeId: () => string, bible: BibleEntry[] = []): WbElement[] {
  const b = builder(makeId);
  if (id === 'plot') plot(b);
  else if (id === 'three-act') threeAct(b);
  else if (id === 'murder') murder(b);
  else if (id === 'family') family(b);
  else web(b, bible);
  return routeConnectors(b.els);
}

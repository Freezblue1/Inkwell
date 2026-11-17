import { describe, expect, it } from 'vitest';
import type { BibleEntry, WbArrow } from '@/types/models';
import { makeBibleEntry } from './bible';
import { buildTemplate, TEMPLATES } from './whiteboardTemplates';
import { elementBounds, elementsInFrame } from './whiteboard';

let n = 0;
const id = () => `t${++n}`;

describe('whiteboard templates', () => {
  it('builds every template with valid, attached, routed arrows', () => {
    for (const t of TEMPLATES.filter((x) => !x.needsCharacters)) {
      const els = buildTemplate(t.id, id);
      expect(els.length, t.id).toBeGreaterThan(5);
      const ids = new Set(els.map((e) => e.id));
      for (const el of els) {
        const b = elementBounds(el);
        expect(Number.isFinite(b.x + b.y + b.w + b.h), `${t.id} ${el.type}`).toBe(true);
        if (el.type === 'arrow' && (el.from || el.to)) {
          expect(ids.has(el.from!) && ids.has(el.to!)).toBe(true);
          expect(Math.hypot(el.x2 - el.x1, el.y2 - el.y1)).toBeGreaterThan(5);
        }
      }
    }
  });

  it('puts the murder board suspects inside their frame, joined to the victim with red string', () => {
    const els = buildTemplate('murder', id);
    const frame = (title: string) => els.find((e) => e.type === 'frame' && e.title === title);
    const inside = (title: string) => {
      const f = frame(title);
      return f && f.type === 'frame' ? elementsInFrame(f, els).filter((id) => els.find((e) => e.id === id)?.type === 'note').length : -1;
    };
    expect(inside('Suspects')).toBe(4);
    expect(inside('Clues')).toBe(3);
    expect(inside('Timeline')).toBe(3);
    expect(inside('Victim')).toBe(1);
    const red = els.filter((e): e is WbArrow => e.type === 'arrow' && e.color === '#e53935');
    expect(red.some((a) => a.label === 'motive?')).toBe(true);
  });

  it('builds a character web from the Story Bible and its relationships', () => {
    const mara = makeBibleEntry<BibleEntry>('p', 'character', { name: 'Mara' });
    const tob = makeBibleEntry<BibleEntry>('p', 'character', { name: 'Tobiah' });
    if (mara.kind === 'character') mara.relationships = [{ targetId: tob.id, type: 'brother' }];
    if (tob.kind === 'character') tob.relationships = [{ targetId: mara.id, type: 'sister' }];
    const els = buildTemplate('web', id, [mara, tob, makeBibleEntry<BibleEntry>('p', 'location', { name: 'Harbour' })]);
    expect(els.filter((e) => e.type === 'card')).toHaveLength(2);
    const arrows = els.filter((e): e is WbArrow => e.type === 'arrow');
    expect(arrows).toHaveLength(1); // one arrow per pair
    expect(arrows[0].label).toBe('brother');
  });
});

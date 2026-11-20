import { describe, expect, it } from 'vitest';
import { arrange, chipKey, gather, nudge, setTabGroup, stripItems, stripKeys, updateGroup, type TabSlot } from './boardTabs';

const G = { id: 'g', name: 'Act 1', color: '#e53935' };
const H = { id: 'h', name: 'Act 2', color: '#43a047' };
const ids = (s: TabSlot[]) => s.map((x) => `${x.id}${x.group ? `:${x.group.id}` : ''}`).join(' ');
const none = new Set<string>();

describe('board tab groups', () => {
  const slots: TabSlot[] = [
    { id: 'a', group: null },
    { id: 'b', group: G },
    { id: 'c', group: null },
    { id: 'd', group: G },
    { id: 'e', group: H },
  ];

  it('keeps a group together at its first tab and shows chips', () => {
    expect(ids(gather(slots))).toBe('a b:g d:g c e:h');
    expect(stripKeys(stripItems(slots, none))).toEqual(['a', chipKey('g'), 'b', 'd', 'c', chipKey('h'), 'e']);
    expect(stripKeys(stripItems(slots, new Set(['g'])))).toEqual(['a', chipKey('g'), 'c', chipKey('h'), 'e']);
  });

  it('reorders plain tabs, and a tab dropped between group tabs joins the group', () => {
    expect(ids(arrange(slots, none, 'a', 'c'))).toBe('b:g d:g c a e:h');
    expect(ids(arrange(slots, none, 'c', 'd'))).toBe('a b:g c:g d:g e:h'); // lands between b and d: joins
    expect(ids(arrange(slots, none, 'a', 'e'))).toBe('b:g d:g c e:h a'); // past the end: stays out of H
    expect(ids(arrange(slots, none, 'c', 'b'))).toBe('a c:g b:g d:g e:h'); // right after the chip: joins as first
  });

  it('drags a whole group by its chip, including collapsed tabs', () => {
    expect(ids(arrange(slots, none, chipKey('g'), 'c'))).toBe('a c b:g d:g e:h');
    expect(ids(arrange(slots, new Set(['g']), chipKey('g'), chipKey('h')))).toBe('a c e:h b:g d:g');
  });

  it('a tab dragged out of its group leaves it', () => {
    expect(ids(arrange(slots, none, 'b', 'a'))).toBe('b a d:g c e:h');
  });

  it('adds to, leaves, renames and dissolves groups', () => {
    expect(ids(setTabGroup(slots, 'a', H))).toBe('b:g d:g c e:h a:h');
    expect(ids(setTabGroup(slots, 'b', null))).toBe('a d:g b c e:h');
    expect(updateGroup(slots, 'g', { ...G, name: 'Opening' }).find((s) => s.id === 'd')!.group!.name).toBe('Opening');
    expect(ids(updateGroup(slots, 'g', null))).toBe('a b c d e:h');
  });

  it('nudges a tab past its neighbour', () => {
    expect(ids(nudge(slots, none, 'c', 1))).toBe('a b:g d:g c:h e:h'); // stepping right past a chip enters that group
    expect(ids(nudge([{ id: 'x', group: null }, { id: 'y', group: null }], none, 'y', -1))).toBe('y x');
  });
});

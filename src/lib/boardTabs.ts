/**
 * Whiteboard tab strip: groups (like browser tab groups) and drag-to-reorder.
 * Pure functions over the open boards in their tab order.
 */
import type { ID, WhiteboardGroup } from '@/types/models';

export const GROUP_COLORS = ['#5c6bc0', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#00acc1', '#d81b60', '#8e24aa', '#78909c'];

export interface TabSlot {
  id: ID;
  group: WhiteboardGroup | null;
}

export type StripItem = { kind: 'group'; group: WhiteboardGroup; members: ID[]; collapsed: boolean } | { kind: 'tab'; id: ID; group: WhiteboardGroup | null };

export const chipKey = (groupId: ID) => `group:${groupId}`;
export const isChipKey = (key: string) => key.startsWith('group:');
const groupIdOf = (key: string) => key.slice('group:'.length);

/** Keeps each group's tabs together, at the place of its first tab. */
export function gather(slots: TabSlot[]): TabSlot[] {
  const out: TabSlot[] = [];
  const done = new Set<ID>();
  for (const s of slots) {
    if (!s.group) out.push(s);
    else if (!done.has(s.group.id)) {
      done.add(s.group.id);
      // The group's name and colour come from its first tab.
      const g = s.group;
      for (const m of slots) if (m.group?.id === g.id) out.push({ ...m, group: g });
    }
  }
  return out;
}

/** What the strip shows: a chip before each group, then its tabs unless the group is collapsed. */
export function stripItems(slots: TabSlot[], collapsed: ReadonlySet<ID>): StripItem[] {
  const items: StripItem[] = [];
  for (const s of gather(slots)) {
    if (s.group) {
      const chip = items.find((i): i is Extract<StripItem, { kind: 'group' }> => i.kind === 'group' && i.group.id === s.group!.id);
      if (!chip) items.push({ kind: 'group', group: s.group, members: [s.id], collapsed: collapsed.has(s.group.id) });
      else chip.members.push(s.id);
      if (!collapsed.has(s.group.id)) items.push({ kind: 'tab', id: s.id, group: s.group });
    } else items.push({ kind: 'tab', id: s.id, group: null });
  }
  return items;
}

export const stripKeys = (items: StripItem[]) => items.map((i) => (i.kind === 'group' ? chipKey(i.group.id) : i.id));

/**
 * The new order after dragging `activeKey` (a tab id or a group chip) onto `overKey`.
 * Dragging a chip moves its whole group. A tab dropped between two tabs of a group,
 * or right after a group's chip, joins that group; a tab dropped outside its group leaves it.
 */
export function arrange(slots: TabSlot[], collapsed: ReadonlySet<ID>, activeKey: string, overKey: string): TabSlot[] {
  const ordered = gather(slots);
  const items = stripItems(ordered, collapsed);
  const keys = stripKeys(items);
  const from = keys.indexOf(activeKey);
  let to = keys.indexOf(overKey);
  if (from < 0 || to < 0 || from === to) return ordered;
  // A group dropped onto another group goes past it as a whole (after it when moving right, before it when moving left).
  if (isChipKey(activeKey)) {
    const target = items[to];
    const gid = target.kind === 'group' ? target.group.id : target.group?.id;
    if (gid && gid !== groupIdOf(activeKey)) {
      const start = keys.indexOf(chipKey(gid));
      let end = start;
      while (end + 1 < items.length && items[end + 1].kind === 'tab' && (items[end + 1] as { group: { id: ID } | null }).group?.id === gid) end++;
      to = from < to ? end : start;
    }
  }
  const moved = [...keys];
  moved.splice(to, 0, moved.splice(from, 1)[0]);

  const byId = new Map(ordered.map((s) => [s.id, s]));
  const membersOf = (gid: ID) => ordered.filter((s) => s.group?.id === gid);
  const groupOfKey = (key: string | undefined): WhiteboardGroup | null => {
    if (!key) return null;
    if (isChipKey(key)) return membersOf(groupIdOf(key))[0]?.group ?? null;
    return byId.get(key)?.group ?? null;
  };

  let movedGroup: ID | null = null;
  let tabGroup: WhiteboardGroup | null | undefined;
  if (isChipKey(activeKey)) movedGroup = groupIdOf(activeKey);
  else {
    const at = moved.indexOf(activeKey);
    const prev = moved[at - 1];
    const next = moved[at + 1];
    const self = byId.get(activeKey)!;
    const prevGroup = groupOfKey(prev);
    const nextGroup = next && !isChipKey(next) ? groupOfKey(next) : null;
    if (prev && isChipKey(prev)) tabGroup = prevGroup;
    else if (prevGroup && (prevGroup.id === nextGroup?.id || prevGroup.id === self.group?.id)) tabGroup = prevGroup;
    else tabGroup = null;
  }

  const seq: TabSlot[] = [];
  for (const key of moved) {
    if (isChipKey(key)) {
      const gid = groupIdOf(key);
      // A moved group carries all its tabs; a collapsed group stands in for its hidden tabs.
      if (gid === movedGroup || collapsed.has(gid)) seq.push(...membersOf(gid).filter((s) => s.id !== activeKey));
      continue;
    }
    const s = byId.get(key)!;
    if (movedGroup && s.group?.id === movedGroup) continue;
    seq.push(key === activeKey ? { ...s, group: tabGroup ?? null } : s);
  }
  return gather(seq);
}

/** Puts a tab into a group (at the end of it) or takes it out (null). */
export function setTabGroup(slots: TabSlot[], id: ID, group: WhiteboardGroup | null): TabSlot[] {
  const ordered = gather(slots);
  const self = ordered.find((s) => s.id === id);
  if (!self) return ordered;
  const rest = ordered.filter((s) => s.id !== id);
  const moved = { ...self, group };
  if (!group) {
    // Leaving a group: go just after it.
    const lastIdx = self.group ? rest.map((s) => s.group?.id).lastIndexOf(self.group.id) : -1;
    if (lastIdx < 0) return ordered.map((s) => (s.id === id ? moved : s));
    rest.splice(lastIdx + 1, 0, moved);
    return gather(rest);
  }
  const lastIdx = rest.map((s) => s.group?.id).lastIndexOf(group.id);
  if (lastIdx < 0) return gather(ordered.map((s) => (s.id === id ? moved : s)));
  rest.splice(lastIdx + 1, 0, moved);
  return gather(rest);
}

/** Renames or recolours a group, or dissolves it (null). */
export function updateGroup(slots: TabSlot[], groupId: ID, next: WhiteboardGroup | null): TabSlot[] {
  return gather(slots.map((s) => (s.group?.id === groupId ? { ...s, group: next } : s)));
}

/** Swaps a tab with its visible neighbour (menu "Move left/right"). */
export function nudge(slots: TabSlot[], collapsed: ReadonlySet<ID>, id: ID, delta: -1 | 1): TabSlot[] {
  const keys = stripKeys(stripItems(slots, collapsed));
  const i = keys.indexOf(id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= keys.length) return gather(slots);
  return arrange(slots, collapsed, id, keys[j]);
}

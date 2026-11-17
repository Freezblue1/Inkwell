import { describe, expect, it } from 'vitest';
import type { WritingSession } from '@/types/models';
import { computeStreaks, countWritingDays, cumulativeSeries, dailySeries, dailyTarget, heatLevel } from './goals';

const s = (date: string, net: number): WritingSession => ({ id: `p:${date}`, projectId: 'p', date, added: Math.max(0, net), removed: 0, net, sprints: 0, updatedAt: 0 });

describe('countWritingDays', () => {
  it('counts only chosen weekdays, inclusive', () => {
    // 2026-11-09 is a Monday; Mon–Fri over two weeks = 10.
    expect(countWritingDays(new Date(2026, 10, 9), new Date(2026, 10, 22), [1, 2, 3, 4, 5])).toBe(10);
    expect(countWritingDays(new Date(2026, 10, 9), new Date(2026, 10, 9), [1])).toBe(1);
    expect(countWritingDays(new Date(2026, 10, 9), new Date(2026, 10, 15), [])).toBe(0);
  });
});

describe('dailyTarget', () => {
  const today = new Date(2026, 10, 9); // Monday
  it('divides the remaining words by writing days left', () => {
    const t = dailyTarget({ targetWords: 10000, currentWords: 0, deadline: '2026-11-20', writingDays: [1, 2, 3, 4, 5], today });
    expect(t.writingDaysLeft).toBe(10);
    expect(t.perDay).toBe(1000);
  });
  it('keeps the target stable during the day', () => {
    const t = dailyTarget({ targetWords: 10000, currentWords: 600, deadline: '2026-11-20', writingDays: [1, 2, 3, 4, 5], today, writtenToday: 600 });
    expect(t.perDay).toBe(1000);
  });
  it('handles no deadline, a reached target and a past deadline', () => {
    expect(dailyTarget({ targetWords: 100, currentWords: 0, deadline: null, writingDays: [1], today }).perDay).toBe(0);
    expect(dailyTarget({ targetWords: 100, currentWords: 150, deadline: '2026-12-01', writingDays: [1], today }).remaining).toBe(0);
    expect(dailyTarget({ targetWords: 100, currentWords: 0, deadline: '2026-11-01', writingDays: [1], today }).overdue).toBe(true);
  });
});

describe('computeStreaks', () => {
  const today = new Date(2026, 10, 9);
  it('counts consecutive days ending today or yesterday', () => {
    const sessions = [s('2026-11-06', 100), s('2026-11-07', 50), s('2026-11-08', 20)];
    expect(computeStreaks(sessions, today).current).toBe(3);
    expect(computeStreaks([...sessions, s('2026-11-09', 10)], today).current).toBe(4);
  });
  it('breaks on a missed writing day and tracks the longest streak', () => {
    const sessions = [s('2026-11-01', 1), s('2026-11-02', 1), s('2026-11-03', 1), s('2026-11-05', 1), s('2026-11-08', 1)];
    const r = computeStreaks(sessions, today);
    expect(r.current).toBe(1);
    expect(r.longest).toBe(3);
  });
  it('skips rest days when writing days are set', () => {
    // Fri 6th and Mon 9th with weekends off → streak of 2.
    const r = computeStreaks([s('2026-11-06', 5), s('2026-11-09', 5)], today, [1, 2, 3, 4, 5]);
    expect(r.current).toBe(2);
  });
  it('ignores days with net negative words', () => {
    expect(computeStreaks([s('2026-11-09', -40)], today).current).toBe(0);
  });
});

describe('series', () => {
  const today = new Date(2026, 10, 9);
  it('zero-fills the daily series', () => {
    const d = dailySeries([s('2026-11-08', 300)], 3, today);
    expect(d.map((x) => x.words)).toEqual([0, 300, 0]);
  });
  it('reconstructs cumulative totals backwards from the current count', () => {
    const c = cumulativeSeries([s('2026-11-07', 100), s('2026-11-08', 200), s('2026-11-09', 50)], 1350, 2000, null, today);
    expect(c.map((x) => x.actual)).toEqual([1100, 1300, 1350]);
  });
  it('draws a target line to the deadline', () => {
    const c = cumulativeSeries([s('2026-11-09', 0)], 0, 1000, '2026-11-19', today);
    expect(c[0].target).toBe(0);
    expect(c[c.length - 1].target).toBe(1000);
  });
  it('buckets heat levels', () => {
    expect([0, 50, 300, 500, 900].map((w) => heatLevel(w, 500))).toEqual([0, 1, 2, 3, 4]);
  });
});

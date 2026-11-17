/** Goal arithmetic: daily targets, streaks and progress series. Pure functions. */
import type { DayKey, WritingSession } from '@/types/models';
import { addDays, dayKey, parseDayKey } from './dates';

export interface DailyTargetInput {
  targetWords: number;
  currentWords: number;
  /** YYYY-MM-DD or null. */
  deadline: DayKey | null;
  /** 0 = Sunday … 6 = Saturday. */
  writingDays: number[];
  today?: Date;
  /** Words already written today (excluded from "remaining" so the target doesn't move during the day). */
  writtenToday?: number;
}

export interface DailyTarget {
  remaining: number;
  writingDaysLeft: number;
  perDay: number;
  /** True if the deadline has passed with words still remaining. */
  overdue: boolean;
}

/** Counts writing days from `from` to `to` inclusive. */
export function countWritingDays(from: Date, to: Date, writingDays: number[]): number {
  if (!writingDays.length) return 0;
  let n = 0;
  const end = parseDayKey(dayKey(to)).getTime();
  for (let d = parseDayKey(dayKey(from)); d.getTime() <= end; d = addDays(d, 1)) {
    if (writingDays.includes(d.getDay())) n++;
  }
  return n;
}

/**
 * Words per writing day needed to hit the target by the deadline. The count
 * at the start of today is used so the target stays stable while you write.
 */
export function dailyTarget({ targetWords, currentWords, deadline, writingDays, today = new Date(), writtenToday = 0 }: DailyTargetInput): DailyTarget {
  const startOfToday = Math.max(0, currentWords - writtenToday);
  const remaining = Math.max(0, targetWords - startOfToday);
  if (!deadline) return { remaining, writingDaysLeft: 0, perDay: 0, overdue: false };
  const end = parseDayKey(deadline);
  const days = countWritingDays(today, end, writingDays);
  if (days === 0) return { remaining, writingDaysLeft: 0, perDay: remaining, overdue: remaining > 0 && end < parseDayKey(dayKey(today)) };
  return { remaining, writingDaysLeft: days, perDay: Math.ceil(remaining / days), overdue: false };
}

export interface Streaks {
  current: number;
  longest: number;
}

/**
 * Consecutive days with net words > 0. Today counts if written; if not, the
 * streak is still alive from yesterday. Non-writing days (if given) neither
 * break nor extend a streak.
 */
export function computeStreaks(sessions: WritingSession[], today = new Date(), writingDays: number[] = [0, 1, 2, 3, 4, 5, 6]): Streaks {
  const wrote = new Set(sessions.filter((s) => s.net > 0).map((s) => s.date));
  const isWritingDay = (d: Date) => !writingDays.length || writingDays.includes(d.getDay());

  // Current streak (walk backwards from today).
  let current = 0;
  let d = parseDayKey(dayKey(today));
  if (!wrote.has(dayKey(d))) d = addDays(d, -1);
  for (let guard = 0; guard < 3660; guard++) {
    const k = dayKey(d);
    if (wrote.has(k)) current++;
    else if (isWritingDay(d)) break;
    d = addDays(d, -1);
  }

  // Longest streak (walk forward through the whole range).
  const dates = [...wrote].sort();
  let longest = 0;
  if (dates.length) {
    let run = 0;
    const end = parseDayKey(dayKey(today));
    for (let x = parseDayKey(dates[0]); x <= end; x = addDays(x, 1)) {
      if (wrote.has(dayKey(x))) longest = Math.max(longest, ++run);
      else if (isWritingDay(x)) run = 0;
    }
  }
  return { current, longest: Math.max(longest, current) };
}

export interface DayPoint {
  date: DayKey;
  label: string;
  words: number;
}

/** Last `days` days of net words (zero-filled). */
export function dailySeries(sessions: WritingSession[], days = 30, today = new Date()): DayPoint[] {
  const byDate = new Map(sessions.map((s) => [s.date, s.net]));
  const out: DayPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(parseDayKey(dayKey(today)), -i);
    const k = dayKey(d);
    out.push({ date: k, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }), words: Math.max(0, byDate.get(k) ?? 0) });
  }
  return out;
}

export interface CumulativePoint {
  date: DayKey;
  label: string;
  actual: number | null;
  target: number | null;
}

/**
 * Cumulative manuscript words over time vs. an ideal straight line to the
 * target by the deadline. Actual values are reconstructed backwards from the
 * current total using daily net changes.
 */
export function cumulativeSeries(sessions: WritingSession[], currentWords: number, targetWords: number, deadline: DayKey | null, today = new Date()): CumulativePoint[] {
  const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));
  const todayKey = dayKey(today);
  const startKey = sorted[0]?.date ?? todayKey;
  const start = parseDayKey(startKey < todayKey ? startKey : todayKey);
  const end = deadline && deadline > todayKey ? parseDayKey(deadline) : parseDayKey(todayKey);
  const net = new Map(sorted.map((s) => [s.date, s.net]));

  // Words at end of each day, reconstructed backwards from today.
  const actualByDay = new Map<DayKey, number>();
  let running = currentWords;
  for (let d = parseDayKey(todayKey); d >= start; d = addDays(d, -1)) {
    const k = dayKey(d);
    actualByDay.set(k, Math.max(0, running));
    running -= net.get(k) ?? 0;
  }
  const startWords = Math.max(0, running);
  const totalDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86_400_000));

  const out: CumulativePoint[] = [];
  let i = 0;
  for (let d = new Date(start); d <= end; d = addDays(d, 1), i++) {
    const k = dayKey(d);
    out.push({
      date: k,
      label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      actual: k <= todayKey ? actualByDay.get(k) ?? null : null,
      target: deadline ? Math.round(startWords + ((targetWords - startWords) * i) / totalDays) : null,
    });
  }
  return out;
}

/** Heatmap intensity bucket (0–4) for a day's word count relative to a goal. */
export function heatLevel(words: number, goal: number): 0 | 1 | 2 | 3 | 4 {
  if (words <= 0) return 0;
  const g = Math.max(1, goal);
  if (words < g * 0.25) return 1;
  if (words < g * 0.75) return 2;
  if (words < g * 1.25) return 3;
  return 4;
}

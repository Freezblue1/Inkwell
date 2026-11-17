/** Goals slice: project goal, daily writing log and the sprint (Pomodoro) timer. */
import type { Goal, ID, WritingSession } from '@/types/models';
import type { SliceCreator } from './types';
import { getGoal, listSessions, putGoal, recordWords } from '@/db/repos/goals';
import { makeGoal } from '@/lib/defaults';
import { manuscriptWordCount } from '@/lib/tree';

export interface SprintState {
  status: 'idle' | 'running' | 'paused';
  phase: 'work' | 'break';
  remainingSec: number;
  /** Manuscript word count when the current sprint started. */
  startWords: number;
}

export interface GoalsSlice {
  goal: Goal | null;
  sessions: WritingSession[];
  /** Manuscript word count when this writing session (app open) started. */
  sessionStartWords: number | null;
  sprint: SprintState;

  loadGoals(projectId: ID): Promise<void>;
  updateGoal(patch: Partial<Goal>): Promise<void>;
  recordWordDelta(delta: number): Promise<void>;
  startSprint(): void;
  pauseSprint(): void;
  resetSprint(): void;
  tickSprint(): void;
}

const idleSprint = (minutes = 25): SprintState => ({ status: 'idle', phase: 'work', remainingSec: minutes * 60, startWords: 0 });

export const createGoalsSlice: SliceCreator<GoalsSlice> = (set, get) => ({
  goal: null,
  sessions: [],
  sessionStartWords: null,
  sprint: idleSprint(),

  async loadGoals(projectId) {
    const [goal, sessions] = await Promise.all([getGoal(projectId), listSessions(projectId)]);
    const g = goal ?? makeGoal(projectId, 80000);
    if (!goal) await putGoal(g);
    set({ goal: g, sessions, sessionStartWords: manuscriptWordCount(get().docs), sprint: idleSprint(g.sprintMinutes) });
  },

  async updateGoal(patch) {
    const cur = get().goal;
    if (!cur) return;
    const next = { ...cur, ...patch };
    set({ goal: next });
    if (get().sprint.status === 'idle' && patch.sprintMinutes) set({ sprint: idleSprint(patch.sprintMinutes) });
    await putGoal(next);
  },

  async recordWordDelta(delta) {
    const pid = get().project?.id;
    if (!pid || delta === 0) return;
    const row = await recordWords(pid, delta);
    set((s) => {
      const exists = s.sessions.some((x) => x.id === row.id);
      return { sessions: exists ? s.sessions.map((x) => (x.id === row.id ? row : x)) : [...s.sessions, row] };
    });
  },

  startSprint() {
    const s = get().sprint;
    if (s.status === 'paused') {
      set({ sprint: { ...s, status: 'running' } });
      return;
    }
    const minutes = get().goal?.sprintMinutes ?? 25;
    set({ sprint: { status: 'running', phase: 'work', remainingSec: minutes * 60, startWords: manuscriptWordCount(get().docs) } });
  },

  pauseSprint() {
    set((st) => ({ sprint: { ...st.sprint, status: 'paused' } }));
  },

  resetSprint() {
    set({ sprint: idleSprint(get().goal?.sprintMinutes) });
  },

  tickSprint() {
    const s = get().sprint;
    if (s.status !== 'running') return;
    if (s.remainingSec > 1) {
      set({ sprint: { ...s, remainingSec: s.remainingSec - 1 } });
      return;
    }
    const goal = get().goal;
    if (s.phase === 'work') {
      const words = manuscriptWordCount(get().docs) - s.startWords;
      get().notify(`Sprint complete — ${words.toLocaleString()} words. Take a ${goal?.breakMinutes ?? 5}-minute break.`, 'success');
      const pid = get().project?.id;
      if (pid)
        void recordWords(pid, 0, 1).then((row) =>
          set((st) => ({ sessions: st.sessions.some((x) => x.id === row.id) ? st.sessions.map((x) => (x.id === row.id ? row : x)) : [...st.sessions, row] })),
        );
      set({ sprint: { status: 'running', phase: 'break', remainingSec: (goal?.breakMinutes ?? 5) * 60, startWords: s.startWords } });
    } else {
      get().notify('Break over — ready for another sprint?', 'info');
      set({ sprint: idleSprint(goal?.sprintMinutes) });
    }
  },
});

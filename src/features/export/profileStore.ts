/** Export profile state (one active profile per project), persisted to IndexedDB. */
import { create } from 'zustand';
import type { ExportProfile, ExportTemplate, ID } from '@/types/models';
import { db } from '@/db/db';
import { makeExportProfile } from '@/lib/defaults';
import { templatePreset } from '@/lib/export/trim';

interface ProfileState {
  projectId: ID | null;
  profile: ExportProfile | null;
  load(projectId: ID, author: string): Promise<void>;
  update(patch: Partial<ExportProfile>): void;
  applyTemplate(t: ExportTemplate): void;
}

let timer: ReturnType<typeof setTimeout> | null = null;

export const useExportProfile = create<ProfileState>((set, get) => ({
  projectId: null,
  profile: null,

  async load(projectId, author) {
    if (get().projectId === projectId && get().profile) return;
    const rows = await db.exportProfiles.where('projectId').equals(projectId).toArray();
    let profile = rows[0];
    if (!profile) {
      profile = makeExportProfile(projectId, author);
      await db.exportProfiles.put(profile);
    }
    set({ projectId, profile: { ...makeExportProfile(projectId, author), ...profile } });
  },

  update(patch) {
    const cur = get().profile;
    if (!cur) return;
    const next = { ...cur, ...patch };
    set({ profile: next });
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void db.exportProfiles.put(next), 400);
  },

  applyTemplate(t) {
    get().update(templatePreset(t));
  },
}));

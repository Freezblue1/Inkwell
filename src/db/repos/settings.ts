/** App settings (singleton row). Missing keys are filled from defaults. */
import type { Settings } from '@/types/models';
import { db } from '../db';
import { defaultSettings } from '@/lib/defaults';

export async function loadSettings(): Promise<Settings> {
  const d = defaultSettings();
  const stored = await db.settings.get('app');
  if (!stored) return d;
  return {
    ...d,
    ...stored,
    editor: { ...d.editor, ...stored.editor },
    layout: { ...d.layout, ...stored.layout },
    ai: { ...d.ai, ...stored.ai },
  };
}

export async function saveSettings(s: Settings): Promise<void> {
  await db.settings.put(s);
  try {
    localStorage.setItem('inkwell:themeMode', s.themeMode);
  } catch {
    /* private mode */
  }
}

import { describe, expect, it } from 'vitest';
import { buildTheme } from './theme';
import { SCENE_LIST, sceneOf } from './scenes';

describe('illustrated themes', () => {
  it('builds a complete MUI theme for every scene', () => {
    for (const sc of SCENE_LIST) {
      const t = buildTheme(sc.mode, 'comfortable', false, sc.id);
      expect(t.inkwell.scene).toBe(sc.id);
      expect(t.palette.mode).toBe(sc.mode);
      expect(t.palette.primary.main).toBe(sc.primary.main);
      expect(t.inkwell.rail).toBeTruthy();
      expect(t.inkwell.board).toBeTruthy();
      expect(t.inkwell.paper.pageBg).toBe(sc.page.pageBg);
    }
  });

  it('leaves light and dark as plain themes', () => {
    const t = buildTheme('light', 'compact', false);
    expect(t.inkwell.scene).toBeNull();
    expect(t.inkwell.rail).toBeNull();
    expect(sceneOf('dark')).toBeNull();
    expect(sceneOf('ocean')?.name).toBe('Ocean');
  });
});

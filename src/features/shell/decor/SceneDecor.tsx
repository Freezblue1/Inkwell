/** Animated decorations for the active illustrated theme. */
import type { SceneId } from '@/theme/scenes';
import { JungleDecor } from '../JungleDecor';
import { OceanDecor } from './OceanDecor';
import { SpaceDecor } from './SpaceDecor';
import { LibraryDecor } from './LibraryDecor';
import { SakuraDecor } from './SakuraDecor';

export function SceneDecor({ scene }: { scene: SceneId }) {
  switch (scene) {
    case 'jungle':
      return <JungleDecor />;
    case 'ocean':
      return <OceanDecor />;
    case 'space':
      return <SpaceDecor />;
    case 'library':
      return <LibraryDecor />;
    case 'sakura':
      return <SakuraDecor />;
  }
}

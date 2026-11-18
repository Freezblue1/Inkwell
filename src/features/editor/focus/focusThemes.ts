/**
 * Focus mode themes: a background, text and caret colours, an optional font,
 * a gentle animated effect and a matching ambient sound for each.
 */
import type { Ambient } from '@/types/models';
import type { SceneSpec } from '@/theme/scenes';

export type FocusSound = 'rain' | 'fire' | 'waves' | 'wind' | 'brown';
export type FocusDecorKind = 'none' | 'stars' | 'rain' | 'embers' | 'snow' | 'fireflies' | 'scanlines' | 'grain' | 'rays';

export interface FocusTheme {
  id: Ambient;
  name: string;
  tagline: string;
  /** The background is dark (controls use the dark style). */
  dark: boolean;
  background: string;
  text: string;
  caret: string;
  selection: string;
  /** Replaces the manuscript font (typewriter, terminal). */
  font?: string;
  /** Extra styling for the text, e.g. a phosphor glow. */
  textShadow?: string;
  /** Text sits on a sheet of paper instead of straight on the background. */
  sheet?: { bg: string; shadow: string };
  decor: FocusDecorKind;
  sound: FocusSound;
}

const NOISE = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.3  0 0 0 0 0.25  0 0 0 0 0.18  0 0 0 0.09 0'/></filter><rect width='220' height='220' filter='url(#n)'/></svg>",
)}")`;

export const FOCUS_THEMES: FocusTheme[] = [
  {
    id: 'paper',
    name: 'Paper',
    tagline: 'Warm cream, nothing else',
    dark: false,
    background: `${NOISE}, radial-gradient(circle at 30% 20%, #fbf7ee, #efe6d2)`,
    text: '#2b2620',
    caret: '#8a5a2b',
    selection: 'rgba(138, 90, 43, 0.22)',
    decor: 'none',
    sound: 'brown',
  },
  {
    id: 'typewriter',
    name: 'Typewriter',
    tagline: 'Courier on a fresh sheet',
    dark: true, // the desk around the sheet is dark
    background: 'radial-gradient(ellipse at 50% 0%, #4a4540 0%, #2a2724 70%)',
    sheet: { bg: `${NOISE}, #f7f3ea`, shadow: '0 18px 50px rgba(0,0,0,0.45)' },
    text: '#1e1c1a',
    caret: '#b3261e',
    selection: 'rgba(179, 38, 30, 0.18)',
    font: '"Courier Prime", "Courier New", monospace',
    textShadow: '0 0 0.6px rgba(30, 28, 26, 0.55)',
    decor: 'none',
    sound: 'brown',
  },
  {
    id: 'candlelight',
    name: 'Candlelight',
    tagline: 'A late desk, embers rising',
    dark: true,
    background: 'radial-gradient(ellipse at 50% 115%, #6b3b14 0%, #2a170b 45%, #120a05 100%)',
    text: '#f1dfc2',
    caret: '#ffb54d',
    selection: 'rgba(255, 181, 77, 0.25)',
    decor: 'embers',
    sound: 'fire',
  },
  {
    id: 'rain',
    name: 'Rainy window',
    tagline: 'Grey afternoon, rain on glass',
    dark: true,
    background: 'linear-gradient(180deg, #2c3a47 0%, #33424f 50%, #26323d 100%)',
    text: '#e3e9ee',
    caret: '#8fc3ea',
    selection: 'rgba(143, 195, 234, 0.25)',
    decor: 'rain',
    sound: 'rain',
  },
  {
    id: 'midnight',
    name: 'Midnight',
    tagline: 'Deep blue sky, slow stars',
    dark: true,
    background: 'radial-gradient(ellipse at 50% 120%, #1d2b5a 0%, #0c1230 50%, #05081a 100%)',
    text: '#e4e8ff',
    caret: '#a9b8ff',
    selection: 'rgba(169, 184, 255, 0.25)',
    decor: 'stars',
    sound: 'wind',
  },
  {
    id: 'snow',
    name: 'Snowfall',
    tagline: 'Quiet flakes, cold blue light',
    dark: true,
    background: 'linear-gradient(180deg, #1b2a3d 0%, #2c4058 60%, #4a5f78 100%)',
    text: '#eef4fb',
    caret: '#cfe6ff',
    selection: 'rgba(207, 230, 255, 0.22)',
    decor: 'snow',
    sound: 'wind',
  },
  {
    id: 'forest',
    name: 'Forest',
    tagline: 'Green dusk and fireflies',
    dark: true,
    background: 'linear-gradient(160deg, #0f2a1f 0%, #1d4636 60%, #35603f 100%)',
    text: '#e6f0e4',
    caret: '#d7f27a',
    selection: 'rgba(215, 242, 122, 0.22)',
    decor: 'fireflies',
    sound: 'wind',
  },
  {
    id: 'ocean',
    name: 'Ocean',
    tagline: 'Sunlight through deep water',
    dark: true,
    background: 'linear-gradient(170deg, #0b2239 0%, #134a69 60%, #23708c 100%)',
    text: '#e3f4fb',
    caret: '#7fe0f0',
    selection: 'rgba(127, 224, 240, 0.22)',
    decor: 'rays',
    sound: 'waves',
  },
  {
    id: 'dusk',
    name: 'Dusk',
    tagline: 'Violet to rose, first stars',
    dark: true,
    background: 'linear-gradient(160deg, #2b1f3a 0%, #4f3a5f 55%, #9c6b62 100%)',
    text: '#f6e9ee',
    caret: '#ffc2a8',
    selection: 'rgba(255, 194, 168, 0.25)',
    decor: 'stars',
    sound: 'brown',
  },
  {
    id: 'terminal',
    name: 'Terminal',
    tagline: 'Green phosphor on black',
    dark: true,
    background: 'radial-gradient(ellipse at center, #08140b 0%, #020503 100%)',
    text: '#7dff9a',
    caret: '#b6ffc5',
    selection: 'rgba(125, 255, 154, 0.25)',
    font: '"VT323", "Courier Prime", monospace',
    textShadow: '0 0 6px rgba(125, 255, 154, 0.55)',
    decor: 'scanlines',
    sound: 'brown',
  },
];

/** The plain theme follows Light/Dark; "Your theme" follows the illustrated app theme. */
export function plainTheme(dark: boolean): FocusTheme {
  return dark
    ? { id: 'none', name: 'Plain', tagline: 'Follows light or dark', dark: true, background: '#15161c', text: '#e6e6ea', caret: '#9fa8da', selection: 'rgba(159, 168, 218, 0.3)', decor: 'none', sound: 'brown' }
    : { id: 'none', name: 'Plain', tagline: 'Follows light or dark', dark: false, background: '#ffffff', text: '#1f1f24', caret: '#3949ab', selection: 'rgba(57, 73, 171, 0.18)', decor: 'none', sound: 'brown' };
}

const SCENE_SOUND: Record<string, FocusSound> = { jungle: 'rain', ocean: 'waves', space: 'wind', library: 'fire', sakura: 'wind' };

export function sceneFocusTheme(scene: SceneSpec): FocusTheme {
  return {
    id: 'scene',
    name: scene.name,
    tagline: 'Your illustrated theme',
    dark: scene.mode === 'dark',
    background: scene.body,
    sheet: { bg: scene.page.pageBg, shadow: '0 18px 60px rgba(0,0,0,0.35)' },
    text: scene.page.pageText,
    caret: scene.primary.main,
    selection: scene.selection,
    decor: 'none',
    sound: SCENE_SOUND[scene.id] ?? 'brown',
  };
}

export function resolveFocusTheme(id: Ambient, appDark: boolean, scene: SceneSpec | null): FocusTheme {
  if (id === 'scene' && scene) return sceneFocusTheme(scene);
  if (id === 'none' || id === 'scene') return plainTheme(appDark);
  return FOCUS_THEMES.find((t) => t.id === id) ?? FOCUS_THEMES[0];
}

export const SOUND_LABELS: Record<FocusSound, string> = {
  rain: 'Rain',
  fire: 'Fireplace',
  waves: 'Waves',
  wind: 'Wind',
  brown: 'Soft noise',
};

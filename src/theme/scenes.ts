/**
 * Illustrated themes ("scenes"): Jungle, Ocean, Space, Cozy Library and
 * Sakura. Each defines its palette, fonts, inline-SVG textures (no image
 * files, so they work offline) and the page colours of the writing surface.
 * Animated decorations live in features/shell/decor.
 */
import { BAMBOO, CANOPY, JUNGLE, LEAF_PATTERN } from './jungle';

export type SceneId = 'jungle' | 'ocean' | 'space' | 'library' | 'sakura';

interface Swatch {
  main: string;
  light: string;
  dark: string;
  contrastText: string;
}

export interface SceneSpec {
  id: SceneId;
  name: string;
  tagline: string;
  /** Label for the decorations switch. */
  decorLabel: string;
  mode: 'light' | 'dark';
  primary: Swatch;
  secondary: Swatch;
  bg: string;
  paper: string;
  paperRaised: string;
  text: { primary: string; secondary: string; disabled: string };
  divider: string;
  /** "r, g, b" used for hover/selected tints and borders. */
  tint: string;
  /** Heading font (loaded in index.html). */
  displayFont: string;
  headingWeight: number;
  /** body background (layers, CSS background shorthand). */
  body: string;
  appBar: string;
  rail: string;
  dialog: string;
  page: { pageBg: string; pageText: string; sepiaBg: string; sepiaText: string };
  scrollbar: string;
  selection: string;
  tooltip: string;
  tabIndicator: string;
  /** Whiteboard canvas colour. */
  board: string;
  button: { from: string; to: string; text: string };
  /** Background for the theme picker preview. */
  preview: string;
}

const svg = (body: string, w: number, h: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`)}")`;

/** Deterministic pseudo-random numbers so textures are stable. */
function rand(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// ── Ocean ────────────────────────────────────────────────────────────────

const CAUSTICS = svg(
  (() => {
    const r = rand(7);
    let out = '';
    for (let i = 0; i < 9; i++) {
      const x = r() * 260;
      const y = r() * 260;
      const s = 20 + r() * 34;
      out += `<path d='M${x} ${y} q ${s} ${-s / 2} ${s * 1.6} ${s * 0.2} t ${s * 0.4} ${s * 1.2} t ${-s * 1.4} ${s * 0.3} t ${-s * 0.6} ${-s * 1.7}' fill='none' stroke='rgba(160,240,255,0.022)' stroke-width='1.4'/>`;
    }
    return out;
  })(),
  260,
  260,
);
const WAVES = svg(`<path d='M0 10 q 15 -8 30 0 t 30 0 t 30 0 t 30 0 V14 H0Z' fill='rgba(128,222,234,0.22)'/><path d='M0 12 q 15 -6 30 0 t 30 0 t 30 0 t 30 0' fill='none' stroke='rgba(224,247,250,0.35)' stroke-width='1'/>`, 120, 14);
const BUBBLES_TILE = svg(
  (() => {
    const r = rand(3);
    let out = '';
    for (let i = 0; i < 7; i++) out += `<circle cx='${10 + r() * 64}' cy='${r() * 200}' r='${1.5 + r() * 3.5}' fill='none' stroke='rgba(178,235,242,0.16)' stroke-width='1'/>`;
    return out;
  })(),
  84,
  200,
);

// ── Space ────────────────────────────────────────────────────────────────

const STARS = svg(
  (() => {
    const r = rand(11);
    let out = '';
    for (let i = 0; i < 70; i++) {
      const big = r() > 0.9;
      out += `<circle cx='${(r() * 320).toFixed(1)}' cy='${(r() * 320).toFixed(1)}' r='${big ? 1.3 : 0.45 + r() * 0.5}' fill='rgba(255,255,255,${(0.25 + r() * 0.6).toFixed(2)})'/>`;
    }
    return out;
  })(),
  320,
  320,
);
const STARS_SMALL = svg(
  (() => {
    const r = rand(23);
    let out = '';
    for (let i = 0; i < 18; i++) out += `<circle cx='${(r() * 160).toFixed(1)}' cy='${(r() * 60).toFixed(1)}' r='${0.4 + r() * 0.6}' fill='rgba(255,255,255,${(0.3 + r() * 0.5).toFixed(2)})'/>`;
    return out;
  })(),
  160,
  60,
);

// ── Cozy library ─────────────────────────────────────────────────────────

const SPINE_COLORS = ['#6d1f1f', '#2f4a2c', '#1f3350', '#8a5a1a', '#4a2a4a', '#5a3a22', '#7a2f1c', '#2c4a4a'];
const BOOKSHELF = svg(
  (() => {
    const r = rand(5);
    let out = '';
    let x = 2;
    while (x < 82) {
      const w = 6 + Math.floor(r() * 7);
      const h = 70 + Math.floor(r() * 34);
      const c = SPINE_COLORS[Math.floor(r() * SPINE_COLORS.length)];
      const tilt = r() > 0.88 ? 6 : 0;
      out += `<g transform='rotate(${tilt} ${x} 112)'><rect x='${x}' y='${112 - h}' width='${w}' height='${h}' fill='${c}'/><rect x='${x}' y='${112 - h + 8}' width='${w}' height='2' fill='rgba(230,190,110,0.45)'/><rect x='${x}' y='${112 - 14}' width='${w}' height='2' fill='rgba(230,190,110,0.35)'/><rect x='${x + w - 1.5}' y='${112 - h}' width='1.5' height='${h}' fill='rgba(0,0,0,0.25)'/></g>`;
      x += w + 0.5;
    }
    out += `<rect x='0' y='112' width='84' height='8' fill='#3b2618'/><rect x='0' y='112' width='84' height='1.5' fill='#6b4a2e'/>`;
    return out;
  })(),
  84,
  120,
);
const WOOD = 'repeating-linear-gradient(92deg, rgba(0,0,0,0) 0 22px, rgba(0,0,0,0.06) 22px 23px, rgba(255,220,170,0.025) 23px 47px, rgba(0,0,0,0.05) 47px 48px)';

// ── Sakura ───────────────────────────────────────────────────────────────

const petal = (x: number, y: number, rot: number, s: number, fill: string) =>
  `<g transform='translate(${x} ${y}) rotate(${rot}) scale(${s})'><path d='M0 0 C4 -6 12 -6 12 0 C12 5 6 8 0 10 C-6 8 -12 5 -12 0 C-12 -6 -4 -6 0 0Z' fill='${fill}'/></g>`;
const PETALS = svg(
  (() => {
    const r = rand(9);
    let out = '';
    for (let i = 0; i < 8; i++) out += petal(r() * 240, r() * 240, r() * 360, 0.5 + r() * 0.5, `rgba(236,128,160,${(0.07 + r() * 0.06).toFixed(2)})`);
    return out;
  })(),
  240,
  240,
);

export const SCENES: Record<SceneId, SceneSpec> = {
  jungle: {
    id: 'jungle',
    name: 'Jungle',
    tagline: 'Canopy greens & hanging vines',
    decorLabel: 'Hanging vines, foliage & fireflies',
    mode: 'dark',
    primary: { main: JUNGLE.leaf, light: '#b4e6a8', dark: '#5fa452', contrastText: '#0b1f10' },
    secondary: { main: JUNGLE.mango, light: '#ffd28a', dark: '#c98a2a', contrastText: '#2b1700' },
    bg: JUNGLE.floor,
    paper: JUNGLE.paper,
    paperRaised: JUNGLE.paperRaised,
    text: { primary: JUNGLE.cream, secondary: JUNGLE.fern, disabled: '#6f8566' },
    divider: 'rgba(170, 220, 150, 0.16)',
    tint: '139, 209, 124',
    displayFont: '"Trade Winds", "Roboto", cursive',
    headingWeight: 400,
    body: `${LEAF_PATTERN}, ${JUNGLE.floor}`,
    // The canopy leaves repeat along the top only.
    appBar: CANOPY.replace('")', '") top left repeat-x'),
    rail: BAMBOO,
    dialog: `${LEAF_PATTERN}, ${JUNGLE.paperRaised}`,
    page: { pageBg: JUNGLE.parchment, pageText: JUNGLE.parchmentInk, sepiaBg: '#efe2bf', sepiaText: '#3a2c14' },
    scrollbar: JUNGLE.moss,
    selection: 'rgba(255, 183, 77, 0.35)',
    tooltip: '#1d3d26',
    tabIndicator: JUNGLE.mango,
    board: '#10261a',
    button: { from: '#a3e093', to: '#6fb862', text: '#0b1f10' },
    preview: `${LEAF_PATTERN}, linear-gradient(160deg, #1b4228, #0a1a10)`,
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean',
    tagline: 'Deep blue, light rays & rising bubbles',
    decorLabel: 'Bubbles, kelp, fish & a jellyfish',
    mode: 'dark',
    primary: { main: '#4dd0e1', light: '#88ffff', dark: '#009faf', contrastText: '#002830' },
    secondary: { main: '#ff8a65', light: '#ffbb93', dark: '#c75b39', contrastText: '#2e0f00' },
    bg: '#061a2b',
    paper: '#0b2740',
    paperRaised: '#0e3050',
    text: { primary: '#e0f7fa', secondary: '#9cc6d4', disabled: '#5f8796' },
    divider: 'rgba(128, 222, 234, 0.16)',
    tint: '77, 208, 225',
    displayFont: '"Fredoka", "Roboto", sans-serif',
    headingWeight: 600,
    body: `${CAUSTICS}, linear-gradient(180deg, #0a2b45 0%, #061a2b 55%, #031220 100%)`,
    appBar: `${WAVES} bottom left / 120px 14px repeat-x, linear-gradient(180deg, #0d3a5c 0%, #0a2b45 100%)`,
    rail: `${BUBBLES_TILE}, linear-gradient(180deg, #0d3556 0%, #082238 100%)`,
    dialog: `${CAUSTICS}, #0e3050`,
    page: { pageBg: '#eef6f5', pageText: '#0d2a3d', sepiaBg: '#f0e6cf', sepiaText: '#3a2e1c' },
    scrollbar: '#1f5a7a',
    selection: 'rgba(255, 138, 101, 0.35)',
    tooltip: '#0f3556',
    tabIndicator: '#ff8a65',
    board: '#082236',
    button: { from: '#80deea', to: '#26c6da', text: '#002830' },
    preview: `${CAUSTICS}, linear-gradient(180deg, #11507a, #061a2b)`,
  },
  space: {
    id: 'space',
    name: 'Space',
    tagline: 'Starfields, nebulae & a ringed planet',
    decorLabel: 'Twinkling stars, shooting stars & a planet',
    mode: 'dark',
    primary: { main: '#b388ff', light: '#e7b9ff', dark: '#805acb', contrastText: '#1a0b33' },
    secondary: { main: '#ffd54f', light: '#ffff81', dark: '#c8a415', contrastText: '#2a2000' },
    bg: '#05060f',
    paper: '#0e1124',
    paperRaised: '#141834',
    text: { primary: '#e8eaf6', secondary: '#a9aed3', disabled: '#6a6f96' },
    divider: 'rgba(179, 136, 255, 0.16)',
    tint: '179, 136, 255',
    displayFont: '"Orbitron", "Roboto", sans-serif',
    headingWeight: 600,
    body: `${STARS}, radial-gradient(ellipse at 12% 18%, rgba(124, 77, 255, 0.20), transparent 50%), radial-gradient(ellipse at 88% 78%, rgba(0, 229, 255, 0.10), transparent 45%), radial-gradient(ellipse at 60% 40%, rgba(255, 64, 129, 0.06), transparent 40%), #05060f`,
    appBar: `${STARS_SMALL}, linear-gradient(90deg, #0b0d22 0%, #171a3a 50%, #0b0d22 100%)`,
    rail: `${STARS_SMALL}, linear-gradient(180deg, #11142c 0%, #070816 100%)`,
    dialog: `${STARS}, #141834`,
    page: { pageBg: '#131730', pageText: '#e6e8ff', sepiaBg: '#ece2c8', sepiaText: '#3a2e1c' },
    scrollbar: '#3a3f73',
    selection: 'rgba(255, 213, 79, 0.30)',
    tooltip: '#1c2047',
    tabIndicator: '#ffd54f',
    board: '#0a0c1d',
    button: { from: '#d1b3ff', to: '#9c6bff', text: '#1a0b33' },
    preview: `${STARS}, radial-gradient(ellipse at 30% 30%, rgba(124, 77, 255, 0.45), transparent 60%), #05060f`,
  },
  library: {
    id: 'library',
    name: 'Cozy Library',
    tagline: 'Warm wood, old books & candlelight',
    decorLabel: 'Candle, book stack, sleepy cat & dust motes',
    mode: 'dark',
    primary: { main: '#e0b973', light: '#ffeba3', dark: '#ac8945', contrastText: '#2a1b06' },
    secondary: { main: '#e07a6a', light: '#ffab98', dark: '#a94b3f', contrastText: '#2e0b06' },
    bg: '#1e1410',
    paper: '#2a1d16',
    paperRaised: '#33241b',
    text: { primary: '#f3e6d0', secondary: '#c8b394', disabled: '#8a7660' },
    divider: 'rgba(224, 185, 115, 0.16)',
    tint: '224, 185, 115',
    displayFont: '"Cormorant Garamond", "EB Garamond", serif',
    headingWeight: 600,
    body: `radial-gradient(ellipse at 50% -10%, rgba(255, 190, 110, 0.10), transparent 60%), ${WOOD}, linear-gradient(180deg, #24180f 0%, #1a110c 100%)`,
    appBar: `${WOOD}, linear-gradient(180deg, #3a2618 0%, #2a1b12 100%)`,
    rail: `linear-gradient(90deg, rgba(26, 17, 12, 0.55), rgba(26, 17, 12, 0.35), rgba(26, 17, 12, 0.55)), ${BOOKSHELF}`,
    dialog: `${WOOD}, #33241b`,
    page: { pageBg: '#f5ecd7', pageText: '#3b2a1a', sepiaBg: '#efdfba', sepiaText: '#3a2a14' },
    scrollbar: '#6b4a2e',
    selection: 'rgba(224, 185, 115, 0.35)',
    tooltip: '#3a2819',
    tabIndicator: '#e0b973',
    board: '#2a1d16',
    button: { from: '#f0cf8e', to: '#c9a05a', text: '#2a1b06' },
    preview: `linear-gradient(90deg, rgba(26,17,12,0.25), rgba(26,17,12,0.25)), ${BOOKSHELF}, #2a1b12`,
  },
  sakura: {
    id: 'sakura',
    name: 'Sakura',
    tagline: 'Cherry blossoms & drifting petals (light)',
    decorLabel: 'Blossoming branch & falling petals',
    mode: 'light',
    primary: { main: '#c2185b', light: '#fa5788', dark: '#8c0032', contrastText: '#ffffff' },
    secondary: { main: '#558b2f', light: '#85bb5c', dark: '#255d00', contrastText: '#ffffff' },
    bg: '#fff4f6',
    paper: '#ffffff',
    paperRaised: '#fffafb',
    text: { primary: '#3a2a30', secondary: '#7a5a66', disabled: '#b8a0aa' },
    divider: 'rgba(194, 24, 91, 0.12)',
    tint: '194, 24, 91',
    displayFont: '"Kaisei Decol", "Merriweather", serif',
    headingWeight: 500,
    body: `${PETALS}, linear-gradient(180deg, #fff0f4 0%, #fff8f6 100%)`,
    appBar: `${PETALS}, linear-gradient(180deg, #ffe4ec 0%, #fff4f6 100%)`,
    rail: `${PETALS}, linear-gradient(180deg, #ffe9ef 0%, #fff6f2 100%)`,
    dialog: `${PETALS}, #fffafb`,
    page: { pageBg: '#fffdfc', pageText: '#3a2a30', sepiaBg: '#f6ecd9', sepiaText: '#433422' },
    scrollbar: '#f0a6bf',
    selection: 'rgba(240, 98, 146, 0.25)',
    tooltip: '#5c2a3d',
    tabIndicator: '#c2185b',
    board: '#fffafb',
    button: { from: '#e04683', to: '#c2185b', text: '#ffffff' },
    preview: `${PETALS}, linear-gradient(160deg, #ffd6e2, #fff6f2)`,
  },
};

export const SCENE_LIST: SceneSpec[] = Object.values(SCENES);

export function sceneOf(themeMode: string): SceneSpec | null {
  return (SCENES as Record<string, SceneSpec>)[themeMode] ?? null;
}

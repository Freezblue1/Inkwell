/**
 * Jungle theme assets: palette values and tiny inline SVG textures
 * (no image files, so they work offline and in the PWA).
 */

export const JUNGLE = {
  canopy: '#0a1a10',
  floor: '#0d1f14',
  paper: '#142c1c',
  paperRaised: '#183522',
  leaf: '#8bd17c',
  leafDark: '#3f7d3a',
  moss: '#2f6b3a',
  vine: '#3d6b2e',
  mango: '#ffb74d',
  hibiscus: '#ff6f61',
  cream: '#eaf3dc',
  fern: '#b7c9a8',
  parchment: '#f3ead0',
  parchmentInk: '#2b2416',
};

const svg = (body: string, w: number, h: number) =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}' viewBox='0 0 ${w} ${h}'>${body}</svg>`)}")`;

const leaf = (x: number, y: number, r: number, s: number, fill: string) =>
  `<g transform='translate(${x} ${y}) rotate(${r}) scale(${s})'><path d='M0 0 C10 -14 34 -14 46 0 C34 14 10 14 0 0Z' fill='${fill}'/><path d='M2 0 L44 0' stroke='${fill}' stroke-opacity='.5' stroke-width='1.2'/></g>`;

/** Faint scattered leaves for the jungle floor (page background). */
export const LEAF_PATTERN = svg(
  [
    leaf(20, 40, -30, 1, 'rgba(139,209,124,0.06)'),
    leaf(130, 30, 40, 0.8, 'rgba(139,209,124,0.05)'),
    leaf(70, 120, 150, 1.2, 'rgba(139,209,124,0.045)'),
    leaf(170, 150, -70, 0.9, 'rgba(139,209,124,0.06)'),
    leaf(30, 190, 20, 0.7, 'rgba(255,183,77,0.035)'),
    leaf(150, 210, 110, 0.6, 'rgba(139,209,124,0.05)'),
  ].join(''),
  220,
  240,
);

/** Bamboo stalk texture for the navigation rail. */
export const BAMBOO = [
  'repeating-linear-gradient(180deg, transparent 0 118px, rgba(10,26,16,0.55) 118px 121px, rgba(139,209,124,0.18) 121px 123px)',
  'linear-gradient(90deg, #12301c 0%, #1b4228 18%, #23542f 50%, #1b4228 82%, #12301c 100%)',
].join(', ');

/** Dense canopy for the app bar. */
export const CANOPY = [
  svg(
    [
      leaf(-6, 8, 20, 0.9, '#1d4a2a'),
      leaf(30, 2, -15, 1.1, '#24592f'),
      leaf(70, 10, 30, 0.8, '#1a4226'),
      leaf(100, 0, -35, 1, '#2a6535'),
      leaf(140, 9, 10, 0.9, '#1f4f2b'),
    ].join(''),
    180,
    26,
  ),
  'linear-gradient(180deg, #0a1a10 0%, #12301c 100%)',
].join(', ');

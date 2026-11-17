/**
 * Jungle decorations: vines hanging from the top of the window, a leafy
 * canopy fringe, foliage in the bottom corners and a few fireflies.
 * Purely decorative: pointer-events are off, hidden from assistive tech,
 * and the swaying stops when the user prefers reduced motion.
 */
import { memo, useMemo } from 'react';
import { Box, GlobalStyles, useMediaQuery } from '@mui/material';
import { JUNGLE } from '@/theme/jungle';
import { pointsToPath } from '@/lib/whiteboard';

interface VineSpec {
  /** CSS left or right position. */
  left?: string;
  right?: string;
  length: number;
  seed: number;
  flower?: boolean;
  duration: number;
  delay: number;
  scale?: number;
}

/*
 * Placement keeps controls readable: long vines hug the outer window edges,
 * and the short ones hang in the empty middle stretch of the app bar
 * (between the project title and the search box).
 */
const VINES: VineSpec[] = [
  { left: '-16px', length: 320, seed: 1, duration: 7, delay: 0 },
  { left: '30%', length: 46, seed: 4, duration: 7.5, delay: -3, scale: 0.8 },
  { left: '37%', length: 30, seed: 5, duration: 6.8, delay: -4, scale: 0.7 },
  { left: '44%', length: 52, seed: 6, flower: true, duration: 8, delay: -1.5, scale: 0.8 },
  { left: '52%', length: 34, seed: 7, duration: 7.2, delay: -2.5, scale: 0.7 },
  { right: '-16px', length: 340, seed: 10, flower: true, duration: 7.8, delay: -1.2 },
];

/** Deterministic pseudo-random numbers so vines look the same every render. */
function rand(seed: number) {
  let s = seed * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const LEAF_SHADES = ['#3f7d3a', '#4f9444', '#2f6b3a', '#5aa64c', '#376f32'];

const Vine = memo(function Vine({ spec }: { spec: VineSpec }) {
  const { path, leaves, tipX } = useMemo(() => {
    const r = rand(spec.seed);
    const amp = 5 + r() * 6;
    const freq = 0.025 + r() * 0.02;
    const phase = r() * Math.PI * 2;
    const xAt = (y: number) => 24 + Math.sin(y * freq + phase) * amp;
    const pts: [number, number][] = [];
    for (let y = 0; y <= spec.length; y += 6) pts.push([xAt(y), y]);
    const leaves: { x: number; y: number; rot: number; s: number; fill: string }[] = [];
    let side = r() > 0.5 ? 1 : -1;
    for (let y = 14 + r() * 8; y < spec.length - 4; y += 15 + r() * 12) {
      leaves.push({ x: xAt(y), y, rot: side * (35 + r() * 30) + (side > 0 ? 0 : 180), s: 0.55 + r() * 0.45, fill: LEAF_SHADES[Math.floor(r() * LEAF_SHADES.length)] });
      side = -side;
    }
    return { path: pointsToPath(pts), leaves, tipX: xAt(spec.length) };
  }, [spec]);

  const w = 48;
  return (
    <Box
      component="svg"
      viewBox={`0 0 ${w} ${spec.length + 22}`}
      width={w * (spec.scale ?? 1)}
      height={(spec.length + 22) * (spec.scale ?? 1)}
      sx={{
        position: 'absolute',
        top: -2,
        left: spec.left,
        right: spec.right,
        overflow: 'visible',
        transformOrigin: 'top center',
        animation: `ink-vine-sway ${spec.duration}s ease-in-out ${spec.delay}s infinite`,
        filter: 'drop-shadow(0 3px 3px rgba(0,0,0,0.35))',
      }}
    >
      <path d={path} fill="none" stroke={JUNGLE.vine} strokeWidth={3.2} strokeLinecap="round" />
      <path d={path} fill="none" stroke="#5c8f3e" strokeWidth={1} strokeLinecap="round" opacity={0.6} />
      {leaves.map((l, i) => (
        <g key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.rot}) scale(${l.s})`}>
          <path d="M0 0 C6 -9 20 -10 28 0 C20 10 6 9 0 0Z" fill={l.fill} />
          <path d="M1 0 L26 0" stroke="#1f4a22" strokeWidth={0.9} opacity={0.7} />
        </g>
      ))}
      {spec.flower ? (
        <g transform={`translate(${tipX} ${spec.length + 6})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx={0} cy={-6} rx={4.2} ry={7} fill={JUNGLE.hibiscus} transform={`rotate(${a})`} />
          ))}
          <circle r={2.6} fill={JUNGLE.mango} />
        </g>
      ) : (
        <path d={`M${tipX} ${spec.length} q 6 6 0 10 q -5 -3 -1 -6`} fill="none" stroke={JUNGLE.vine} strokeWidth={2} strokeLinecap="round" />
      )}
    </Box>
  );
});

/** Leafy fringe along the very top edge. */
function CanopyFringe() {
  const leaves = useMemo(() => {
    const r = rand(42);
    return Array.from({ length: 40 }, (_, i) => ({ x: i * 2.6 + r() * 2, rot: 60 + r() * 60, s: 0.6 + r() * 0.5, fill: LEAF_SHADES[Math.floor(r() * LEAF_SHADES.length)] }));
  }, []);
  return (
    <Box component="svg" viewBox="0 0 104 8" preserveAspectRatio="none" sx={{ position: 'absolute', top: 0, left: 0, width: '100%', height: 14 }}>
      {leaves.map((l, i) => (
        <g key={i} transform={`translate(${l.x} -1) rotate(${l.rot}) scale(${l.s * 0.22} ${l.s * 0.3})`}>
          <path d="M0 0 C6 -9 20 -10 28 0 C20 10 6 9 0 0Z" fill={l.fill} />
        </g>
      ))}
    </Box>
  );
}

/** A cluster of big tropical leaves for a bottom corner. */
function Foliage({ side }: { side: 'left' | 'right' }) {
  const leaves = [
    { rot: -70, s: 1.25, fill: '#24552d' },
    { rot: -45, s: 1.05, fill: '#2f6b3a' },
    { rot: -20, s: 0.9, fill: '#3f7d3a' },
    { rot: -95, s: 0.85, fill: '#1d4626' },
  ];
  return (
    <Box
      component="svg"
      viewBox="0 0 160 160"
      sx={{ position: 'absolute', bottom: -10, [side]: -10, width: { xs: 90, md: 150 }, height: { xs: 90, md: 150 }, opacity: 0.55, transform: side === 'right' ? 'scaleX(-1)' : undefined }}
    >
      {leaves.map((l, i) => (
        <g key={i} transform={`translate(8 158) rotate(${l.rot}) scale(${l.s})`}>
          <path d="M0 0 C22 -34 88 -40 120 0 C88 40 22 34 0 0Z" fill={l.fill} />
          <path d="M2 0 L116 0" stroke="#163a1d" strokeWidth={2} />
          {[20, 40, 60, 80, 100].map((x) => (
            <path key={x} d={`M${x} 0 L${x + 14} -${18 - x / 10} M${x} 0 L${x + 14} ${18 - x / 10}`} stroke="#163a1d" strokeWidth={1.2} opacity={0.7} />
          ))}
        </g>
      ))}
    </Box>
  );
}

const FIREFLIES = [
  { left: '12%', top: '70%', d: 9, delay: 0 },
  { left: '82%', top: '62%', d: 11, delay: -3 },
  { left: '55%', top: '85%', d: 10, delay: -6 },
  { left: '30%', top: '40%', d: 13, delay: -2 },
  { left: '92%', top: '30%', d: 12, delay: -8 },
];

export function JungleDecor() {
  const mobile = useMediaQuery('(max-width:599px)');
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  // On phones, only the two edge vines.
  const vines = mobile ? VINES.filter((v) => v.length > 100) : VINES;
  return (
    <Box aria-hidden sx={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 1150, overflow: 'hidden' }}>
      <GlobalStyles
        styles={{
          '@keyframes ink-vine-sway': { '0%': { transform: 'rotate(-1.8deg)' }, '50%': { transform: 'rotate(1.8deg)' }, '100%': { transform: 'rotate(-1.8deg)' } },
          '@keyframes ink-firefly': {
            '0%': { transform: 'translate(0, 0)', opacity: 0 },
            '20%': { opacity: 0.9 },
            '50%': { transform: 'translate(30px, -40px)', opacity: 0.4 },
            '80%': { opacity: 0.9 },
            '100%': { transform: 'translate(-20px, -80px)', opacity: 0 },
          },
        }}
      />
      <CanopyFringe />
      <Box sx={reduced ? { '& svg': { animation: 'none !important' } } : undefined}>
        {vines.map((v) => (
          <Vine key={v.seed} spec={v} />
        ))}
      </Box>
      {!mobile && (
        <>
          <Foliage side="left" />
          <Foliage side="right" />
        </>
      )}
      {!reduced &&
        FIREFLIES.map((f, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              left: f.left,
              top: f.top,
              width: 5,
              height: 5,
              borderRadius: '50%',
              bgcolor: '#f6f7a8',
              boxShadow: '0 0 8px 3px rgba(246, 247, 168, 0.55)',
              animation: `ink-firefly ${f.d}s ease-in-out ${f.delay}s infinite`,
            }}
          />
        ))}
    </Box>
  );
}

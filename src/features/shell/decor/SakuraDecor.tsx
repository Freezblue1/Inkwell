/**
 * Sakura decorations: a blossoming cherry branch rising from the bottom
 * right corner (clear of the toolbar buttons), petals drifting down across
 * the window, and a faint distant mountain on the horizon.
 */
import { memo, useMemo } from 'react';
import { Box } from '@mui/material';
import { DecorLayer, rand, useDecorEnv } from './shared';

const KEYFRAMES = {
  '@keyframes ink-petal-fall': {
    '0%': { transform: 'translate(0, -8vh) rotate(0deg)', opacity: 0 },
    '8%': { opacity: 0.9 },
    '50%': { transform: 'translate(-12vw, 50vh) rotate(220deg)' },
    '92%': { opacity: 0.8 },
    '100%': { transform: 'translate(-22vw, 108vh) rotate(420deg)', opacity: 0 },
  },
  '@keyframes ink-petal-flutter': { '0%': { transform: 'rotateX(0deg) rotateY(0deg)' }, '100%': { transform: 'rotateX(60deg) rotateY(40deg)' } },
  '@keyframes ink-branch': { '0%': { transform: 'rotate(0deg)' }, '50%': { transform: 'rotate(-1.4deg)' }, '100%': { transform: 'rotate(0deg)' } },
};

const PETAL_PATH = 'M0 0 C4 -6 12 -6 12 0 C12 5 6 8 0 10 C-6 8 -12 5 -12 0 C-12 -6 -4 -6 0 0Z';

function Blossom({ x, y, s, rot }: { x: number; y: number; s: number; rot: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${s})`}>
      {[0, 72, 144, 216, 288].map((a) => (
        <path key={a} d="M0 0 C-5 -6 -5 -14 0 -16 C5 -14 5 -6 0 0Z" fill="#f8bbd0" stroke="#f48fb1" strokeWidth={0.6} transform={`rotate(${a})`} />
      ))}
      <circle r={2.6} fill="#fff59d" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <circle key={a} cx={4.5 * Math.cos((a * Math.PI) / 180)} cy={4.5 * Math.sin((a * Math.PI) / 180)} r={0.8} fill="#c2185b" />
      ))}
    </g>
  );
}

const Branch = memo(function Branch() {
  const blossoms = useMemo(() => {
    const r = rand(29);
    const spots: [number, number][] = [
      [40, 30], [70, 44], [96, 40], [122, 58], [150, 56], [176, 74], [204, 70], [128, 30], [160, 32], [228, 86], [250, 96], [104, 70], [190, 100], [214, 112], [60, 64],
    ];
    return spots.map(([x, y]) => ({ x: x + r() * 6, y: y + r() * 6, s: 0.6 + r() * 0.5, rot: r() * 360 }));
  }, []);
  return (
    <Box
      component="svg"
      viewBox="0 0 280 140"
      sx={{
        position: 'absolute',
        bottom: -6,
        right: -10,
        width: { xs: 150, md: 270 },
        height: { xs: 75, md: 135 },
        opacity: 0.92,
        transformOrigin: 'bottom right',
        animation: 'ink-branch 10s ease-in-out infinite',
        filter: 'drop-shadow(0 2px 2px rgba(120, 40, 70, 0.18))',
      }}
    >
      <g transform="translate(0 140) scale(1 -1)">
      <path d="M280 6 C220 14 180 26 140 42 C110 54 70 60 30 34" fill="none" stroke="#5d4037" strokeWidth={6} strokeLinecap="round" />
      <path d="M180 28 C200 50 220 80 252 98" fill="none" stroke="#5d4037" strokeWidth={4} strokeLinecap="round" />
      <path d="M140 42 C150 58 170 80 214 112" fill="none" stroke="#6d4c41" strokeWidth={3} strokeLinecap="round" />
      <path d="M100 52 C104 60 104 66 100 74" fill="none" stroke="#6d4c41" strokeWidth={2} strokeLinecap="round" />
      {blossoms.map((b, i) => (
        <Blossom key={i} {...b} />
      ))}
      {[[84, 52], [138, 46], [196, 64]].map(([x, y], i) => (
        <path key={i} d={`M${x} ${y} c 4 -8 12 -8 14 -2 c -6 2 -10 4 -14 2Z`} fill="#8bc34a" opacity={0.85} />
      ))}
      </g>
    </Box>
  );
});

function Petals({ count }: { count: number }) {
  const petals = useMemo(() => {
    const r = rand(41);
    return Array.from({ length: count }, () => ({ left: `${20 + r() * 90}%`, size: 0.5 + r() * 0.5, d: 14 + r() * 12, delay: -r() * 26, flutter: 1.5 + r() * 2, shade: r() > 0.5 ? '#f8bbd0' : '#f48fb1' }));
  }, [count]);
  return (
    <>
      {petals.map((p, i) => (
        <Box key={i} sx={{ position: 'absolute', left: p.left, top: 0, animation: `ink-petal-fall ${p.d}s linear ${p.delay}s infinite` }}>
          <Box component="svg" viewBox="-13 -7 26 18" sx={{ width: 22 * p.size, height: 16 * p.size, overflow: 'visible', animation: `ink-petal-flutter ${p.flutter}s ease-in-out infinite alternate` }}>
            <path d={PETAL_PATH} fill={p.shade} opacity={0.85} />
          </Box>
        </Box>
      ))}
    </>
  );
}

function Mountain() {
  return (
    <Box component="svg" viewBox="0 0 400 80" preserveAspectRatio="none" sx={{ position: 'absolute', left: 0, right: 0, bottom: 0, width: '100%', height: { xs: 40, md: 70 }, opacity: 0.35 }}>
      <path d="M0 80 L0 66 C60 60 110 56 150 40 L190 14 C196 10 204 10 210 14 L250 40 C290 56 340 60 400 64 L400 80Z" fill="#f3c6d4" />
      <path d="M190 14 C196 10 204 10 210 14 L222 22 C214 20 206 26 200 22 C194 26 186 20 178 22Z" fill="#ffffff" />
    </Box>
  );
}

export function SakuraDecor() {
  const { mobile, reduced } = useDecorEnv();
  return (
    <DecorLayer keyframes={KEYFRAMES} reduced={reduced}>
      <Mountain />
      <Branch />
      <Petals count={mobile ? 6 : 16} />
    </DecorLayer>
  );
}

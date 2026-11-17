/**
 * Ocean decorations: sun rays from the surface, bubbles rising, kelp swaying
 * in the bottom corners, a little school of fish and a drifting jellyfish.
 */
import { memo, useMemo } from 'react';
import { Box } from '@mui/material';
import { DecorLayer, rand, useDecorEnv } from './shared';

const KEYFRAMES = {
  '@keyframes ink-ray': { '0%': { opacity: 0.35 }, '100%': { opacity: 1 } },
  '@keyframes ink-bubble-rise': { '0%': { transform: 'translateY(0)', opacity: 0 }, '8%': { opacity: 0.9 }, '90%': { opacity: 0.7 }, '100%': { transform: 'translateY(-112vh)', opacity: 0 } },
  '@keyframes ink-bubble-wobble': { '0%': { transform: 'translateX(-6px)' }, '100%': { transform: 'translateX(6px)' } },
  '@keyframes ink-kelp': { '0%': { transform: 'rotate(-3deg)' }, '50%': { transform: 'rotate(3deg)' }, '100%': { transform: 'rotate(-3deg)' } },
  '@keyframes ink-school': { '0%': { transform: 'translateX(-20vw)' }, '100%': { transform: 'translateX(120vw)' } },
  '@keyframes ink-fish-bob': { '0%': { transform: 'translateY(0)' }, '100%': { transform: 'translateY(-5px)' } },
  '@keyframes ink-jelly': { '0%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-46px)' }, '100%': { transform: 'translateY(0)' } },
  '@keyframes ink-jelly-pulse': { '0%': { transform: 'scale(1, 1)' }, '50%': { transform: 'scale(1.08, 0.9)' }, '100%': { transform: 'scale(1, 1)' } },
};

const RAYS = [
  { left: '6%', w: 110, d: 9, delay: 0 },
  { left: '18%', w: 70, d: 11, delay: -4 },
  { left: '78%', w: 90, d: 10, delay: -2 },
  { left: '90%', w: 130, d: 12, delay: -6 },
];

function Bubbles({ count }: { count: number }) {
  const bubbles = useMemo(() => {
    const r = rand(17);
    return Array.from({ length: count }, () => ({ left: `${r() * 100}%`, size: 4 + r() * 12, d: 12 + r() * 14, delay: -r() * 26, wobble: 2.5 + r() * 2 }));
  }, [count]);
  return (
    <>
      {bubbles.map((b, i) => (
        <Box key={i} sx={{ position: 'absolute', left: b.left, bottom: -20, animation: `ink-bubble-rise ${b.d}s linear ${b.delay}s infinite` }}>
          <Box
            sx={{
              width: b.size,
              height: b.size,
              borderRadius: '50%',
              border: '1px solid rgba(224, 247, 250, 0.55)',
              background: 'radial-gradient(circle at 32% 30%, rgba(255,255,255,0.75) 0 14%, rgba(178,235,242,0.16) 40%, transparent 72%)',
              animation: `ink-bubble-wobble ${b.wobble}s ease-in-out infinite alternate`,
            }}
          />
        </Box>
      ))}
    </>
  );
}

const Kelp = memo(function Kelp({ side }: { side: 'left' | 'right' }) {
  const fronds = useMemo(() => {
    const r = rand(side === 'left' ? 31 : 37);
    return Array.from({ length: 5 }, (_, i) => {
      const h = 90 + r() * 120;
      const x = 14 + i * 22 + r() * 8;
      const amp = 6 + r() * 6;
      let d = `M${x} 230`;
      for (let y = 230; y > 230 - h; y -= 18) d += ` Q ${x + (((230 - y) / 18) % 2 ? amp : -amp)} ${y - 9} ${x} ${y - 18}`;
      const leaves: string[] = [];
      for (let y = 220; y > 230 - h + 10; y -= 22) {
        const dir = Math.round((230 - y) / 22) % 2 ? 1 : -1;
        leaves.push(`M${x} ${y} q ${dir * 16} -6 ${dir * 18} -18 q ${-dir * 10} 6 ${-dir * 18} 18`);
      }
      return { d, leaves, fill: ['#1b5e4a', '#2e7d5b', '#23684f', '#3c8d6e'][i % 4], dur: 6 + r() * 3, delay: -r() * 6 };
    });
  }, [side]);
  return (
    <Box
      component="svg"
      viewBox="0 0 140 230"
      sx={{ position: 'absolute', bottom: -6, [side]: -6, width: { xs: 80, md: 140 }, height: { xs: 130, md: 230 }, opacity: 0.6, transform: side === 'right' ? 'scaleX(-1)' : undefined }}
    >
      {fronds.map((f, i) => (
        <g key={i} style={{ transformOrigin: 'bottom center', transformBox: 'fill-box', animation: `ink-kelp ${f.dur}s ease-in-out ${f.delay}s infinite` }}>
          <path d={f.d} fill="none" stroke={f.fill} strokeWidth={4} strokeLinecap="round" />
          {f.leaves.map((l, k) => (
            <path key={k} d={l} fill={f.fill} opacity={0.9} />
          ))}
        </g>
      ))}
    </Box>
  );
});

function Fish({ color, delay }: { color: string; delay: number }) {
  return (
    <Box component="svg" viewBox="0 0 30 16" sx={{ width: 26, height: 14, animation: `ink-fish-bob 1.6s ease-in-out ${delay}s infinite alternate` }}>
      <path d="M2 8 C8 1 18 1 24 8 C18 15 8 15 2 8Z" fill={color} />
      <path d="M22 8 L30 2 L28 8 L30 14Z" fill={color} />
      <circle cx="8" cy="7" r="1.3" fill="#06202f" />
    </Box>
  );
}

function School() {
  const fish = [
    { x: 0, y: 0, c: '#ffb74d' },
    { x: 30, y: -12, c: '#ffa726' },
    { x: 34, y: 14, c: '#ffb74d' },
    { x: 64, y: 2, c: '#ff8a65' },
    { x: 62, y: -20, c: '#ffcc80' },
  ];
  return (
    <Box sx={{ position: 'absolute', bottom: '13%', left: 0, opacity: 0.55, animation: 'ink-school 52s linear -18s infinite' }}>
      {fish.map((f, i) => (
        <Box key={i} sx={{ position: 'absolute', left: -f.x, top: f.y, transform: 'scaleX(-1)' }}>
          <Fish color={f.c} delay={-i * 0.3} />
        </Box>
      ))}
    </Box>
  );
}

function Jellyfish() {
  return (
    <Box sx={{ position: 'absolute', right: 120, bottom: '24%', opacity: 0.35, animation: 'ink-jelly 15s ease-in-out infinite', filter: 'drop-shadow(0 0 10px rgba(244, 143, 177, 0.6))' }}>
      <Box component="svg" viewBox="0 0 60 100" sx={{ width: { xs: 36, md: 52 }, height: { xs: 60, md: 86 }, overflow: 'visible' }}>
        <g style={{ transformOrigin: '30px 18px', animation: 'ink-jelly-pulse 3.2s ease-in-out infinite' }}>
          <path d="M4 24 C4 4 56 4 56 24 C50 28 44 22 38 27 C32 22 28 22 22 27 C16 22 10 28 4 24Z" fill="#f8bbd0" />
          <path d="M12 18 C16 10 44 10 48 18" fill="none" stroke="#fce4ec" strokeWidth={2} opacity={0.7} />
        </g>
        {[14, 24, 34, 46].map((x, i) => (
          <path key={x} d={`M${x} 27 q ${i % 2 ? 6 : -6} 14 0 26 q ${i % 2 ? -6 : 6} 12 0 24 q ${i % 2 ? 4 : -4} 10 0 18`} fill="none" stroke="#f48fb1" strokeWidth={1.6} strokeLinecap="round" />
        ))}
      </Box>
    </Box>
  );
}

export function OceanDecor() {
  const { mobile, reduced } = useDecorEnv();
  return (
    <DecorLayer keyframes={KEYFRAMES} reduced={reduced}>
      {!mobile &&
        RAYS.map((r, i) => (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              top: '-10%',
              left: r.left,
              width: r.w,
              height: '120vh',
              background: 'linear-gradient(180deg, rgba(178, 235, 242, 0.09), rgba(178, 235, 242, 0.02) 55%, transparent 75%)',
              transform: 'rotate(16deg)',
              transformOrigin: 'top center',
              filter: 'blur(6px)',
              animation: `ink-ray ${r.d}s ease-in-out ${r.delay}s infinite alternate`,
            }}
          />
        ))}
      <Bubbles count={mobile ? 7 : 16} />
      <Kelp side="left" />
      <Kelp side="right" />
      {!mobile && <School />}
      {!mobile && <Jellyfish />}
    </DecorLayer>
  );
}

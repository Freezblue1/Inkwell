/**
 * Cozy Library decorations: a brass pendant lamp glowing in the app bar,
 * a flickering candle, a stack of old books with a sleeping cat (tail
 * swishing) and dust motes drifting in the warm light.
 */
import { useMemo } from 'react';
import { Box } from '@mui/material';
import { DecorLayer, rand, useDecorEnv } from './shared';

const KEYFRAMES = {
  '@keyframes ink-flame': {
    '0%': { transform: 'scale(1, 1) skewX(0deg)' },
    '25%': { transform: 'scale(0.94, 1.06) skewX(-3deg)' },
    '50%': { transform: 'scale(1.04, 0.95) skewX(2deg)' },
    '75%': { transform: 'scale(0.97, 1.04) skewX(-1deg)' },
    '100%': { transform: 'scale(1, 1) skewX(0deg)' },
  },
  '@keyframes ink-glow': { '0%': { opacity: 0.55 }, '100%': { opacity: 0.85 } },
  '@keyframes ink-lamp': { '0%': { transform: 'rotate(-1.5deg)' }, '50%': { transform: 'rotate(1.5deg)' }, '100%': { transform: 'rotate(-1.5deg)' } },
  '@keyframes ink-mote': {
    '0%': { transform: 'translate(0, 0)', opacity: 0 },
    '15%': { opacity: 0.7 },
    '50%': { transform: 'translate(24px, -36px)', opacity: 0.45 },
    '85%': { opacity: 0.7 },
    '100%': { transform: 'translate(-14px, -80px)', opacity: 0 },
  },
  '@keyframes ink-tail': { '0%': { transform: 'rotate(-8deg)' }, '50%': { transform: 'rotate(10deg)' }, '100%': { transform: 'rotate(-8deg)' } },
  '@keyframes ink-breathe': { '0%': { transform: 'scaleY(1)' }, '50%': { transform: 'scaleY(1.04)' }, '100%': { transform: 'scaleY(1)' } },
};

function PendantLamp() {
  return (
    <Box sx={{ position: 'absolute', top: 0, left: '38.5%', transformOrigin: 'top center', animation: 'ink-lamp 9s ease-in-out infinite' }}>
      <Box component="svg" viewBox="0 0 40 70" sx={{ width: 34, height: 60, overflow: 'visible' }}>
        <line x1="20" y1="0" x2="20" y2="30" stroke="#8a6a3e" strokeWidth={1.5} strokeDasharray="2 2" />
        <path d="M8 44 Q20 26 32 44 Z" fill="#b8893f" />
        <path d="M8 44 Q20 30 32 44" fill="none" stroke="#e8c27a" strokeWidth={1} />
        <ellipse cx="20" cy="45" rx="6" ry="3" fill="#fff3c4" />
      </Box>
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          top: 44,
          width: 160,
          height: 120,
          transform: 'translateX(-50%)',
          background: 'radial-gradient(ellipse at 50% 0%, rgba(255, 214, 140, 0.20), transparent 70%)',
          animation: 'ink-glow 4s ease-in-out infinite alternate',
        }}
      />
    </Box>
  );
}

function Candle() {
  return (
    <Box sx={{ position: 'absolute', left: { xs: 6, sm: 92 }, bottom: 0, width: 70, height: 140 }}>
      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          top: -40,
          width: 220,
          height: 220,
          transform: 'translateX(-50%)',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 190, 100, 0.22), transparent 65%)',
          animation: 'ink-glow 1.7s ease-in-out infinite alternate',
        }}
      />
      <Box component="svg" viewBox="0 0 70 140" sx={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {/* holder */}
        <ellipse cx="35" cy="132" rx="30" ry="6" fill="#7a5a2e" />
        <path d="M12 130 Q35 120 58 130 L54 134 Q35 128 16 134Z" fill="#a8803f" />
        <path d="M58 128 q 12 -4 10 6 q -2 6 -10 2" fill="none" stroke="#a8803f" strokeWidth={3} />
        {/* candle */}
        <rect x="25" y="62" width="20" height="64" rx="3" fill="#f3e6c8" />
        <path d="M25 66 q 3 10 0 16 M45 70 q -2 8 0 12" stroke="#e2d1a8" strokeWidth={3} fill="none" />
        <ellipse cx="35" cy="63" rx="10" ry="3" fill="#fff6dc" />
        <line x1="35" y1="62" x2="35" y2="55" stroke="#3b2a1a" strokeWidth={1.5} />
        {/* flame */}
        <g style={{ transformOrigin: '35px 56px', animation: 'ink-flame 1.2s ease-in-out infinite' }}>
          <path d="M35 34 C42 44 43 52 35 57 C27 52 28 44 35 34Z" fill="#ffb74d" />
          <path d="M35 42 C39 48 39 53 35 56 C31 53 31 48 35 42Z" fill="#fff3c4" />
        </g>
      </Box>
    </Box>
  );
}

const BOOKS = [
  { w: 150, h: 20, c: '#6d1f1f', band: '#c9a05a', x: 8 },
  { w: 138, h: 18, c: '#1f3350', band: '#e0b973', x: 16 },
  { w: 156, h: 22, c: '#2f4a2c', band: '#c9a05a', x: 2 },
  { w: 128, h: 17, c: '#5a3a22', band: '#e8c27a', x: 22 },
];

function BookStackWithCat() {
  let y = 160;
  const books = BOOKS.map((b) => {
    y -= b.h;
    return { ...b, y };
  });
  const top = y;
  return (
    <Box sx={{ position: 'absolute', right: { xs: -20, md: -6 }, bottom: -4, width: { xs: 120, md: 170 }, height: { xs: 115, md: 165 }, opacity: 0.9 }}>
      <Box component="svg" viewBox="0 0 170 165" sx={{ width: '100%', height: '100%', overflow: 'visible' }}>
        {books.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={2} fill={b.c} />
            <rect x={b.x + 10} y={b.y + 3} width={3} height={b.h - 6} fill={b.band} opacity={0.8} />
            <rect x={b.x + b.w - 16} y={b.y + 3} width={3} height={b.h - 6} fill={b.band} opacity={0.8} />
            <rect x={b.x + b.w - 3} y={b.y + 2} width={3} height={b.h - 4} fill="#f3e6c8" opacity={0.85} />
            <rect x={b.x + 30} y={b.y + b.h / 2 - 1} width={b.w - 60} height={2} fill={b.band} opacity={0.5} />
          </g>
        ))}
        {/* sleeping cat */}
        <g transform={`translate(34 ${top - 34})`}>
          <g style={{ transformOrigin: '86px 30px', animation: 'ink-tail 4s ease-in-out infinite' }}>
            <path d="M86 30 C108 32 116 18 108 8" fill="none" stroke="#2b2420" strokeWidth={7} strokeLinecap="round" />
          </g>
          <g style={{ transformOrigin: '50px 34px', animation: 'ink-breathe 3.6s ease-in-out infinite' }}>
            <ellipse cx="54" cy="22" rx="38" ry="14" fill="#2b2420" />
          </g>
          <circle cx="18" cy="20" r="13" fill="#2b2420" />
          <path d="M8 11 L10 0 L17 8Z M21 7 L27 -1 L29 11Z" fill="#2b2420" />
          <path d="M11 20 q 3 2 6 0 M20 20 q 3 2 6 0" stroke="#d9b36a" strokeWidth={1.3} fill="none" strokeLinecap="round" />
          <path d="M34 30 q 10 4 22 2" stroke="#3a312b" strokeWidth={2} fill="none" />
        </g>
      </Box>
    </Box>
  );
}

function Motes({ count }: { count: number }) {
  const motes = useMemo(() => {
    const r = rand(19);
    return Array.from({ length: count }, () => ({ left: `${8 + r() * 84}%`, top: `${20 + r() * 70}%`, size: 1.5 + r() * 2, d: 10 + r() * 10, delay: -r() * 20 }));
  }, [count]);
  return (
    <>
      {motes.map((m, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            left: m.left,
            top: m.top,
            width: m.size,
            height: m.size,
            borderRadius: '50%',
            bgcolor: '#ffe7b3',
            boxShadow: '0 0 6px 1px rgba(255, 220, 150, 0.45)',
            animation: `ink-mote ${m.d}s ease-in-out ${m.delay}s infinite`,
          }}
        />
      ))}
    </>
  );
}

export function LibraryDecor() {
  const { mobile, reduced } = useDecorEnv();
  return (
    <DecorLayer keyframes={KEYFRAMES} reduced={reduced}>
      {/* Warm vignette */}
      <Box sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 40%, transparent 55%, rgba(20, 10, 4, 0.28) 100%)' }} />
      {!mobile && <PendantLamp />}
      {!mobile && <Motes count={9} />}
      <Candle />
      <BookStackWithCat />
    </DecorLayer>
  );
}

/**
 * Space decorations: twinkling stars along the top, the odd shooting star,
 * a ringed planet with an orbiting moon in the corner and a little
 * astronaut drifting by.
 */
import { useMemo } from 'react';
import { Box } from '@mui/material';
import { DecorLayer, rand, useDecorEnv } from './shared';

const KEYFRAMES = {
  '@keyframes ink-twinkle': { '0%': { opacity: 0.15, transform: 'scale(0.7)' }, '100%': { opacity: 1, transform: 'scale(1.15)' } },
  '@keyframes ink-shoot': {
    '0%': { transform: 'translate(0, 0) rotate(-24deg)', opacity: 0 },
    '88%': { transform: 'translate(0, 0) rotate(-24deg)', opacity: 0 },
    '90%': { opacity: 1 },
    '97%': { transform: 'translate(-340px, 150px) rotate(-24deg)', opacity: 0 },
    '100%': { transform: 'translate(-340px, 150px) rotate(-24deg)', opacity: 0 },
  },
  '@keyframes ink-orbit': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } },
  '@keyframes ink-float': {
    '0%': { transform: 'translate(0, 0) rotate(-8deg)' },
    '50%': { transform: 'translate(14px, -22px) rotate(10deg)' },
    '100%': { transform: 'translate(0, 0) rotate(-8deg)' },
  },
  '@keyframes ink-planet-glow': { '0%': { opacity: 0.7 }, '100%': { opacity: 1 } },
};

function Twinkles({ count }: { count: number }) {
  const stars = useMemo(() => {
    const r = rand(13);
    return Array.from({ length: count }, (_, i) => {
      // Mostly in the empty middle of the app bar and along the edges.
      const band = i % 3;
      const left = band === 0 ? 36 + r() * 7 : band === 1 ? 9 + r() * 4 : 93 + r() * 7;
      const top = band === 0 ? r() * 52 : 10 + r() * 80;
      return { left: `${left}%`, top: band === 0 ? `${top}px` : `${top}%`, size: 1.5 + r() * 2.5, d: 1.6 + r() * 2.6, delay: -r() * 4, gold: r() > 0.75 };
    });
  }, [count]);
  return (
    <>
      {stars.map((s, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            bgcolor: s.gold ? '#ffe082' : '#ffffff',
            boxShadow: `0 0 ${s.size * 3}px ${s.size}px ${s.gold ? 'rgba(255, 224, 130, 0.45)' : 'rgba(200, 210, 255, 0.45)'}`,
            animation: `ink-twinkle ${s.d}s ease-in-out ${s.delay}s infinite alternate`,
          }}
        />
      ))}
    </>
  );
}

function ShootingStar({ top, left, d, delay }: { top: string; left: string; d: number; delay: number }) {
  return (
    <Box
      sx={{
        position: 'absolute',
        top,
        left,
        width: 130,
        height: 2,
        borderRadius: 2,
        background: 'linear-gradient(90deg, #ffffff, rgba(179, 136, 255, 0.6) 30%, transparent)',
        boxShadow: '0 0 6px 1px rgba(255,255,255,0.5)',
        animation: `ink-shoot ${d}s linear ${delay}s infinite`,
      }}
    />
  );
}

function Planet() {
  return (
    <Box sx={{ position: 'absolute', right: { xs: -60, md: -60 }, bottom: { xs: -60, md: -70 }, width: { xs: 140, md: 230 }, height: { xs: 140, md: 230 }, opacity: 0.78 }}>
      <Box component="svg" viewBox="0 0 230 230" sx={{ width: '100%', height: '100%', overflow: 'visible' }}>
        <defs>
          <radialGradient id="ink-planet" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#f3a6ff" />
            <stop offset="45%" stopColor="#8e5bd8" />
            <stop offset="100%" stopColor="#2a1a5c" />
          </radialGradient>
          <linearGradient id="ink-ring" x1="0" x2="1">
            <stop offset="0%" stopColor="rgba(255,224,130,0)" />
            <stop offset="30%" stopColor="rgba(255,224,130,0.75)" />
            <stop offset="70%" stopColor="rgba(255,204,128,0.6)" />
            <stop offset="100%" stopColor="rgba(255,224,130,0)" />
          </linearGradient>
        </defs>
        <circle cx="115" cy="115" r="98" fill="rgba(179,136,255,0.18)" style={{ animation: 'ink-planet-glow 5s ease-in-out infinite alternate' }} />
        <ellipse cx="115" cy="118" rx="112" ry="26" fill="none" stroke="url(#ink-ring)" strokeWidth={9} transform="rotate(-16 115 118)" />
        <circle cx="115" cy="115" r="70" fill="url(#ink-planet)" />
        <path d="M58 96 C90 86 140 88 176 100" stroke="rgba(255,255,255,0.18)" strokeWidth={6} fill="none" />
        <path d="M50 128 C92 120 140 124 180 134" stroke="rgba(42,26,92,0.35)" strokeWidth={8} fill="none" />
        {/* Front half of the ring passes in front of the planet. */}
        <clipPath id="ink-ring-front">
          <rect x="-40" y="118" width="310" height="160" />
        </clipPath>
        <ellipse cx="115" cy="118" rx="112" ry="26" fill="none" stroke="url(#ink-ring)" strokeWidth={9} transform="rotate(-16 115 118)" clipPath="url(#ink-ring-front)" />
      </Box>
      {/* Orbiting moon */}
      <Box sx={{ position: 'absolute', left: '50%', top: '50%', width: 0, height: 0, animation: 'ink-orbit 28s linear infinite' }}>
        <Box sx={{ position: 'absolute', left: { xs: -95, md: -150 }, top: -8, width: { xs: 10, md: 16 }, height: { xs: 10, md: 16 }, borderRadius: '50%', background: 'radial-gradient(circle at 35% 35%, #ffffff, #b0bec5 60%, #546e7a)' }} />
      </Box>
    </Box>
  );
}

function Astronaut() {
  return (
    <Box sx={{ position: 'absolute', left: 104, bottom: '8%', opacity: 0.6, animation: 'ink-float 16s ease-in-out infinite' }}>
      <Box component="svg" viewBox="0 0 60 70" sx={{ width: 48, height: 56 }}>
        <rect x="16" y="30" width="28" height="26" rx="10" fill="#eceff1" />
        <rect x="10" y="32" width="9" height="20" rx="4" fill="#cfd8dc" transform="rotate(18 14 42)" />
        <rect x="41" y="32" width="9" height="20" rx="4" fill="#cfd8dc" transform="rotate(-24 46 42)" />
        <rect x="18" y="52" width="9" height="14" rx="4" fill="#cfd8dc" />
        <rect x="33" y="52" width="9" height="14" rx="4" fill="#cfd8dc" />
        <circle cx="30" cy="20" r="15" fill="#eceff1" />
        <ellipse cx="31" cy="20" rx="10" ry="8" fill="#3a3f73" />
        <ellipse cx="27" cy="17" rx="3" ry="2" fill="rgba(255,255,255,0.6)" />
        <rect x="24" y="38" width="12" height="7" rx="2" fill="#b388ff" />
      </Box>
    </Box>
  );
}

export function SpaceDecor() {
  const { mobile, reduced } = useDecorEnv();
  return (
    <DecorLayer keyframes={KEYFRAMES} reduced={reduced}>
      <Twinkles count={mobile ? 10 : 24} />
      {!mobile && (
        <>
          <ShootingStar top="6%" left="70%" d={13} delay={-4} />
          <ShootingStar top="18%" left="42%" d={19} delay={-11} />
          <Astronaut />
        </>
      )}
      <Planet />
    </DecorLayer>
  );
}

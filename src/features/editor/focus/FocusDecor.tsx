/** Gentle animated effects behind the text in focus mode. Pure CSS, no pointer events. */
import { memo } from 'react';
import { Box } from '@mui/material';
import { keyframes } from '@emotion/react';
import type { FocusDecorKind } from './focusThemes';

/** Deterministic pseudo-random numbers, so the layout doesn't jump between renders. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const twinkle = keyframes`0%,100%{opacity:.15}50%{opacity:.9}`;
const fall = keyframes`from{transform:translateY(-15vh)}to{transform:translateY(115vh)}`;
const rise = keyframes`0%{transform:translate(0,0) scale(1);opacity:0}10%{opacity:1}100%{transform:translate(var(--dx),-85vh) scale(.3);opacity:0}`;
const drift = keyframes`0%{transform:translate(0,-10vh)}50%{transform:translate(var(--dx),50vh)}100%{transform:translate(0,110vh)}`;
const wander = keyframes`0%{transform:translate(0,0)}25%{transform:translate(var(--dx),var(--dy))}50%{transform:translate(calc(var(--dx)*-.6),calc(var(--dy)*1.3))}75%{transform:translate(calc(var(--dx)*.4),calc(var(--dy)*-.7))}100%{transform:translate(0,0)}`;
const pulse = keyframes`0%,100%{opacity:.1}50%{opacity:1}`;
const flicker = keyframes`0%,100%{opacity:.75}20%{opacity:.9}40%{opacity:.68}55%{opacity:.95}70%{opacity:.8}`;
const sway = keyframes`0%,100%{transform:rotate(-4deg)}50%{transform:rotate(4deg)}`;
const roll = keyframes`from{background-position:0 0}to{background-position:0 100px}`;

const layer = { position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' } as const;

function Stars({ animate }: { animate: boolean }) {
  const r = rng(7);
  return (
    <Box sx={layer} aria-hidden>
      {Array.from({ length: 90 }, (_, i) => {
        const size = r() < 0.12 ? 3 : r() < 0.5 ? 2 : 1.3;
        return (
          <Box
            key={i}
            sx={{
              position: 'absolute',
              left: `${r() * 100}%`,
              top: `${r() * 100}%`,
              width: size,
              height: size,
              borderRadius: '50%',
              bgcolor: '#fff',
              boxShadow: size > 2 ? '0 0 6px 1px rgba(200,215,255,.7)' : 'none',
              opacity: 0.5,
              animation: animate ? `${twinkle} ${3 + r() * 5}s ease-in-out ${-r() * 8}s infinite` : 'none',
            }}
          />
        );
      })}
    </Box>
  );
}

function Rain({ animate }: { animate: boolean }) {
  const r = rng(11);
  return (
    <Box sx={layer} aria-hidden>
      {/* Misted glass */}
      <Box sx={{ ...layer, background: 'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,.06), transparent 70%)' }} />
      {Array.from({ length: 80 }, (_, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            left: `${r() * 100}%`,
            top: 0,
            width: '1px',
            height: `${8 + r() * 12}vh`,
            background: 'linear-gradient(to bottom, transparent, rgba(200,225,245,.45))',
            opacity: 0.25 + r() * 0.35,
            transform: animate ? undefined : `translateY(${r() * 100}vh)`,
            animation: animate ? `${fall} ${0.7 + r() * 0.8}s linear ${-r() * 2}s infinite` : 'none',
          }}
        />
      ))}
      {/* A few drops resting on the glass */}
      {Array.from({ length: 26 }, (_, i) => {
        const s = 3 + r() * 6;
        return (
          <Box
            key={`d${i}`}
            sx={{
              position: 'absolute',
              left: `${r() * 100}%`,
              top: `${r() * 100}%`,
              width: s,
              height: s * 1.2,
              borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, rgba(255,255,255,.5), rgba(160,190,215,.12) 60%, transparent 70%)',
            }}
          />
        );
      })}
    </Box>
  );
}

function Embers({ animate }: { animate: boolean }) {
  const r = rng(5);
  return (
    <Box sx={layer} aria-hidden>
      <Box
        sx={{
          ...layer,
          background: 'radial-gradient(ellipse at 50% 110%, rgba(255,140,40,.35), transparent 60%)',
          animation: animate ? `${flicker} 2.6s ease-in-out infinite` : 'none',
        }}
      />
      {Array.from({ length: 30 }, (_, i) => {
        const s = 2 + r() * 3;
        return (
          <Box
            key={i}
            style={{ ['--dx' as string]: `${(r() - 0.5) * 30}vw` }}
            sx={{
              position: 'absolute',
              left: `${20 + r() * 60}%`,
              bottom: '-2vh',
              width: s,
              height: s,
              borderRadius: '50%',
              bgcolor: r() < 0.5 ? '#ffb347' : '#ff7a2a',
              boxShadow: '0 0 8px 2px rgba(255,140,40,.7)',
              opacity: animate ? 0 : 0.5,
              transform: animate ? undefined : `translateY(-${r() * 70}vh)`,
              animation: animate ? `${rise} ${7 + r() * 8}s ease-out ${-r() * 15}s infinite` : 'none',
            }}
          />
        );
      })}
    </Box>
  );
}

function Snow({ animate }: { animate: boolean }) {
  const r = rng(3);
  return (
    <Box sx={layer} aria-hidden>
      {Array.from({ length: 70 }, (_, i) => {
        const s = 2 + r() * 4;
        return (
          <Box
            key={i}
            style={{ ['--dx' as string]: `${(r() - 0.5) * 12}vw` }}
            sx={{
              position: 'absolute',
              left: `${r() * 100}%`,
              top: 0,
              width: s,
              height: s,
              borderRadius: '50%',
              bgcolor: '#fff',
              opacity: 0.35 + r() * 0.5,
              filter: s > 4.5 ? 'blur(1px)' : 'none',
              transform: animate ? undefined : `translateY(${r() * 100}vh)`,
              animation: animate ? `${drift} ${12 + r() * 14}s linear ${-r() * 26}s infinite` : 'none',
            }}
          />
        );
      })}
    </Box>
  );
}

function Fireflies({ animate }: { animate: boolean }) {
  const r = rng(13);
  return (
    <Box sx={layer} aria-hidden>
      {Array.from({ length: 22 }, (_, i) => (
        <Box
          key={i}
          style={{ ['--dx' as string]: `${(r() - 0.5) * 16}vw`, ['--dy' as string]: `${(r() - 0.5) * 14}vh` }}
          sx={{
            position: 'absolute',
            left: `${r() * 100}%`,
            top: `${30 + r() * 70}%`,
            animation: animate ? `${wander} ${16 + r() * 18}s ease-in-out ${-r() * 30}s infinite` : 'none',
          }}
        >
          <Box
            sx={{
              width: 4,
              height: 4,
              borderRadius: '50%',
              bgcolor: '#e9ff8a',
              boxShadow: '0 0 10px 4px rgba(215,242,122,.55)',
              opacity: 0.6,
              animation: animate ? `${pulse} ${2.5 + r() * 3}s ease-in-out ${-r() * 5}s infinite` : 'none',
            }}
          />
        </Box>
      ))}
    </Box>
  );
}

function Rays({ animate }: { animate: boolean }) {
  const r = rng(17);
  return (
    <Box sx={layer} aria-hidden>
      {Array.from({ length: 6 }, (_, i) => (
        <Box
          key={i}
          sx={{
            position: 'absolute',
            top: '-20vh',
            left: `${5 + i * 16 + r() * 6}%`,
            width: `${4 + r() * 6}vw`,
            height: '130vh',
            background: 'linear-gradient(to bottom, rgba(190,240,255,.16), transparent 75%)',
            transformOrigin: 'top center',
            filter: 'blur(6px)',
            animation: animate ? `${sway} ${9 + r() * 8}s ease-in-out ${-r() * 10}s infinite` : 'none',
          }}
        />
      ))}
    </Box>
  );
}

function Scanlines({ animate }: { animate: boolean }) {
  return (
    <Box sx={layer} aria-hidden>
      <Box
        sx={{
          ...layer,
          backgroundImage: 'repeating-linear-gradient(to bottom, rgba(0,0,0,.2) 0px, rgba(0,0,0,.2) 1px, transparent 2px, transparent 4px)',
          animation: animate ? `${roll} 8s linear infinite` : 'none',
        }}
      />
      <Box sx={{ ...layer, background: 'radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,.65) 100%)' }} />
    </Box>
  );
}

export const FocusDecor = memo(function FocusDecor({ kind, animate }: { kind: FocusDecorKind; animate: boolean }) {
  switch (kind) {
    case 'stars':
      return <Stars animate={animate} />;
    case 'rain':
      return <Rain animate={animate} />;
    case 'embers':
      return <Embers animate={animate} />;
    case 'snow':
      return <Snow animate={animate} />;
    case 'fireflies':
      return <Fireflies animate={animate} />;
    case 'rays':
      return <Rays animate={animate} />;
    case 'scanlines':
      return <Scanlines animate={animate} />;
    default:
      return null;
  }
});

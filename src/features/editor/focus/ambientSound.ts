/**
 * Ambient sounds for focus mode, synthesised with the Web Audio API (no audio
 * files, so they work offline): rain, a crackling fireplace, waves, wind and
 * soft brown noise.
 */
import type { FocusSound } from './focusThemes';

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let nodes: AudioScheduledSourceNode[] = [];
let playing: FocusSound | null = null;

function noiseBuffer(c: AudioContext, seconds: number, kind: 'white' | 'brown'): AudioBuffer {
  const buffer = c.createBuffer(2, c.sampleRate * seconds, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      if (kind === 'white') data[i] = white * 0.5;
      else {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    }
  }
  return buffer;
}

/** Sparse crackles and pops for the fireplace. */
function crackleBuffer(c: AudioContext, seconds: number): AudioBuffer {
  const buffer = c.createBuffer(2, c.sampleRate * seconds, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    const pops = seconds * 9;
    for (let p = 0; p < pops; p++) {
      const at = Math.floor(Math.random() * (data.length - 2000));
      const len = 80 + Math.floor(Math.random() * 900);
      const amp = 0.15 + Math.random() * (Math.random() < 0.15 ? 0.85 : 0.35);
      for (let i = 0; i < len; i++) data[at + i] += (Math.random() * 2 - 1) * amp * Math.exp(-i / (len / 5));
    }
  }
  return buffer;
}

function loop(c: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
  const s = c.createBufferSource();
  s.buffer = buffer;
  s.loop = true;
  nodes.push(s);
  return s;
}

function lfo(c: AudioContext, freq: number, depth: number, target: AudioParam) {
  const o = c.createOscillator();
  o.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = depth;
  o.connect(g).connect(target);
  nodes.push(o);
}

function filter(c: AudioContext, type: BiquadFilterType, frequency: number, q = 0.7): BiquadFilterNode {
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = frequency;
  f.Q.value = q;
  return f;
}

function gainNode(c: AudioContext, value: number): GainNode {
  const g = c.createGain();
  g.gain.value = value;
  return g;
}

function build(c: AudioContext, out: AudioNode, kind: FocusSound) {
  const brown = () => noiseBuffer(c, 4, 'brown');
  const white = () => noiseBuffer(c, 3, 'white');
  switch (kind) {
    case 'rain': {
      loop(c, brown()).connect(filter(c, 'lowpass', 900)).connect(out);
      // Patter: bright, quiet, slowly swelling.
      const patterGain = gainNode(c, 0.18);
      loop(c, white()).connect(filter(c, 'bandpass', 3200, 0.6)).connect(patterGain).connect(out);
      lfo(c, 0.07, 0.06, patterGain.gain);
      break;
    }
    case 'fire': {
      const rumble = gainNode(c, 0.7);
      loop(c, brown()).connect(filter(c, 'lowpass', 420)).connect(rumble).connect(out);
      lfo(c, 0.13, 0.2, rumble.gain);
      loop(c, crackleBuffer(c, 7)).connect(filter(c, 'highpass', 1200)).connect(gainNode(c, 0.9)).connect(out);
      break;
    }
    case 'waves': {
      const swell = gainNode(c, 0.55);
      const lp = filter(c, 'lowpass', 700);
      loop(c, brown()).connect(lp).connect(swell).connect(out);
      lfo(c, 0.09, 0.45, swell.gain);
      lfo(c, 0.09, 350, lp.frequency);
      break;
    }
    case 'wind': {
      const bp = filter(c, 'bandpass', 500, 1.2);
      const g = gainNode(c, 0.9);
      loop(c, white()).connect(bp).connect(g).connect(out);
      lfo(c, 0.05, 260, bp.frequency);
      lfo(c, 0.031, 0.35, g.gain);
      break;
    }
    default:
      loop(c, brown()).connect(filter(c, 'lowpass', 900)).connect(out);
  }
}

export function startAmbientSound(kind: FocusSound = 'rain', volume = 0.18): void {
  if (playing === kind) return;
  stopAmbientSound(true);
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = ctx ?? new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  build(ctx, master, kind);
  nodes.forEach((n) => n.start());
  master.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.5);
  playing = kind;
  void ctx.resume();
}

export function stopAmbientSound(immediate = false): void {
  if (!ctx || !master) return;
  const m = master;
  const old = nodes;
  const fade = immediate ? 0.25 : 0.6;
  m.gain.cancelScheduledValues(ctx.currentTime);
  m.gain.setValueAtTime(m.gain.value, ctx.currentTime);
  m.gain.linearRampToValueAtTime(0, ctx.currentTime + fade);
  setTimeout(() => {
    old.forEach((n) => {
      try {
        n.stop();
      } catch {
        /* already stopped */
      }
    });
    m.disconnect();
  }, fade * 1000 + 100);
  master = null;
  nodes = [];
  playing = null;
}

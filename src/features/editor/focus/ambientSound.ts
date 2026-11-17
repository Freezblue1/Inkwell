/** Generates soft brown noise ("rain on a window") with the Web Audio API. No files needed. */
let ctx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let gain: GainNode | null = null;

export function startAmbientSound(volume = 0.18): void {
  if (source) return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = ctx ?? new AC();
  const seconds = 4;
  const buffer = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    }
  }
  source = ctx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 900;
  gain = ctx.createGain();
  gain.gain.value = 0;
  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start();
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 1.5);
  void ctx.resume();
}

export function stopAmbientSound(): void {
  if (!source || !ctx || !gain) return;
  const s = source;
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
  setTimeout(() => s.stop(), 700);
  source = null;
  gain = null;
}

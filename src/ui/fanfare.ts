import { prefs } from './prefs.svelte';

/**
 * Short fanfares, synthesized with Web Audio (no sound files): a brass call
 * for „Optimale DNS“ and a glittering arpeggio for a shiny creature.
 * Silent when sounds are off or the browser blocks audio.
 */
let audio: AudioContext | null = null;

function context(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  audio ??= new AudioContext();
  if (audio.state === 'suspended') void audio.resume();
  return audio;
}

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** One note: oscillator → low-pass → envelope → out. */
function note(ctx: AudioContext, out: AudioNode, midi: number, start: number, length: number, type: OscillatorType, volume: number, bright = 2400): void {
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = hz(midi);
  filter.type = 'lowpass';
  filter.frequency.value = bright;
  const t = ctx.currentTime + start;
  gain.gain.setValueAtTime(0, t);
  gain.gain.linearRampToValueAtTime(volume, t + 0.025);
  gain.gain.setValueAtTime(volume * 0.8, t + Math.max(0.03, length - 0.08));
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length + 0.25);
  osc.connect(filter).connect(gain).connect(out);
  osc.start(t);
  osc.stop(t + length + 0.3);
}

export function playFanfare(kind: 'perfect' | 'shiny'): void {
  if (!prefs.sound) return;
  try {
    const ctx = context();
    if (!ctx) return;
    const master = ctx.createGain();
    master.gain.value = 0.22;
    master.connect(ctx.destination);
    if (kind === 'perfect') {
      // Brass call: da-da-da DAAA, then the full chord.
      const brass = (m: number, s: number, l: number, v = 0.5) => {
        note(ctx, master, m, s, l, 'sawtooth', v, 1800);
        note(ctx, master, m + 12, s, l, 'square', v * 0.15, 2600);
      };
      brass(67, 0, 0.12);
      brass(67, 0.15, 0.12);
      brass(67, 0.3, 0.12);
      brass(72, 0.46, 0.5, 0.6);
      brass(71, 0.98, 0.14);
      brass(72, 1.14, 0.14);
      for (const m of [60, 64, 67, 72, 76]) brass(m, 1.3, 1.3, 0.28);
      note(ctx, master, 36, 1.3, 1.2, 'triangle', 0.6, 400);
    } else {
      // Glitter: fast bell arpeggio up and down, then a shimmering chord.
      const bell = (m: number, s: number, l: number, v = 0.35) => {
        note(ctx, master, m, s, l, 'triangle', v, 6000);
        note(ctx, master, m + 0.08, s, l, 'sine', v * 0.6, 6000);
      };
      [76, 80, 83, 88, 92, 95, 100, 95, 92, 88].forEach((m, i) => bell(m, i * 0.075, 0.18));
      for (const m of [76, 83, 88, 92]) bell(m, 0.85, 1.2, 0.22);
    }
  } catch {
    /* audio is optional */
  }
}

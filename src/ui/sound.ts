import { prefs } from './prefs.svelte';

/**
 * Game sounds, synthesized with Web Audio (no sound files). A sound is a
 * named recipe of notes; `play(name)` checks the settings, mutes during
 * catch-up and in background tabs, and throttles repeats so automations
 * (Zuchtautomat, 10 capsules at once …) never turn into a noise.
 *
 * Adding a sound: a recipe in `SOUNDS` (and its throttle in `LIMITS` if it
 * can fire often). Which events play which sound is decided by the caller.
 */

export type SoundName = keyof typeof SOUNDS;

/** Tools a recipe gets: notes and noise bursts, scheduled relative to „now“. */
interface Synth {
  /** One note: MIDI pitch, start and length in seconds, waveform, volume 0…1, low-pass cutoff. */
  note(midi: number, start: number, length: number, type?: OscillatorType, volume?: number, bright?: number): void;
  /** Filtered noise (crackle, rustle, whoosh). */
  noise(start: number, length: number, volume?: number, cutoff?: number): void;
}

const SOUNDS = {
  /** „OPTIMALE DNS“: brass call da-da-da DAAA, then the full chord. */
  perfect: (s: Synth) => {
    const brass = (m: number, at: number, len: number, v = 0.5) => {
      s.note(m, at, len, 'sawtooth', v, 1800);
      s.note(m + 12, at, len, 'square', v * 0.15, 2600);
    };
    brass(67, 0, 0.12);
    brass(67, 0.15, 0.12);
    brass(67, 0.3, 0.12);
    brass(72, 0.46, 0.5, 0.6);
    brass(71, 0.98, 0.14);
    brass(72, 1.14, 0.14);
    for (const m of [60, 64, 67, 72, 76]) brass(m, 1.3, 1.3, 0.28);
    s.note(36, 1.3, 1.2, 'triangle', 0.6, 400);
  },
  /** „SCHILLERND!“: fast bell arpeggio up and down, then a shimmering chord. */
  shiny: (s: Synth) => {
    const bell = (m: number, at: number, len: number, v = 0.35) => {
      s.note(m, at, len, 'triangle', v, 6000);
      s.note(m + 0.08, at, len, 'sine', v * 0.6, 6000);
    };
    [76, 80, 83, 88, 92, 95, 100, 95, 92, 88].forEach((m, i) => bell(m, i * 0.075, 0.18));
    for (const m of [76, 83, 88, 92]) bell(m, 0.85, 1.2, 0.22);
  },
  // ---- Brutstation ----
  /** Egg laid: soft rustle in the straw and a low, warm note. */
  eggLaid: (s: Synth) => {
    s.noise(0, 0.35, 0.18, 1400);
    s.note(55, 0.05, 0.3, 'sine', 0.35, 900);
  },
  /** Egg hatches: two cracks and a small chime. */
  hatch: (s: Synth) => {
    s.noise(0, 0.05, 0.5, 5000);
    s.noise(0.12, 0.06, 0.55, 6000);
    s.note(79, 0.2, 0.18, 'triangle', 0.35, 5000);
    s.note(84, 0.3, 0.3, 'triangle', 0.3, 5000);
  },
  /** Rare or better hatchling: cracks and a sparkling run. */
  hatchRare: (s: Synth) => {
    s.noise(0, 0.05, 0.5, 5000);
    s.noise(0.12, 0.06, 0.55, 6000);
    [79, 83, 86, 91, 95].forEach((m, i) => s.note(m, 0.2 + i * 0.06, 0.25, 'triangle', 0.3, 7000));
    s.note(91, 0.55, 0.8, 'sine', 0.22, 7000);
  },
  /** Twins: the crack twice, the second one higher. */
  twins: (s: Synth) => {
    s.noise(0, 0.05, 0.5, 5000);
    s.noise(0.1, 0.05, 0.5, 6500);
    s.note(79, 0.18, 0.18, 'triangle', 0.3, 5000);
    s.note(83, 0.3, 0.18, 'triangle', 0.3, 5000);
    s.note(86, 0.42, 0.35, 'triangle', 0.3, 5000);
  },
  /** New species in the Dex (hybrids): a little „discovery“ motif. */
  discovery: (s: Synth) => {
    [72, 76, 79, 84].forEach((m, i) => s.note(m, i * 0.1, 0.22, 'triangle', 0.35, 5000));
    for (const m of [72, 79, 84, 88]) s.note(m, 0.45, 0.9, 'sine', 0.18, 5000);
  },

  // ---- Genlabor ----
  /** Sequencing done: computer beeps, then an „ok“ chirp. */
  sequenced: (s: Synth) => {
    [84, 84, 88].forEach((m, i) => s.note(m, i * 0.09, 0.05, 'square', 0.18, 3000));
    s.note(91, 0.3, 0.15, 'square', 0.2, 3500);
  },
  /** Deep sequencing reveals the Erbanlage: low hum, then a bright reveal. */
  deepSequenced: (s: Synth) => {
    s.note(43, 0, 0.7, 'sawtooth', 0.25, 300);
    s.note(50, 0.1, 0.6, 'sawtooth', 0.18, 300);
    s.note(86, 0.65, 0.5, 'sine', 0.3, 6000);
    s.note(91, 0.75, 0.6, 'sine', 0.25, 6000);
  },
  /** New allele in the gene library: a short bleep. */
  catalogued: (s: Synth) => {
    s.note(88, 0, 0.06, 'square', 0.15, 3500);
    s.note(93, 0.07, 0.1, 'square', 0.15, 3500);
  },
  /** Splice worked: snip and a clear ding. */
  spliceOk: (s: Synth) => {
    s.noise(0, 0.04, 0.45, 8000);
    s.noise(0.06, 0.04, 0.4, 8000);
    s.note(88, 0.12, 0.5, 'sine', 0.35, 8000);
    s.note(95, 0.14, 0.45, 'sine', 0.18, 8000);
  },
  /** Unstable splice: a hiss and a falling tone. */
  spliceFail: (s: Synth) => {
    s.noise(0, 0.5, 0.35, 2500);
    s.note(60, 0.05, 0.12, 'sawtooth', 0.25, 1200);
    s.note(55, 0.18, 0.12, 'sawtooth', 0.25, 1000);
    s.note(49, 0.31, 0.3, 'sawtooth', 0.25, 800);
  },

  /** Short sample for the volume setting. */
  test: (s: Synth) => {
    s.note(72, 0, 0.12, 'triangle', 0.5, 4000);
    s.note(79, 0.1, 0.2, 'triangle', 0.5, 4000);
  },
} satisfies Record<string, (s: Synth) => void>;

/** Minimum time between two plays of the same sound (ms); default below. */
const LIMITS: Partial<Record<SoundName, number>> = {
  perfect: 1500, shiny: 1500, eggLaid: 700, hatch: 600, hatchRare: 900, twins: 900, discovery: 1500, sequenced: 800, deepSequenced: 1500, catalogued: 400,
};
const DEFAULT_GAP_MS = 80;
/** At most this many sounds start within `BURST_MS`. */
const BURST_MAX = 4;
const BURST_MS = 250;

let audio: AudioContext | null = null;
let muted = 0;
const lastPlayed = new Map<SoundName, number>();
let recent: number[] = [];

/** Mutes all sounds while `fn` runs (e.g. the offline catch-up); nests safely. */
export function silently<T>(fn: () => T): T {
  muted++;
  try {
    return fn();
  } finally {
    muted--;
  }
}

/** The shared audio context (effects and music); resumes it when the browser suspended it. */
export function audioContext(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  audio ??= new AudioContext();
  if (audio.state === 'suspended') void audio.resume();
  return audio;
}

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

function synth(ctx: AudioContext, out: AudioNode): Synth {
  return {
    note(midi, start, length, type = 'triangle', volume = 0.5, bright = 2400) {
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
    },
    noise(start, length, volume = 0.3, cutoff = 3000) {
      const frames = Math.max(1, Math.floor(ctx.sampleRate * length));
      const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
      const src = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      src.buffer = buffer;
      filter.type = 'lowpass';
      filter.frequency.value = cutoff;
      gain.gain.value = volume;
      src.connect(filter).connect(gain).connect(out);
      src.start(ctx.currentTime + start);
    },
  };
}

/** Whether a sound may play right now (settings, catch-up, background tab, throttle). */
function allowed(name: SoundName, now: number): boolean {
  if (!prefs.sound || prefs.volume <= 0 || muted > 0) return false;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
  if (now - (lastPlayed.get(name) ?? -Infinity) < (LIMITS[name] ?? DEFAULT_GAP_MS)) return false;
  recent = recent.filter((t) => now - t < BURST_MS);
  return recent.length < BURST_MAX;
}

export function play(name: SoundName): void {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (!allowed(name, now)) return;
  try {
    const ctx = audioContext();
    if (!ctx) return;
    lastPlayed.set(name, now);
    recent.push(now);
    const master = ctx.createGain();
    master.gain.value = 0.3 * prefs.volume;
    master.connect(ctx.destination);
    SOUNDS[name](synth(ctx, master));
  } catch {
    /* audio is optional */
  }
}

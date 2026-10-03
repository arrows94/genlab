import { audioContext } from './sound';

/**
 * Background music, generated live with Web Audio (no sound files, nothing
 * to download): a slow chord progression as a soft pad, a bass note, sparse
 * plucked arpeggios and a long reverb. Each area has its own mood; on a
 * tab switch the sounding chords fade out while the new mood swells in.
 * The other world (GenLab RPG) adds a step grid: war drums, a galloping bass
 * and a horn riff, so fights sound like fights. The Genom-Keller has no chords
 * at all: a breathing drone, a broken music box, sounds in the dark and – the
 * deeper and the more dangerous – a tritone, a cluster and a heartbeat.
 *
 * `setMusic(on, volume, mood)` is the only entry point; it is called from an
 * effect in App.svelte whenever the settings or the tab change.
 */

export type Mood = 'lab' | 'breeding' | 'genetics' | 'tower' | 'aeon' | 'isekai' | 'battle' | 'cellar' | 'cellarBoss';

interface MoodDef {
  /** Chords as MIDI notes; the first note is the root. */
  chords: number[][];
  /** Seconds per chord. */
  chordSec: number;
  /** Plucks per chord (random times and notes from the chord). */
  plucks: number;
  /** Bass pulse every n seconds (0 = one long note per chord). */
  pulse: number;
  /** Pad low-pass cutoff in Hz. */
  bright: number;
  /** Pluck waveform. */
  pluck: OscillatorType;
  /** Sequencer arpeggio: seconds per step through the chord (0 = none). */
  arp?: number;
  /** Octave shift of the plucks (12 = one up). */
  pluckOctave?: number;
  /** Pad level per voice (default 0.035). */
  pad?: number;
  /** Step grid per chord: patterns of 'x' (hit) and '.' (rest), all `steps` long. */
  grid?: {
    steps: number;
    /** Deep war drum (taiko). */
    drum?: string;
    /** Snare / frame drum. */
    snare?: string;
    /** Short metallic tick. */
    hat?: string;
    /** Bass ostinato on the root (replaces the long bass note). */
    bass?: string;
    /** Horn riffs, one per chord in turn: chord-note index (1…) per step, 0 = rest. */
    riffs?: number[][];
  };
  /** Genom-Keller: no chords – drone, music box and sounds in the dark (`boss`: the shadow's track). */
  horror?: 'cellar' | 'boss';
}

const MOODS: Record<Mood, MoodDef> = {
  // Calm lab: Am9 – Fmaj7 – Cmaj7 – G6.
  lab: { chords: [[57, 60, 64, 67, 71], [53, 57, 60, 64, 69], [48, 55, 59, 64, 67], [55, 59, 62, 64, 71]], chordSec: 8, plucks: 5, pulse: 0, bright: 900, pluck: 'triangle' },
  // Brutstation: warm and cosy, a music box over soft major chords. C – Am7 – F – G.
  breeding: { chords: [[48, 55, 60, 64, 67], [45, 55, 60, 64, 67], [41, 57, 60, 65, 69], [43, 55, 59, 62, 67]], chordSec: 6, plucks: 9, pulse: 0, bright: 800, pluck: 'sine', pluckOctave: 24 },
  // Genlabor: a quiet sequencer ticking through dorian chords. Dm9 – Em7 – Fmaj7 – Em7.
  genetics: { chords: [[50, 57, 60, 64, 65], [52, 59, 62, 67, 71], [53, 60, 64, 69, 72], [52, 59, 62, 67, 69]], chordSec: 6, plucks: 0, pulse: 0, bright: 650, pluck: 'triangle', arp: 0.25 },
  // Tower: minor and driving, a steady bass pulse. Dm – Bb – C – A.
  tower: { chords: [[50, 57, 62, 65, 69], [46, 53, 58, 62, 65], [48, 55, 60, 64, 67], [45, 52, 57, 61, 64]], chordSec: 4, plucks: 6, pulse: 0.5, bright: 1300, pluck: 'square' },
  // Äon: floating lydian colours, long chords, bell-like plucks. Fmaj7#11 – Cmaj9 – Em7 – Dsus2.
  aeon: { chords: [[53, 60, 64, 67, 71], [48, 55, 59, 62, 64], [52, 59, 62, 67, 71], [50, 57, 62, 64, 69]], chordSec: 10, plucks: 4, pulse: 0, bright: 700, pluck: 'sine' },
  // The other world (GenLab RPG): dark and old, a phrygian step in the shadows, sparse low plucks. Dm – Eb – Dm – C.
  // Exploring, with war drums in the distance.
  isekai: {
    chords: [[50, 57, 62, 65, 69], [51, 58, 63, 67, 70], [50, 57, 62, 65, 69], [48, 55, 60, 64, 67]],
    chordSec: 6.4, plucks: 3, pulse: 0, bright: 560, pluck: 'triangle', pluckOctave: 12, pad: 0.03,
    grid: { steps: 16, drum: 'x.......x.x.....' },
  },
  // Fight in the other world: fast and hard, taiko and snare, a galloping bass and a horn riff.
  // Dm – Bb – F – C, Dm – Bb – Gm – A.
  battle: {
    chords: [[50, 57, 62, 65, 69], [46, 53, 58, 62, 65], [41, 53, 57, 60, 65], [48, 55, 60, 64, 67], [50, 57, 62, 65, 69], [46, 53, 58, 62, 65], [43, 55, 58, 62, 67], [45, 52, 57, 61, 64]],
    chordSec: 2.4, plucks: 0, pulse: 0, bright: 1500, pluck: 'triangle', pad: 0.025,
    grid: {
      steps: 16,
      drum: 'x.....x.x.....x.',
      snare: '....x.......x..x',
      hat: '..x...x...x...x.',
      bass: 'x.xxx.xxx.xxx.xx',
      riffs: [
        [3, 0, 0, 4, 0, 0, 3, 0, 2, 0, 0, 0, 1, 0, 0, 0],
        [2, 0, 0, 3, 0, 0, 4, 0, 3, 0, 2, 0, 0, 0, 0, 0],
        [3, 0, 0, 3, 0, 4, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0],
        [4, 0, 0, 3, 0, 0, 2, 0, 1, 0, 2, 0, 3, 0, 0, 0],
      ],
    },
  },
  // Genom-Keller: the chord is only the drone's root (A1); everything else is scheduled by `horror`.
  cellar: { chords: [[33]], chordSec: 8, plucks: 0, pulse: 0, bright: 300, pluck: 'sine', horror: 'cellar' },
  // The shadow of the player's line: lower (G1), slower, the Brutstation's tune bent to minor, the heart racing.
  cellarBoss: { chords: [[31]], chordSec: 9.6, plucks: 0, pulse: 0, bright: 300, pluck: 'sine', horror: 'boss' },
};

const LOOKAHEAD_SEC = 1.2;
const TICK_MS = 250;
const FADE_SEC = 1.5;

const hz = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let bus: GainNode | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let nextChordAt = 0;
let chordIndex = 0;
let mood: Mood = 'lab';
let volume = 0.5;
let playing = false;
/** Gain per scheduled chord, so a mood change can fade the sounding ones out. */
let voices: { gain: GainNode; end: number }[] = [];
let moodTimer: ReturnType<typeof setTimeout> | null = null;
/** Mood the pending `moodTimer` switches to. */
let pendingMood: Mood | null = null;
const CROSSFADE_SEC = 1.2;
/** Delay before a tab switch changes the mood (flicking through tabs keeps the track). */
const MOOD_DELAY_MS = 350;
let noiseBuffer: AudioBuffer | null = null;

/** A long, soft reverb from decaying noise. */
function reverb(c: AudioContext): ConvolverNode {
  const seconds = 3;
  const frames = Math.floor(c.sampleRate * seconds);
  const buffer = c.createBuffer(2, frames, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / frames, 2.5);
  }
  const conv = c.createConvolver();
  conv.buffer = buffer;
  return conv;
}

function build(c: AudioContext): void {
  master = c.createGain();
  master.gain.value = 0;
  master.connect(c.destination);
  bus = c.createGain();
  const dry = c.createGain();
  dry.gain.value = 0.55;
  const wet = c.createGain();
  wet.gain.value = 0.6;
  const rev = reverb(c);
  bus.connect(dry).connect(master);
  bus.connect(rev).connect(wet).connect(master);
}

/** A tone with attack/release envelope and low-pass, into `out` (a chord's gain). */
function tone(c: AudioContext, out: AudioNode, midi: number, at: number, length: number, type: OscillatorType, level: number, cutoff: number, attack: number, detune = 0): void {
  const osc = c.createOscillator();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.value = hz(midi);
  osc.detune.value = detune;
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(level, at + attack);
  gain.gain.setValueAtTime(level, at + Math.max(attack, length - attack));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length + attack);
  osc.connect(filter).connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + length + attack + 0.1);
}

/** Half a second of white noise for drums. */
function noise(c: AudioContext): AudioBuffer {
  if (noiseBuffer && noiseBuffer.sampleRate === c.sampleRate) return noiseBuffer;
  const frames = Math.floor(c.sampleRate * 0.5);
  noiseBuffer = c.createBuffer(1, frames, c.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

/** A filtered noise burst (snare, tick). */
function hit(c: AudioContext, out: AudioNode, at: number, type: BiquadFilterType, freq: number, level: number, decay: number): void {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  const gain = c.createGain();
  gain.gain.setValueAtTime(level, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  src.connect(filter).connect(gain).connect(out);
  src.start(at);
  src.stop(at + decay + 0.05);
}

/** A deep drum: a sine falling in pitch with a short skin slap on top. */
function drum(c: AudioContext, out: AudioNode, at: number, level: number): void {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, at);
  osc.frequency.exponentialRampToValueAtTime(42, at + 0.3);
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(level, at + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.55);
  osc.connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + 0.6);
  hit(c, out, at, 'lowpass', 900, level * 0.25, 0.08);
}

function scheduleChord(c: AudioContext, at: number): void {
  const m = MOODS[mood];
  const index = chordIndex;
  const chord = m.chords[index % m.chords.length]!;
  chordIndex++;
  const len = m.chordSec;
  const out = c.createGain();
  out.connect(bus!);
  voices.push({ gain: out, end: at + len + 3 });
  if (m.horror) return horror(c, out, at, len, chord[0]!, m.horror === 'boss', index);
  // Pad: two slightly detuned saws per note, slow swell.
  const pad = m.pad ?? 0.035;
  for (const n of chord.slice(1)) {
    tone(c, out, n, at, len, 'sawtooth', pad, m.bright, len * 0.35, -7);
    tone(c, out, n, at, len, 'sawtooth', pad, m.bright, len * 0.35, 7);
  }
  // Bass: one long note, a pulse or the grid's ostinato.
  const root = chord[0]! - 12;
  const g = m.grid;
  if (g) {
    const step = len / g.steps;
    const on = (pattern: string | undefined, k: number) => pattern?.[k] === 'x';
    const riff = g.riffs?.[index % g.riffs.length];
    for (let k = 0; k < g.steps; k++) {
      const t = at + k * step;
      if (on(g.drum, k)) drum(c, out, t, k === 0 ? 0.5 : 0.36);
      if (on(g.snare, k)) {
        hit(c, out, t, 'bandpass', 1800, 0.16, 0.16);
        tone(c, out, 55, t, 0.04, 'triangle', 0.06, 900, 0.003);
      }
      if (on(g.hat, k)) hit(c, out, t, 'highpass', 7000, 0.035, 0.05);
      if (on(g.bass, k)) tone(c, out, root, t, step * 0.55, 'sawtooth', k % 4 === 0 ? 0.13 : 0.09, 650, 0.004);
      const n = riff?.[k] ?? 0;
      if (n > 0) {
        // Horn: held until the next riff note, two detuned saws with a soft attack.
        let hold = 1;
        while (k + hold < g.steps && !riff![k + hold]) hold++;
        const note = chord[Math.min(n, chord.length - 1)]! + 12;
        const length = step * Math.min(hold, 4) * 0.85;
        tone(c, out, note, t, length, 'sawtooth', 0.04, 1700, 0.03, -5);
        tone(c, out, note, t, length, 'sawtooth', 0.04, 1700, 0.03, 5);
      }
    }
    if (!g.bass) tone(c, out, root, at, len, 'sine', 0.14, 400, 1.2);
  } else if (m.pulse > 0) {
    for (let t = 0; t < len - 0.01; t += m.pulse) tone(c, out, root, at + t, m.pulse * 0.6, 'triangle', 0.16, 500, 0.02);
  } else {
    tone(c, out, root, at, len, 'sine', 0.14, 400, 1.2);
  }
  // Plucks: sparse random notes from the chord (an octave up unless the mood says otherwise).
  const up = m.pluckOctave ?? 12;
  for (let i = 0; i < m.plucks; i++) {
    const when = at + Math.random() * (len - 0.5);
    const note = chord[1 + Math.floor(Math.random() * (chord.length - 1))]! + up;
    tone(c, out, note, when, m.pluckOctave && m.pluckOctave > 12 ? 0.6 : 0.25, m.pluck, m.pluck === 'square' ? 0.025 : m.pluckOctave && m.pluckOctave > 12 ? 0.045 : 0.07, 3200, 0.01);
  }
  // Sequencer: steps up and down through the chord, every other step an octave higher.
  if (m.arp) {
    const notes = chord.slice(1);
    const pattern = [...notes, ...notes.slice(1, -1).reverse()];
    for (let k = 0, t = 0; t < len - 0.01; k++, t += m.arp) {
      const note = pattern[k % pattern.length]! + (k % 2 ? 24 : 12);
      tone(c, out, note, at + t, m.arp * 0.5, 'triangle', k % 4 === 0 ? 0.05 : 0.03, 2000, 0.005);
    }
  }
}

// ---- Genom-Keller ---------------------------------------------------------------

/** How deep (0…1) and how dangerous (0…1) the cellar is right now – set by the Keller view. */
let atmosphere = { depth: 0, danger: 0 };

/** The Keller view reports depth and danger; the next segments of the cellar track follow them. */
export function setCellarAtmosphere(depth: number, danger: number): void {
  atmosphere = { depth: Math.max(0, Math.min(1, depth)), danger: Math.max(0, Math.min(1, danger)) };
}

/** A tone that glides from one pitch to another (drops, creaks). */
function glide(c: AudioContext, out: AudioNode, from: number, to: number, at: number, length: number, type: OscillatorType, level: number, cutoff: number): void {
  const osc = c.createOscillator();
  const filter = c.createBiquadFilter();
  const gain = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(hz(from), at);
  osc.frequency.exponentialRampToValueAtTime(hz(to), at + length);
  filter.type = 'lowpass';
  filter.frequency.value = cutoff;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(level, at + Math.min(0.02, length / 4));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(filter).connect(gain).connect(out);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

/** A whisper: looping noise through a band-pass that wanders, swelling and fading. */
function whisper(c: AudioContext, out: AudioNode, at: number, length: number, level: number): void {
  const src = c.createBufferSource();
  src.buffer = noise(c);
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 6;
  filter.frequency.setValueAtTime(500 + Math.random() * 300, at);
  filter.frequency.linearRampToValueAtTime(1100 + Math.random() * 800, at + length * 0.6);
  filter.frequency.linearRampToValueAtTime(600, at + length);
  const gain = c.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.linearRampToValueAtTime(level, at + length * 0.4);
  gain.gain.linearRampToValueAtTime(0.0001, at + length);
  src.connect(filter).connect(gain).connect(out);
  src.start(at);
  src.stop(at + length + 0.05);
}

/** One heartbeat: a dull „lub“ and a softer „dub“. */
function heartbeat(c: AudioContext, out: AudioNode, at: number, level: number): void {
  for (const [t, l] of [[0, level], [0.2, level * 0.6]] as const) {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(68, at + t);
    osc.frequency.exponentialRampToValueAtTime(40, at + t + 0.16);
    gain.gain.setValueAtTime(0.0001, at + t);
    gain.gain.linearRampToValueAtTime(l, at + t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + t + 0.28);
    osc.connect(gain).connect(out);
    osc.start(at + t);
    osc.stop(at + t + 0.32);
  }
}

/** A lullaby from the lab's early days (A minor), for the broken music box. */
const LULLABY = [76, 72, 74, 71, 72, 69, 71, 68, 69];
/**
 * The shadow's tune: the Brutstation's chords (C – Am7 – F – G) as a falling
 * arpeggio, every major third and sixth bent down a semitone into minor.
 */
const BENT_BROOD = (() => {
  const brood = [[60, 64, 67], [60, 64, 57], [65, 60, 57], [62, 59, 55]];
  const bend = (n: number) => ([4, 9, 11].includes(n % 12) ? n - 1 : n);
  return brood.flatMap((chord) => chord.map(bend));
})();

/** The music box: detuned, uneven, winding down – and sometimes it just stops. */
function musicBox(c: AudioContext, out: AudioNode, at: number, len: number, boss: boolean): void {
  const tune = boss ? BENT_BROOD : LULLABY;
  const stopAt = Math.random() < 0.35 ? 3 + Math.floor(Math.random() * (tune.length - 3)) : tune.length;
  let t = at + 0.4 + Math.random() * 1.2;
  let step = boss ? 0.72 : 0.5;
  for (let i = 0; i < stopAt && t < at + len - 0.3; i++) {
    const note = tune[i]! + (boss ? -12 : 0);
    const detune = (Math.random() - 0.5) * (boss ? 70 : 45);
    tone(c, out, note, t, 0.5, 'sine', 0.05, 5000, 0.005, detune);
    tone(c, out, note + 12, t, 0.25, 'triangle', 0.012, 6000, 0.005, detune);
    // Winding down: every note a little later than the last, never quite even.
    step *= 1.06 + Math.random() * 0.06;
    t += step * (0.85 + Math.random() * 0.3);
  }
}

/** Sounds in the dark: a drop, creaking metal, a distant knock or a whisper. */
function roomSound(c: AudioContext, out: AudioNode, at: number): void {
  const kind = Math.floor(Math.random() * 4);
  if (kind === 0) glide(c, out, 96 + Math.random() * 4, 84, at, 0.07, 'sine', 0.06, 6000);
  else if (kind === 1) {
    glide(c, out, 40, 44 + Math.random() * 3, at, 0.7, 'sawtooth', 0.025, 420);
    glide(c, out, 44, 38, at + 0.7, 0.6, 'sawtooth', 0.02, 380);
  } else if (kind === 2) {
    const n = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) hit(c, out, at + i * (0.32 + Math.random() * 0.1), 'lowpass', 260, 0.18, 0.18);
  } else whisper(c, out, at, 1.6 + Math.random(), 0.035);
}

/**
 * One segment of the cellar track: the breathing drone (two sines a few cents
 * apart, so they beat slowly), deeper down a tritone and then a minor-second
 * cluster, the music box every other segment, one to three sounds in the dark,
 * and a heartbeat when the team is in danger (always against the shadow).
 */
function horror(c: AudioContext, out: AudioNode, at: number, len: number, root: number, boss: boolean, index: number): void {
  const { depth, danger } = atmosphere;
  const swell = len * 0.45;
  tone(c, out, root, at, len, 'sine', 0.16, 300, swell, -4);
  tone(c, out, root, at, len, 'sine', 0.16, 300, swell, 5);
  tone(c, out, root + 12, at, len, 'sawtooth', 0.018, 180, swell, 9);
  if (boss || depth > 0.15) tone(c, out, root + 18, at, len, 'sine', 0.02 + 0.04 * (boss ? 1 : depth), 500, swell, -12);
  if (boss || depth > 0.5) {
    tone(c, out, root + 25, at + len * 0.3, len * 0.6, 'triangle', 0.012 + 0.012 * depth, 900, 1.5);
    tone(c, out, root + 26, at + len * 0.35, len * 0.55, 'triangle', 0.012 + 0.012 * depth, 900, 1.5);
  }
  if (boss || index % 2 === 0) musicBox(c, out, at, len, boss);
  const sounds = 1 + Math.floor(Math.random() * (2 + depth * 2));
  for (let i = 0; i < sounds; i++) roomSound(c, out, at + Math.random() * (len - 1.5));
  const fear = boss ? 0.9 : danger;
  if (fear > 0.35) {
    const beat = boss ? 0.75 : 1.15 - 0.45 * fear;
    for (let t = 0.2; t < len - 0.3; t += beat) heartbeat(c, out, at + t, 0.12 + 0.18 * fear);
  }
}

function tick(): void {
  if (!ctx || !playing) return;
  // Hidden tab: let the scheduled notes run out, schedule nothing new.
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    nextChordAt = Math.max(nextChordAt, ctx.currentTime);
    return;
  }
  if (nextChordAt < ctx.currentTime) nextChordAt = ctx.currentTime + 0.1;
  voices = voices.filter((v) => v.end > ctx!.currentTime);
  while (nextChordAt < ctx.currentTime + LOOKAHEAD_SEC) {
    scheduleChord(ctx, nextChordAt);
    nextChordAt += MOODS[mood].chordSec;
  }
}

/** Browsers only start audio after a user gesture: resume on the first one. */
function resumeOnGesture(): void {
  if (!ctx || ctx.state !== 'suspended' || typeof window === 'undefined') return;
  const resume = () => {
    void ctx?.resume();
    window.removeEventListener('pointerdown', resume);
    window.removeEventListener('keydown', resume);
  };
  window.addEventListener('pointerdown', resume);
  window.addEventListener('keydown', resume);
}

function start(): void {
  ctx = audioContext();
  if (!ctx) return;
  if (!master) build(ctx);
  playing = true;
  resumeOnGesture();
  master!.gain.cancelScheduledValues(ctx.currentTime);
  master!.gain.setValueAtTime(master!.gain.value, ctx.currentTime);
  master!.gain.linearRampToValueAtTime(0.35 * volume, ctx.currentTime + FADE_SEC);
  nextChordAt = ctx.currentTime + 0.1;
  timer ??= setInterval(tick, TICK_MS);
  tick();
}

function stop(): void {
  playing = false;
  if (timer) clearInterval(timer);
  timer = null;
  if (ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setValueAtTime(master.gain.value, ctx.currentTime);
    master.gain.linearRampToValueAtTime(0, ctx.currentTime + FADE_SEC);
  }
}

/** Fades out what is sounding and lets the new mood swell in right away. */
function crossfade(next: Mood): void {
  mood = next;
  chordIndex = 0;
  if (!ctx || !playing) return;
  const now = ctx.currentTime;
  for (const v of voices) {
    v.gain.gain.cancelScheduledValues(now);
    v.gain.gain.setValueAtTime(v.gain.gain.value, now);
    v.gain.gain.linearRampToValueAtTime(0, now + CROSSFADE_SEC);
  }
  voices = [];
  nextChordAt = now + 0.15;
  tick();
}

/** Turns the music on/off, sets its volume (0…1) and the mood of the current area. */
export function setMusic(on: boolean, vol: number, next: Mood): void {
  try {
    if (next === mood || !playing) {
      // Back on the area that is playing before the switch took effect – or silent, so switch at once.
      cancelPending();
      if (next !== mood) {
        mood = next;
        chordIndex = 0;
      }
    } else if (next !== pendingMood) {
      // Flicking through tabs should not restart the music on every tab: wait a moment. A repeated call
      // for the same mood keeps the running timer (App calls this on every re-render).
      cancelPending();
      pendingMood = next;
      moodTimer = setTimeout(() => {
        moodTimer = null;
        pendingMood = null;
        crossfade(next);
      }, MOOD_DELAY_MS);
    }
    volume = Math.max(0, Math.min(1, vol));
    if (on && volume > 0) {
      if (!playing) start();
      else if (ctx && master) master.gain.setTargetAtTime(0.35 * volume, ctx.currentTime, 0.2);
    } else if (playing) stop();
  } catch {
    /* music is optional */
  }
}

function cancelPending(): void {
  if (moodTimer) clearTimeout(moodTimer);
  moodTimer = null;
  pendingMood = null;
}

/** The mood that is playing (or will play once the music starts). */
export function currentMood(): Mood {
  return mood;
}

/** Mood per area of the tab bar (`GROUPS` in App.svelte), so a track keeps playing across its sub-tabs. */
const AREA_MOODS: Record<string, Mood> = { base: 'lab', breed: 'breeding', adventure: 'tower', progress: 'aeon' };

/** Mood for the open tab in its area; the Genlabor keeps its own sequencer track. */
export function moodFor(tab: string, area: string): Mood {
  if (tab === 'genetics') return 'genetics';
  return AREA_MOODS[area] ?? 'lab';
}

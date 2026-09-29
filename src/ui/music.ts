import { audioContext } from './sound';

/**
 * Background music, generated live with Web Audio (no sound files, nothing
 * to download): a slow chord progression as a soft pad, a bass note, sparse
 * plucked arpeggios and a long reverb. Each area has its own mood; a new
 * mood takes over at the next chord, so tab switches blend in.
 *
 * `setMusic(on, volume, mood)` is the only entry point; it is called from an
 * effect in App.svelte whenever the settings or the tab change.
 */

export type Mood = 'lab' | 'tower' | 'aeon';

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
}

const MOODS: Record<Mood, MoodDef> = {
  // Calm lab: Am9 – Fmaj7 – Cmaj7 – G6.
  lab: { chords: [[57, 60, 64, 67, 71], [53, 57, 60, 64, 69], [48, 55, 59, 64, 67], [55, 59, 62, 64, 71]], chordSec: 8, plucks: 5, pulse: 0, bright: 900, pluck: 'triangle' },
  // Tower: minor and driving, a steady bass pulse. Dm – Bb – C – A.
  tower: { chords: [[50, 57, 62, 65, 69], [46, 53, 58, 62, 65], [48, 55, 60, 64, 67], [45, 52, 57, 61, 64]], chordSec: 4, plucks: 6, pulse: 0.5, bright: 1300, pluck: 'square' },
  // Äon: floating lydian colours, long chords, bell-like plucks. Fmaj7#11 – Cmaj9 – Em7 – Dsus2.
  aeon: { chords: [[53, 60, 64, 67, 71], [48, 55, 59, 62, 64], [52, 59, 62, 67, 71], [50, 57, 62, 64, 69]], chordSec: 10, plucks: 4, pulse: 0, bright: 700, pluck: 'sine' },
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

/** A tone with attack/release envelope and low-pass, into the music bus. */
function tone(c: AudioContext, midi: number, at: number, length: number, type: OscillatorType, level: number, cutoff: number, attack: number, detune = 0): void {
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
  osc.connect(filter).connect(gain).connect(bus!);
  osc.start(at);
  osc.stop(at + length + attack + 0.1);
}

function scheduleChord(c: AudioContext, at: number): void {
  const m = MOODS[mood];
  const chord = m.chords[chordIndex % m.chords.length]!;
  chordIndex++;
  const len = m.chordSec;
  // Pad: two slightly detuned saws per note, slow swell.
  for (const n of chord.slice(1)) {
    tone(c, n, at, len, 'sawtooth', 0.035, m.bright, len * 0.35, -7);
    tone(c, n, at, len, 'sawtooth', 0.035, m.bright, len * 0.35, 7);
  }
  // Bass: one long note or a pulse.
  const root = chord[0]! - 12;
  if (m.pulse > 0) {
    for (let t = 0; t < len - 0.01; t += m.pulse) tone(c, root, at + t, m.pulse * 0.6, 'triangle', 0.16, 500, 0.02);
  } else {
    tone(c, root, at, len, 'sine', 0.14, 400, 1.2);
  }
  // Plucks: sparse random notes from the chord an octave up.
  for (let i = 0; i < m.plucks; i++) {
    const when = at + Math.random() * (len - 0.5);
    const note = chord[1 + Math.floor(Math.random() * (chord.length - 1))]! + 12;
    tone(c, note, when, 0.25, m.pluck, m.pluck === 'square' ? 0.025 : 0.07, 2600, 0.01);
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

/** Turns the music on/off, sets its volume (0…1) and the mood of the current area. */
export function setMusic(on: boolean, vol: number, next: Mood): void {
  try {
    if (next !== mood) {
      mood = next;
      chordIndex = 0;
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

/** Mood for a tab id. */
export function moodFor(tab: string): Mood {
  if (tab === 'tower') return 'tower';
  if (tab === 'aeon' || tab === 'anomalies' || tab === 'prestige') return 'aeon';
  return 'lab';
}

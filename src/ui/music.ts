import { audioContext } from './sound';

/**
 * Background music, generated live with Web Audio (no sound files, nothing
 * to download): a slow chord progression as a soft pad, a bass note, sparse
 * plucked arpeggios and a long reverb. Each area has its own mood; on a
 * tab switch the sounding chords fade out while the new mood swells in.
 *
 * `setMusic(on, volume, mood)` is the only entry point; it is called from an
 * effect in App.svelte whenever the settings or the tab change.
 */

export type Mood = 'lab' | 'breeding' | 'genetics' | 'tower' | 'aeon' | 'isekai';

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
  isekai: { chords: [[50, 57, 62, 65, 69], [51, 58, 63, 67, 70], [50, 57, 62, 65, 69], [48, 55, 60, 64, 67]], chordSec: 7, plucks: 3, pulse: 0, bright: 520, pluck: 'triangle', pluckOctave: 12 },
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
const CROSSFADE_SEC = 1.2;

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

function scheduleChord(c: AudioContext, at: number): void {
  const m = MOODS[mood];
  const chord = m.chords[chordIndex % m.chords.length]!;
  chordIndex++;
  const len = m.chordSec;
  const out = c.createGain();
  out.connect(bus!);
  voices.push({ gain: out, end: at + len + 3 });
  // Pad: two slightly detuned saws per note, slow swell.
  for (const n of chord.slice(1)) {
    tone(c, out, n, at, len, 'sawtooth', 0.035, m.bright, len * 0.35, -7);
    tone(c, out, n, at, len, 'sawtooth', 0.035, m.bright, len * 0.35, 7);
  }
  // Bass: one long note or a pulse.
  const root = chord[0]! - 12;
  if (m.pulse > 0) {
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
    if (next !== mood) {
      // Flicking through tabs should not restart the music on every tab: wait a moment.
      if (moodTimer) clearTimeout(moodTimer);
      if (playing) moodTimer = setTimeout(() => {
        moodTimer = null;
        crossfade(next);
      }, 350);
      else {
        mood = next;
        chordIndex = 0;
      }
    } else if (moodTimer) {
      // Back on the area that is playing before the switch took effect.
      clearTimeout(moodTimer);
      moodTimer = null;
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
  if (tab === 'breeding') return 'breeding';
  if (tab === 'genetics') return 'genetics';
  if (tab === 'aeon' || tab === 'anomalies' || tab === 'prestige') return 'aeon';
  return 'lab';
}

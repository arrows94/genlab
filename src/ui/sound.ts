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

/** Recipe: schedules notes; `v` is an optional variant (pitch step, rarity order …). */
type Recipe = (s: Synth, v: number) => void;

/** Tools a recipe gets: notes and noise bursts, scheduled relative to „now“. */
interface Synth {
  /** One note: MIDI pitch, start and length in seconds, waveform, volume 0…1, low-pass cutoff. */
  note(midi: number, start: number, length: number, type?: OscillatorType, volume?: number, bright?: number): void;
  /** Filtered noise (crackle, rustle, whoosh). */
  noise(start: number, length: number, volume?: number, cutoff?: number): void;
  /** A note that glides from one pitch to another (horn, whoosh, falling tone). */
  slide(from: number, to: number, start: number, length: number, type?: OscillatorType, volume?: number, bright?: number): void;
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
  hatchRare: (s: Synth, v: number) => {
    s.noise(0, 0.05, 0.5, 5000);
    s.noise(0.12, 0.06, 0.55, 6000);
    // More sparkle with every rarity step (v = rarity order).
    [79, 83, 86, 91, 95, 98, 103].slice(0, 3 + Math.max(0, v - 1)).forEach((m, i) => s.note(m, 0.2 + i * 0.06, 0.25, 'triangle', 0.3, 7000));
    s.note(91, 0.55, 0.8, 'sine', 0.22, 7000);
    // Mythic: a small choir.
    if (v >= 5) for (const m of [67, 71, 74, 79]) {
      s.note(m, 0.6, 1.6, 'sawtooth', 0.06, 1400);
      s.note(m + 0.1, 0.6, 1.6, 'sawtooth', 0.06, 1400);
    }
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

  // ---- Grundgefühl ----
  /** „Sammeln“: a soft plop; `v` = step of a fast click series (pitch rises). */
  collect: (s: Synth, v: number) => {
    const m = 67 + Math.min(12, v) + (Math.random() - 0.5);
    s.slide(m + 7, m, 0, 0.09, 'sine', 0.4, 3000);
  },
  /** Buttons and tabs (optional, off by default): a very quiet click. */
  click: (s: Synth) => s.noise(0, 0.015, 0.12, 6000),
  /** Info toast without its own sound: a neutral soft tick. */
  toastInfo: (s: Synth) => s.note(81, 0, 0.08, 'sine', 0.18, 4000),
  /** Rare toast without its own sound: a glitter. */
  toastRare: (s: Synth) => [88, 91, 95, 100].forEach((m, i) => s.note(m, i * 0.05, 0.2, 'triangle', 0.18, 8000)),
  /** Failed action: a short, dull „bonk“. */
  bonk: (s: Synth) => {
    s.slide(52, 45, 0, 0.12, 'triangle', 0.35, 700);
  },
  /** Research bought: coin clink and a short tone. */
  research: (s: Synth) => {
    s.note(96, 0, 0.05, 'square', 0.08, 7000);
    s.note(100, 0.05, 0.08, 'square', 0.07, 7000);
    s.note(76, 0.08, 0.2, 'triangle', 0.3, 4000);
  },
  /** Research at its last level: a small chord. */
  researchMax: (s: Synth) => {
    s.note(96, 0, 0.05, 'square', 0.08, 7000);
    for (const m of [72, 76, 79, 84]) s.note(m, 0.08, 0.6, 'triangle', 0.22, 4000);
  },
  /** New area unlocked: „tadaa“, two notes up. */
  unlock: (s: Synth) => {
    s.note(72, 0, 0.14, 'triangle', 0.4, 4000);
    s.note(79, 0.16, 0.45, 'triangle', 0.4, 4000);
    s.note(84, 0.16, 0.45, 'sine', 0.2, 4000);
  },
  /** Achievement: a short jingle. */
  achievement: (s: Synth) => {
    [79, 84, 88].forEach((m, i) => s.note(m, i * 0.08, 0.15, 'square', 0.12, 3500));
    s.note(91, 0.26, 0.5, 'triangle', 0.3, 5000);
  },
  /** Back after a break (offline summary): a friendly greeting. */
  welcome: (s: Synth) => {
    s.note(67, 0, 0.25, 'sine', 0.3, 3000);
    s.note(72, 0.18, 0.25, 'sine', 0.3, 3000);
    s.note(76, 0.36, 0.6, 'sine', 0.3, 3000);
  },

  // ---- Zucht (Rest) ----
  /** Infusion: the chamber sucks the creatures in. */
  infuse: (s: Synth) => {
    s.noise(0, 0.45, 0.25, 1800);
    s.slide(48, 72, 0, 0.45, 'sine', 0.3, 2000);
  },
  /** Infusion level up. */
  infuseLevel: (s: Synth) => {
    s.noise(0, 0.35, 0.2, 1800);
    [72, 76, 79, 84].forEach((m, i) => s.note(m, 0.3 + i * 0.07, 0.25, 'triangle', 0.3, 5000));
  },
  /** Breakthrough to a new rarity: a short fanfare. */
  breakthrough: (s: Synth) => {
    const brass = (m: number, at: number, len: number) => s.note(m, at, len, 'sawtooth', 0.3, 1800);
    brass(67, 0, 0.12);
    brass(72, 0.14, 0.12);
    brass(76, 0.28, 0.12);
    for (const m of [72, 76, 79, 84]) brass(m, 0.44, 0.9);
  },
  /** Dynasty tier: a little coronation. */
  dynasty: (s: Synth) => {
    [60, 64, 67, 72].forEach((m, i) => s.note(m, i * 0.12, 0.2, 'sawtooth', 0.22, 1600));
    for (const m of [72, 76, 79]) s.note(m, 0.5, 1, 'triangle', 0.25, 3000);
    s.note(96, 0.5, 1.2, 'sine', 0.15, 8000);
  },
  /** Ritual egg hatched: a solemn bell. */
  ritualBell: (s: Synth) => {
    s.note(60, 0, 2, 'sine', 0.4, 3000);
    s.note(72, 0, 1.6, 'sine', 0.2, 4000);
    s.note(79.1, 0, 1.2, 'sine', 0.12, 5000);
    s.note(84, 0.01, 0.8, 'triangle', 0.08, 6000);
  },

  // ---- Wirtschaft & Erkundung ----
  /** Recycled: plop, then fragments clinking. */
  recycled: (s: Synth) => {
    s.slide(72, 60, 0, 0.1, 'sine', 0.35, 2500);
    [96, 100, 93, 98].forEach((m, i) => s.note(m, 0.12 + i * 0.05, 0.06, 'square', 0.06, 8000));
  },
  /** Capsule opening: rattling. */
  capsuleRattle: (s: Synth) => {
    for (let i = 0; i < 7; i++) s.noise(i * 0.1, 0.04, 0.25, 4000);
  },
  /** Capsule bursts: pop and whoosh; `v` = best rarity order (brighter and longer from epic on). */
  capsuleBurst: (s: Synth, v: number) => {
    s.noise(0, 0.25, 0.45, 5000);
    s.slide(60, 84, 0, 0.25, 'triangle', 0.3, 4000);
    if (v >= 3) [84, 88, 91, 96, 100].slice(0, v).forEach((m, i) => s.note(m, 0.25 + i * 0.07, 0.3, 'triangle', 0.22, 8000));
    if (v >= 5) for (const m of [72, 79, 84, 88]) s.note(m, 0.6, 1.4, 'sine', 0.15, 6000);
  },
  /** A card flips over. */
  cardFlip: (s: Synth) => s.noise(0, 0.03, 0.18, 7000),
  /** Market: coins and a gulp from the bottle. */
  potion: (s: Synth) => {
    s.note(96, 0, 0.05, 'square', 0.08, 7000);
    s.note(100, 0.05, 0.08, 'square', 0.07, 7000);
    for (let i = 0; i < 3; i++) s.slide(55 + i * 2, 62 + i * 2, 0.2 + i * 0.13, 0.08, 'sine', 0.3, 1500);
  },
  /** Expedition back: a horn. */
  horn: (s: Synth) => {
    s.slide(55, 60, 0, 0.3, 'sawtooth', 0.22, 1200);
    s.note(60, 0.3, 0.5, 'sawtooth', 0.2, 1200);
  },
  /** A wild creature was found: a chirpy call. */
  wild: (s: Synth) => {
    s.slide(84, 91, 0, 0.08, 'sine', 0.3, 5000);
    s.slide(88, 81, 0.1, 0.12, 'sine', 0.3, 5000);
    s.slide(84, 93, 0.25, 0.1, 'sine', 0.3, 5000);
  },
  /** The Wochenexpedition waits for a decision: a tense chord. */
  tension: (s: Synth) => {
    for (const m of [50, 56, 61]) s.note(m, 0, 1.4, 'sawtooth', 0.12, 900);
    s.note(62, 0.5, 0.9, 'sine', 0.2, 2000);
  },
  /** Contract delivered: stamp and coins. */
  contract: (s: Synth) => {
    s.noise(0, 0.06, 0.6, 900);
    s.note(40, 0, 0.1, 'sine', 0.4, 400);
    [96, 100, 93].forEach((m, i) => s.note(m, 0.15 + i * 0.05, 0.06, 'square', 0.07, 8000));
  },
  /** Daily reward: a chest creaks open. */
  chest: (s: Synth) => {
    s.slide(45, 52, 0, 0.3, 'sawtooth', 0.12, 700);
    [79, 84, 88, 91].forEach((m, i) => s.note(m, 0.32 + i * 0.06, 0.3, 'triangle', 0.25, 6000));
  },

  // ---- Turm & Endgame ----
  /** Normal hit. */
  hit: (s: Synth) => {
    s.noise(0, 0.05, 0.3, 2500);
    s.note(45, 0, 0.06, 'triangle', 0.25, 800);
  },
  /** Super effective: brighter. */
  hitCrit: (s: Synth) => {
    s.noise(0, 0.07, 0.4, 7000);
    s.note(88, 0, 0.08, 'square', 0.12, 6000);
  },
  /** Resisted: dull. */
  hitWeak: (s: Synth) => {
    s.noise(0, 0.05, 0.25, 700);
  },
  /** An Element-Technik: a rising shimmer. */
  technique: (s: Synth) => {
    s.noise(0, 0.12, 0.15, 5000);
    s.slide(72, 84, 0, 0.18, 'triangle', 0.22, 5000);
  },
  /** Dodged: a whoosh. */
  whoosh: (s: Synth) => s.noise(0, 0.14, 0.2, 3500),
  /** A fighter goes down. */
  ko: (s: Synth) => s.slide(60, 36, 0, 0.35, 'triangle', 0.3, 1200),
  /** Floor cleared. */
  floorClear: (s: Synth) => {
    s.note(72, 0, 0.12, 'triangle', 0.3, 4000);
    s.note(79, 0.1, 0.3, 'triangle', 0.3, 4000);
  },
  /** A boss floor starts: a deep drum. */
  drum: (s: Synth) => {
    s.slide(45, 30, 0, 0.3, 'sine', 0.7, 400);
    s.slide(45, 30, 0.35, 0.3, 'sine', 0.6, 400);
  },
  /** Tower run over. */
  runEnded: (s: Synth) => {
    [67, 63, 60].forEach((m, i) => s.note(m, i * 0.18, 0.3, 'triangle', 0.25, 2000));
  },
  /** Tower milestone (every 50 floors): fanfare. */
  milestone: (s: Synth) => {
    const brass = (m: number, at: number, len: number) => s.note(m, at, len, 'sawtooth', 0.3, 1800);
    brass(72, 0, 0.15);
    brass(72, 0.18, 0.15);
    for (const m of [67, 72, 76, 79]) brass(m, 0.36, 1);
  },
  /** Relic bought: a metallic ring. */
  relic: (s: Synth) => {
    s.note(84, 0, 0.8, 'sine', 0.3, 8000);
    s.note(91.2, 0, 0.6, 'sine', 0.18, 8000);
  },
  /** Weekly boss hit (the whole attack). */
  bossHit: (s: Synth) => {
    for (let i = 0; i < 4; i++) s.noise(i * 0.12, 0.06, 0.35, 2500);
    s.slide(40, 33, 0.45, 0.4, 'sawtooth', 0.25, 600);
  },
  /** Weekly boss: a reward tier reached. */
  bossTier: (s: Synth) => {
    [76, 79, 84].forEach((m, i) => s.note(m, i * 0.1, 0.3, 'triangle', 0.3, 5000));
  },
  /** Vererbung: a rushing wind and a bell. */
  prestige: (s: Synth) => {
    s.noise(0, 1, 0.35, 2000);
    s.note(72, 0.8, 1.6, 'sine', 0.35, 4000);
    s.note(84, 0.8, 1.2, 'sine', 0.15, 5000);
  },
  /** Äon: a deep, long sound. */
  aeon: (s: Synth) => {
    for (const m of [36, 43, 48]) s.note(m, 0, 2.5, 'sawtooth', 0.15, 500);
    s.note(84, 1, 1.8, 'sine', 0.15, 6000);
  },
  /** Talent learned. */
  talent: (s: Synth) => {
    s.note(79, 0, 0.3, 'sine', 0.3, 5000);
    s.note(86, 0.12, 0.5, 'sine', 0.3, 5000);
  },
  /** Großprojekt stage done. */
  construction: (s: Synth) => {
    for (let i = 0; i < 3; i++) s.noise(i * 0.15, 0.05, 0.4, 1500);
    for (const m of [60, 67, 72]) s.note(m, 0.5, 0.8, 'triangle', 0.25, 3000);
  },
  /** GenLab RPG portal: a swelling pull into the vortex and a dull thud (0 = in); backwards on the way home (1). */
  portal: (s: Synth, v: number) => {
    const into = v === 0;
    s.slide(into ? 36 : 72, into ? 72 : 36, 0, 1.6, 'sawtooth', 0.12, 900);
    s.slide(into ? 43 : 79, into ? 79 : 43, 0.08, 1.5, 'sine', 0.14, 2200);
    for (let i = 0; i < 6; i++) s.noise(i * 0.24, 0.32, into ? 0.08 + i * 0.03 : 0.23 - i * 0.03, 700 + i * 450);
    s.note(33, 1.6, 1.3, 'sine', 0.4, 260);
  },
  /** Anomaly starts: a warped tone. */
  anomalyStart: (s: Synth) => {
    s.slide(60, 54, 0, 0.8, 'sawtooth', 0.2, 900);
    s.slide(61, 66, 0, 0.8, 'sawtooth', 0.15, 900);
  },
  /** Anomaly mastered. */
  anomalyDone: (s: Synth) => {
    s.slide(54, 60, 0, 0.3, 'sawtooth', 0.2, 900);
    for (const m of [72, 76, 79, 84]) s.note(m, 0.3, 0.8, 'triangle', 0.22, 4000);
  },

  /** Short sample for the volume setting. */
  test: (s: Synth) => {
    s.note(72, 0, 0.12, 'triangle', 0.5, 4000);
    s.note(79, 0.1, 0.2, 'triangle', 0.5, 4000);
  },
} satisfies Record<string, Recipe>;

/** A switchable entry in Optionen → „Einzelne Klänge“ (`hum` is the Zerlege-Kammer's hum). */
export type SoundKey = SoundName | 'hum';

/** Groups and names for switching single sounds off (every sound except the volume sample). */
export const SOUND_GROUPS: { name: string; sounds: { id: SoundKey; name: string }[] }[] = [
  { name: 'Allgemein', sounds: [
    { id: 'collect', name: 'Sammeln' }, { id: 'click', name: 'Klicken bei Knöpfen' }, { id: 'toastInfo', name: 'Hinweis' },
    { id: 'toastRare', name: 'Seltener Hinweis' }, { id: 'bonk', name: 'Fehler' }, { id: 'research', name: 'Forschung gekauft' },
    { id: 'researchMax', name: 'Forschung ausgebaut' }, { id: 'unlock', name: 'Neuer Bereich' }, { id: 'achievement', name: 'Erfolg' },
    { id: 'welcome', name: 'Begrüßung nach einer Pause' },
  ] },
  { name: 'Brutstation & Kreaturen', sounds: [
    { id: 'eggLaid', name: 'Ei gelegt' }, { id: 'hatch', name: 'Schlüpfen' }, { id: 'hatchRare', name: 'Seltenes Schlüpfen' },
    { id: 'twins', name: 'Zwillinge' }, { id: 'discovery', name: 'Neuer Hybrid' }, { id: 'ritualBell', name: 'Brutritual' },
    { id: 'infuse', name: 'Infusion' }, { id: 'infuseLevel', name: 'Infusion: Stufe hoch' }, { id: 'breakthrough', name: 'Durchbruch' },
    { id: 'dynasty', name: 'Dynastie-Stufe' }, { id: 'perfect', name: 'Optimale DNS' }, { id: 'shiny', name: 'Schillernd' },
  ] },
  { name: 'Genlabor', sounds: [
    { id: 'sequenced', name: 'Sequenzierung fertig' }, { id: 'deepSequenced', name: 'Tiefensequenzierung' }, { id: 'catalogued', name: 'Neues Allel' },
    { id: 'spliceOk', name: 'Splicing gelungen' }, { id: 'spliceFail', name: 'Splicing instabil' },
  ] },
  { name: 'Recycler, Markt & Erkundung', sounds: [
    { id: 'recycled', name: 'Recycelt' }, { id: 'hum', name: 'Brummen der Zerlege-Kammer' }, { id: 'capsuleRattle', name: 'Kapsel rüttelt' },
    { id: 'capsuleBurst', name: 'Kapsel platzt auf' }, { id: 'cardFlip', name: 'Karten umdrehen' }, { id: 'potion', name: 'Trank' },
    { id: 'horn', name: 'Erkundung zurück' }, { id: 'wild', name: 'Wilde Kreatur' }, { id: 'tension', name: 'Wochenexpedition wartet' },
    { id: 'contract', name: 'Gen-Auftrag' }, { id: 'chest', name: 'Tagesbelohnung' },
  ] },
  { name: 'Turm', sounds: [
    { id: 'hit', name: 'Treffer' }, { id: 'hitCrit', name: 'Starker Treffer' }, { id: 'hitWeak', name: 'Resistierter Treffer' },
    { id: 'whoosh', name: 'Ausweichen' }, { id: 'technique', name: 'Element-Technik' }, { id: 'ko', name: 'K.O.' },
    { id: 'drum', name: 'Boss-Trommel' }, { id: 'floorClear', name: 'Etage geschafft' }, { id: 'runEnded', name: 'Lauf beendet' },
    { id: 'milestone', name: 'Meilenstein' }, { id: 'relic', name: 'Relikt gekauft' }, { id: 'bossHit', name: 'Wochen-Boss: Angriff' },
    { id: 'bossTier', name: 'Wochen-Boss: Belohnungsstufe' },
  ] },
  { name: 'GenLab RPG', sounds: [{ id: 'portal', name: 'Portal in die andere Welt' }] },
  { name: 'Endgame', sounds: [
    { id: 'prestige', name: 'Vererbung' }, { id: 'aeon', name: 'Äon' }, { id: 'talent', name: 'Talent, Resonanz, Heilung im Turm' },
    { id: 'construction', name: 'Großprojekt' }, { id: 'anomalyStart', name: 'Anomalie beginnt' }, { id: 'anomalyDone', name: 'Anomalie gemeistert' },
  ] },
];

/** Plays a sound for the options list, even if it is switched off (still needs „Töne“). */
export function preview(name: SoundKey): void {
  if (name === 'hum') {
    const stop = startHum(38, true);
    setTimeout(stop, 1500);
    return;
  }
  const muted = prefs.mutedSounds;
  prefs.mutedSounds = [];
  lastPlayed.delete(name);
  try {
    play(name, 3);
  } finally {
    prefs.mutedSounds = muted;
  }
}

/** Minimum time between two plays of the same sound (ms); default below. */
const LIMITS: Partial<Record<SoundName, number>> = {
  collect: 40, click: 30, toastInfo: 400, toastRare: 600, bonk: 250, research: 120, unlock: 800, achievement: 800,
  hit: 60, hitCrit: 90, technique: 120, hitWeak: 60, whoosh: 80, cardFlip: 40, recycled: 500, horn: 1500, wild: 1200,
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
    slide(from, to, start, length, type = 'triangle', volume = 0.4, bright = 2400) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = type;
      const t = ctx.currentTime + start;
      osc.frequency.setValueAtTime(hz(from), t);
      osc.frequency.exponentialRampToValueAtTime(hz(to), t + length);
      filter.type = 'lowpass';
      filter.frequency.value = bright;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(volume, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + length + 0.15);
      osc.connect(filter).connect(gain).connect(out);
      osc.start(t);
      osc.stop(t + length + 0.2);
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

/** Sounds allowed right now (null = all): in the other world nothing from the lab is heard. */
let scope: ReadonlySet<SoundName> | null = null;

export function setSoundScope(names: readonly SoundName[] | null): void {
  scope = names ? new Set(names) : null;
}

/** Whether a sound may play right now (settings, scope, catch-up, background tab, throttle). */
function allowed(name: SoundName, now: number): boolean {
  if (!prefs.sound || prefs.volume <= 0 || muted > 0 || prefs.mutedSounds.includes(name)) return false;
  if (scope && !scope.has(name)) return false;
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return false;
  if (now - (lastPlayed.get(name) ?? -Infinity) < (LIMITS[name] ?? DEFAULT_GAP_MS)) return false;
  recent = recent.filter((t) => now - t < BURST_MS);
  return recent.length < BURST_MAX;
}

/** True while sounds are muted (offline catch-up). */
export function isMuted(): boolean {
  return muted > 0;
}

/** True when any sound started within the last `ms` (a generic toast sound gives way to a specific one). */
export function playedRecently(ms: number): boolean {
  const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return [...lastPlayed.values()].some((t) => now - t < ms);
}

export function play(name: SoundName, variant = 0): void {
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
    (SOUNDS[name] as Recipe)(synth(ctx, master), variant);
  } catch {
    /* audio is optional */
  }
}

/**
 * A quiet continuous sound (the Zerlege-Kammer's hum) while a view is open.
 * Returns the stop function; respects the same settings as `play`.
 */
export function startHum(midi = 38, force = false): () => void {
  if (!prefs.sound || prefs.volume <= 0 || muted > 0 || (!force && prefs.mutedSounds.includes('hum'))) return () => {};
  try {
    const ctx = audioContext();
    if (!ctx) return () => {};
    const out = ctx.createGain();
    out.gain.setValueAtTime(0, ctx.currentTime);
    out.gain.linearRampToValueAtTime(0.05 * prefs.volume, ctx.currentTime + 0.8);
    out.connect(ctx.destination);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 380;
    filter.connect(out);
    const oscs = [0, 7].map((detune) => {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = hz(midi);
      o.detune.value = detune;
      o.connect(filter);
      o.start();
      return o;
    });
    // Slow wobble of the filter: the machine breathes.
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 0.4;
    depth.gain.value = 120;
    lfo.connect(depth).connect(filter.frequency);
    lfo.start();
    return () => {
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value, t);
      out.gain.linearRampToValueAtTime(0, t + 0.5);
      for (const o of [...oscs, lfo]) o.stop(t + 0.6);
    };
  } catch {
    return () => {};
  }
}

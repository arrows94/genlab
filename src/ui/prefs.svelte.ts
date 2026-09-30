import { setNotation, type Notation } from '@core/format';

/**
 * Per-device preferences (not part of the save game): number notation,
 * reduced motion, sounds, music and notifications. Stored separately in localStorage.
 */
const KEY = 'genlab.prefs';

export const prefs = $state({
  notation: 'short' as Notation,
  reduceMotion: false,
  /** Game sounds (fanfares, effects). */
  sound: true,
  /** Effect volume 0…1. */
  volume: 0.7,
  /** Single sounds switched off in the options (sound names, see SOUND_GROUPS). */
  mutedSounds: [] as string[],
  /** Very quiet click on buttons and tabs (off by default). */
  uiClicks: false,
  /** Brutstation: one candidate list per parent once „Zwei Zuchtlisten“ is researched (off = one shared list). */
  breedingSplit: true,
  /** Background music (off by default). */
  music: false,
  /** Music volume 0…1, separate from the effects. */
  musicVolume: 0.5,
  /** Reminders while the game is in the background (needs the system permission). */
  notifications: false,
  /** Debug tools in the options (switched on with `?debug=1` in the address, off with `?debug=0`). */
  debug: false,
});

function apply(): void {
  setNotation(prefs.notation);
  if (typeof document !== 'undefined') document.documentElement.classList.toggle('reduce-motion', prefs.reduceMotion);
}

export function loadPrefs(): void {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(prefs, JSON.parse(raw));
  } catch {
    /* defaults */
  }
  if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches && !localStorage.getItem(KEY)) prefs.reduceMotion = true;
  apply();
  // `?debug=1` / `?debug=0` in the address switches the debug tools on or off for this device.
  const flag = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('debug') : null;
  if (flag === '1' || flag === '0') updatePrefs({ debug: flag === '1' });
}

export function updatePrefs(patch: Partial<typeof prefs>): void {
  Object.assign(prefs, patch);
  apply();
  try {
    localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

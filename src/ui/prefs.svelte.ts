import { setNotation, type Notation } from '@core/format';

/**
 * Per-device display preferences (not part of the save game): number
 * notation and reduced motion. Stored separately in localStorage.
 */
const KEY = 'genlab.prefs';

export const prefs = $state({
  notation: 'short' as Notation,
  reduceMotion: false,
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

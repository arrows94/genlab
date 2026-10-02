import type { Action } from 'svelte/action';

/**
 * `use:meter={share}` on a progress bar's track: announces it as a progress bar
 * (0–100 %) to screen readers. The bars keep their own look; this only adds
 * the semantics in one place.
 */
export const meter: Action<HTMLElement, number> = (node, share) => {
  const set = (v: number) => {
    node.setAttribute('role', 'progressbar');
    node.setAttribute('aria-valuemin', '0');
    node.setAttribute('aria-valuemax', '100');
    node.setAttribute('aria-valuenow', String(Math.round(Math.max(0, Math.min(1, Number.isFinite(v) ? v : 0)) * 100)));
  };
  set(share ?? 0);
  return { update: (v) => set(v ?? 0) };
};

<script lang="ts">
  /**
   * The progress bar of the whole game: three sizes, a tone that carries meaning
   * (teal progress, gold reward/rank, violet genetics/rare, danger risk/KP), a soft
   * glow when full. `label` is shown inside the large bar.
   */
  export type MeterTone = 'teal' | 'gold' | 'violet' | 'danger' | 'muted';

  let { value, size = 'md', tone = 'teal', color, label, title, low = false }: {
    /** Share 0…1 (clamped). */
    value: number;
    size?: 'sm' | 'md' | 'lg';
    tone?: MeterTone;
    /** Custom fill colour (overrides the tone, e.g. an element colour). */
    color?: string;
    label?: string;
    title?: string;
    /** Warning state (e.g. low KP): the danger tone, whatever the tone is. */
    low?: boolean;
  } = $props();

  const share = $derived(Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)));
  const fill = $derived(low ? 'var(--danger)' : (color ?? (tone === 'muted' ? 'var(--muted)' : `var(--${tone})`)));
</script>

<div
  class="meter {size}"
  class:full={share >= 1}
  style="--c: {fill}"
  role="progressbar"
  aria-valuemin="0"
  aria-valuemax="100"
  aria-valuenow={Math.round(share * 100)}
  aria-label={title ?? label}
  {title}
>
  <i style="width: {share * 100}%"></i>
  {#if label && size === 'lg'}<b class="num">{label}</b>{/if}
</div>

<style>
  .meter {
    position: relative; width: 100%; height: 8px; border-radius: 99px; overflow: hidden;
    background: var(--bg-2); box-shadow: inset 0 0 0 1px var(--line);
  }
  .meter.sm { height: 4px; }
  .meter.lg { height: 16px; }
  i {
    position: absolute; inset: 0 auto 0 0; border-radius: inherit;
    background: linear-gradient(90deg, color-mix(in srgb, var(--c) 72%, #000), var(--c));
    transition: width 0.3s ease;
  }
  .full i { box-shadow: 0 0 10px var(--c); }
  b {
    position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%);
    font-size: 0.68rem; font-weight: 700; line-height: 1; color: var(--text); text-shadow: 0 1px 2px #000;
  }
</style>

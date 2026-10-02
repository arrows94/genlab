<script lang="ts">
  import type { Snippet } from 'svelte';
  import { content } from '@content/index';
  import { expressedAppearance } from '@core/genetics';
  import type { Creature } from '@core/state';
  import { game } from '../store.svelte';
  import CreatureSvg from './CreatureSvg.svelte';

  /**
   * The creature tile of the whole game (pickers in Brutstation, Turm, Genlabor,
   * Markt …): element glow behind the art, rarity as a strip at the bottom, name
   * and one info line. Corners: left the selection mark, right one extra info
   * that depends on the place (`corner`). `children` adds lines under the info.
   */
  let { creature, info, mark = null, selected = false, disabled = false, dim = false, title, size = 44, onclick, corner, children }: {
    creature: Creature;
    /** The one info line under the name (e.g. „Gen 1 · Σ 68“). */
    info?: string;
    /** Selection: 1 (gold) / 2 (rosa) – parent slots, or true for a plain „chosen“ ring. */
    mark?: 1 | 2 | null;
    selected?: boolean;
    disabled?: boolean;
    /** Busy or not usable here, but still clickable (shown pale). */
    dim?: boolean;
    title?: string;
    size?: number;
    onclick?: () => void;
    corner?: Snippet;
    children?: Snippet;
  } = $props();

  const sp = $derived(content.species.get(creature.speciesId));
  const rar = $derived(content.rarities.get(creature.rarity));
  const el = $derived(content.elements.get(sp.element));
</script>

<button
  class="ctile"
  class:m1={mark === 1}
  class:m2={mark === 2}
  class:sel={selected && !mark}
  class:dim
  {disabled}
  style="--el: {el.color}; --rar: {rar.color}"
  title={title ?? `${creature.name} · ${sp.name} · ${rar.name}`}
  aria-pressed={mark !== null || selected}
  {onclick}
>
  {#if mark}<span class="tl">{mark}</span>{/if}
  {#if corner}<span class="tr">{@render corner()}</span>{/if}
  <span class="art"><CreatureSvg appearance={expressedAppearance(game, creature)} shape={sp.shape} tier={sp.tier} {size} shiny={creature.shiny} /></span>
  <span class="n">{creature.name}</span>
  {#if info}<span class="s num">{info}</span>{/if}
  {@render children?.()}
</button>

<style>
  .ctile {
    position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.1rem;
    width: 100%; min-width: 0; padding: 0.45rem 0.3rem 0.5rem; border-radius: 12px; text-align: center;
    background: var(--panel-2); border: 1px solid var(--line); color: var(--text);
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .ctile::after {
    content: ''; position: absolute; left: 10px; right: 10px; bottom: -1px; height: 3px; border-radius: 3px 3px 0 0; background: var(--rar);
  }
  .ctile:hover:not(:disabled) { border-color: color-mix(in srgb, var(--el) 60%, var(--line)); }
  .art {
    display: grid; place-items: center; border-radius: 50%; padding: 0.15rem;
    background: radial-gradient(circle, color-mix(in srgb, var(--el) 35%, transparent), transparent 70%);
  }
  .n { font-size: 0.75rem; font-weight: 600; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .s { font-size: 0.68rem; color: var(--muted); max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tl, .tr { position: absolute; top: 4px; font-size: 0.7rem; font-weight: 700; line-height: 1; }
  .tl { left: 7px; }
  .tr { right: 6px; display: flex; gap: 0.15rem; }
  .m1 { border-color: var(--gold); box-shadow: 0 0 0 1px var(--gold), 0 0 12px color-mix(in srgb, var(--gold) 45%, transparent); }
  .m1 .tl { color: var(--gold); }
  .m2 { border-color: var(--pink); box-shadow: 0 0 0 1px var(--pink), 0 0 12px color-mix(in srgb, var(--pink) 45%, transparent); }
  .m2 .tl { color: var(--pink); }
  .sel { border-color: var(--teal); box-shadow: 0 0 0 1px var(--teal), 0 0 12px color-mix(in srgb, var(--teal) 40%, transparent); }
  .dim, .ctile:disabled { opacity: 0.45; filter: saturate(0.4); }
  .ctile:disabled { cursor: not-allowed; }
</style>

<script lang="ts">
  import { content } from '@content/index';
  import { expressedAppearance } from '@core/genetics';
  import { formatDuration } from '@core/format';
  import type { BreedingRitualDef } from '@core/content/types';
  import type { Creature } from '@core/state';
  import { game } from '../store.svelte';
  import CreatureSvg from './CreatureSvg.svelte';
  import CrystalSkip from './CrystalSkip.svelte';
  import DnaHelix from './DnaHelix.svelte';
  import EggSvg from './EggSvg.svelte';

  export interface EggView {
    id: number;
    progress: number;
    ready: boolean;
    remaining: number;
    parents: (Creature | undefined)[];
    hues: [number, number];
    generation: number;
    ritual: BreedingRitualDef | null;
  }

  /** One nest (or the Ritualnest) with its egg, parents and progress. */
  let { egg, ritual, opening, onopen }: { egg: EggView | undefined; ritual: boolean; opening: number | null; onopen: (id: number, ritual: string) => void } = $props();

  const twigs: [number, number, number, number][] = [[10, 24, 60, 14], [22, 32, 104, 20], [16, 16, 94, 30], [30, 30, 110, 22], [6, 20, 70, 32]];
  const look = (c: Creature) => expressedAppearance(game, c);
</script>

<article class="nest" class:busy={!!egg} class:soon={!!egg && egg.progress > 0.85} class:ready={!!egg?.ready} class:cracking={!!egg && opening === egg.id} class:ritualnest={ritual}>
  {#if ritual}<span class="rn-label tiny">✨ Ritualnest</span>{/if}
  <div class="egg-wrap">
    {#if egg}
      <span class="glow" style="--h: {egg.hues[0]}; opacity: {0.25 + egg.progress * 0.6}"></span>
      <span class="egg"><EggSvg hueA={egg.hues[0]} hueB={egg.hues[1]} progress={egg.progress} size={52} /></span>
    {:else}
      <span class="egg"><EggSvg hueA={180} hueB={200} size={44} ghost /></span>
    {/if}
    <svg class="twigs" viewBox="0 0 120 40" aria-hidden="true">
      <ellipse cx="60" cy="22" rx="52" ry="14" fill="#4a3320" />
      <ellipse cx="60" cy="18" rx="40" ry="8" fill="#2b1d12" />
      {#each twigs as [x1, y1, x2, y2], j (j)}
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#7a5433" stroke-width="2.5" stroke-linecap="round" opacity="0.8" />
      {/each}
    </svg>
  </div>
  {#if egg}
    <div class="parents">
      {#each egg.parents as p, j (j)}
        {#if p}
          {@const sp = content.species.get(p.speciesId)}
          <span title={p.name}><CreatureSvg appearance={look(p)} shape={sp.shape} tier={sp.tier} size={24} /></span>
        {/if}
        {#if j === 0}<span class="times">×</span>{/if}
      {/each}
    </div>
    <span class="small">{egg.parents.map((p) => p?.name ?? '?').join(' × ')}</span>
    {#if egg.ready}
      <button class="open-egg" disabled={opening !== null} onclick={() => onopen(egg.id, egg.ritual?.name ?? 'Brutritual')}>
        ✨ Ei öffnen
      </button>
      <span class="small muted">{#if egg.ritual}{egg.ritual.icon} {egg.ritual.name} · {/if}<span class="gen">Gen {egg.generation}</span></span>
    {:else}
      <DnaHelix progress={egg.progress} pairs={14} width={130} height={22} />
      <span class="small num">{#if egg.ritual}<span class="ritual-tag" title={egg.ritual.name}>{egg.ritual.icon}</span>{' '}{/if}<span class="gen">Gen {egg.generation}</span> · noch {formatDuration(egg.remaining)}</span>
      <CrystalSkip process={game.state.processes.find((p) => p.id === egg.id)} />
    {/if}
  {:else}
    <span class="small muted">{ritual ? 'Frei für ein Brutritual' : 'Freies Nest'}</span>
  {/if}
</article>

<style>
  .small { font-size: 0.8rem; }
  .tiny { font-size: 0.68rem; }
  .nest {
    display: flex; flex-direction: column; align-items: center; gap: 0.2rem; padding: 0.6rem 0.5rem; text-align: center;
    border-radius: var(--radius); border: 1px dashed var(--line); background: var(--bg-2);
  }
  .nest.busy { border: 1px solid var(--line); background: radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--gold) 8%, transparent), var(--panel) 70%); }
  .nest.soon { border-color: var(--gold); }
  .nest.ritualnest { position: relative; border: 1px dashed color-mix(in srgb, var(--violet) 60%, var(--line)); background: radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--violet) 12%, transparent), var(--panel) 70%); }
  .rn-label { position: absolute; top: 0.3rem; left: 0.5rem; color: var(--violet); font-weight: 700; }
  .egg-wrap { position: relative; width: 120px; height: 86px; display: grid; justify-items: center; align-items: end; }
  .twigs { position: absolute; bottom: 0; width: 120px; height: 40px; }
  .egg { position: relative; z-index: 1; margin-bottom: 12px; transform-origin: 50% 90%; }
  .glow { position: absolute; bottom: 10px; width: 80px; height: 80px; border-radius: 50%; background: radial-gradient(circle, hsl(var(--h) 80% 60% / 0.7), transparent 65%); }
  .busy .egg { animation: rock 3s ease-in-out infinite; }
  .soon .egg { animation: wobble 0.45s ease-in-out infinite; }
  @keyframes rock { 0%, 100% { rotate: -2deg; } 50% { rotate: 2deg; } }
  @keyframes wobble { 0%, 100% { rotate: -9deg; } 50% { rotate: 9deg; } }
  /* Ritual egg done: it waits, glowing, until the player opens it. */
  .nest.ready { border-style: solid; border-color: var(--gold); box-shadow: 0 0 16px color-mix(in srgb, var(--gold) 33%, transparent); }
  .ready .egg { animation: wobble 0.9s ease-in-out infinite; }
  .ready .glow { opacity: 1 !important; animation: pulse 1.4s ease-in-out infinite; }
  .cracking .egg { animation: crack 0.7s ease-in forwards; }
  @keyframes pulse { 0%, 100% { scale: 0.9; } 50% { scale: 1.15; } }
  @keyframes crack { 0% { rotate: 0deg; scale: 1; } 20% { rotate: -14deg; } 40% { rotate: 14deg; } 60% { rotate: -10deg; scale: 1.08; } 100% { rotate: 0deg; scale: 1.35; opacity: 0; filter: brightness(2.5); } }
  .open-egg { margin: 0.2rem 0; border-color: var(--gold); color: var(--gold); font-weight: 700; }
  .parents { display: flex; align-items: center; gap: 0.2rem; }
  .times { color: var(--muted); font-size: 0.8rem; }
  .gen { color: var(--violet); }
  .ritual-tag { font-size: 0.9rem; }
</style>

<script lang="ts">
  import { content } from '@content/index';
  import { toCost } from '@core/costs';
  import { checkEvolution, evolutionsFor, evolve } from '@core/features/evolution';
  import type { Creature } from '@core/state';
  import { game, view, act } from '../store.svelte';
  import CostLabel from './CostLabel.svelte';

  let { creature }: { creature: Creature } = $props();
  let open = $state(false);

  const checks = $derived.by(() => {
    view.frame;
    if (!game.state.features['evolution']) return [];
    return evolutionsFor(game, creature).map((e) => checkEvolution(game, creature, e));
  });
</script>

{#if checks.length > 0}
  <div class="evo">
    <button class="toggle" class:ready={checks.some((c) => c.ready)} onclick={() => (open = !open)}>
      ✨ {checks.some((c) => c.ready) ? 'Entwicklung bereit!' : 'Entwicklung'}
    </button>
    {#if open}
      {#each checks as c (c.evolution.id)}
        <div class="option">
          <b>→ {content.species.get(c.evolution.to).name}</b>
          {#if c.evolution.description}<span class="muted small">{c.evolution.description}</span>{/if}
          <ul>
            {#each c.requirements as r (r.label)}
              <li class:met={r.met === true} class:unknown={r.met === null}>{r.met === true ? '✓' : r.met === null ? '?' : '✗'} {r.label}</li>
            {/each}
          </ul>
          <button class="primary" disabled={!c.ready} onclick={() => act(evolve(game, creature.id, c.evolution.id))}>
            Entwickeln {#if c.evolution.requires.cost}· <CostLabel cost={toCost(c.evolution.requires.cost)} />{/if}
          </button>
        </div>
      {/each}
    {/if}
  </div>
{/if}

<style>
  .evo { display: grid; gap: 0.4rem; }
  .toggle { font-size: 0.8rem; padding: 0.3rem 0.5rem; }
  .toggle.ready { border-color: var(--gold); color: var(--gold); animation: pulse 1.6s ease-in-out infinite; }
  @keyframes pulse { 50% { box-shadow: 0 0 10px color-mix(in srgb, var(--gold) 60%, transparent); } }
  .option { display: grid; gap: 0.25rem; font-size: 0.8rem; }
  .small { font-size: 0.75rem; }
  ul { list-style: none; margin: 0; padding: 0; }
  li { color: var(--danger); }
  li.met { color: var(--teal); }
  li.unknown { color: var(--muted); }
  .option button { font-size: 0.8rem; }
</style>

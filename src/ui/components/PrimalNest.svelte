<script lang="ts">
  import { content } from '@content/index';
  import { findCreature } from '@core/creatures';
  import { formatDuration, formatPercent } from '@core/format';
  import { incubatePrimalEgg, openPrimalEgg, primalChances, primalEggsOwned, primalNestEggs, primalNestSlots } from '@core/features/primalEggs';
  import { isWaiting, processRemainingMs } from '@core/systems/processes';
  import { game, view, act } from '../store.svelte';
  import { prefs } from '../prefs.svelte';
  import CrystalSkip from './CrystalSkip.svelte';
  import EggSvg from './EggSvg.svelte';
  import Meter from './Meter.svelte';
  import RitualReveal from './RitualReveal.svelte';

  /**
   * Brutkammer: Urzeit-Eier from the stock are laid into a warm, stony chamber and opened by hand once they are
   * ready. What hatches is a surprise; the chances list names only the Urzeitwesen already in the dex.
   */

  /** Egg breaking open right now (short animation before the reveal). */
  let opening = $state<number | null>(null);
  let reveal = $state<number | null>(null);

  const data = $derived.by(() => {
    view.frame;
    const slots = primalNestSlots(game);
    const eggs = primalNestEggs(game).map((p) => ({
      id: p.id,
      process: p,
      progress: Math.min(1, p.elapsedMs / p.durationMs),
      ready: isWaiting(game, p),
      remaining: processRemainingMs(game, p),
    }));
    return {
      owned: primalEggsOwned(game),
      slots,
      list: Array.from({ length: Math.max(slots, eggs.length) }, (_, i) => ({ key: i, egg: eggs[i] })),
      full: eggs.length >= slots,
      hours: game.balance.primalEggs.hours,
      minRarity: content.rarities.get(game.balance.primalEggs.minRarity),
      open: game.state.features['primalEggs'] === true,
    };
  });

  const chances = $derived.by(() => {
    view.slowFrame;
    return primalChances(game);
  });

  const revealed = $derived.by(() => {
    view.frame;
    const c = reveal !== null ? findCreature(game, reveal) : undefined;
    return c ? { c, sp: content.species.get(c.speciesId), rar: content.rarities.get(c.rarity) } : null;
  });

  function open(id: number) {
    if (opening !== null) return;
    opening = id;
    setTimeout(() => {
      opening = null;
      const result = openPrimalEgg(game, id);
      if (act(result) && result.hatched) reveal = result.hatched.id;
    }, prefs.reduceMotion ? 0 : 900);
  }
</script>

<article class="panel chamber">
  <header class="head">
    <h3>🦴 Brutkammer</h3>
    <span class="stock" title="Urzeit-Eier im Vorrat"><span class="num">{data.owned}</span> × 🥚 Urzeit-Ei</span>
  </header>
  <p class="small muted">
    Versteinerte Eier aus uralter Zeit. In der Brutkammer erwachen sie in {data.hours} Stunden – was darin schläft, zeigt sich erst beim Öffnen,
    mindestens <span style="color: {data.minRarity.color}">{data.minRarity.name}</span>. Urzeitwesen geben ihre Art nur an ihresgleichen weiter.
  </p>

  <div class="slots">
    {#each data.list as s (s.key)}
      {@const egg = s.egg}
      <div class="slot" class:busy={!!egg} class:soon={!!egg && egg.progress > 0.85} class:ready={!!egg?.ready} class:cracking={!!egg && opening === egg.id}>
        <div class="egg-wrap">
          {#if egg}
            <span class="glow" style="opacity: {0.2 + egg.progress * 0.6}"></span>
            <span class="egg"><EggSvg hueA={38} hueB={22} progress={egg.progress} size={50} /></span>
          {:else}
            <span class="egg"><EggSvg hueA={38} hueB={22} size={42} ghost /></span>
          {/if}
          <svg class="stones" viewBox="0 0 120 34" aria-hidden="true">
            <ellipse cx="60" cy="22" rx="50" ry="11" fill="#3a2c22" />
            <ellipse cx="22" cy="20" rx="13" ry="9" fill="#6b5646" />
            <ellipse cx="98" cy="21" rx="14" ry="9" fill="#5e4a3c" />
            <ellipse cx="44" cy="27" rx="11" ry="6" fill="#7a6352" />
            <ellipse cx="78" cy="27" rx="12" ry="6" fill="#6f5949" />
          </svg>
        </div>
        {#if egg}
          {#if egg.ready}
            <button class="open-egg" disabled={opening !== null} onclick={() => open(egg.id)}>✨ Ei öffnen</button>
            <span class="small muted">Etwas regt sich darin …</span>
          {:else}
            <Meter value={egg.progress} title="Brutfortschritt" />
            <span class="small num">noch {formatDuration(egg.remaining)}</span>
            <CrystalSkip process={egg.process} />
          {/if}
        {:else}
          <button class="primary" disabled={!data.open || data.owned < 1} onclick={() => act(incubatePrimalEgg(game))}>Urzeit-Ei einlegen</button>
          <span class="small muted">{data.owned < 1 ? 'Kein Urzeit-Ei im Vorrat' : `Dauert ${data.hours} Stunden`}</span>
        {/if}
      </div>
    {/each}
  </div>

  <details class="odds">
    <summary class="small">Was schlummert in den Eiern?</summary>
    <ul>
      {#each chances as ch (ch.species.id)}
        <li class:unknown={!ch.discovered}>
          <span>{ch.discovered ? ch.species.name : '???'}</span>
          {#if ch.discovered}<span class="tiny muted">{content.elements.get(ch.species.element).name}</span>{/if}
          <b class="num">{formatPercent(ch.chance, 1)}</b>
        </li>
      {/each}
    </ul>
    <p class="tiny muted">Urzeitwesen, die noch fehlen, schlüpfen häufiger.</p>
  </details>
</article>

{#if revealed}
  <RitualReveal {revealed} ritualName="Urzeit-Ei" onclose={() => (reveal = null)} />
{/if}

<style>
  .small { font-size: 0.8rem; }
  .tiny { font-size: 0.68rem; }
  .chamber { margin-top: 0.75rem; border-color: color-mix(in srgb, #d9a35b 45%, var(--line)); background: radial-gradient(circle at 20% 0%, color-mix(in srgb, #d9a35b 10%, transparent), var(--panel) 60%); }
  .head { display: flex; align-items: baseline; justify-content: space-between; gap: 0.5rem; flex-wrap: wrap; }
  .head h3 { margin: 0; }
  .stock { font-weight: 700; color: #d9a35b; }
  .slots { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 0.5rem; margin-top: 0.6rem; }
  .slot {
    display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0.6rem 0.5rem; text-align: center;
    border-radius: var(--radius); border: 1px dashed color-mix(in srgb, #d9a35b 40%, var(--line)); background: var(--bg-2);
  }
  .slot.busy { border-style: solid; }
  .slot.ready { border-color: var(--gold); box-shadow: 0 0 16px color-mix(in srgb, var(--gold) 33%, transparent); }
  .egg-wrap { position: relative; width: 120px; height: 80px; display: grid; justify-items: center; align-items: end; }
  .stones { position: absolute; bottom: 0; width: 120px; height: 34px; }
  .egg { position: relative; z-index: 1; margin-bottom: 10px; transform-origin: 50% 90%; }
  .glow { position: absolute; bottom: 8px; width: 80px; height: 80px; border-radius: 50%; background: radial-gradient(circle, hsl(32 85% 55% / 0.7), transparent 65%); }
  .busy .egg { animation: rock 4s ease-in-out infinite; }
  .soon .egg { animation: wobble 0.5s ease-in-out infinite; }
  .ready .egg { animation: wobble 0.9s ease-in-out infinite; }
  .ready .glow { opacity: 1 !important; animation: pulse 1.4s ease-in-out infinite; }
  .cracking .egg { animation: crack 0.9s ease-in forwards; }
  @keyframes rock { 0%, 100% { rotate: -1.5deg; } 50% { rotate: 1.5deg; } }
  @keyframes wobble { 0%, 100% { rotate: -9deg; } 50% { rotate: 9deg; } }
  @keyframes pulse { 0%, 100% { scale: 0.9; } 50% { scale: 1.15; } }
  @keyframes crack { 0% { rotate: 0deg; scale: 1; } 20% { rotate: -14deg; } 40% { rotate: 14deg; } 60% { rotate: -10deg; scale: 1.08; } 100% { rotate: 0deg; scale: 1.4; opacity: 0; filter: brightness(2.5); } }
  .open-egg { margin: 0.2rem 0; border-color: var(--gold); color: var(--gold); font-weight: 700; }
  .odds { margin-top: 0.6rem; }
  .odds summary { cursor: pointer; }
  .odds ul { list-style: none; margin: 0.4rem 0 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 0.2rem 0.8rem; }
  .odds li { display: flex; align-items: baseline; gap: 0.4rem; font-size: 0.8rem; }
  .odds li b { margin-left: auto; }
  .odds li.unknown { color: var(--muted); }
</style>

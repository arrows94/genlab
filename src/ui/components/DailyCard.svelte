<script lang="ts">
  import { claimDaily, dailyAvailable, dailyReward, dailySteps, nextDailyAt } from '@core/features/daily';
  import { formatDuration } from '@core/format';
  import { game, view, act, toast } from '../store.svelte';
  import { viewState } from '../viewState.svelte';
  import CostLabel from './CostLabel.svelte';

  /**
   * Tagesbelohnung: a single line (day, reward, claim button); the
   * Treue-Kalender with its seven gift boxes folds out on demand. No streak –
   * a break never resets the calendar.
   */
  const data = $derived.by(() => {
    view.slowFrame;
    const now = Date.now();
    const step = game.state.daily.step;
    const reward = dailyReward(game, step);
    return {
      steps: dailySteps(game),
      step,
      available: dailyAvailable(game, now),
      wait: nextDailyAt(game, now) - now,
      reward,
    };
  });

  function claim() {
    if (act(claimDaily(game, Date.now()))) toast(data.step === 0 ? 'Die Woche ist voll – der Kalender beginnt von vorn.' : 'Tagesbelohnung abgeholt!', 'unlock');
  }
</script>

<section class="panel daily" class:ready={data.available} class:open={viewState.lab.dailyOpen}>
  <div class="bar">
    <button class="toggle" aria-expanded={viewState.lab.dailyOpen} title={viewState.lab.dailyOpen ? 'Kalender einklappen' : 'Kalender anzeigen'} onclick={() => (viewState.lab.dailyOpen = !viewState.lab.dailyOpen)}>
      <span class="gift">🎁</span>
      <span class="label">
        <b>Tag {data.step + 1}/{data.steps}</b>
        <span class="small"><CostLabel cost={data.reward.amounts} />{#if data.reward.alleleSamples > 0}<span class="sample"> · +{data.reward.alleleSamples} Genprobe</span>{/if}</span>
      </span>
      <span class="chev">{viewState.lab.dailyOpen ? '▴' : '▾'}</span>
    </button>
    {#if data.available}
      <button class="primary claim" onclick={claim}>Abholen</button>
    {:else}
      <span class="small muted wait num">⏱ {formatDuration(data.wait)}</span>
    {/if}
  </div>
  {#if viewState.lab.dailyOpen}
    <div class="boxes" aria-label="Treue-Kalender">
      {#each Array.from({ length: data.steps }, (_, i) => i) as i (i)}
        <span class="box" class:done={i < data.step} class:next={i === data.step} class:big={i === data.steps - 1} title="Tag {i + 1}">
          {i < data.step ? '✔' : i === data.steps - 1 ? '👑' : '🎁'}
          <small>{i + 1}</small>
        </span>
      {/each}
    </div>
    <p class="tiny muted">Eine Pause kostet nichts – der Kalender geht dort weiter, wo du aufgehört hast.</p>
  {/if}
</section>

<style>
  .daily { margin-bottom: 0.75rem; display: grid; gap: 0.5rem; padding: 0.4rem 0.6rem; }
  .daily.open { padding: 0.6rem; }
  .daily.ready { border-color: var(--gold); box-shadow: 0 0 14px color-mix(in srgb, var(--gold) 20%, transparent); }
  .bar { display: flex; align-items: center; gap: 0.5rem; }
  .toggle { flex: 1; min-width: 0; display: flex; align-items: center; gap: 0.5rem; padding: 0.15rem 0.2rem; border: 0; background: none; text-align: left; }
  .gift { font-size: 1.3rem; display: inline-block; }
  .daily.ready .gift { animation: wiggle 1.6s ease-in-out infinite; }
  .label { flex: 1; min-width: 0; display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.1rem 0.6rem; }
  .chev { color: var(--muted); }
  .claim { padding: 0.35rem 0.9rem; }
  .wait { white-space: nowrap; }
  .small { font-size: 0.82rem; }
  .tiny { font-size: 0.7rem; margin: 0; }
  .boxes { display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.3rem; }
  .box { display: grid; place-items: center; padding: 0.3rem 0; border-radius: 8px; border: 1px solid var(--line); background: var(--bg-2); font-size: 1.1rem; opacity: 0.55; }
  .box small { font-size: 0.62rem; color: var(--muted); }
  .box.done { opacity: 1; color: var(--teal); border-color: color-mix(in srgb, var(--teal) 50%, var(--line)); }
  .box.next { opacity: 1; border-color: var(--gold); }
  .daily.ready .box.next { animation: wiggle 1.6s ease-in-out infinite; }
  .box.big { background: color-mix(in srgb, var(--gold) 12%, var(--bg-2)); }
  .sample { color: var(--teal); }
  @keyframes wiggle { 0%, 100% { transform: rotate(0); } 10% { transform: rotate(-6deg); } 20% { transform: rotate(6deg); } 30% { transform: rotate(0); } }
  :global(.reduce-motion) .box.next, :global(.reduce-motion) .gift { animation: none; }
</style>

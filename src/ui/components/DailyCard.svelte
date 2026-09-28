<script lang="ts">
  import { claimDaily, dailyAvailable, dailyReward, dailySteps, nextDailyAt } from '@core/features/daily';
  import { formatDuration } from '@core/format';
  import { game, view, act, toast } from '../store.svelte';
  import CostLabel from './CostLabel.svelte';

  /**
   * Tagesbelohnung: the Treue-Kalender as seven gift boxes. The next box is
   * highlighted; claimed boxes of the current round are ticked. No streak –
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

<section class="panel daily" class:ready={data.available}>
  <div class="head">
    <h3>🎁 Tagesbelohnung</h3>
    <span class="small muted">{data.available ? 'Bereit!' : `Nächste in ${formatDuration(data.wait)}`}</span>
  </div>
  <div class="boxes" aria-label="Treue-Kalender">
    {#each Array.from({ length: data.steps }, (_, i) => i) as i (i)}
      <span class="box" class:done={i < data.step} class:next={i === data.step} class:big={i === data.steps - 1} title="Tag {i + 1}">
        {i < data.step ? '✔' : i === data.steps - 1 ? '👑' : '🎁'}
        <small>{i + 1}</small>
      </span>
    {/each}
  </div>
  <div class="foot">
    <span class="small">Tag {data.step + 1}: <CostLabel cost={data.reward.amounts} />{#if data.reward.alleleSamples > 0}<span class="sample"> · +{data.reward.alleleSamples} Genprobe</span>{/if}</span>
    <button class="primary" disabled={!data.available} onclick={claim}>Abholen</button>
  </div>
  <p class="tiny muted">Eine Pause kostet nichts – der Kalender geht dort weiter, wo du aufgehört hast.</p>
</section>

<style>
  .daily { margin-bottom: 1rem; display: grid; gap: 0.5rem; }
  .daily.ready { border-color: var(--gold); box-shadow: 0 0 14px #f2c14e33; }
  .head, .foot { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  h3 { margin: 0; }
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
  :global(.reduce-motion) .box.next { animation: none; }
</style>

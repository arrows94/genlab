<script lang="ts">
  import { meter } from '../meter';
  import { content } from '@content/index';
  import { contractDay, nextContractDay } from '@core/features/contracts';
  import { attackWeeklyBoss, bossAttempts, bossDefeated } from '@core/features/weeklyBoss';
  import { nextWeekStart } from '@core/features/weekly';
  import { formatDuration, formatNumber, formatPercent } from '@core/format';
  import { rewardAmounts } from '@core/rewards';
  import { game, view, act, toast } from '../store.svelte';
  import CostLabel from './CostLabel.svelte';
  import CreatureSvg from './CreatureSvg.svelte';

  /**
   * Wochen-Boss: portrait, HP bar with the reward tiers as marks, the saved-up
   * attempts and the result of the last attempt.
   */
  const data = $derived.by(() => {
    view.slowFrame;
    const now = Date.now();
    const b = game.state.weeklyBoss;
    const cfg = game.balance.weeklyBoss;
    const species = b.species ? content.species.get(b.species) : null;
    return {
      b,
      species,
      element: b.element ? content.elements.get(b.element) : null,
      share: b.maxHp > 0 ? b.damage / b.maxHp : 0,
      defeated: bossDefeated(game),
      tiers: cfg.tiers.map((t, i) => ({ ...t, reached: i < b.tiers, rewards: rewardAmounts(game, { resources: t.rewards }) })),
      maxAttempts: bossAttempts(game).max,
      perDay: bossAttempts(game).perDay,
      refillIn: nextContractDay(game, now) - now,
      weekLeft: nextWeekStart(game, now) - now,
      today: contractDay(game, now) === b.day,
      team: game.state.tower.team.length,
    };
  });

  function attack() {
    if (act(attackWeeklyBoss(game))) {
      const b = game.state.weeklyBoss;
      toast(bossDefeated(game) ? 'Der Wochen-Titan ist besiegt!' : `${formatNumber(b.last?.damage ?? 0)} Schaden in ${formatNumber(b.last?.rounds ?? 0, { decimals: 1 })} s Kampfzeit.`, bossDefeated(game) ? 'rare' : 'info');
    }
  }
</script>

{#if data.species && data.element}
  <article class="panel weekly-boss" style="--el: {data.element.color}">
    <div class="portrait">
      <CreatureSvg appearance={{ hue: data.species.hue, pattern: 'none', eyes: 'sharp', horn: 'none' }} shape={data.species.shape} tier={data.species.tier} size={84} />
    </div>
    <div class="body">
      <div class="title">
        <h3>👹 Wochen-Titan: {data.species.name}</h3>
        <span class="small muted">{data.element.name} · wie die Wochenexpedition · neuer Titan in {formatDuration(data.weekLeft)}</span>
      </div>
      <div class="hp" title="{formatPercent(data.share, 1)} Schaden" use:meter={data.share}>
        <div class="dmg" style="width: {Math.min(100, data.share * 100)}%"></div>
        {#each data.tiers as t, i (i)}
          <span class="tier" class:reached={t.reached} style="left: {t.at * 100}%" title="{formatPercent(t.at, 0)}: Belohnung"></span>
        {/each}
      </div>
      <div class="facts small">
        <span class="num">{formatNumber(data.b.damage)} / {formatNumber(data.b.maxHp)} ({formatPercent(data.share, 1)})</span>
        {#if data.b.last}<span class="muted">Letzter Angriff: {formatNumber(data.b.last.damage)} in {formatNumber(data.b.last.rounds, { decimals: 1 })} s Kampfzeit</span>{/if}
      </div>
      <div class="rewards">
        {#each data.tiers as t, i (i)}
          <span class="reward" class:reached={t.reached}><b>{formatPercent(t.at, 0)}</b> <CostLabel cost={t.rewards} /></span>
        {/each}
      </div>
      <div class="actions">
        <span class="attempts" title="Pro Tag kommen {data.perDay} Angriffe dazu, bis zu {data.maxAttempts}.">
          ⚔️ <b class="num">{data.b.attempts}/{data.maxAttempts}</b> Angriffe · +{data.perDay} in {formatDuration(data.refillIn)}
        </span>
        {#if data.defeated}
          <span class="won">🏆 Besiegt!</span>
        {:else}
          <button class="primary" disabled={data.b.attempts < 1 || data.team === 0} onclick={attack}>Mit dem Turm-Team angreifen</button>
        {/if}
      </div>
      {#if data.team === 0}<p class="small muted">Stelle unten ein Turm-Team zusammen.</p>{/if}
      {#if !data.defeated}
        <p class="small muted hint">
          💡 Angriffe sammeln sich bis {data.maxAttempts}. Der Titan bleibt die ganze Woche gleich stark – dein Team ist kurz vor einer Vererbung am stärksten, dann bringt ein Angriff am meisten.
        </p>
      {/if}
    </div>
  </article>
{/if}

<style>
  .weekly-boss { display: flex; gap: 0.9rem; align-items: flex-start; margin-bottom: 1rem; border-color: color-mix(in srgb, var(--el) 55%, var(--line)); background: linear-gradient(135deg, color-mix(in srgb, var(--el) 10%, var(--panel)), var(--panel)); }
  .portrait { flex: none; filter: drop-shadow(0 0 10px color-mix(in srgb, var(--el) 60%, transparent)); }
  .body { flex: 1; display: grid; gap: 0.45rem; min-width: 0; }
  .title h3 { margin: 0; }
  .small { font-size: 0.8rem; }
  .hp { position: relative; height: 14px; border-radius: 99px; background: #3a1414; border: 1px solid var(--line); overflow: visible; }
  .dmg { height: 100%; border-radius: 99px; background: linear-gradient(90deg, var(--el), var(--gold)); }
  .tier { position: absolute; top: -3px; width: 3px; height: 18px; margin-left: -1px; background: var(--muted); border-radius: 2px; }
  .tier.reached { background: var(--gold); }
  .facts { display: flex; flex-wrap: wrap; gap: 0.3rem 1rem; }
  .rewards { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .reward { font-size: 0.72rem; padding: 0.1rem 0.45rem; border-radius: 99px; border: 1px solid var(--line); background: var(--bg-2); opacity: 0.8; }
  .reward.reached { border-color: var(--gold); opacity: 1; }
  .actions { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; justify-content: space-between; }
  .attempts { font-size: 0.85rem; }
  .hint { margin: 0; }
  .won { color: var(--gold); font-weight: 700; }
  @media (max-width: 520px) { .weekly-boss { flex-direction: column; align-items: center; } }
</style>

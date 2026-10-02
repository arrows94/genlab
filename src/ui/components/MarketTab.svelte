<script lang="ts">
  import { content } from '@content/index';
  import { canAfford } from '@core/costs';
  import { creaturePower, findCreature } from '@core/creatures';
  import { formatDuration, formatNumber, formatPercent } from '@core/format';
  import { potionCost, potionNeedsCreature, usePotion } from '@core/features/market';
  import { ruleActive } from '@core/features/anomalies';
  import { workerRate } from '@core/systems/production';
  import type { Creature } from '@core/state';
  import { game, view, act } from '../store.svelte';
  import CostLabel from './CostLabel.svelte';
  import CreatureTile from './CreatureTile.svelte';
  import PotionBottle from './PotionBottle.svelte';

  /** Potion waiting for a target creature, the chosen creature and stat. */
  let picking = $state<string | null>(null);
  let target = $state<number | null>(null);
  let stat = $state('atk');

  const maxBoosts = game.balance.market.maxBoostsPerStat;

  const data = $derived.by(() => {
    view.frame;
    const creature = target !== null ? findCreature(game, target) : undefined;
    const potions = content.potions.list
      .filter((p) => game.state.features[p.feature])
      .map((p) => {
        const needs = potionNeedsCreature(game, p.id);
        const cost = potionCost(game, p.id, needs ? (target ?? null) : null);
        const active = game.state.buffs.filter((b) => b.source === p.id).length;
        return { def: p, needs, cost, affordable: canAfford(game.state, cost), active };
      });
    return {
      creature,
      potions,
      fed: game.state.creatures.reduce((n, c) => n + (c.boostUses ?? 0), 0),
      pick: picking && content.potions.has(picking) ? potions.find((p) => p.def.id === picking) ?? null : null,
      banned: ruleActive(game, 'noPotions'),
      buffs: game.state.buffs.map((b) => {
        const def = content.potions.has(b.source) ? content.potions.get(b.source) : null;
        const total = (def?.durationSec ?? 0) * 1000;
        const c = b.creatureId !== null ? findCreature(game, b.creatureId) : null;
        return { b, def, c, share: total > 0 ? Math.min(1, b.remainingMs / total) : 1 };
      }),
    };
  });

  /** Creatures for the picked potion: workers first for Turbo, strongest first otherwise. */
  const tiles = $derived.by(() => {
    view.slowFrame;
    if (!data.pick) return [];
    const turbo = data.pick.def.kind === 'creatureBuff';
    return game.state.creatures
      .map((c) => ({ c, rate: turbo ? workerRate(game, c) : null, power: creaturePower(game, c), boost: c.boosts[stat] ?? 0 }))
      .sort((a, b) => (turbo ? b.rate!.cmp(a.rate!) : 0) || b.power - a.power);
  });

  function choose(id: string) {
    const p = data.potions.find((x) => x.def.id === id)!;
    if (p.needs) {
      picking = picking === id ? null : id;
      return;
    }
    act(usePotion(game, id));
  }

  function give() {
    if (!data.pick || target === null) return;
    act(usePotion(game, data.pick.def.id, target, data.pick.def.kind === 'permanentStat' ? stat : null));
  }

  /** Kraftfutter limit per stat (same rule as `usePotion`). */
  const boostFull = (c: Creature | undefined, s: string, bonus: number) => !!c && (c.boosts[s] ?? 0) + bonus > maxBoosts * bonus + 1e-9;
</script>

<header class="tab-head">
  <h2>⚗️ Markt</h2>
  <div class="kpis">
    <span class="kpi" class:live={data.buffs.length > 0}><b class="num">{data.buffs.length}</b><small>aktive Effekte</small></span>
    <span class="kpi"><b class="num">{data.fed}</b><small>Kraftfutter verteilt</small></span>
  </div>
</header>

{#if data.banned}
  <p class="panel banned">🚫 In dieser Anomalie sind Tränke verboten.</p>
{/if}

<section class="counter">
  <div class="shelf">
    {#each data.potions as p (p.def.id)}
      <article class="slot" class:picked={picking === p.def.id} class:affordable={p.affordable && !data.banned}>
        <button class="bottle" title={p.def.description} onclick={() => choose(p.def.id)} disabled={data.banned}>
          <PotionBottle kind={p.def.kind} color={p.def.color} size={56} glow={picking === p.def.id || p.active > 0} />
          {#if p.active > 0}<span class="badge num">{p.active}× aktiv</span>{/if}
        </button>
        <b class="pname">{p.def.name}</b>
        <span class="desc small">{p.def.description}</span>
        <span class="tag">{#if p.def.kind === 'permanentStat'}ab&nbsp;{/if}<CostLabel cost={p.cost} /></span>
        <button class="buy" class:primary={!p.needs && p.affordable} disabled={data.banned || (!p.needs && !p.affordable)} onclick={() => choose(p.def.id)}>
          {p.needs ? (picking === p.def.id ? 'Auswahl schließen' : 'Kreatur wählen') : 'Kaufen'}
        </button>
      </article>
    {/each}
  </div>
  <div class="plank"></div>
</section>

{#if data.pick}
  {@const pk = data.pick}
  <article class="panel picker">
    <div class="phead">
      <PotionBottle kind={pk.def.kind} color={pk.def.color} size={30} />
      <h3>Wer bekommt {pk.def.kind === 'permanentStat' ? 'das' : 'den'} {pk.def.name}?</h3>
    </div>

    {#if pk.def.kind === 'permanentStat'}
      <div class="stats">
        {#each content.stats.list as s (s.id)}
          {@const have = data.creature?.boosts[s.id] ?? 0}
          <button class="stat" class:on={stat === s.id} disabled={boostFull(data.creature, s.id, pk.def.statBonus ?? 0)} onclick={() => (stat = s.id)}>
            <b>{s.name}</b>
            <span class="pips">{#each Array.from({ length: maxBoosts }, (_, i) => i) as i (i)}<span class="pip" class:full={i < Math.round(have / (pk.def.statBonus ?? 0.05))}></span>{/each}</span>
            <span class="small num muted">+{formatPercent(have, 0)}</span>
          </button>
        {/each}
      </div>
    {:else}
      <p class="small muted hint">Wirkt nur, solange die Kreatur in einer Anlage arbeitet – Arbeiter stehen vorne.</p>
    {/if}

    <div class="tiles">
      {#each tiles as t (t.c.id)}
        <CreatureTile
          creature={t.c}
          info={t.rate ? (t.rate.gt(0) ? `+${formatNumber(t.rate)}/s` : 'arbeitet nicht') : `${content.stats.get(stat).short} +${formatPercent(t.boost, 0)}`}
          selected={target === t.c.id}
          onclick={() => (target = target === t.c.id ? null : t.c.id)}
        >
          {#snippet corner()}
            {#if t.c.job?.kind === 'building'}<span title="Arbeitet in: {content.buildings.get(t.c.job.target).name}">{content.buildings.get(t.c.job.target).icon}</span>{/if}
          {/snippet}
        </CreatureTile>
      {/each}
    </div>

    <div class="confirm">
      {#if data.creature}
        <span class="small">Für <b>{data.creature.name}</b>{#if pk.def.kind === 'permanentStat'} · {content.stats.get(stat).name} +{formatPercent(pk.def.statBonus ?? 0, 0)}{/if}</span>
      {:else}
        <span class="small muted">Wähle eine Kreatur.</span>
      {/if}
      <button class="primary" disabled={!data.creature || !pk.affordable || (pk.def.kind === 'permanentStat' && boostFull(data.creature, stat, pk.def.statBonus ?? 0))} onclick={give}>
        Geben · <CostLabel cost={pk.cost} />
      </button>
    </div>
  </article>
{/if}

<h3 class="section">Aktive Effekte</h3>
{#if data.buffs.length === 0}
  <p class="small muted">Gerade wirkt kein Trank.</p>
{:else}
  <div class="effects">
    {#each data.buffs as e (e.b.id)}
      <article class="panel effect" style="--c: {e.def?.color ?? 'var(--teal)'}">
        <svg viewBox="0 0 44 44" class="ring" aria-hidden="true">
          <circle cx="22" cy="22" r="19" class="track" />
          <circle cx="22" cy="22" r="19" class="left" stroke-dasharray="{(e.share * 119.4).toFixed(1)} 119.4" />
        </svg>
        <div class="einfo">
          <b>{e.def?.name ?? e.b.source}</b>
          <span class="small muted">{e.c ? `für ${e.c.name}` : 'für alle'}</span>
          <span class="num rest">noch {formatDuration(e.b.remainingMs)}</span>
        </div>
      </article>
    {/each}
  </div>
{/if}

<style>
  .small { font-size: 0.8rem; }
  .banned { border-color: var(--danger); color: var(--danger); margin: 0 0 0.6rem; }

  /* Shop counter: bottles on a wooden shelf */
  .counter { position: relative; margin-bottom: 0.9rem; padding: 0.8rem 0.8rem 0; border-radius: var(--radius); border: 1px solid #6b4a2b88;
    background: linear-gradient(180deg, #1a1410 0%, #22190f 70%), repeating-linear-gradient(90deg, #0000 0 38px, #0003 38px 40px); }
  .shelf { position: relative; z-index: 1; display: grid; gap: 0.6rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr)); }
  .plank { height: 14px; margin: 0 -0.8rem; border-radius: 0 0 var(--radius) var(--radius); background: linear-gradient(180deg, #8a5a33, #5a3a20); box-shadow: 0 -2px 0 #a8703f inset; }
  .slot { display: grid; justify-items: center; align-content: start; gap: 0.25rem; padding: 0.5rem 0.5rem 0.7rem; border-radius: 12px; border: 1px solid transparent; text-align: center; }
  .slot.affordable { background: radial-gradient(circle at 50% 20%, color-mix(in srgb, var(--gold) 8%, transparent), transparent 70%); }
  .slot.picked { border-color: var(--teal); background: color-mix(in srgb, var(--teal) 10%, transparent); }
  .bottle { position: relative; padding: 0.2rem 0.6rem 0; border: 0; background: none; transition: transform 0.15s; }
  .bottle:hover:not(:disabled) { transform: translateY(-4px) rotate(-3deg); }
  .badge { position: absolute; top: 0; right: -0.6rem; font-size: 0.65rem; background: var(--gold); color: #1a1405; border-radius: 99px; padding: 0 0.35rem; font-weight: 700; }
  .pname { font-size: 0.95rem; }
  .desc { color: var(--muted); min-height: 2.4em; }
  .tag { font-size: 0.8rem; padding: 0.1rem 0.55rem; border-radius: 4px 12px 12px 4px; background: #f3e3c3; color: #3a2a14; font-weight: 700; }
  .tag :global(.num) { color: #3a2a14; }
  .buy { width: 100%; font-size: 0.85rem; padding: 0.4rem; }

  .picker { display: grid; gap: 0.5rem; margin-bottom: 0.9rem; border-color: color-mix(in srgb, var(--teal) 50%, var(--line)); }
  .phead { display: flex; align-items: center; gap: 0.5rem; }
  .phead h3 { margin: 0; }
  .hint { margin: 0; }
  .stats { display: grid; grid-template-columns: repeat(auto-fill, minmax(8.5rem, 1fr)); gap: 0.4rem; }
  .stat { display: grid; justify-items: start; gap: 0.2rem; padding: 0.4rem 0.6rem; font-size: 0.85rem; text-align: left; }
  .stat.on { border-color: var(--gold); background: color-mix(in srgb, var(--gold) 12%, var(--panel-2)); }
  .pips { display: flex; gap: 2px; }
  .pip { width: 8px; height: 6px; border-radius: 2px; background: var(--bg-2); border: 1px solid var(--line); }
  .pip.full { background: #f2a93b; border-color: #f2a93b; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.4rem, 1fr)); gap: 0.4rem; max-height: 18rem; overflow-y: auto; padding: 2px; }
  .confirm { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; }
  .confirm button { min-width: min(100%, 12rem); }

  .section { margin: 0.4rem 0 0.5rem; }
  .effects { display: grid; gap: 0.5rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 220px), 1fr)); }
  .effect { display: flex; align-items: center; gap: 0.6rem; border-color: color-mix(in srgb, var(--c) 45%, var(--line)); }
  .ring { width: 44px; height: 44px; transform: rotate(-90deg); flex: none; }
  .track { fill: none; stroke: var(--bg-2); stroke-width: 5; }
  .left { fill: none; stroke: var(--c); stroke-width: 5; stroke-linecap: round; transition: stroke-dasharray 0.3s linear; }
  .einfo { display: grid; }
  .rest { font-size: 0.85rem; color: var(--c); font-weight: 600; }
</style>

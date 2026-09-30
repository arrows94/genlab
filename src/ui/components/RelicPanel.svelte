<script lang="ts">
  import { play } from '../sound';
  import { content } from '@content/index';
  import { findCreature } from '@core/creatures';
  import { formatNumber, formatPercent } from '@core/format';
  import { buyRelic, equipRelic, relicCost, relicLevel, teamSize } from '@core/features/tower';
  import { game, view, act } from '../store.svelte';

  /**
   * Relikte: bought and levelled with Turm-Marken, put into the places of the
   * tower team. They belong to the player, not to a creature, so they stay
   * through every reset – whoever stands in the place gets the bonus.
   */
  const STAT: Record<string, string> = { hp: 'KP', atk: 'Angriff', def: 'Verteidigung', spd: 'Tempo', element: 'Element-Vorteil' };

  const data = $derived.by(() => {
    view.slowFrame;
    const tokens = game.state.resources['towerTokens'] ?? null;
    const run = !!game.state.tower.run;
    const relics = content.relics.list.map((def) => {
      const level = relicLevel(game, def.id);
      const cost = relicCost(game, def.id);
      const slot = game.state.tower.relicSlots.indexOf(def.id);
      return { def, level, cost, affordable: !!cost && !!tokens && tokens.gte(cost), slot: slot >= 0 && slot < teamSize(game) ? slot : -1 };
    });
    const places = Array.from({ length: teamSize(game) }, (_, i) => {
      const id = game.state.tower.team[i];
      const relic = game.state.tower.relicSlots[i] ?? null;
      return { i, creature: id !== undefined ? findCreature(game, id) : undefined, relic: relic && content.relics.has(relic) ? content.relics.get(relic) : null };
    });
    return { relics, places, run, owned: relics.filter((r) => r.level > 0) };
  });

  const bonusText = (bonus: Record<string, number | undefined>, level: number) =>
    Object.entries(bonus).map(([k, v]) => `+${formatPercent((v ?? 0) * level, 0)} ${STAT[k] ?? k}`).join(', ');
</script>

<article class="panel relics">
  <div class="rhead">
    <h3>🏺 Relikte</h3>
    <span class="small muted">Für Turm-Marken · gehören dir, nicht der Kreatur – sie bleiben über jeden Neustart.</span>
  </div>

  <div class="grid list">
    {#each data.relics as r (r.def.id)}
      <div class="relic" class:owned={r.level > 0} class:worn={r.slot >= 0}>
        <span class="icon">{r.def.icon}</span>
        <div class="info">
          <b>{r.def.name}{#if r.slot >= 0}<span class="where small">&nbsp;· Platz {r.slot + 1}</span>{/if}</b>
          <span class="pips" title="Stufe {r.level} von {r.def.maxLevel}">
            {#each Array.from({ length: r.def.maxLevel }, (_, i) => i) as i (i)}<span class="pip" class:on={i < r.level}></span>{/each}
          </span>
          <span class="small muted">{r.level > 0 ? `Jetzt ${bonusText(r.def.bonus, r.level)}` : r.def.description}</span>
        </div>
        {#if r.cost}
          <button class="buy" class:primary={r.affordable} disabled={!r.affordable} onclick={() => act(buyRelic(game, r.def.id)) && play('relic')}>
            {r.level > 0 ? 'Stufe +1' : 'Kaufen'} · <span class="num">{formatNumber(r.cost)} 🗼</span>
          </button>
        {:else}
          <span class="max small">✓ Maximal</span>
        {/if}
      </div>
    {/each}
  </div>

  {#if data.owned.length > 0}
    <h4>Plätze im Team {#if data.run}<span class="small muted">– während eines Laufs gesperrt</span>{/if}</h4>
    <div class="places">
      {#each data.places as p (p.i)}
        <div class="place">
          <span class="pname small"><b>Platz {p.i + 1}</b> <span class="muted">{p.creature?.name ?? 'frei'}</span></span>
          <div class="choices">
            <button class="choice" class:on={!p.relic} disabled={data.run} title="Kein Relikt" onclick={() => act(equipRelic(game, p.i, null))}>–</button>
            {#each data.owned as r (r.def.id)}
              <button class="choice" class:on={p.relic?.id === r.def.id} disabled={data.run} title="{r.def.name} (Stufe {r.level})" onclick={() => act(equipRelic(game, p.i, r.def.id))}>{r.def.icon}</button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</article>

<style>
  .relics { margin-top: 0.75rem; display: grid; gap: 0.5rem; }
  .rhead { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.4rem; }
  h3 { margin: 0; }
  h4 { margin: 0.4rem 0 0; font-size: 0.85rem; }
  .small { font-size: 0.78rem; }
  .list { grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap: 0.45rem; }
  .relic { display: grid; grid-template-columns: 2rem 1fr; grid-template-rows: auto auto; gap: 0.3rem 0.5rem; padding: 0.5rem; border-radius: 10px; border: 1px solid var(--line); background: var(--bg-2); }
  .relic.owned { border-color: color-mix(in srgb, #ffb74d 50%, var(--line)); }
  .relic.worn { box-shadow: 0 0 10px #ffb74d44; }
  .icon { font-size: 1.5rem; grid-row: span 2; align-self: center; text-align: center; }
  .info { display: grid; gap: 0.15rem; min-width: 0; }
  .where { color: #ffb74d; font-weight: 400; }
  .pips { display: flex; gap: 2px; }
  .pip { width: 9px; height: 5px; border-radius: 2px; background: var(--panel-2); border: 1px solid var(--line); }
  .pip.on { background: #ffb74d; border-color: #ffb74d; }
  .buy { grid-column: 2; font-size: 0.8rem; padding: 0.3rem 0.5rem; }
  .max { grid-column: 2; color: var(--gold); }
  .places { display: grid; gap: 0.35rem; }
  .place { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.4rem; padding: 0.3rem 0.5rem; border-radius: 8px; background: var(--bg-2); border: 1px solid var(--line); }
  .choices { display: flex; flex-wrap: wrap; gap: 0.25rem; }
  .choice { min-width: 2.2rem; padding: 0.2rem 0.4rem; font-size: 1rem; line-height: 1.2; }
  .choice.on { border-color: #ffb74d; background: color-mix(in srgb, #ffb74d 18%, var(--panel-2)); }
</style>

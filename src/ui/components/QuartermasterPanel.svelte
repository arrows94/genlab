<script lang="ts">
  import { play } from '../sound';
  import { content } from '@content/index';
  import { buyOffer, offerLeft, offerPrice, offerUnit, towerOffers } from '@core/features/quartermaster';
  import { nextWeekStart } from '@core/features/weekly';
  import { formatDuration, formatNumber } from '@core/format';
  import { game, view, act } from '../store.svelte';

  /**
   * Quartiermeister: Turm-Marken for scarce resources, a few times a week.
   * Prices follow the tower record and grow with every purchase in the week.
   */
  const data = $derived.by(() => {
    view.slowFrame;
    const tokens = game.state.resources['towerTokens'] ?? null;
    const offers = towerOffers(game).map((def) => {
      const res = content.resources.get(def.resource);
      const left = offerLeft(game, def.id);
      const price = offerPrice(game, def.id);
      return { def, res, left, price, affordable: left > 0 && !!tokens && tokens.gte(price) };
    });
    const now = game.state.lastTickAt;
    return { offers, unit: offerUnit(game), weekLeft: nextWeekStart(game, now) - now };
  });
</script>

<article class="panel quartermaster">
  <div class="qhead">
    <h3>🎖️ Quartiermeister</h3>
    <span class="small muted">
      Tauscht Turm-Marken gegen Knappes. Die Preise wachsen mit deinem Turm-Rekord (eine Etage dort: {formatNumber(data.unit)} 🗼) und mit
      jedem Kauf · neue Woche in {formatDuration(data.weekLeft)}
    </span>
  </div>
  <div class="offers">
    {#each data.offers as o (o.def.id)}
      <div class="offer" class:sold={o.left === 0}>
        <span class="icon">{o.res.icon}</span>
        <div class="info">
          <b><span class="num">{formatNumber(o.def.amount)}</span> {o.res.name}</b>
          <span class="small muted">{o.left > 0 ? `noch ${o.left} von ${o.def.weeklyLimit} diese Woche` : `${o.def.weeklyLimit} von ${o.def.weeklyLimit} gekauft, neue in ${formatDuration(data.weekLeft)}`}</span>
        </div>
        {#if o.left > 0}
          <button class="buy" class:primary={o.affordable} disabled={!o.affordable} onclick={() => act(buyOffer(game, o.def.id)) && play('relic')}>
            <span class="num">{formatNumber(o.price)} 🗼</span>
          </button>
        {:else}
          <span class="small muted">Ausverkauft</span>
        {/if}
      </div>
    {/each}
  </div>
</article>

<style>
  .quartermaster { margin-top: 0.75rem; display: grid; gap: 0.5rem; }
  .qhead { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.4rem; }
  h3 { margin: 0; }
  .small { font-size: 0.78rem; }
  /* Two columns, one on phones. */
  .offers { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.45rem; }
  @media (max-width: 560px) { .offers { grid-template-columns: 1fr; } }
  .offer { display: grid; grid-template-columns: 2rem minmax(0, 1fr) auto; align-items: center; gap: 0.5rem; padding: 0.5rem; border-radius: 10px; border: 1px solid var(--line); background: var(--bg-2); }
  .offer.sold { opacity: 0.6; }
  .icon { font-size: 1.5rem; text-align: center; }
  .info { display: grid; gap: 0.1rem; min-width: 0; }
  .buy { font-size: 0.8rem; padding: 0.3rem 0.6rem; white-space: nowrap; }
</style>

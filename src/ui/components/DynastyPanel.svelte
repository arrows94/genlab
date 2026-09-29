<script lang="ts">
  import { content } from '@content/index';
  import { formatPercent } from '@core/format';
  import { dynastyTier, nextTierDepth, totalDynastyTiers } from '@core/features/dynasty';
  import { game, view } from '../store.svelte';
  import CreatureSvg from './CreatureSvg.svelte';

  /**
   * Stammbaum-Dynastien: the deepest pure line per species. The record stays
   * through every reset; each tier strengthens the species and adds production.
   */
  const neutral = { pattern: 'none', eyes: 'round', horn: 'none' };

  const data = $derived.by(() => {
    view.slowFrame;
    const b = game.balance.dynasty;
    const rows = Object.entries(game.state.dynasties)
      .filter(([id, depth]) => depth > 0 && content.species.has(id))
      .map(([id, depth]) => {
        const tier = dynastyTier(game, depth);
        const next = nextTierDepth(game, depth);
        const from = tier > 0 ? b.tiers[tier - 1]! : 0;
        // Deepest line of this species in the stable right now.
        const current = Math.max(0, ...game.state.creatures.filter((c) => c.speciesId === id).map((c) => c.lineage ?? 0));
        return { species: content.species.get(id), depth, tier, next, current, progress: next === null ? 1 : (depth - from) / (next - from) };
      })
      .sort((x, y) => y.depth - x.depth || x.species.name.localeCompare(y.species.name, 'de'));
    const tiers = totalDynastyTiers(game);
    const production = b.modifiersPerTier.find((m) => m.target === 'production.food')?.value ?? 0;
    const shardTiers = b.shardsPerTier.map((s, i) => ({ s, tier: i + 1 })).filter((x) => x.s > 0);
    return { rows, tiers, production: tiers * production, maxTier: b.tiers.length, b, shardTiers };
  });
</script>

<article class="panel dynasties">
  <div class="dhead">
    <h3>👑 Stammbaum-Dynastien</h3>
    {#if data.tiers > 0}<span class="small total">Σ {data.tiers} Stufen · <b>+{formatPercent(data.production)}</b> Produktion</span>{/if}
  </div>
  <p class="small muted">
    Reine Linie: Beide Eltern und das Kind sind dieselbe Art. Jede Generation in Folge vertieft die Linie (die kürzere Linie der Eltern zählt)
    und gibt der Kreatur +{formatPercent(data.b.statPerDepth, 0)} Werte. Der Rekord jeder Art bleibt für immer – Stufen ab Tiefe
    {data.b.tiers.join(' / ')} geben der ganzen Art +{formatPercent(data.b.statPerTier, 0)} Werte je Stufe{#if data.shardTiers.length > 0}, Stufe
      {data.shardTiers.map((x) => x.tier).join(' und ')} auch Äon-Splitter{/if}.
  </p>
  {#if data.rows.length === 0}
    <p class="muted small">Noch keine reine Linie. Paare zwei Kreaturen derselben Art.</p>
  {:else}
    <ul>
      {#each data.rows as r (r.species.id)}
        <li>
          <CreatureSvg appearance={{ ...neutral, hue: r.species.hue }} shape={r.species.shape} tier={r.species.tier} size={32} />
          <span class="name">{r.species.name}</span>
          <span class="stars" title="Stufe {r.tier} von {data.maxTier}" aria-label="Stufe {r.tier} von {data.maxTier}">{'★'.repeat(r.tier)}<span class="off">{'★'.repeat(data.maxTier - r.tier)}</span></span>
          <span class="rec num" title="Tiefste reine Linie, die je geschlüpft ist">Rekord {r.depth}</span>
          <span class="bar" title={r.next === null ? 'Höchste Stufe erreicht' : `Noch ${r.next - r.depth} Generationen bis Stufe ${r.tier + 1}`}><span style="width: {r.progress * 100}%"></span></span>
          <span class="small muted info">
            {#if r.tier > 0}+{formatPercent(r.tier * data.b.statPerTier, 0)} Werte{/if}
            {#if r.next !== null}{r.tier > 0 ? ' · ' : ''}nächste ab {r.next}{/if}
            {#if r.current > 0}{' · '}im Stall 👑 {r.current}{/if}
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</article>

<style>
  .dynasties { margin-top: 0.75rem; }
  .dhead { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 0.4rem; }
  .dhead h3 { margin: 0; }
  .total b { color: var(--gold); }
  .small { font-size: 0.8rem; }
  ul { list-style: none; padding: 0; margin: 0.5rem 0 0; display: grid; gap: 0.3rem; }
  li {
    display: grid; grid-template-columns: auto minmax(6rem, 1fr) auto auto minmax(4rem, 8rem) minmax(0, 1.4fr); align-items: center; gap: 0.6rem;
    padding: 0.2rem 0.5rem; border-radius: 8px; background: var(--bg-2); border: 1px solid var(--line);
  }
  .name { font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .stars { color: var(--gold); letter-spacing: 1px; white-space: nowrap; }
  .stars .off { color: var(--line); }
  .rec { font-weight: 700; white-space: nowrap; }
  .bar { height: 6px; border-radius: 3px; background: var(--line); overflow: hidden; }
  .bar span { display: block; height: 100%; background: var(--gold); }
  .info { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  @media (max-width: 760px) {
    li { grid-template-columns: auto 1fr auto; row-gap: 0.15rem; }
    .rec { grid-column: 3; grid-row: 1; }
    .stars { grid-column: 2; grid-row: 2; }
    .bar { grid-column: 3; grid-row: 2; width: 4.5rem; }
    .info { grid-column: 1 / -1; white-space: normal; }
  }
</style>

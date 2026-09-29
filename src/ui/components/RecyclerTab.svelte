<script lang="ts">
  import { content } from '@content/index';
  import { canAfford } from '@core/costs';
  import { formatNumber, formatPercent } from '@core/format';
  import { capsuleCost, capsuleOdds, fragmentValue, openCapsules, pityCounter, type CapsuleResult } from '@core/features/recycler';
  import { autoRecycleCandidates, setAutoRecycle } from '@core/features/automation';
  import { D } from '@core/num';
  import type { AutoRecycleConfig } from '@core/state';
  import { stableFree } from '@core/features/stable';
  import { game, view, act, refresh, toast } from '../store.svelte';
  import CostLabel from './CostLabel.svelte';
  import CreatureSvg from './CreatureSvg.svelte';
  import { expressedAppearance } from '@core/genetics';
  import { findCreature } from '@core/creatures';
  import { viewState } from '../viewState.svelte';

  const recycler = viewState.recycler;
  let results = $state<CapsuleResult[] | null>(null);
  let revealing = $state(false);

  const data = $derived.by(() => {
    view.frame;
    return {
      free: stableFree(game),
      capsules: content.capsules.list.map((c) => ({
        def: c,
        odds: capsuleOdds(game, c.id),
        pity: pityCounter(game, c.id),
        cost1: capsuleCost(game, c.id, 1),
        cost10: capsuleCost(game, c.id, 10),
      })),
    };
  });

  const KEEP = [0, 1, 2, 3, 5, 10];

  // Candidate search walks all creatures – refreshed at the slow rate.
  const auto = $derived.by(() => {
    view.slowFrame;
    if (!game.state.features['autoRecycle']) return null;
    const cfg = game.state.automation.autoRecycle;
    const candidates = autoRecycleCandidates(game);
    return {
      cfg,
      count: candidates.length,
      fragments: candidates.reduce((sum, c) => sum.add(fragmentValue(game, c)), D(0)),
      next: candidates[0]?.name ?? null,
    };
  });

  function setAuto(patch: Partial<AutoRecycleConfig>) {
    act(setAutoRecycle(game, patch));
  }

  function open(id: string, count: number) {
    const def = content.capsules.get(id);
    view.muteDex = true;
    const res = openCapsules(game, id, count, def.elementChoice ? recycler.element : null);
    view.muteDex = false;
    refresh();
    if (!res.ok) {
      toast(res.reason, 'error', 3500, false);
      return;
    }
    results = res.results;
    revealing = true;
    // Short reveal animation; click anywhere to skip.
    setTimeout(() => (revealing = false), 900);
  }

  const shown = $derived.by(() =>
    (results ?? []).map((r) => {
      const c = findCreature(game, r.creatureId);
      return { r, c, species: content.species.get(r.speciesId), rarity: content.rarities.get(r.rarity), look: c ? expressedAppearance(game, c) : null };
    }),
  );
</script>

<header class="tab-head">
  <h2>♻️ Gen-Recycler & Kapseln</h2>
  <div class="kpis">
    <span class="kpi"><b class="num">🧩 {formatNumber(game.state.resources['fragments'] ?? 0)}</b><small>Gen-Fragmente</small></span>
    <span class="kpi" class:warn={data.free <= 0}><b class="num">{data.free}</b><small>freie Stallplätze</small></span>
    <span class="kpi"><b class="num">{game.state.statistics['capsulesOpened'] ?? 0}</b><small>Kapseln geöffnet</small></span>
  </div>
</header>
<p class="muted small">
  Überzählige Kreaturen recycelst du im <b>Labor</b> („Auswählen“) oder in der Detailansicht. Aus Gen-Fragmenten entstehen hier zufällige Kreaturen –
  auch Arten, die du noch nicht kennst. Alle Chancen stehen offen daneben. Nur Spielwährung, kein Echtgeld.
</p>

{#if auto}
  <div class="panel auto" class:on={auto.cfg.enabled}>
    <div class="auto-row">
      <label class="switch"><input type="checkbox" checked={auto.cfg.enabled} onchange={(e) => setAuto({ enabled: e.currentTarget.checked })} /> <b>♻️ Recycling-Automat</b></label>
      <label>Wann
        <select value={auto.cfg.when} onchange={(e) => setAuto({ when: e.currentTarget.value as AutoRecycleConfig['when'] })}>
          <option value="always">laufend alles Passende</option>
          <option value="full">nur wenn der Stall voll ist</option>
        </select>
      </label>
      <label>bis Seltenheit
        <select value={auto.cfg.maxRarity} onchange={(e) => setAuto({ maxRarity: e.currentTarget.value })}>
          {#each content.rarities.list as r (r.id)}<option value={r.id}>{r.name}</option>{/each}
        </select>
      </label>
    </div>
    <div class="auto-row">
      <label>Je Art behalten
        <select value={String(auto.cfg.keepPerSpecies)} onchange={(e) => setAuto({ keepPerSpecies: Number(e.currentTarget.value) })}>
          {#each KEEP as n (n)}<option value={String(n)}>{n === 0 ? 'keine' : `die ${n} stärksten`}</option>{/each}
        </select>
      </label>
      <label class="switch"><input type="checkbox" checked={auto.cfg.keepSequenced} onchange={(e) => setAuto({ keepSequenced: e.currentTarget.checked })} /> Sequenzierte behalten</label>
    </div>
    <p class="small auto-status">
      <span class="muted">Nie recycelt: Favoriten ★, Schillernde, infundierte und beschäftigte Kreaturen sowie das nächste Paar des Zuchtautomaten.</span>
      {#if auto.cfg.when === 'always'}
        <span class:hit={auto.count > 0}>Betrifft gerade <b class="num">{auto.count}</b> {auto.count === 1 ? 'Kreatur' : 'Kreaturen'}{#if auto.count > 0}{' '}(≈ <span class="num">{formatNumber(auto.fragments)}</span> 🧩){/if}</span>
      {:else if auto.next}
        <span>Als Nächstes dran: <b>{auto.next}</b></span>
      {:else}
        <span>Keine Kreatur erfüllt die Regeln.</span>
      {/if}
    </p>
  </div>
{/if}

<div class="grid caps">
  {#each data.capsules as cap (cap.def.id)}
    <article class="panel capsule">
      <h3>💊 {cap.def.name}</h3>
      <p class="muted small">{cap.def.description}</p>
      {#if cap.def.elementChoice}
        <select bind:value={recycler.element}>
          {#each content.elements.list as e (e.id)}<option value={e.id}>{e.name}</option>{/each}
        </select>
      {/if}
      <table class="odds">
        <tbody>
          {#each content.rarities.list as r (r.id)}
            {#if (cap.odds[r.id] ?? 0) > 0}
              <tr><td style="color: {r.color}">{r.name}</td><td class="num">{formatPercent(cap.odds[r.id] ?? 0, (cap.odds[r.id] ?? 0) < 0.01 ? 2 : 1)}</td></tr>
            {/if}
          {/each}
        </tbody>
      </table>
      <p class="small pity">
        Garantie: spätestens jede <b class="num">{cap.def.pity.threshold}.</b> Kapsel mindestens {content.rarities.get(cap.def.pity.minRarity).name}
        <br /><span class="num">{cap.pity}/{cap.def.pity.threshold - 1}</span> ohne {content.rarities.get(cap.def.pity.minRarity).name}
      </p>
      <div class="pitybar"><div style="width: {(cap.pity / (cap.def.pity.threshold - 1)) * 100}%"></div></div>
      <div class="row">
        <button class="primary" disabled={!canAfford(game.state, cap.cost1) || data.free < 1} onclick={() => open(cap.def.id, 1)}>Öffnen · <CostLabel cost={cap.cost1} /></button>
        <button disabled={!canAfford(game.state, cap.cost10) || data.free < 10} onclick={() => open(cap.def.id, 10)}>×10 · <CostLabel cost={cap.cost10} /></button>
      </div>
    </article>
  {/each}
</div>

{#if results}
  <div class="backdrop" role="presentation" onclick={() => (revealing ? (revealing = false) : (results = null))}>
    <div class="panel reveal" role="dialog" aria-modal="true" tabindex="-1" onkeydown={(e) => e.key === 'Escape' && (results = null)}>
      {#if revealing}
        <div class="spin">💊</div>
        <p class="muted small">Tippen zum Überspringen</p>
      {:else}
        <h3>Ergebnis</h3>
        <div class="results">
          {#each shown as s (s.r.creatureId)}
            <div class="res" class:glow={s.rarity.glow} style="--c: {s.rarity.color}">
              {#if s.look}<CreatureSvg appearance={s.look} shape={s.species.shape} tier={s.species.tier} size={56} />{/if}
              <b>{s.species.name}</b>
              <span class="small" style="color: var(--c)">{s.rarity.name}</span>
              {#if s.r.newDex}<span class="new">NEU</span>{/if}
              {#if s.r.pity}<span class="small muted">Garantie</span>{/if}
            </div>
          {/each}
        </div>
        <button class="primary" onclick={() => (results = null)}>Weiter</button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .small { font-size: 0.8rem; }
  .auto { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem; padding: 0.6rem 0.8rem; font-size: 0.9rem; }
  .auto.on { border-color: var(--teal); box-shadow: 0 0 12px #2fd3c433; }
  .auto-row { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
  .auto-status { margin: 0; display: flex; flex-direction: column; gap: 0.2rem; }
  .auto-status .hit { color: var(--gold); }
  .caps { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
  .capsule select { width: 100%; margin-bottom: 0.4rem; }
  .odds { width: 100%; font-size: 0.82rem; border-collapse: collapse; }
  .odds td { padding: 0.1rem 0; }
  .odds td.num { text-align: right; }
  .pity { margin: 0.5rem 0 0.25rem; }
  .pitybar { height: 6px; background: var(--bg-2); border-radius: 99px; overflow: hidden; margin-bottom: 0.5rem; }
  .pitybar div { height: 100%; background: linear-gradient(90deg, var(--violet), var(--gold)); }
  .row { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .row button { flex: 1; }
  .backdrop { position: fixed; inset: 0; background: #000c; z-index: 30; display: grid; place-items: center; padding: 1rem; }
  .reveal { width: min(640px, 100%); text-align: center; max-height: 90vh; overflow-y: auto; }
  .spin { font-size: 4rem; animation: shake 0.3s ease-in-out infinite alternate; }
  @keyframes shake { from { transform: rotate(-12deg) scale(1); } to { transform: rotate(12deg) scale(1.15); } }
  .results { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 0.5rem; margin: 0.75rem 0; }
  .res { display: flex; flex-direction: column; align-items: center; gap: 0.1rem; border: 2px solid var(--c); border-radius: 10px; padding: 0.4rem; font-size: 0.8rem; animation: pop 0.3s ease-out both; }
  .res.glow { animation: mythic-glow 2.2s ease-in-out infinite; }
  .new { background: var(--gold); color: #000; border-radius: 99px; padding: 0 0.4rem; font-size: 0.65rem; font-weight: 700; }
  @keyframes pop { from { transform: scale(0.6); opacity: 0; } }
</style>

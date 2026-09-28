<script lang="ts">
  import { onDestroy } from 'svelte';
  import { content } from '@content/index';
  import { assignJob } from '@core/actions';
  import { effectiveStats } from '@core/creatures';
  import { formatNumber, formatPercent } from '@core/format';
  import { expressedAppearance } from '@core/genetics';
  import { assignGain, jobCount, jobSlots, workerRate } from '@core/systems/production';
  import { autoAssign, setAutoAssign } from '@core/features/automation';
  import type { Creature } from '@core/state';
  import { game, view, act } from '../store.svelte';
  import { prefs } from '../prefs.svelte';
  import CreatureSvg from './CreatureSvg.svelte';
  import FacilityScene from './FacilityScene.svelte';

  /** Building whose creature picker is open. */
  let picking = $state<string | null>(null);

  const data = $derived.by(() => {
    view.frame;
    const rates = game.productionRates();
    const buildings = content.buildings.list
      .filter((b) => game.state.features[b.feature])
      .map((b) => {
        const stat = content.stats.get(b.workStat);
        const workers = game.state.creatures
          .filter((c) => c.job?.kind === 'building' && c.job.target === b.id)
          .map((c) => ({ c, stat: effectiveStats(game, c)[b.workStat] ?? 0, rate: workerRate(game, c) }));
        const slots = jobSlots(game, b.id);
        return {
          def: b,
          res: content.resources.get(b.produces),
          stat,
          used: jobCount(game, b.id),
          slots,
          workers,
          rate: rates[b.produces] ?? null,
        };
      });
    const idle = game.state.creatures.filter((c) => c.job === null).length;
    const used = buildings.reduce((n, b) => n + b.used, 0);
    const slots = buildings.reduce((n, b) => n + b.slots, 0);
    return { buildings, idle, used, slots, planner: game.state.features['autoAssign'] === true, auto: game.state.automation.autoAssign };
  });

  /** Creatures that could work in the picked building, best gain first. */
  const candidates = $derived.by(() => {
    view.slowFrame;
    if (!picking || !content.buildings.has(picking)) return [];
    const b = content.buildings.get(picking);
    return game.state.creatures
      .filter((c) => c.job === null || (c.job.kind === 'building' && c.job.target !== b.id))
      .map((c) => ({
        c,
        stat: effectiveStats(game, c)[b.workStat] ?? 0,
        gain: assignGain(game, b.id, c),
        from: c.job?.kind === 'building' ? content.buildings.get(c.job.target) : null,
      }))
      .sort((x, y) => (x.from ? 1 : 0) - (y.from ? 1 : 0) || y.gain.cmp(x.gain));
  });

  function assign(c: Creature, buildingId: string) {
    if (!act(assignJob(game, c.id, buildingId))) return;
    if (jobCount(game, buildingId) >= jobSlots(game, buildingId)) picking = null;
  }

  function withdraw(e: MouseEvent, c: Creature) {
    e.stopPropagation();
    act(assignJob(game, c.id, null));
  }

  // Rising yield numbers over each scene.
  const TICK_MS = 1400;
  let floaters = $state<{ id: number; building: string; x: number; text: string }[]>([]);
  let nextId = 0;
  const timer = setInterval(() => {
    if (prefs.reduceMotion || (typeof document !== 'undefined' && document.hidden)) return;
    const fresh = data.buildings
      .filter((b) => b.rate && b.used > 0)
      .map((b) => ({ id: ++nextId, building: b.def.id, x: 15 + Math.random() * 70, text: `+${formatNumber(b.rate!.mul(TICK_MS / 1000))} ${b.res.icon}` }));
    if (fresh.length === 0) return;
    floaters = [...floaters.slice(-12), ...fresh];
    const ids = new Set(fresh.map((f) => f.id));
    setTimeout(() => (floaters = floaters.filter((f) => !ids.has(f.id))), 1600);
  }, TICK_MS);
  onDestroy(() => clearInterval(timer));

  const species = (c: Creature) => content.species.get(c.speciesId);
  const el = (c: Creature) => content.elements.get(species(c).element);
</script>

<header class="head">
  <h2>🏭 Anlagen</h2>
  <div class="kpis">
    {#each data.buildings as b (b.def.id)}
      <span class="kpi" class:live={b.used > 0} style="--rc: {b.res.color}">
        <b class="num">{b.res.icon} {b.rate ? formatNumber(b.rate) : '0'}</b><small>{b.res.name}/s</small>
      </span>
    {/each}
    <span class="kpi"><b class="num">{data.used}/{data.slots}</b><small>Arbeitsplätze</small></span>
    <span class="kpi" class:warn={data.idle > 0 && data.used < data.slots}><b class="num">{data.idle}</b><small>ohne Arbeit</small></span>
  </div>
</header>

{#if data.planner}
  <div class="panel planner">
    <b>🗂️ Arbeitsplaner</b>
    <button class="primary" onclick={() => act(autoAssign(game))}>Jetzt optimal verteilen</button>
    <label><input type="checkbox" checked={data.auto} onchange={(e) => act(setAutoAssign(game, e.currentTarget.checked))} /> automatisch (alle {game.balance.automation.intervalSec} s)</label>
  </div>
{/if}

<div class="facilities">
  {#each data.buildings as b (b.def.id)}
    <article class="panel facility {b.def.id}" style="--rc: {b.res.color}">
      <div class="title">
        <h3>{b.def.icon} {b.def.name}</h3>
        <span class="rate num" class:off={!b.rate}>+{b.rate ? formatNumber(b.rate) : '0'} {b.res.icon}<small>/s</small></span>
      </div>

      <div class="stage">
        <FacilityScene kind={b.def.id} level={b.slots > 0 ? b.used / b.slots : 0} idle={b.used === 0} />
        <div class="crew">
          {#each b.workers.slice(0, 8) as w, i (w.c.id)}
            <span class="worker {b.def.id}" style="animation-delay: {i * 0.23}s" title="{w.c.name} arbeitet">
              <CreatureSvg appearance={expressedAppearance(game, w.c)} shape={species(w.c).shape} tier={species(w.c).tier} size={38} shiny={w.c.shiny} />
            </span>
          {/each}
          {#if b.workers.length > 8}<span class="more num">+{b.workers.length - 8}</span>{/if}
        </div>
        {#if b.used === 0}<span class="stillstand">Stillstand – weise eine Kreatur zu</span>{/if}
        {#each floaters.filter((f) => f.building === b.def.id) as f (f.id)}
          <span class="floater num" style="left: {f.x}%">{f.text}</span>
        {/each}
      </div>

      <p class="hint small">
        💡 <b>{b.stat.name}</b> erhöht den Ertrag: +{formatPercent(game.balance.production.statScaling, 0)} je Punkt.
        <span class="muted">{b.def.description.split('.')[0]}.</span>
      </p>

      <div class="sockets">
        {#each b.workers as w (w.c.id)}
          <div class="socket filled" style="--el: {el(w.c).color}">
            <button class="art" title="Details zu {w.c.name}" onclick={() => (view.detail = w.c.id)}>
              <CreatureSvg appearance={expressedAppearance(game, w.c)} shape={species(w.c).shape} tier={species(w.c).tier} size={44} shiny={w.c.shiny} />
            </button>
            <span class="sname">{w.c.name}</span>
            <span class="small num"><span class="muted">{b.stat.short}</span> {formatNumber(w.stat)}</span>
            <span class="small num yield">+{formatNumber(w.rate)}/s</span>
            <button class="x" title="Abziehen" onclick={(e) => withdraw(e, w.c)}>×</button>
          </div>
        {/each}
        {#each Array.from({ length: Math.max(0, b.slots - b.used) }, (_, i) => i) as i (i)}
          <button class="socket empty" class:open={picking === b.def.id} onclick={() => (picking = picking === b.def.id ? null : b.def.id)}>
            <span class="plus">+</span><span class="small">Zuweisen</span>
          </button>
        {/each}
      </div>

      {#if picking === b.def.id}
        <div class="picker">
          <div class="picker-head">
            <b class="small">Wer soll hier arbeiten? <span class="muted">Sortiert nach zusätzlichem Ertrag ({b.stat.name} zählt).</span></b>
            <button class="close" onclick={() => (picking = null)}>Fertig</button>
          </div>
          <div class="tiles">
            {#each candidates as t (t.c.id)}
              <button
                class="tile"
                disabled={b.used >= b.slots}
                style="--el: {el(t.c).color}; --rarity: {content.rarities.get(t.c.rarity).color}"
                title="{t.c.name} · {species(t.c).name} · {content.rarities.get(t.c.rarity).name}{t.from ? ` · arbeitet in: ${t.from.name}` : ''}"
                onclick={() => assign(t.c, b.def.id)}
              >
                {#if t.from}<span class="from" title="Arbeitet gerade in: {t.from.name}">{t.from.icon}</span>{/if}
                <CreatureSvg appearance={expressedAppearance(game, t.c)} shape={species(t.c).shape} tier={species(t.c).tier} size={40} shiny={t.c.shiny} />
                <span class="tname">{t.c.name}</span>
                <span class="small num"><span class="muted">{b.stat.short}</span> {formatNumber(t.stat)}</span>
                <span class="small num gain">+{formatNumber(t.gain)} {b.res.icon}/s</span>
              </button>
            {:else}
              <p class="muted small">Keine freie Kreatur. Kreaturen auf Erkundung, im Nest oder im Turm-Team können nicht arbeiten.</p>
            {/each}
          </div>
        </div>
      {/if}
    </article>
  {/each}
</div>

<style>
  .small { font-size: 0.8rem; }
  .head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.6rem; }
  .head h2 { margin: 0; }
  .kpis { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .kpi { display: flex; flex-direction: column; align-items: center; padding: 0.25rem 0.7rem; border: 1px solid var(--line); border-radius: 10px; background: var(--bg-2); min-width: 4.5rem; }
  .kpi b { font-size: 1.05rem; }
  .kpi small { color: var(--muted); font-size: 0.68rem; }
  .kpi.live { border-color: color-mix(in srgb, var(--rc) 60%, var(--line)); }
  .kpi.warn { border-color: var(--gold); box-shadow: 0 0 10px #f2c14e44; }

  .planner { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; margin-bottom: 0.75rem; padding: 0.6rem 0.8rem; }

  .facilities { display: grid; gap: 0.75rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); align-items: start; }
  .facility { display: grid; gap: 0.5rem; border-color: color-mix(in srgb, var(--rc) 35%, var(--line)); }
  .title { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
  .title h3 { margin: 0; }
  .rate { font-size: 1.15rem; font-weight: 700; color: var(--rc); }
  .rate small { font-size: 0.75rem; color: var(--muted); }
  .rate.off { color: var(--muted); }

  .stage { position: relative; height: 128px; border-radius: 10px; overflow: hidden; border: 1px solid var(--line); }
  .crew { position: absolute; left: 0; right: 0; bottom: 4px; display: flex; justify-content: center; align-items: flex-end; gap: 2px; padding: 0 0.5rem; }
  .worker { display: inline-block; filter: drop-shadow(0 2px 3px #0009); }
  .worker.farm { animation: hop 1.1s ease-in-out infinite; }
  .worker.mine { animation: dig 0.9s ease-in-out infinite; transform-origin: 50% 90%; }
  .worker.biolab { animation: hover 2.2s ease-in-out infinite; }
  @keyframes hop { 0%, 100% { transform: translateY(0); } 40% { transform: translateY(-7px); } }
  @keyframes dig { 0%, 100% { transform: rotate(-8deg); } 50% { transform: rotate(10deg) translateY(2px); } }
  @keyframes hover { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
  .more { align-self: center; font-size: 0.8rem; background: #000a; border-radius: 99px; padding: 0.1rem 0.45rem; }
  .stillstand { position: absolute; inset: 0; display: grid; place-items: center; font-size: 0.85rem; color: var(--text); text-shadow: 0 1px 4px #000; }
  .floater { position: absolute; bottom: 38%; pointer-events: none; font-size: 0.85rem; font-weight: 700; color: var(--rc); background: #0009; border-radius: 99px; padding: 0.05rem 0.45rem; white-space: nowrap; transform: translateX(-50%); animation: float-up 1.6s ease-out forwards; }
  @keyframes float-up { from { transform: translate(-50%, 0); opacity: 1; } to { transform: translate(-50%, -52px); opacity: 0; } }

  .hint { margin: 0; }

  .sockets { display: grid; grid-template-columns: repeat(auto-fill, minmax(5.6rem, 1fr)); gap: 0.4rem; }
  .socket {
    position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.05rem;
    min-height: 6.4rem; border-radius: 12px; border: 2px dashed var(--line); background: var(--bg-2); color: var(--muted); padding: 0.3rem;
  }
  .socket.filled { border: 2px solid var(--el); background: radial-gradient(circle at 50% 30%, color-mix(in srgb, var(--el) 18%, transparent), var(--bg-2) 70%); color: var(--text); }
  .socket.filled::after { content: ''; position: absolute; left: 18%; right: 18%; bottom: 3px; height: 3px; border-radius: 3px; background: color-mix(in srgb, var(--el) 50%, transparent); }
  .socket.empty:hover, .socket.empty.open { border-color: var(--teal); color: var(--text); }
  .plus { font-size: 1.4rem; line-height: 1; }
  .art { padding: 0; border: 0; background: none; line-height: 0; }
  .sname { max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; font-size: 0.8rem; }
  .yield { color: var(--rc); }
  .x { position: absolute; top: 2px; right: 3px; padding: 0 0.35rem; border: 0; background: none; color: var(--muted); font-size: 1rem; line-height: 1.2; }
  .x:hover { color: var(--danger); }

  .picker { border-top: 1px dashed var(--line); padding-top: 0.5rem; display: grid; gap: 0.4rem; }
  .picker-head { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
  .close { font-size: 0.8rem; padding: 0.2rem 0.6rem; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.2rem, 1fr)); gap: 0.4rem; max-height: 20rem; overflow-y: auto; padding: 2px; }
  .tile {
    position: relative; display: flex; flex-direction: column; align-items: center; gap: 0.05rem; padding: 0.35rem 0.25rem;
    border-radius: 10px; border: 2px solid color-mix(in srgb, var(--el) 45%, var(--line)); background: var(--bg-2);
  }
  .tile:hover:not(:disabled) { border-color: var(--rc); }
  .tname { font-size: 0.75rem; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border-bottom: 2px solid var(--rarity); }
  .gain { color: var(--rc); font-weight: 600; }
  .from { position: absolute; top: 2px; left: 5px; font-size: 0.8rem; }
</style>

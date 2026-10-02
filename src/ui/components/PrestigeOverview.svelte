<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { content } from '@content/index';
  import { formatDuration, formatNumber, formatPercent } from '@core/format';
  import {
    currentRunStart, nextPrestigePoint, performPrestige, prestigeBonusPreview, prestigeGain, prestigeTimeline, resetImpactText, resetOverview,
  } from '@core/prestige';
  import { unusedAttacksText } from '@core/features/weeklyBoss';
  import { game, view, act, save, ask } from '../store.svelte';

  /**
   * Overview of one prestige layer (Vererbung, Äon): the gain as a big
   * number, progress to the next point, bonus before/after, what is lost
   * and what stays, a timeline of past runs and a short celebration.
   */
  let { layerId }: { layerId: string } = $props();

  /** Wording per layer (the rest comes from the layer data). */
  const TEXT: Record<string, { gain: string; action: string; share: string; empty: string; done: string; lower: string }> = {
    inheritance: {
      gain: 'Gewinn beim Vererben', action: 'Vererben', share: 'deines Erbguts', lower: '',
      empty: 'Noch keine Vererbung – dein erster Lauf läuft.', done: 'Erbgut vererbt – eine neue Generation beginnt.',
    },
    aeon: {
      gain: 'Splitter beim Äon', action: 'Äon einleiten', share: 'deiner Splitter', lower: 'Vererbungen',
      empty: 'Noch kein Äon – dein erstes Zeitalter läuft.', done: 'Ein neues Äon beginnt – die Zeit dreht sich weiter.',
    },
  };

  const layer = $derived(content.prestigeLayers.get(layerId));
  const currency = $derived(content.resources.get(layer.currency));
  const text = $derived(TEXT[layerId] ?? { gain: 'Gewinn', action: layer.name, share: '', lower: '', empty: 'Noch kein Durchlauf.', done: `${layer.name} abgeschlossen.` });
  const source = $derived(layer.gainFrom.map((r) => content.resources.get(r)));

  const data = $derived.by(() => {
    view.slowFrame;
    const owned = game.state.resources[layer.currency]?.toNumber() ?? 0;
    const gain = prestigeGain(game, layer.id);
    const timeline = prestigeTimeline(game, layer.id);
    const runs = timeline.items.filter((x) => x.kind === 'run');
    return {
      gain,
      owned,
      share: owned > 0 ? gain.toNumber() / owned : null,
      count: game.state.prestige[layer.id]?.count ?? 0,
      next: nextPrestigePoint(game, layer.id),
      bonuses: prestigeBonusPreview(game, layer.id),
      overview: resetOverview(game, layer.id),
      runMs: Math.max(0, game.state.lastTickAt - currentRunStart(game, layer.id)),
      anomaly: game.state.anomaly !== null,
      timeline: { ...timeline, items: timeline.items.slice(-24) },
      maxGain: Math.max(1, ...runs.map((e) => e.gain)),
    };
  });

  /** "🍖 Nahrung" for `production.food`. */
  function targetLabel(target: string): string {
    const [root, res] = target.split('.');
    if (root === 'production' && res && content.resources.has(res)) {
      const r = content.resources.get(res);
      return `${r.icon} ${r.name}`;
    }
    return target;
  }

  let celebrate = $state<{ gain: string; key: number } | null>(null);

  async function confirm() {
    const gain = formatNumber(data.gain);
    const boss = layer.resets.creatures ? unusedAttacksText(game) : '';
    if (!(await ask(`${text.action}? ${layer.description} ${resetImpactText(game)} ${boss}`.trim(), { ok: text.action, danger: true }))) return;
    if (!act(performPrestige(game, layer.id))) return;
    save();
    const key = Date.now();
    celebrate = { gain, key };
    setTimeout(() => celebrate?.key === key && (celebrate = null), 3200);
  }

  /** Keeps the newest run in view when the timeline scrolls. */
  function scrollEnd(node: HTMLElement) {
    node.scrollLeft = node.scrollWidth;
  }

  const short = (ms: number) => formatDuration(ms).split(' ').slice(0, 2).join(' ');
  const particles = Array.from({ length: 18 }, (_, i) => ({ x: 5 + ((i * 53) % 90), delay: (i % 6) * 0.18, size: 0.9 + (i % 3) * 0.35 }));
</script>

<article class="panel hero" class:ready={data.gain.gt(0)}>
  <div class="gain">
    <span class="label small muted">{text.gain}</span>
    <span class="big num">+{formatNumber(data.gain)}<span class="icon">{currency.icon}</span></span>
    {#if data.gain.gt(0) && data.share !== null && text.share}
      <span class="small muted">+{formatPercent(data.share, 0)} {text.share}</span>
    {:else if data.gain.lte(0)}
      <span class="small muted">Noch kein Gewinn möglich</span>
    {/if}
  </div>
  <div class="next">
    <p class="small desc muted">{layer.description}</p>
    <div class="small">
      <span class="muted">Nächster Punkt:</span>
      <span class="num">{formatNumber(data.next.total)} / {formatNumber(data.next.needed)}</span>
      {source.map((r) => r.icon).join('+')} {layer.gainSource === 'owned' ? 'im Besitz' : 'verdient'}
    </div>
    <div class="bar"><div style="width: {data.next.progress * 100}%"></div></div>
    <button class="primary go" disabled={data.gain.lte(0) || data.anomaly} onclick={confirm}>
      {text.action} für <span class="num">+{formatNumber(data.gain)}</span> {currency.icon}
    </button>
    {#if data.anomaly}<span class="small muted">Während einer Anomalie nicht möglich.</span>{/if}
  </div>
</article>

{#if data.bonuses.length > 0}
  <article class="panel bonus">
    <h3>Produktionsbonus</h3>
    <div class="rows">
      {#each data.bonuses as b (b.target)}
        <div class="brow">
          <span class="blabel">{targetLabel(b.target)}</span>
          <span class="num before">+{formatPercent(b.before, 0)}</span>
          <span class="arrow">→</span>
          <span class="num after" class:up={b.after > b.before}>+{formatPercent(b.after, 0)}</span>
        </div>
      {/each}
    </div>
    <p class="small muted">Jeder {currency.name}-Punkt wirkt dauerhaft – bis zum nächsten Äon.</p>
  </article>
{/if}

<div class="split">
  <article class="panel lost">
    <h3>Geht verloren</h3>
    <ul>
      {#each data.overview.lost as item (item.label)}
        <li><span class="i">{item.icon}</span><span>{item.label}</span>{#if item.detail}<span class="num muted d">{item.detail}</span>{/if}</li>
      {:else}
        <li class="muted small">Nichts von Bedeutung.</li>
      {/each}
    </ul>
  </article>
  <article class="panel kept">
    <h3>Bleibt</h3>
    <ul>
      <li><span class="i">{currency.icon}</span><span>{currency.name}</span><span class="num d">{formatNumber(data.owned)} → {formatNumber(data.gain.add(data.owned))}</span></li>
      {#each data.overview.kept as item (item.label)}
        <li><span class="i">{item.icon}</span><span>{item.label}</span>{#if item.detail}<span class="num muted d">{item.detail}</span>{/if}</li>
      {/each}
    </ul>
  </article>
</div>

<article class="panel history">
  <div class="hhead">
    <h3>Bisherige Durchläufe <span class="muted num">{data.count}</span></h3>
    {#if data.timeline.best > 0}<span class="small muted">Bester Gewinn <b class="num">+{formatNumber(data.timeline.best)}</b> · Ø Laufzeit <b class="num">{formatDuration(data.timeline.avgMs)}</b> · dieser Lauf <b class="num">{formatDuration(data.runMs)}</b></span>{/if}
  </div>
  {#if data.timeline.items.length === 0}
    <p class="small muted">{data.count > 0 ? `${data.count} frühere Durchläufe wurden vor der Aufzeichnung abgeschlossen.` : text.empty}</p>
  {:else}
    <div class="timeline" use:scrollEnd>
      {#if data.timeline.unrecorded > 0}<div class="older small muted">+{data.timeline.unrecorded} ältere</div>{/if}
      {#each data.timeline.items as e, i (e.at + ':' + i)}
        {#if e.kind === 'run'}
          <div class="run" title="{new Date(e.at).toLocaleString('de-DE')} · {formatDuration(e.runMs)}{text.lower && e.inner ? ` · ${e.inner} ${text.lower}` : ''}">
            <span class="g num">+{formatNumber(e.gain)}</span>
            <div class="col"><div style="height: {Math.max(8, (e.gain / data.maxGain) * 100)}%"></div></div>
            <span class="t num">{short(e.runMs)}</span>
            {#if text.lower}<span class="t num inner">{e.inner}×♾️</span>{/if}
          </div>
        {:else}
          {@const other = content.prestigeLayers.get(e.layer)}
          <div class="marker" title="{other.name} · +{formatNumber(e.gain)} {content.resources.get(other.currency).name} · {new Date(e.at).toLocaleString('de-DE')}">
            <span>{content.resources.get(other.currency).icon}</span><span class="small">{other.name}</span>
          </div>
        {/if}
      {/each}
      <div class="run current" title="Laufender Durchlauf">
        <span class="g num">+{formatNumber(data.gain)}</span>
        <div class="col"><div style="height: {Math.max(8, Math.min(100, (data.gain.toNumber() / data.maxGain) * 100))}%"></div></div>
        <span class="t">jetzt</span>
        {#if text.lower}<span class="t num inner">&nbsp;</span>{/if}
      </div>
    </div>
  {/if}
</article>

{#if celebrate}
  {#key celebrate.key}
    <button class="celebrate" transition:fade={{ duration: 400 }} onclick={() => (celebrate = null)} aria-label="Schließen">
      <div class="burst"></div>
      {#each particles as p, i (i)}
        <span class="p" style="left: {p.x}%; animation-delay: {p.delay}s; font-size: {p.size}rem">{currency.icon}</span>
      {/each}
      <div class="msg" in:scale={{ duration: 600, start: 0.4 }}>
        <span class="num big">+{celebrate.gain}<span class="icon">{currency.icon}</span></span>
        <span>{text.done}</span>
      </div>
    </button>
  {/key}
{/if}

<style>
  .small { font-size: 0.8rem; }
  h3 { margin: 0 0 0.4rem; }

  .hero { display: grid; grid-template-columns: auto 1fr; gap: 1.2rem; align-items: center; margin-bottom: 0.75rem; }
  .hero.ready { border-color: color-mix(in srgb, var(--teal) 60%, var(--line)); background: radial-gradient(ellipse at 15% 50%, color-mix(in srgb, var(--teal) 16%, transparent), var(--panel) 60%); }
  .gain { display: grid; justify-items: center; gap: 0.1rem; min-width: 11rem; }
  .big { font-size: 3rem; font-weight: 800; line-height: 1.05; color: var(--teal); text-shadow: 0 0 18px color-mix(in srgb, var(--teal) 55%, transparent); }
  .hero:not(.ready) .big { color: var(--muted); text-shadow: none; }
  .icon { font-size: 0.6em; margin-left: 0.2rem; }
  .next { display: grid; gap: 0.4rem; }
  .desc { margin: 0; }
  .bar { height: 10px; border-radius: 99px; background: var(--bg-2); overflow: hidden; border: 1px solid var(--line); }
  .bar div { height: 100%; background: linear-gradient(90deg, var(--petrol), var(--teal)); transition: width 0.4s; }
  .go { font-size: 1rem; padding: 0.7rem 1rem; }

  .bonus { margin-bottom: 0.75rem; }
  .rows { display: grid; gap: 0.3rem; }
  .brow { display: grid; grid-template-columns: 9rem 6.5rem 1rem 6.5rem; gap: 0.6rem; align-items: baseline; }
  .brow .num { text-align: right; white-space: nowrap; }
  .before { color: var(--muted); }
  .arrow { color: var(--muted); }
  .after { font-weight: 700; }
  .after.up { color: var(--teal); }

  .split { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem; }
  .lost { border-color: color-mix(in srgb, var(--danger) 45%, var(--line)); }
  .kept { border-color: color-mix(in srgb, var(--teal) 45%, var(--line)); }
  .lost h3 { color: var(--danger); }
  .kept h3 { color: var(--teal); }
  ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.3rem; }
  li { display: grid; grid-template-columns: 1.5rem 1fr auto; gap: 0.4rem; align-items: baseline; font-size: 0.88rem; }
  .i { text-align: center; }
  .d { font-size: 0.78rem; text-align: right; }
  .lost li:not(.muted) span:nth-child(2) { text-decoration: line-through; text-decoration-color: color-mix(in srgb, var(--danger) 60%, transparent); }

  .history { margin-bottom: 0.75rem; }
  .hhead { display: flex; flex-wrap: wrap; justify-content: space-between; align-items: baseline; gap: 0.5rem; }
  .timeline { display: flex; align-items: flex-end; gap: 0.35rem; overflow-x: auto; padding: 0.3rem 0.1rem; min-height: 9rem; }
  .run { display: grid; grid-template-rows: auto 5.5rem auto; justify-items: center; gap: 0.15rem; min-width: 2.6rem; }
  .run:has(.inner) { grid-template-rows: auto 5.5rem auto auto; }
  .col { width: 1.3rem; height: 100%; display: flex; align-items: flex-end; background: var(--bg-2); border-radius: 6px; overflow: hidden; }
  .col div { width: 100%; background: linear-gradient(180deg, var(--teal), var(--petrol)); border-radius: 6px 6px 0 0; }
  .run.current .col div { background: repeating-linear-gradient(45deg, var(--gold) 0 5px, #d9a93a 5px 10px); opacity: 0.8; }
  .g { font-size: 0.7rem; color: var(--teal); }
  .run.current .g { color: var(--gold); }
  .t { font-size: 0.65rem; color: var(--muted); white-space: nowrap; }
  .inner { color: var(--violet); }
  .marker { align-self: stretch; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.2rem; padding: 0 0.3rem; border-left: 2px dashed var(--violet); border-right: 2px dashed var(--violet); color: var(--violet); }
  .older { align-self: center; white-space: nowrap; padding-right: 0.3rem; }

  .celebrate { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; background: color-mix(in srgb, var(--bg) 82%, transparent); border: 0; border-radius: 0; padding: 0; overflow: hidden; cursor: pointer; }
  .burst { position: absolute; width: 60vmax; height: 60vmax; border-radius: 50%; background: radial-gradient(circle, color-mix(in srgb, var(--teal) 45%, transparent), transparent 60%); animation: burst 2.6s ease-out forwards; }
  @keyframes burst { from { transform: scale(0.1); opacity: 1; } to { transform: scale(1.4); opacity: 0; } }
  .p { position: absolute; bottom: -2rem; animation: rise 2.8s ease-out forwards; opacity: 0; }
  @keyframes rise { 0% { transform: translateY(0) rotate(0); opacity: 0; } 15% { opacity: 1; } 100% { transform: translateY(-105vh) rotate(260deg); opacity: 0; } }
  .msg { position: relative; display: grid; justify-items: center; gap: 0.4rem; color: var(--text); font-size: 1rem; text-align: center; padding: 0 1rem; }
  .msg .big { font-size: 4rem; }

  @media (max-width: 640px) {
    .hero { grid-template-columns: 1fr; gap: 0.6rem; }
    .split { grid-template-columns: 1fr; }
    /* Label on its own line, so big numbers keep the full width (they were cut off at 320 px). */
    .brow { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); gap: 0.1rem 0.4rem; }
    .brow .blabel { grid-column: 1 / -1; }
    .brow .after { text-align: left; }
    .big { font-size: 2.6rem; }
  }
</style>

<script lang="ts">
  import Meter from './Meter.svelte';
  import { content } from '@content/index';
  import { formatDuration } from '@core/format';
  import { missingAlleles } from '@core/genetics';
  import {
    contractCandidates,
    contractLevel,
    contractReward,
    deliverContract,
    nextContractDay,
    nextLevelAt,
    requirementStatus,
    requirementText,
    rerollContract,
    type RequirementStatus,
  } from '@core/features/contracts';
  import { consumeBlocker } from '@core/features/stable';
  import type { ContractRequirement, Creature } from '@core/state';
  import { game, view, act, ask, toast } from '../store.svelte';
  import CostLabel from './CostLabel.svelte';
  import CreatureTile from './CreatureTile.svelte';

  /** Selected creature per board slot. */
  let chosen = $state<Record<number, number | null>>({});

  const ICONS: Record<ContractRequirement['kind'], string> = {
    expresses: '👁', genotype: '🧬', element: '✦', minTier: '🔀', topLoci: '⭐', minRarity: '💠', minGeneration: '🌳',
  };
  const MARK: Record<RequirementStatus, string> = { met: '✔', unmet: '✖', unknown: '?' };

  const data = $derived.by(() => {
    view.slowFrame;
    const board = game.state.contracts;
    const now = Date.now();
    const level = contractLevel(game);
    const next = nextLevelAt(game);
    const prev = game.balance.contracts.levelThresholds[level - 1] ?? 0;
    const hasMissing = missingAlleles(game).length > 0;
    const offers = board.offers.map((offer, slot) => {
      const t = content.contracts.get(offer.template);
      const { ready, maybe } = contractCandidates(game, offer);
      const pick = chosen[slot] !== undefined && chosen[slot] !== null ? ready.find((c) => c.id === chosen[slot]) : undefined;
      return {
        slot,
        offer,
        t,
        reward: contractReward(game, offer),
        samples: hasMissing ? (t.reward.alleleSamples ?? 0) : 0,
        ready: ready.map((c) => ({ c, blocker: consumeBlocker(game, c) })),
        maybe: maybe.length,
        pick,
        lines: offer.requirements.map((r) => ({ r, text: requirementText(game, r), status: pick ? requirementStatus(game, pick, r) : null })),
      };
    });
    // The board grows with the Ruf: one row per star level, easiest first.
    const groups = [...new Set(offers.map((o) => o.t.level))].sort((a, b) => a - b).map((star) => {
      const list = offers.filter((o) => o.t.level === star);
      return { star, offers: list, done: list.filter((o) => o.offer.done).length };
    });
    return {
      level,
      completed: board.completed,
      next,
      progress: next === null ? 1 : (board.completed - prev) / Math.max(1, next - prev),
      renewIn: nextContractDay(game, now) - now,
      rerollsLeft: game.balance.contracts.rerollsPerDay - board.rerolls,
      groups,
    };
  });

  async function deliver(slot: number, c: Creature, client: string) {
    if (!(await ask(`${c.name} an „${client}“ abgeben? Die Kreatur verlässt dein Labor.`, { ok: 'Abgeben' }))) return;
    const level = contractLevel(game);
    if (act(deliverContract(game, slot, c.id))) {
      chosen[slot] = null;
      toast('Auftrag erfüllt! Die Belohnung ist da.', 'unlock');
      if (contractLevel(game) > level) toast(`Ruf ${contractLevel(game)} erreicht – ab dem nächsten Tag gibt es mehr und anspruchsvollere Aufträge.`, 'rare', 6000);
    }
  }
</script>

<header class="tab-head">
  <h2>📋 Gen-Aufträge</h2>
  <div class="kpis">
    <span class="kpi" title="Mehr Ruf bringt mehr Aufträge am Tag – und schwierigere mit besseren Belohnungen.">
      <b class="num">Ruf {data.level}</b>
      <small>{data.next === null ? 'Höchster Ruf' : `${data.completed}/${data.next} erfüllt`}</small>
      <Meter size="sm" tone="gold" value={data.progress} />
    </span>
    <span class="kpi"><b class="num">{formatDuration(data.renewIn)}</b><small>bis zu neuen Aufträgen</small></span>
    <span class="kpi"><b class="num">{data.rerollsLeft}</b><small>Tausch übrig</small></span>
  </div>
</header>

<p class="muted small intro">
  Züchter suchen Kreaturen mit bestimmten Genen. Gene zählen erst, wenn das Genom sequenziert ist. Die abgegebene Kreatur verlässt dein Labor. Jeder erfüllte Auftrag bringt Ruf – mit mehr Ruf gibt es mehr Aufträge und mehr Sterne.
</p>

{#each data.groups as grp (grp.star)}
<h3 class="stars-head"><span class="level">{'★'.repeat(grp.star)}</span> <span class="muted small">{grp.done}/{grp.offers.length} erledigt</span></h3>
<div class="board">
  {#each grp.offers as o (o.slot)}
    <article class="panel card" class:done={o.offer.done} style="--lv: {o.t.level}">
      <div class="top">
        <span class="level" title="{o.t.level} {o.t.level === 1 ? 'Stern' : 'Sterne'}">{'★'.repeat(o.t.level)}</span>
        {#if !o.offer.done && data.rerollsLeft > 0}
          <button class="reroll" title="Diesen Auftrag gegen einen anderen tauschen" onclick={() => act(rerollContract(game, o.slot))}>🎲 Tauschen</button>
        {/if}
      </div>
      <h3>{o.t.name}</h3>
      <p class="client muted">{o.t.client}</p>

      <ul class="reqs">
        {#each o.lines as line, i (i)}
          <li class={line.status ?? ''}>
            <span class="icon">{ICONS[line.r.kind]}</span>
            <span>{line.text}</span>
            {#if line.status}<b class="mark">{MARK[line.status]}</b>{/if}
          </li>
        {/each}
      </ul>

      <div class="reward">
        <span class="muted small">Belohnung</span>
        <span><CostLabel cost={o.reward} />{#if o.samples > 0}<span class="sample" title="Fügt das seltenste fehlende Allel der Genbibliothek hinzu"> +{o.samples} 🧬 Genprobe</span>{/if}</span>
      </div>

      {#if o.offer.done}
        <div class="stamp">✔ Erledigt</div>
      {:else}
        {#if o.ready.length > 0}
          <div class="tiles">
            {#each o.ready as { c, blocker } (c.id)}
              {@const sp = content.species.get(c.speciesId)}
              {@const rar = content.rarities.get(c.rarity)}
              <CreatureTile
                creature={c}
                info="Gen {c.generation}"
                selected={o.pick?.id === c.id}
                dim={!!blocker}
                title={blocker ? `${c.name}: ${blocker}` : `${c.name} · ${sp.name} · ${rar.name}`}
                onclick={() => (chosen[o.slot] = o.pick?.id === c.id ? null : c.id)}
              >
                {#snippet corner()}
                  {#if blocker}<span>{c.locked ? '★' : '⚒'}</span>{/if}
                {/snippet}
              </CreatureTile>
            {/each}
          </div>
          {#if o.pick}
            {@const blocker = consumeBlocker(game, o.pick)}
            {#if blocker}<p class="small warn">{blocker}</p>{/if}
            <button class="primary" disabled={!!blocker} onclick={() => o.pick && deliver(o.slot, o.pick, o.t.client)}>{o.pick.name} abgeben</button>
          {:else}
            <p class="small muted">{o.ready.length === 1 ? 'Eine Kreatur passt' : `${o.ready.length} Kreaturen passen`} – zum Abgeben auswählen.</p>
          {/if}
        {:else}
          <p class="small muted">
            Noch keine passende Kreatur.
            {#if o.maybe > 0}{o.maybe === 1 ? 'Eine unsequenzierte Kreatur könnte passen' : `${o.maybe} unsequenzierte Kreaturen könnten passen`} – im Genlabor sequenzieren.{:else}Tipp: Der Zuchtplaner in der Brutstation zeigt die Chancen der Nachkommen.{/if}
          </p>
        {/if}
      {/if}
    </article>
  {/each}
</div>
{:else}
  <p class="muted">Heute gibt es keine Aufträge.</p>
{/each}

<style>
  .small { font-size: 0.8rem; }
  .mini { width: 100%; height: 3px; border-radius: 99px; background: var(--panel-2); overflow: hidden; margin-top: 2px; }
  .mini span { display: block; height: 100%; background: var(--teal); }
  .intro { margin: 0 0 0.8rem; }

  .stars-head { display: flex; align-items: baseline; gap: 0.5rem; margin: 1rem 0 0.5rem; font-size: 1rem; }
  .stars-head:first-of-type { margin-top: 0; }
  .board { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 270px), 1fr)); gap: 0.8rem; }
  .card { position: relative; display: flex; flex-direction: column; gap: 0.45rem; border-color: color-mix(in srgb, var(--gold) calc(var(--lv) * 12%), var(--line)); }
  .card.done { opacity: 0.6; }
  .top { display: flex; justify-content: space-between; align-items: center; min-height: 1.6rem; }
  .level { color: var(--gold); letter-spacing: 0.1em; }
  .reroll { font-size: 0.75rem; padding: 0.15rem 0.5rem; }
  h3 { margin: 0; }
  .client { margin: -0.3rem 0 0; font-size: 0.8rem; font-style: italic; }

  .reqs { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.3rem; }
  .reqs li { display: grid; grid-template-columns: 1.4rem 1fr auto; align-items: center; gap: 0.3rem; padding: 0.3rem 0.5rem; border-radius: 8px; background: var(--bg-2); font-size: 0.88rem; }
  .reqs .icon { text-align: center; }
  .reqs li.met { box-shadow: inset 3px 0 0 var(--teal); }
  .reqs li.unmet { box-shadow: inset 3px 0 0 var(--danger); }
  .reqs li.met .mark { color: var(--teal); }
  .reqs li.unmet .mark { color: var(--danger); }
  .reqs li.unknown .mark { color: var(--muted); }

  .reward { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; border-top: 1px dashed var(--line); padding-top: 0.4rem; }
  .sample { color: var(--teal); margin-left: 0.4rem; }

  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.4rem, 1fr)); gap: 0.4rem; padding: 2px; }
  .warn { color: var(--danger); margin: 0; }
  .primary { width: 100%; }

  .stamp { align-self: center; margin-top: 0.3rem; padding: 0.2rem 0.9rem; border: 2px solid var(--teal); border-radius: 8px; color: var(--teal); font-weight: 700; transform: rotate(-4deg); }
</style>

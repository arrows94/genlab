<script lang="ts">
  import { content } from '@content/index';
  import { canAfford } from '@core/costs';
  import { creaturePower, findCreature } from '@core/creatures';
  import { formatDuration } from '@core/format';
  import { DEEP_SEQUENCE, SEQUENCE, isBeingSequenced, sequencerSlots, sequencingCost, sequencingTimeMs, startSequencing, type SequenceData } from '@core/features/sequencing';
  import { setAutoSequence } from '@core/features/automation';
  import { deepSequencingBlocker, deepSequencingCost, deepSequencingTimeMs, startDeepSequencing } from '@core/features/deepSequencing';
  import { activeLoci, expressedAppearance } from '@core/genetics';
  import { processRemainingMs } from '@core/systems/processes';
  import type { Creature } from '@core/state';
  import { game, view, act } from '../store.svelte';
  import CostLabel from './CostLabel.svelte';
  import CreatureSvg from './CreatureSvg.svelte';
  import CreatureTile from './CreatureTile.svelte';
  import DnaHelix from './DnaHelix.svelte';
  import GenomeInspector from './GenomeInspector.svelte';
  import GeneLibrary from './GeneLibrary.svelte';
  import SplicingBench from './SplicingBench.svelte';
  import CrystalSkip from './CrystalSkip.svelte';

  /** Open picker: normal or deep sequencing, and the chosen creature. */
  let picking = $state<'seq' | 'deep' | null>(null);
  let chosen = $state<number | null>(null);


  const data = $derived.by(() => {
    view.frame;
    const loci = activeLoci(game);
    const running = game.state.processes
      .filter((p) => p.kind === SEQUENCE || p.kind === DEEP_SEQUENCE)
      .map((p) => {
        const progress = Math.min(1, p.elapsedMs / p.durationMs);
        return { p, deep: p.kind === DEEP_SEQUENCE, creature: findCreature(game, (p.data as SequenceData).creatureId), progress, remaining: processRemainingMs(game, p) };
      });
    const slots = sequencerSlots(game);
    const found = Object.keys(game.state.geneLibrary).length;
    const total = loci.reduce((n, l) => n + l.alleles.length, 0);
    return {
      loci,
      slots,
      machines: Array.from({ length: Math.max(slots, running.length) }, (_, i) => running[i] ?? null),
      free: running.length < slots,
      found,
      total,
      unknown: game.state.creatures.filter((c) => !c.sequenced).length,
      sequenced: game.state.statistics['sequenced'] ?? 0,
      time: sequencingTimeMs(game),
      splicing: game.state.features['splicing'] === true,
      deepOn: game.state.features['deepSequencing'] === true,
      robot: game.state.features['autoSequence'] === true,
      robotOn: game.state.automation.autoSequence,
      deepCost: deepSequencingCost(game),
      deepTime: deepSequencingTimeMs(game),
    };
  });

  const candidates = $derived.by(() => {
    view.slowFrame;
    if (!picking) return [];
    const list = picking === 'seq'
      ? game.state.creatures.filter((c) => !c.sequenced && !isBeingSequenced(game, c.id))
      : game.state.creatures.filter((c) => !deepSequencingBlocker(game, c));
    return list.map((c) => ({ c, power: creaturePower(game, c) })).sort((a, b) => b.power - a.power);
  });

  const pickCost = $derived.by(() => {
    view.slowFrame;
    const c = chosen !== null ? findCreature(game, chosen) : undefined;
    if (!picking || !c) return null;
    return picking === 'seq' ? sequencingCost(game, c) : data.deepCost;
  });


  function openPicker(mode: 'seq' | 'deep') {
    picking = picking === mode ? null : mode;
    chosen = null;
  }

  function start() {
    if (chosen === null || !picking) return;
    const ok = act(picking === 'seq' ? startSequencing(game, chosen) : startDeepSequencing(game, chosen));
    if (ok) {
      chosen = null;
      if (!data.free) picking = null;
    }
  }

  const species = (c: Creature) => content.species.get(c.speciesId);
  /** Locus state on the machine screen while decoding. */
  const locusState = (i: number, progress: number, n: number) => (i < Math.floor(progress * n) ? 'done' : i === Math.floor(progress * n) ? 'scan' : 'wait');
</script>

<header class="tab-head">
  <h2>🧬 Genlabor</h2>
  <div class="kpis">
    <span class="kpi" class:live={!data.free}><b class="num">{data.machines.filter(Boolean).length}/{data.slots}</b><small>Sequenzierer</small></span>
    <span class="kpi"><b class="num">{data.found}/{data.total}</b><small>Genbibliothek</small></span>
    <span class="kpi"><b class="num">{data.sequenced}</b><small>entschlüsselt</small></span>
    <span class="kpi" class:warn={data.unknown > 0 && data.free}><b class="num">{data.unknown}</b><small>unbekannte Genome</small></span>
  </div>
</header>

<section class="lab">
  <div class="lab-head">
    <h3>🔬 Sequenzierlabor</h3>
    {#if data.robot}
      <label class="robot" class:on={data.robotOn}>
        <input type="checkbox" checked={data.robotOn} onchange={(e) => act(setAutoSequence(game, e.currentTarget.checked))} />
        🤖 Sequenzier-Roboter <span class="small muted">– stärkste unbekannte Genome zuerst</span>
      </label>
    {/if}
  </div>

  <div class="machines">
    {#each data.machines as m, i (m ? m.p.id : `free-${i}`)}
      <article class="machine" class:deep={m?.deep} class:busy={!!m}>
        <div class="chamber">
          <div class="tube">
            {#if m?.creature}
              {@const sp = species(m.creature)}
              <span class="specimen"><CreatureSvg appearance={expressedAppearance(game, m.creature)} shape={sp.shape} tier={sp.tier} size={54} shiny={m.creature.shiny} /></span>
              <span class="beam"></span>
            {:else}
              <span class="empty">＋</span>
            {/if}
          </div>
          <div class="base"><span class="led" class:on={!!m}></span><span class="led" class:on={!!m && m.progress > 0.5}></span><span class="led" class:on={!m}></span></div>
        </div>
        <div class="screen">
          {#if m}
            <div class="sline">
              <b>{m.creature?.name ?? '?'}</b>
              <span class="small mode">{m.deep ? 'Tiefensequenzierung' : 'Sequenzierung'}</span>
            </div>
            <DnaHelix progress={m.progress} pairs={18} width={220} height={26} />
            <ol class="scan">
              {#each data.loci as l, j (l.id)}
                {@const st = locusState(j, m.progress, data.loci.length)}
                <li class={st}>{st === 'done' ? '✓' : st === 'scan' ? '▮' : '·'} {l.name}</li>
              {/each}
            </ol>
            <span class="small num muted">{Math.floor(m.progress * 100)} % · noch {formatDuration(m.remaining)} <CrystalSkip process={m.p} /></span>
          {:else}
            <div class="sline"><b>Sequenzierer {i + 1}</b><span class="small mode ready">bereit</span></div>
            <p class="small muted idle">Wähle ein Genom – die Kreatur arbeitet währenddessen weiter.</p>
            <div class="go">
              <button class:primary={picking === 'seq'} onclick={() => openPicker('seq')}>🧬 Genom wählen · {formatDuration(data.time)}</button>
              {#if data.deepOn}<button class="deepbtn" class:on={picking === 'deep'} onclick={() => openPicker('deep')}>🧿 Tiefensequenzierung · {formatDuration(data.deepTime)}</button>{/if}
            </div>
          {/if}
        </div>
      </article>
    {/each}
  </div>

  {#if picking && data.free}
    <article class="panel picker" class:deep={picking === 'deep'}>
      <div class="phead">
        <b>{picking === 'seq' ? 'Welches Genom soll entschlüsselt werden?' : 'Wessen Erbanlage soll aufgedeckt werden?'}</b>
        <button class="close" onclick={() => (picking = null)}>Schließen</button>
      </div>
      {#if picking === 'deep'}
        <p class="small muted">
          Manche Kreaturen tragen eine verborgene <b>Erbanlage</b> – stark, vererbbar, aber erst wirksam, wenn sie aufgedeckt ist.{#if game.state.talents['ancientGenes']} Dabei kann ein schlummerndes Urgen erwachen.{/if}
        </p>
      {/if}
      <div class="tiles">
        {#each candidates as t (t.c.id)}
          {@const sp = species(t.c)}
          <CreatureTile
            creature={t.c}
            info="Gen {t.c.generation} · Σ {Math.round(t.power)}"
            selected={chosen === t.c.id}
            onclick={() => (chosen = chosen === t.c.id ? null : t.c.id)}
          />
        {:else}
          <p class="small muted">{picking === 'seq' ? 'Alle Genome sind entschlüsselt oder werden gerade sequenziert.' : 'Keine Kreatur bereit – erst normal sequenzieren.'}</p>
        {/each}
      </div>
      <div class="confirm">
        <span class="small">{chosen !== null ? `Für ${findCreature(game, chosen)?.name ?? '?'}` : 'Wähle eine Kreatur.'}</span>
        <button class="primary" disabled={!pickCost || !canAfford(game.state, pickCost)} onclick={start}>
          {picking === 'seq' ? 'Sequenzieren' : 'Tief sequenzieren'}{#if pickCost}&nbsp;·&nbsp;<CostLabel cost={pickCost} />{/if}
        </button>
      </div>
    </article>
  {/if}
</section>

<GenomeInspector />

<GeneLibrary />

{#if data.splicing}
  <SplicingBench />
{/if}

<style>
  section { margin-bottom: 1rem; }
  .small { font-size: 0.8rem; margin: 0.2rem 0; }
  h3 { margin: 0; }
  .kpi.live { border-color: var(--teal); box-shadow: 0 0 10px color-mix(in srgb, var(--teal) 20%, transparent); }

  .lab-head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 0.5rem; }
  .robot { display: flex; gap: 0.45rem; align-items: center; padding: 0.3rem 0.6rem; border-radius: 8px; border: 1px solid var(--line); font-size: 0.85rem; }
  .robot.on { border-color: var(--teal); box-shadow: 0 0 10px color-mix(in srgb, var(--teal) 20%, transparent); }

  /* Sequencer machines */
  .machines { display: grid; gap: 0.6rem; grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr)); }
  .machine {
    --glow: var(--teal);
    display: grid; grid-template-columns: 88px 1fr; gap: 0.7rem; padding: 0.6rem; border-radius: var(--radius);
    background: linear-gradient(160deg, #1a3440, #0f2229); border: 1px solid #2c5560; box-shadow: inset 0 1px 0 #ffffff12;
  }
  .machine.deep { --glow: var(--violet); }
  .machine.busy { border-color: color-mix(in srgb, var(--glow) 60%, #2c5560); box-shadow: 0 0 14px color-mix(in srgb, var(--glow) 22%, transparent), inset 0 1px 0 #ffffff12; }
  .chamber { display: grid; grid-template-rows: 1fr auto; gap: 4px; }
  .tube {
    position: relative; overflow: hidden; display: grid; place-items: center; min-height: 110px; border-radius: 40px 40px 10px 10px;
    border: 2px solid #6fa3ab88; background: linear-gradient(90deg, #ffffff10, #ffffff02 40%, #ffffff12), radial-gradient(circle at 50% 70%, color-mix(in srgb, var(--glow) 25%, transparent), #07131788 70%);
  }
  .empty { color: var(--muted); font-size: 1.6rem; }
  .specimen { animation: float 3s ease-in-out infinite; }
  @keyframes float { 50% { transform: translateY(-4px); } }
  .beam { position: absolute; left: 0; right: 0; height: 3px; background: var(--glow); box-shadow: 0 0 10px var(--glow); animation: scan 2.2s ease-in-out infinite; opacity: 0.85; }
  @keyframes scan { 0%, 100% { top: 12%; } 50% { top: 85%; } }
  .base { display: flex; justify-content: center; gap: 6px; padding: 4px; border-radius: 6px; background: #0a1519; border: 1px solid #2c5560; }
  .led { width: 7px; height: 7px; border-radius: 50%; background: #1f4650; }
  .led.on { background: var(--glow); box-shadow: 0 0 6px var(--glow); }
  .screen { display: grid; gap: 0.3rem; align-content: start; padding: 0.45rem 0.55rem; border-radius: 8px; background: #06110f; border: 1px solid #1f4650; font-family: var(--mono); min-width: 0; }
  .screen :global(svg) { max-width: 100%; }
  .sline { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; font-family: system-ui, sans-serif; }
  .mode { color: var(--glow); }
  .mode.ready { color: var(--muted); }
  .scan { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 0.15rem 0.6rem; font-size: 0.7rem; }
  .scan li.done { color: var(--glow); }
  .scan li.scan { color: var(--text); animation: blink 0.8s steps(2) infinite; }
  .scan li.wait { color: #3d6b75; }
  @keyframes blink { 50% { opacity: 0.35; } }
  .idle { font-family: system-ui, sans-serif; }
  .go { display: grid; gap: 0.35rem; font-family: system-ui, sans-serif; }
  .go button { font-size: 0.82rem; padding: 0.4rem 0.6rem; }
  .deepbtn { border-color: color-mix(in srgb, var(--violet) 60%, var(--line)); }
  .deepbtn.on { background: color-mix(in srgb, var(--violet) 25%, var(--panel-2)); }

  .picker { display: grid; gap: 0.45rem; margin-top: 0.6rem; border-color: color-mix(in srgb, var(--teal) 50%, var(--line)); }
  .picker.deep { border-color: color-mix(in srgb, var(--violet) 55%, var(--line)); }
  .phead { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
  .close { font-size: 0.8rem; padding: 0.2rem 0.6rem; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(6.4rem, 1fr)); gap: 0.4rem; max-height: 18rem; overflow-y: auto; padding: 2px; }
  .confirm { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem; }
  .confirm button { min-width: 12rem; }


  @media (max-width: 480px) {
    .machine { grid-template-columns: 70px 1fr; }
  }
</style>

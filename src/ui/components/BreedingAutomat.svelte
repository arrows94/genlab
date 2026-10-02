<script lang="ts">
  import { content } from '@content/index';
  import { setAutoBreed, type AutoBreedPlan } from '@core/features/automation';
  import type { AutoBreedConfig } from '@core/state';
  import { game, act, openTab } from '../store.svelte';

  /** Zuchtautomat settings in the Brutstation: goal, filters, budget and what it does next. */
  let { auto, plan, hybrids, dynasties, knownAlleles, ownedSpecies, recycler, recycleAuto, recycleAutoOn }: {
    auto: AutoBreedConfig;
    plan: AutoBreedPlan | null;
    hybrids: boolean;
    dynasties: boolean;
    knownAlleles: { id: string; label: string }[];
    ownedSpecies: { id: string; name: string }[];
    recycler: boolean;
    recycleAuto: boolean;
    recycleAutoOn: boolean;
  } = $props();

  const BUDGETS = [[1, 'alle Vorräte'], [0.5, '50 %'], [0.25, '25 %'], [0.1, '10 %']] as const;
  const GOAL_HINTS: Record<string, string> = {
    power: 'Die zwei stärksten Kreaturen.',
    hybrid: 'Eltern eines noch unentdeckten Hybrid-Rezepts (höchste Chance zuerst).',
    dex: 'Die günstigsten zwei einer Art, der noch Dex-Einträge fehlen.',
    allele: 'Sequenzierte Träger des Ziel-Allels – reinerbige zuerst.',
    abilities: 'Kreaturen mit den meisten und seltensten Fähigkeiten.',
    lineage: 'Die zwei tiefsten reinen Linien einer Art – so wächst die Dynastie Generation für Generation.',
    cheap: 'Die niedrigsten Generationen – billiger Nachwuchs für Infusion und Recycler.',
  };

  function setAuto(patch: Partial<AutoBreedConfig>) {
    act(setAutoBreed(game, patch));
  }
</script>

<div class="panel auto" class:on={auto.enabled}>
  <div class="auto-row">
    <label class="switch"><input type="checkbox" checked={auto.enabled} onchange={(e) => setAuto({ enabled: e.currentTarget.checked })} /> <b>🤖 Zuchtautomat</b></label>
    <label>Ziel
      <select value={auto.rule} onchange={(e) => setAuto({ rule: e.currentTarget.value })}>
        <optgroup label="Stärke">
          <option value="power">Gesamtstärke</option>
          {#each content.stats.list as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
        </optgroup>
        <optgroup label="Sammeln">
          {#if hybrids}<option value="hybrid">Neue Hybride entdecken</option>{/if}
          <option value="dex">Dex-Lücken füllen</option>
          <option value="abilities">Fähigkeiten</option>
          <option value="allele">Gen-Ziel (Allel)</option>
          {#if dynasties}<option value="lineage">Reine Linie vertiefen</option>{/if}
        </optgroup>
        <optgroup label="Verwertung">
          <option value="cheap">Günstiger Nachwuchs</option>
        </optgroup>
      </select>
    </label>
    {#if auto.rule === 'allele'}
      <label>Allel
        <select value={auto.allele ?? ''} onchange={(e) => setAuto({ allele: e.currentTarget.value || null })}>
          <option value="">– wählen –</option>
          {#each knownAlleles as al (al.id)}<option value={al.id}>{al.label}</option>{/each}
        </select>
      </label>
    {/if}
    {#if auto.rule !== 'hybrid'}
      <label>Art
        <select value={auto.species ?? ''} onchange={(e) => setAuto({ species: e.currentTarget.value || null })}>
          <option value="">beliebig</option>
          {#each ownedSpecies as s (s.id)}<option value={s.id}>{s.name}</option>{/each}
        </select>
      </label>
    {/if}
  </div>
  <div class="auto-row">
    <label title="Ein Ei darf höchstens diesen Anteil jeder Ressource kosten.">Budget pro Ei
      <select value={String(auto.budget)} onchange={(e) => setAuto({ budget: Number(e.currentTarget.value) })}>
        {#each BUDGETS as [v, label] (v)}<option value={String(v)}>{label}</option>{/each}
      </select>
    </label>
  </div>
  <p class="auto-status small">
    <span class="muted">{GOAL_HINTS[auto.rule] ?? `Die zwei mit dem höchsten Wert in ${content.stats.get(auto.rule).name}.`}</span>
    {#if plan}
      {#if plan.ok}<span class="next">Nächstes Paar: <b>{plan.a.name}</b> × <b>{plan.b.name}</b></span>
      {:else}<span class="wait">Wartet: {plan.reason}</span>{/if}
    {/if}
  </p>
  <p class="auto-status small">
    <span class="muted">
      Ist der Stall voll, wartet der Zuchtautomat.
      {#if recycleAuto}Platz schafft der Recycling-Automat mit seiner Zerlege-Kammer{recycleAutoOn ? '' : ' (gerade ausgeschaltet)'}.{:else if recycler}Platz schaffst du im Labor oder im Gen-Recycler – der Recycling-Automat kann das später übernehmen.{:else}Platz schaffst du im Labor (verkaufen).{/if}
    </span>
    {#if recycler}<button class="to-recycler" onclick={() => openTab('recycler')}>♻️ Zum Gen-Recycler</button>{/if}
  </p>
</div>

<style>
  .small { font-size: 0.8rem; }
  .to-recycler { align-self: flex-start; font-size: 0.78rem; padding: 0.2rem 0.6rem; }
  .auto { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem; padding: 0.6rem 0.8rem; font-size: 0.9rem; }
  .auto-row { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }
  .auto-status { margin: 0; display: flex; gap: 0.3rem 0.75rem; flex-wrap: wrap; }
  .auto-status .next { color: var(--teal); }
  .auto-status .wait { color: var(--gold); }
  .auto.on { border-color: var(--teal); box-shadow: 0 0 12px color-mix(in srgb, var(--teal) 20%, transparent); }
</style>

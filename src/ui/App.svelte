<script lang="ts">
  import type { Component } from 'svelte';
  import { affordableUpgradeCount, unlockedTabs } from '@core/queries';
  import { game, view, start, openTab } from './store.svelte';
  import ResourceBar from './components/ResourceBar.svelte';
  import Toasts from './components/Toasts.svelte';
  import OfflineModal from './components/OfflineModal.svelte';
  import DnaHelix from './components/DnaHelix.svelte';
  import LabTab from './components/LabTab.svelte';
  import FacilitiesTab from './components/FacilitiesTab.svelte';
  import ResearchTab from './components/ResearchTab.svelte';
  import DexTab from './components/DexTab.svelte';
  import StatsTab from './components/StatsTab.svelte';
  import PrestigeTab from './components/PrestigeTab.svelte';
  import SettingsTab from './components/SettingsTab.svelte';
  import BreedingTab from './components/BreedingTab.svelte';
  import ExpeditionTab from './components/ExpeditionTab.svelte';
  import MarketTab from './components/MarketTab.svelte';
  import GeneticsTab from './components/GeneticsTab.svelte';
  import RecyclerTab from './components/RecyclerTab.svelte';
  import CreatureDetail from './components/CreatureDetail.svelte';
  import TowerTab from './components/TowerTab.svelte';
  import AeonTab from './components/AeonTab.svelte';
  import AnomaliesTab from './components/AnomaliesTab.svelte';
  import WeeklyBanner from './components/WeeklyBanner.svelte';

  /** Tab id (from FeatureDef.tab) → label + component. New systems register here. */
  const TABS: Record<string, { label: string; icon: string; component: Component }> = {
    lab: { label: 'Labor', icon: '🧬', component: LabTab },
    facilities: { label: 'Anlagen', icon: '🏭', component: FacilitiesTab },
    breeding: { label: 'Brutstation', icon: '🥚', component: BreedingTab },
    expedition: { label: 'Erkundung', icon: '🧭', component: ExpeditionTab },
    genetics: { label: 'Genlabor', icon: '🔬', component: GeneticsTab },
    research: { label: 'Forschung', icon: '📜', component: ResearchTab },
    market: { label: 'Markt', icon: '⚗️', component: MarketTab },
    recycler: { label: 'Recycler', icon: '♻️', component: RecyclerTab },
    tower: { label: 'Turm', icon: '🗼', component: TowerTab },
    anomalies: { label: 'Anomalien', icon: '🌀', component: AnomaliesTab },
    aeon: { label: 'Äon', icon: '⏳', component: AeonTab },
    dex: { label: 'Dex', icon: '📖', component: DexTab },
    stats: { label: 'Statistik', icon: '📊', component: StatsTab },
    prestige: { label: 'Vererbung', icon: '♾️', component: PrestigeTab },
    settings: { label: 'Optionen', icon: '⚙️', component: SettingsTab },
  };

  const tabs = $derived.by(() => {
    view.frame;
    return [...unlockedTabs(game).filter((t) => TABS[t]), 'settings'];
  });
  const badges = $derived.by((): Record<string, number> => {
    view.frame;
    return { ...view.unseen, research: affordableUpgradeCount(game) };
  });
  const Current = $derived(TABS[tabs.includes(view.tab) ? view.tab : 'lab']!.component);

  start();
</script>

<div class="app">
  <header>
    <div class="brand">
      <DnaHelix pairs={8} width={70} height={28} />
      <h1>Genlab</h1>
    </div>
    <ResourceBar />
  </header>

  <WeeklyBanner />

  <nav>
    {#each tabs as t (t)}
      <button class:active={view.tab === t} onclick={() => openTab(t)}>
        <span class="icon">{TABS[t]!.icon}</span>
        <span class="label">{TABS[t]!.label}</span>
        {#if badges[t]}<span class="badge num">{badges[t]}</span>{/if}
      </button>
    {/each}
  </nav>

  <main>
    <Current />
  </main>
</div>

<CreatureDetail />
<Toasts />
<OfflineModal />

<style>
  .app { max-width: 1100px; margin: 0 auto; padding: 0.75rem 1rem 6rem; }
  header { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
  .brand { display: flex; align-items: center; gap: 0.5rem; }
  h1 {
    margin: 0; font-size: 1.5rem; letter-spacing: 0.08em;
    background: linear-gradient(90deg, var(--teal), var(--violet)); -webkit-background-clip: text; background-clip: text; color: transparent;
  }
  nav { display: flex; gap: 0.4rem; margin-bottom: 1rem; flex-wrap: wrap; }
  nav button { position: relative; display: flex; gap: 0.35rem; align-items: center; }
  nav button.active { border-color: var(--teal); background: color-mix(in srgb, var(--petrol) 45%, var(--panel-2)); }
  .badge {
    position: absolute; top: -6px; right: -6px; min-width: 1.2rem; height: 1.2rem; padding: 0 0.3rem;
    border-radius: 999px; background: var(--violet); font-size: 0.7rem; display: grid; place-items: center;
  }

  /* Portrait phones: bottom tab bar */
  @media (max-width: 640px) {
    .app { padding: 0.5rem 0.6rem 5.5rem; }
    nav {
      position: fixed; z-index: 10; left: 0; right: 0; bottom: 0; margin: 0;
      padding: 0.4rem 0.4rem calc(0.4rem + env(safe-area-inset-bottom));
      background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(8px);
      border-top: 1px solid var(--line); flex-wrap: nowrap; overflow-x: auto;
    }
    nav button { flex: 1 0 auto; flex-direction: column; gap: 0.1rem; padding: 0.35rem 0.5rem; font-size: 0.7rem; }
    nav .icon { font-size: 1.2rem; }
  }
</style>

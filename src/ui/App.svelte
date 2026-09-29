<script lang="ts">
  import type { Component } from 'svelte';
  import { affordableUpgradeCount, unlockedTabs } from '@core/queries';
  import { fulfillableCount } from '@core/features/contracts';
  import { dailyAvailable } from '@core/features/daily';
  import { game, view, init, openTab } from './store.svelte';
  import { loadPrefs } from './prefs.svelte';
  import ResourceBar from './components/ResourceBar.svelte';
  import ConfirmDialog from './components/ConfirmDialog.svelte';
  import Toasts from './components/Toasts.svelte';
  import NotificationBell from './components/NotificationBell.svelte';
  import NotificationCenter from './components/NotificationCenter.svelte';
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
  import ContractsTab from './components/ContractsTab.svelte';
  import RecyclerTab from './components/RecyclerTab.svelte';
  import CreatureDetail from './components/CreatureDetail.svelte';
  import TowerTab from './components/TowerTab.svelte';
  import AeonTab from './components/AeonTab.svelte';
  import AnomaliesTab from './components/AnomaliesTab.svelte';
  import WeeklyBanner from './components/WeeklyBanner.svelte';
  import UpdateBanner from './components/UpdateBanner.svelte';
  import WhatsNew from './components/WhatsNew.svelte';

  /** Tab id (from FeatureDef.tab) → label + component. New systems register here. */
  const TABS: Record<string, { label: string; icon: string; component: Component }> = {
    lab: { label: 'Labor', icon: '🧬', component: LabTab },
    facilities: { label: 'Anlagen', icon: '🏭', component: FacilitiesTab },
    breeding: { label: 'Brutstation', icon: '🥚', component: BreedingTab },
    expedition: { label: 'Erkundung', icon: '🧭', component: ExpeditionTab },
    genetics: { label: 'Genlabor', icon: '🔬', component: GeneticsTab },
    contracts: { label: 'Aufträge', icon: '📋', component: ContractsTab },
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
    // A voyage waiting for its decision counts as news in the expedition tab.
    const voyage = game.state.voyage.pending ? 1 : 0;
    return { ...view.unseen, research: affordableUpgradeCount(game), contracts: fulfillableCount(game), expedition: (view.unseen.expedition ?? 0) + voyage, lab: (view.unseen.lab ?? 0) + (dailyAvailable(game, Date.now()) ? 1 : 0), tower: (view.unseen.tower ?? 0) + (game.state.features['weeklyBoss'] && game.state.tower.team.length > 0 && game.state.weeklyBoss.damage < game.state.weeklyBoss.maxHp ? game.state.weeklyBoss.attempts : 0) };
  });
  const Current = $derived(TABS[tabs.includes(view.tab) ? view.tab : 'lab']!.component);

  loadPrefs();
  void init();

  // Keep the active tab visible in the scrollable bottom bar on phones.
  let navEl: HTMLElement | undefined = $state();
  /** Header shadow once the page is scrolled under it. */
  let stuck = $state(false);
  /** Header height as a CSS variable, so other sticky bars sit below it. */
  let headerH = $state(0);
  $effect(() => document.documentElement.style.setProperty('--header-h', `${headerH}px`));
  $effect(() => {
    view.tab;
    navEl?.querySelector('button.active')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  });
</script>

{#if !view.ready}
  <div class="splash">
    <DnaHelix pairs={14} width={200} height={44} />
    <p>Genlab lädt …</p>
  </div>
{:else}
<div class="app">
  <header class:stuck bind:offsetHeight={headerH}>
    <div class="brand">
      <DnaHelix pairs={8} width={70} height={28} />
      <h1>Genlab</h1>
      <NotificationBell />
    </div>
    <ResourceBar />
  </header>

  <WeeklyBanner />

  <nav bind:this={navEl}>
    {#each tabs as t (t)}
      <button class:active={view.tab === t} onclick={() => openTab(t)}>
        <span class="icon">{TABS[t]!.icon}</span>
        <span class="label">{TABS[t]!.label}</span>
        {#if badges[t]}<span class="badge num">{badges[t]}</span>{/if}
      </button>
    {/each}
  </nav>

  <main>
    {#key view.tab}
      <div class="page"><Current /></div>
    {/key}
  </main>
</div>

<CreatureDetail />
<OfflineModal />
<WhatsNew />
{#if view.applyUpdate}<UpdateBanner />{/if}
{/if}
<Toasts />
<NotificationCenter />
<ConfirmDialog />
<svelte:window onscroll={() => (stuck = window.scrollY > 4)} />

<style>
  .splash { min-height: 100vh; display: grid; place-content: center; justify-items: center; gap: 0.5rem; color: var(--muted); }
  .app { max-width: 1100px; margin: 0 auto; padding: 0.75rem 1rem 6rem; }
  /* Sticky: the resources stay in view while the page scrolls. */
  header {
    position: sticky; z-index: 12; top: 0;
    display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; justify-content: space-between;
    margin: -0.75rem -1rem 0.75rem; padding: calc(0.6rem + env(safe-area-inset-top)) 1rem 0.6rem;
  }
  /* Full-width backdrop behind the (max-width) header content. Opaque without backdrop-filter: in the
     installed iOS web app the header reaches under the status bar, and the blur made the top look smeared. */
  header::before {
    content: ''; position: absolute; z-index: -1; top: 0; bottom: 0; left: 50%; width: 100vw; translate: -50% 0;
    background: var(--bg);
    border-bottom: 1px solid transparent; transition: border-color 0.2s, box-shadow 0.2s;
  }
  header.stuck::before { border-bottom-color: var(--line); box-shadow: 0 6px 16px #0006; }
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

  .page { animation: fade-in 0.2s ease-out; }

  /* Portrait phones: bottom tab bar */
  @media (max-width: 640px) {
    .app { padding: 0.5rem 0.6rem 5.5rem; }
    header { gap: 0.4rem; margin: -0.5rem -0.6rem 0.5rem; padding: calc(0.4rem + env(safe-area-inset-top)) 0.6rem 0.4rem; }
    .brand { width: 100%; }
    .brand :global(svg) { display: none; }
    .brand :global(.bell) { margin-left: auto; }
    h1 { font-size: 1.2rem; }
    nav {
      position: fixed; z-index: 10; left: 0; right: 0; bottom: 0; margin: 0;
      padding: 0.4rem 0.4rem calc(0.4rem + env(safe-area-inset-bottom));
      background: color-mix(in srgb, var(--bg) 92%, transparent); backdrop-filter: blur(8px);
      border-top: 1px solid var(--line); flex-wrap: nowrap; overflow-x: auto;
    }
    nav button { flex: 1 0 auto; flex-direction: column; gap: 0.1rem; padding: 0.35rem 0.5rem; font-size: 0.7rem; min-width: 4.2rem; }
    nav { scrollbar-width: none; }
    nav::-webkit-scrollbar { display: none; }
    nav .icon { font-size: 1.2rem; }
  }
</style>

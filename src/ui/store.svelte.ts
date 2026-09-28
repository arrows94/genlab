import { content, balance } from '@content/index';
import { Game, type OfflineReport } from '@core/game';
import { deserialize, exportSave, importSave, serialize, type SaveStorage } from '@core/save';
import type { ActionResult } from '@core/actions';
import { formatNumber } from '@core/format';
import { createStorage } from './platform/storage';
import { registerPwa } from './platform/pwa';
import { setupNative } from './platform/native';

/**
 * Bridge between the core and Svelte. Holds the single Game instance, runs
 * the real-time loop, autosaves and exposes a reactive `view.frame` counter
 * that components read to re-derive their data from the (plain) game state.
 */
export interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'unlock' | 'rare' | 'error';
}

const storage: SaveStorage = createStorage();

export const view = $state({
  frame: 0,
  /** Slower counter (4×/s) for live number displays, so they don't flicker. */
  slowFrame: 0,
  tab: 'lab',
  toasts: [] as Toast[],
  offline: null as OfflineReport | null,
  /** Unseen results per tab (badge), cleared when the tab is opened. */
  unseen: {} as Record<string, number>,
  /** Suppresses per-creature dex toasts while a capsule result screen shows them anyway. */
  muteDex: false,
  /** Set when a new app version is downloaded (PWA); calling it reloads into the update. */
  applyUpdate: null as (() => void) | null,
  /** False until the stored save has been loaded (async on native platforms). */
  ready: false,
  /** Wall clock of the last successful save. */
  lastSaved: 0,
  /** Creature shown in the detail view. */
  detail: null as number | null,
  loadError: null as string | null,
  /** Recent expedition returns (newest first) for the expedition log. */
  /** Recently hatched creature ids (newest first) for the nest row. */
  hatchlings: [] as { id: number; key: number }[],
  returns: [] as { id: number; missionId: string; creatureId: number; rewards: [string, string][]; wildSpecies: string | null }[],
});

let listId = 0;

let toastId = 0;
export function toast(text: string, kind: Toast['kind'] = 'info', ms = 3500): void {
  const t = { id: ++toastId, text, kind };
  view.toasts = [...view.toasts.slice(-4), t];
  setTimeout(() => (view.toasts = view.toasts.filter((x) => x.id !== t.id)), ms);
}

/** The single game instance. Starts fresh; `init()` swaps in the stored save. */
export const game = new Game({ content, balance });

async function loadSave(): Promise<void> {
  let raw: string | null = null;
  try {
    raw = await storage.load();
  } catch (err) {
    view.loadError = (err as Error).message;
  }
  if (!raw) return;
  try {
    game.loadState(deserialize(raw).state);
  } catch (err) {
    view.loadError = (err as Error).message;
    // Keep the broken save around so it can be exported / inspected.
    try {
      localStorage.setItem('genlab.save.broken', raw);
    } catch {
      /* ignore */
    }
  }
}

function wireEvents(g: Game): void {
  g.bus.on('featureUnlocked', (e) => {
    if (!e.silent) toast(`🔓 ${content.features.get(e.feature).hint}`, 'unlock', 5000);
  });
  g.bus.on('achievementUnlocked', (e) => toast(`🏆 ${content.achievements.get(e.achievement).name}`, 'rare'));
  g.bus.on('dexDiscovered', (e) => {
    if (g.state.creatures.length > 1 && !view.muteDex)
      toast(`📖 Neu im Dex: ${content.species.get(e.species).name} (${content.rarities.get(e.rarity).name})`, 'info');
  });
  g.bus.on('prestige', () => toast('🧬 Vererbung abgeschlossen!', 'rare'));
  const markUnseen = (tab: string) => {
    if (view.tab !== tab) view.unseen = { ...view.unseen, [tab]: (view.unseen[tab] ?? 0) + 1 };
  };
  g.bus.on('eggHatched', (e) => {
    const c = g.state.creatures.find((x) => x.id === e.creatureId);
    if (c) {
      const rarity = content.rarities.get(c.rarity);
      const species = content.species.get(c.speciesId);
      const hybrid = species.tier !== 'base';
      toast(`${hybrid ? '🧪 Hybrid' : '🐣 Geschlüpft'}: ${c.name} (${species.name}, ${rarity.name})`, rarity.order >= 3 || hybrid ? 'rare' : 'info', hybrid ? 6000 : 3500);
    }
    view.hatchlings = [{ id: e.creatureId, key: ++listId }, ...view.hatchlings].slice(0, 4);
    markUnseen('breeding');
  });
  g.bus.on('sequenced', (e) => {
    const c = g.state.creatures.find((x) => x.id === e.creatureId);
    toast(`🧬 Genom entschlüsselt: ${c?.name ?? '?'}`, 'info');
    markUnseen('genetics');
  });
  const amounts = (v: Record<string, { toString(): string }>) =>
    Object.entries(v).map(([r, a]) => `+${formatNumber(a.toString())} ${content.resources.get(r).icon}`).join(' ');
  g.bus.on('sold', (e) => toast(`💰 ${e.count} verkauft: ${amounts(e.value)}`));
  g.bus.on('recycled', (e) => toast(`♻️ ${e.count} recycelt: +${formatNumber(e.fragments)} 🧩`));
  g.bus.on('stableFull', (e) => toast(`🏠 Stall voll – wilde Kreatur freigelassen (${amounts(e.value)})`, 'error'));
  g.bus.on('infused', (e) => {
    const parts = [`🔮 Infusion: +${formatNumber(e.ep)} EP`];
    if (e.levelsGained > 0) parts.push(`Stufe +${e.levelsGained}`);
    for (const t of e.transferred) parts.push(`Allel ${content.genes.get(t.locus).alleles.find((a) => a.id === t.allele)?.name} übertragen!`);
    toast(parts.join(' · '), e.transferred.length > 0 ? 'rare' : 'info');
  });
  g.bus.on('breakthrough', (e) => toast(`💥 Durchbruch! Neue Seltenheit: ${content.rarities.get(e.rarity).name}`, 'rare', 6000));
  g.bus.on('towerFloor', (e) => {
    if (e.allele) {
      const locus = content.genes.get(e.allele.locus);
      toast(`🗼 Etage ${e.floor}: seltenes Allel ${locus.alleles.find((a) => a.id === e.allele!.allele)?.name} (${locus.name}) für die Genbibliothek!`, 'rare', 6000);
    } else if (e.win && e.floor % 10 === 0) toast(`🗼 Etage ${e.floor} bezwungen! ${amounts(e.rewards)}`, 'rare');
  });
  g.bus.on('towerRunEnded', (e) => toast(`🗼 Turm-Lauf beendet auf Etage ${e.floor}.`, 'info'));
  g.bus.on('talentBought', (e) => toast(`⏳ Talent gelernt: ${content.talents.get(e.talent).name}`, 'rare'));
  g.bus.on('anomalyStarted', (e) => toast(`🌀 Anomalie „${content.anomalies.get(e.anomaly).name}“ beginnt!`, 'unlock'));
  g.bus.on('anomalyCompleted', (e) => toast(`🌀 Anomalie gemeistert: ${content.anomalies.get(e.anomaly).rewardText}`, 'rare', 7000));
  g.bus.on('perfectGenome', (e) => toast(`✦ Perfektes Genom: ${content.species.get(e.species).name}!`, 'rare', 7000));
  g.bus.on('shiny', (e) => toast(`🌈 Schillernd! Eine seltene Farbmutation: ${content.species.get(e.species).name}`, 'rare', 7000));
  g.bus.on('recipeHinted', (e) => {
    toast(`📜 Hinweis auf eine Kreuzung: „${content.recipes.get(e.recipe).hint}“`, 'unlock', 6000);
    markUnseen('dex');
  });
  g.bus.on('evolved', (e) => toast(`✨ Evolution: ${content.species.get(e.from).name} → ${content.species.get(e.to).name}`, 'rare', 6000));
  g.bus.on('alleleCatalogued', (e) => {
    const locus = content.genes.get(e.locus);
    const allele = locus.alleles.find((a) => a.id === e.allele);
    if (allele && allele.weight <= 5) toast(`📚 Seltenes Allel katalogisiert: ${allele.name} (${locus.name})`, 'rare');
  });
  g.bus.on('spliced', (e) =>
    toast(
      e.success ? `✂️ Splicing erfolgreich (${content.genes.get(e.locus).name})` : `⚠️ Instabil! ${e.scrambledLocus ? content.genes.get(e.scrambledLocus).name : 'Ein Gen'} ist mutiert.`,
      e.success ? 'rare' : 'error',
    ),
  );
  g.bus.on('missionCompleted', (e) => {
    const loot = Object.entries(e.rewards).map(([r, v]) => `+${formatNumber(v)} ${content.resources.get(r).icon}`).join(' ');
    const wild = e.wildCreatureId !== null ? g.state.creatures.find((x) => x.id === e.wildCreatureId) : null;
    view.returns = [
      { id: ++listId, missionId: e.missionId, creatureId: e.creatureId, rewards: Object.entries(e.rewards).map(([r, v]): [string, string] => [r, formatNumber(v)]), wildSpecies: wild?.speciesId ?? null },
      ...view.returns,
    ].slice(0, 6);
    toast(`🧭 ${content.missions.get(e.missionId).name}: ${loot}${wild ? ` · wild: ${content.species.get(wild.speciesId).name}!` : ''}`, wild ? 'rare' : 'info');
    markUnseen('expedition');
  });
}
wireEvents(game);

export function openTab(tab: string): void {
  view.tab = tab;
  if (view.unseen[tab]) view.unseen = { ...view.unseen, [tab]: 0 };
}

export function refresh(): void {
  view.frame++;
  view.slowFrame++;
}

/** Runs an action and reports failures as a toast. */
export function act(result: ActionResult): boolean {
  if (!result.ok) toast(result.reason, 'error');
  refresh();
  return result.ok;
}

export function save(): void {
  // Never overwrite the stored save with the placeholder state before loading finished.
  if (!view.ready) return;
  storage.save(serialize(game.state)).then(
    () => (view.lastSaved = Date.now()),
    (err: Error) => toast(`Speichern fehlgeschlagen: ${err.message}`, 'error'),
  );
}

export function exportText(): string {
  return exportSave(game.state);
}

export function importText(text: string): boolean {
  try {
    const { state } = importSave(text);
    game.loadState(state);
    save();
    toast('Spielstand importiert.', 'info');
    refresh();
    return true;
  } catch (err) {
    toast((err as Error).message, 'error', 6000);
    return false;
  }
}

export function hardReset(): void {
  void storage.clear();
  const fresh = new Game({ content, balance });
  game.setState(fresh.state);
  save();
  refresh();
}

let started = false;
/** Loads the save (async on native platforms), then starts the game loop. */
export async function init(): Promise<void> {
  if (started) return;
  started = true;
  await loadSave();
  view.ready = true;
  refresh();
  startLoop();
  void registerPwa((apply) => (view.applyUpdate = apply)).catch(() => {
    /* offline cache is optional */
  });
  void setupNative({
    save,
    resume: () => {
      const r = game.update(Date.now());
      if (r && r.simulatedMs / 1000 >= balance.offline.summaryMinSec) view.offline = r;
      refresh();
    },
    // Close the topmost dialog; false = nothing open (app gets minimised).
    back: () => {
      if (view.detail !== null) view.detail = null;
      else if (view.offline) view.offline = null;
      else if (view.tab !== 'lab') view.tab = 'lab';
      else return false;
      return true;
    },
  });
}

function startLoop(): void {
  const report = game.update(Date.now());
  if (report && report.simulatedMs / 1000 >= balance.offline.summaryMinSec) view.offline = report;

  let lastRender = 0;
  let lastSlow = 0;
  const loop = (t: number) => {
    const r = game.update(Date.now());
    if (r && r.simulatedMs / 1000 >= balance.offline.summaryMinSec) view.offline = r;
    if (t - lastRender >= 100) {
      lastRender = t;
      view.frame++;
    }
    if (t - lastSlow >= 250) {
      lastSlow = t;
      view.slowFrame++;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // Background tabs throttle rAF; a slow interval keeps the sim alive.
  setInterval(() => game.update(Date.now()), 1000);
  setInterval(save, balance.sim.autosaveSec * 1000);
  // Mobile apps are suspended without `beforeunload`; hiding is the reliable moment to save.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
    else game.update(Date.now());
  });
  window.addEventListener('beforeunload', save);
}

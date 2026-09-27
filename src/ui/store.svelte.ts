import { content, balance } from '@content/index';
import { Game, type OfflineReport } from '@core/game';
import { deserialize, exportSave, importSave, serialize, type SaveStorage } from '@core/save';
import type { ActionResult } from '@core/actions';
import { formatNumber } from '@core/format';
import { LocalSaveStorage } from './platform/storage';

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

const storage: SaveStorage = new LocalSaveStorage();

export const view = $state({
  frame: 0,
  tab: 'lab',
  toasts: [] as Toast[],
  offline: null as OfflineReport | null,
  /** Unseen results per tab (badge), cleared when the tab is opened. */
  unseen: {} as Record<string, number>,
  loadError: null as string | null,
});

let toastId = 0;
export function toast(text: string, kind: Toast['kind'] = 'info', ms = 3500): void {
  const t = { id: ++toastId, text, kind };
  view.toasts = [...view.toasts.slice(-4), t];
  setTimeout(() => (view.toasts = view.toasts.filter((x) => x.id !== t.id)), ms);
}

function loadGame(): Game {
  const raw = storage.load();
  if (raw) {
    try {
      const { state } = deserialize(raw);
      return new Game({ content, balance, state });
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
  return new Game({ content, balance });
}

export const game = loadGame();

function wireEvents(g: Game): void {
  g.bus.on('featureUnlocked', (e) => {
    if (!e.silent) toast(`🔓 ${content.features.get(e.feature).hint}`, 'unlock', 5000);
  });
  g.bus.on('achievementUnlocked', (e) => toast(`🏆 ${content.achievements.get(e.achievement).name}`, 'rare'));
  g.bus.on('dexDiscovered', (e) => {
    if (g.state.creatures.length > 1)
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
      toast(`🐣 Geschlüpft: ${content.species.get(c.speciesId).name} (${rarity.name})`, rarity.order >= 3 ? 'rare' : 'info');
    }
    markUnseen('breeding');
  });
  g.bus.on('sequenced', (e) => {
    const c = g.state.creatures.find((x) => x.id === e.creatureId);
    toast(`🧬 Genom entschlüsselt: ${c?.name ?? '?'}`, 'info');
    markUnseen('genetics');
  });
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
}

/** Runs an action and reports failures as a toast. */
export function act(result: ActionResult): boolean {
  if (!result.ok) toast(result.reason, 'error');
  refresh();
  return result.ok;
}

export function save(): void {
  try {
    storage.save(serialize(game.state));
  } catch (err) {
    toast(`Speichern fehlgeschlagen: ${(err as Error).message}`, 'error');
  }
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
  storage.clear();
  const fresh = new Game({ content, balance });
  game.setState(fresh.state);
  save();
  refresh();
}

let started = false;
export function start(): void {
  if (started) return;
  started = true;

  const report = game.update(Date.now());
  if (report && report.simulatedMs / 1000 >= balance.offline.summaryMinSec) view.offline = report;

  let lastRender = 0;
  const loop = (t: number) => {
    const r = game.update(Date.now());
    if (r && r.simulatedMs / 1000 >= balance.offline.summaryMinSec) view.offline = r;
    if (t - lastRender >= 100) {
      lastRender = t;
      refresh();
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // Background tabs throttle rAF; a slow interval keeps the sim alive.
  setInterval(() => game.update(Date.now()), 1000);
  setInterval(save, balance.sim.autosaveSec * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') save();
  });
  window.addEventListener('beforeunload', save);
}

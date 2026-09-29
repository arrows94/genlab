import { content, balance } from '@content/index';
import { Game, type OfflineReport } from '@core/game';
import type { GameState } from '@core/state';
import { deserialize, exportSave, importSave, serialize, type SaveStorage } from '@core/save';
import type { ActionResult } from '@core/actions';
import { formatNumber } from '@core/format';
import { plannedNotices } from '@core/notices';
import { createStorage } from './platform/storage';
import { registerPwa } from './platform/pwa';
import { closeNews, initNews, news } from './news.svelte';
import { setupNative } from './platform/native';
import { cancelNotices, scheduleNotices } from './platform/notify';
import { prefs } from './prefs.svelte';
import { inbox, loadInbox, record, saveInbox, type NoticeKind } from './inbox.svelte';
import { initSync, notePlay, resolveConflict, sync, syncOnHide, syncOnShow, unlinkLocal } from './sync.svelte';
import { silently } from './sound';

/**
 * Bridge between the core and Svelte. Holds the single Game instance, runs
 * the real-time loop, autosaves and exposes a reactive `view.frame` counter
 * that components read to re-derive their data from the (plain) game state.
 */
export interface Toast {
  id: number;
  text: string;
  kind: NoticeKind;
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
  /** Open in-game confirmation (replaces window.confirm, which browsers can block). */
  confirm: null as { text: string; ok: string; danger: boolean; resolve: (yes: boolean) => void } | null,
  /** Big full-screen moments waiting to be shown, oldest first (optimal DNA, first shiny creature). */
  celebrations: [] as { key: number; kind: 'perfect' | 'shiny'; creatureId: number; species: string }[],
  returns: [] as { id: number; missionId: string; creatureId: number; rewards: [string, string][]; wildSpecies: string | null }[],
});

let listId = 0;

let toastId = 0;
/**
 * Shows a short message. It is also kept in the notification center unless
 * `log` is false (instant feedback to a click, e.g. "not enough resources").
 */
export function toast(text: string, kind: Toast['kind'] = 'info', ms = 3500, log = true): void {
  if (log) record(text, kind);
  const t = { id: ++toastId, text, kind };
  view.toasts = [...view.toasts.slice(-4), t];
  setTimeout(() => (view.toasts = view.toasts.filter((x) => x.id !== t.id)), ms);
}

/** The single game instance. Starts fresh; `init()` swaps in the stored save. */
export const game = new Game({ content, balance });

/** Loads the stored save; true if there was one. */
async function loadSave(): Promise<boolean> {
  let raw: string | null = null;
  try {
    raw = await storage.load();
  } catch (err) {
    view.loadError = (err as Error).message;
  }
  if (!raw) return false;
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
  return true;
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
  g.bus.on('sold', (e) => !e.auto && toast(`💰 ${e.count} verkauft: ${amounts(e.value)}`));
  g.bus.on('recycled', (e) => !e.auto && toast(`♻️ ${e.count} recycelt: +${formatNumber(e.fragments)} 🧩`));
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
  g.bus.on('resonanceBought', (e) => toast(`〰️ ${content.resonances.get(e.resonance).name} auf Stufe ${e.level}`, 'info'));
  g.bus.on('megaProjectStage', (e) => {
    const def = content.megaProjects.get(e.project);
    const done = e.stage >= def.stages.length;
    toast(`${def.icon} ${def.name}: ${done ? 'vollendet!' : `„${def.stages[e.stage - 1]!.name}“ fertig gebaut`}`, 'rare', 7000);
    markUnseen('aeon');
  });
  g.bus.on('anomalyStarted', (e) => toast(`🌀 Anomalie „${content.anomalies.get(e.anomaly).name}“ beginnt!`, 'unlock'));
  g.bus.on('anomalyCompleted', (e) => toast(`🌀 ${content.anomalies.get(e.anomaly).name} Stufe ${e.level} gemeistert: ${content.anomalies.get(e.anomaly).rewardText}`, 'rare', 7000));
  g.bus.on('anomalyRecord', (e) => toast(`🏆 Neuer Anomalie-Rekord: Schwierigkeit ${e.total}${e.shards > 0 && g.state.features.aeon ? ` · +${e.shards} ⏳` : ''}`, 'rare', 7000));
  g.bus.on('dynastyTier', (e) => {
    if (g.state.features['dynasties']) toast(`👑 Dynastie ${content.species.get(e.species).name}: Stufe ${e.tier} (reine Linie ${e.depth})${e.shards > 0 && g.state.features.aeon ? ` · +${e.shards} ⏳` : ''}`, 'rare', 7000);
  });
  // Big moments get a full-screen celebration (and stay in the notification center).
  g.bus.on('perfectGenome', (e) => {
    record(`✦ Optimale DNS: perfektes Genom für ${content.species.get(e.species).name}!`, 'rare');
    view.celebrations = [...view.celebrations, { key: ++listId, kind: 'perfect', creatureId: e.creatureId, species: e.species }];
  });
  g.bus.on('shiny', (e) => {
    record(`🌈 Schillernd! Eine seltene Farbmutation: ${content.species.get(e.species).name}`, 'rare');
    view.celebrations = [...view.celebrations, { key: ++listId, kind: 'shiny', creatureId: e.creatureId, species: e.species }];
  });
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
/**
 * Asks for confirmation with an in-game dialog. `window.confirm` is not used:
 * once a player tells the browser to suppress dialogs it silently returns
 * false, which made selling/infusing impossible.
 */
export function ask(text: string, opts: { ok?: string; danger?: boolean } = {}): Promise<boolean> {
  view.confirm?.resolve(false);
  return new Promise((resolve) => {
    view.confirm = { text, ok: opts.ok ?? 'OK', danger: opts.danger ?? false, resolve };
  });
}

export function answer(yes: boolean): void {
  const open = view.confirm;
  view.confirm = null;
  open?.resolve(yes);
}

export function act(result: ActionResult): boolean {
  if (!result.ok) toast(result.reason, 'error', 3500, false);
  else notePlay();
  refresh();
  return result.ok;
}

export function save(): void {
  // Never overwrite the stored save with the placeholder state before loading finished.
  if (!view.ready) return;
  saveInbox();
  notePlay();
  storage.save(serialize(game.state)).then(
    () => (view.lastSaved = Date.now()),
    (err: Error) => toast(`Speichern fehlgeschlagen: ${err.message}`, 'error'),
  );
}

export function exportText(): Promise<string> {
  return exportSave(game.state);
}

/** Reads an export without loading it (for the comparison before an import); null after a toast if it is invalid. */
export async function readImport(text: string): Promise<{ state: GameState; savedAt: number } | null> {
  try {
    return await importSave(text);
  } catch (err) {
    toast((err as Error).message, 'error', 6000);
    return null;
  }
}

export function applyImport(state: GameState): void {
  game.loadState(state);
  save();
  toast('Spielstand importiert.', 'info');
  refresh();
}

export function hardReset(): void {
  // A fresh game must never be uploaded over the cloud save of the other devices.
  unlinkLocal();
  void storage.clear();
  const fresh = new Game({ content, balance });
  game.setState(fresh.state);
  save();
  refresh();
}

/** Going to the background: save, upload to the other devices and plan reminders for the time away. */
function toBackground(): void {
  save();
  syncOnHide();
  if (prefs.notifications) scheduleNotices(plannedNotices(game, Date.now()));
}

/** Back in the foreground: the reminders are no longer needed; fetch what other devices did. */
function toForeground(): void {
  cancelNotices();
  syncOnShow();
}

/** Device sync hooks into the game (see sync.svelte.ts). */
const syncHost = {
  exportText: () => exportSave(game.state),
  read: (text: string) => importSave(text),
  adopt: (state: GameState) => {
    game.loadState(state);
    // The catch-up report of the replaced save no longer applies; the loop reports the new one.
    view.offline = null;
    save();
    refresh();
  },
  notify: (text: string, kind: 'info' | 'error' = 'info') => toast(text, kind, kind === 'error' ? 6000 : 3500),
};

/** Advances the game to now; long catch-ups (offline, sleeping tab) stay silent. */
function advance() {
  const quiet = Date.now() - game.state.lastTickAt > 5000;
  return quiet ? silently(() => game.update(Date.now())) : game.update(Date.now());
}

let started = false;
/** Loads the save (async on native platforms), then starts the game loop. */
export async function init(): Promise<void> {
  if (started) return;
  started = true;
  loadInbox();
  const hadSave = await loadSave();
  view.ready = true;
  // Before the loop starts, so the game continues on the newest save of all devices.
  await initSync(syncHost);
  initNews(hadSave, (f) => game.state.features[f] === true);
  refresh();
  startLoop();
  // Leftovers from the last session (the app was closed while notices were pending).
  cancelNotices();
  void registerPwa((apply) => (view.applyUpdate = apply)).catch(() => {
    /* offline cache is optional */
  });
  void setupNative({
    save: toBackground,
    resume: () => {
      toForeground();
      const r = advance();
      if (r && r.simulatedMs / 1000 >= balance.offline.summaryMinSec) view.offline = r;
      refresh();
    },
    // Close the topmost dialog; false = nothing open (app gets minimised).
    back: () => {
      if (sync.conflict) resolveConflict('later');
      else if (view.detail !== null) view.detail = null;
      else if (news.open) closeNews();
      else if (inbox.open) inbox.open = false;
      else if (view.offline) view.offline = null;
      else if (view.tab !== 'lab') view.tab = 'lab';
      else return false;
      return true;
    },
  });
}

function startLoop(): void {
  const report = advance();
  if (report && report.simulatedMs / 1000 >= balance.offline.summaryMinSec) view.offline = report;

  let lastRender = 0;
  let lastSlow = 0;
  const loop = (t: number) => {
    const r = advance();
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
  setInterval(advance, 1000);
  setInterval(save, balance.sim.autosaveSec * 1000);
  // Mobile apps are suspended without `beforeunload`; hiding is the reliable moment to save.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') toBackground();
    else {
      toForeground();
      advance();
    }
  });
  window.addEventListener('beforeunload', save);
  // Closing a tab does not always report `visibilitychange`; the last upload must still leave.
  window.addEventListener('pagehide', toBackground);
}

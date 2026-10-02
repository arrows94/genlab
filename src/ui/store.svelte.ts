import { content, balance } from '@content/index';
import { Game, type OfflineReport } from '@core/game';
import type { GameState } from '@core/state';
import { deserialize, exportSave, importSave, serialize, type SaveStorage } from '@core/save';
import type { ActionResult } from '@core/actions';
import { formatNumber } from '@core/format';
import { plannedNotices } from '@core/notices';
import { createStorage } from './platform/storage';
import { errorText } from './errors';
import { lookForUpdate, registerPwa } from './platform/pwa';
import { closeNews, initNews, news } from './news.svelte';
import { setupNative } from './platform/native';
import { cancelNotices, scheduleNotices } from './platform/notify';
import { prefs } from './prefs.svelte';
import { inbox, loadInbox, record, saveInbox, type NoticeKind } from './inbox.svelte';
import { START_TIMEOUT_MS, initSync, notePlay, resolveConflict, sync, syncOnHide, syncOnShow, unlinkLocal } from './sync.svelte';
import { isMuted, play, playedRecently, setSoundScope, silently } from './sound';
import { wireSounds } from './soundEvents';
import { noteActive } from '@core/activity';

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
  /** A long absence being computed in slices (the „Labor holt auf“ screen); null otherwise. */
  catchUp: null as { done: number; requestedMs: number } | null,
  /**
   * Before a long absence is caught up the game holds (see `beforeCatchUp`): looking for a new
   * version, installing it (the page reloads), or waiting for the cloud save.
   */
  waitFor: null as 'update' | 'install' | 'sync' | null,
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
  /**
   * GenLab RPG, the other world: 'run' while a run lasts, 'result' after it until the player goes back to the lab.
   * Meanwhile the app shows only the other world, and news from the lab go quietly into the notification center.
   */
  world: 'off' as 'off' | 'run' | 'result',
  /** Portal animation between the lab and the other world (`mid`: the screen is covered, the switch may happen). */
  portal: null as { dir: 'in' | 'out'; creatureId: number; key: number; mid: boolean } | null,
});

let portalKey = 0;

/**
 * Plays the portal: 'in' pulls the monster from the lab into the other world, 'out' brings it back. The switch
 * of the screen waits for the moment the portal covers everything (`portalCovered`).
 */
export function startPortal(dir: 'in' | 'out', creatureId: number): void {
  view.portal = { dir, creatureId, key: ++portalKey, mid: false };
}

/** The portal covers the screen: now the app switches between the lab and the other world. */
export function portalCovered(): void {
  if (!view.portal) return;
  view.portal = { ...view.portal, mid: true };
  if (view.portal.dir === 'out') leaveWorld();
  else refresh();
}

export function portalDone(): void {
  view.portal = null;
}

/** Sounds of the other world (fights, level-ups, UI) – everything else waits in the lab. */
const WORLD_SOUNDS = ['hit', 'hitCrit', 'hitWeak', 'whoosh', 'technique', 'ko', 'floorClear', 'milestone', 'runEnded', 'talent', 'click', 'bonk', 'portal'] as const;

/** Follows the game: a running RPG run pulls the app into the other world; its end leaves the result screen. */
function syncWorld(): void {
  const running = game.state.rpg.run !== null;
  // A portal on its way in keeps the lab on screen until it covers everything.
  if (running && view.world === 'off' && view.portal?.dir === 'in' && !view.portal.mid) return;
  const next = running ? 'run' : view.world === 'run' ? 'result' : view.world;
  if (next === view.world) return;
  view.world = next;
  setSoundScope(next === 'off' ? null : WORLD_SOUNDS);
}

/** „Zurück ins Labor“ after a run. */
export function leaveWorld(): void {
  if (game.state.rpg.run) return;
  view.world = 'off';
  setSoundScope(null);
  refresh();
}

let listId = 0;

let toastId = 0;
/**
 * Shows a short message. It is also kept in the notification center unless
 * `log` is false (instant feedback to a click, e.g. "not enough resources").
 */
export function toast(text: string, kind: Toast['kind'] = 'info', ms = 3500, log = true): void {
  if (log) record(text, kind);
  // In the other world only direct feedback to a click shows; news from the lab wait in the notification center.
  if (log && view.world !== 'off') return;
  const t = { id: ++toastId, text, kind };
  // At most three at once, so they never bury the page.
  view.toasts = [...view.toasts.slice(-2), t];
  setTimeout(() => (view.toasts = view.toasts.filter((x) => x.id !== t.id)), ms);
  toastSound(kind);
}

/**
 * Toasts get a generic sound only when nothing specific played for their
 * event (that one runs right after the toast, hence the short delay).
 */
function toastSound(kind: Toast['kind']): void {
  if (isMuted() || kind === 'unlock') return;
  setTimeout(() => {
    if (kind === 'error') play('bonk');
    else if (!playedRecently(250)) play(kind === 'rare' ? 'toastRare' : 'toastInfo');
  }, 30);
}

/** The single game instance. Starts fresh; `init()` swaps in the stored save. */
export const game = new Game({ content, balance });

/** Loads the stored save; true if there was one. */
async function loadSave(): Promise<boolean> {
  let raw: string | null = null;
  try {
    raw = await storage.load();
  } catch (err) {
    view.loadError = errorText(err);
  }
  if (!raw) return false;
  try {
    game.loadState(deserialize(raw).state);
  } catch (err) {
    view.loadError = errorText(err);
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
  // A brand-new tab gets a badge, so it is found even inside its area of the tab bar.
  g.bus.on('featureUnlocked', (e) => {
    const tab = content.features.get(e.feature).tab;
    if (!e.silent && tab && content.features.list.filter((f) => f.tab === tab && g.state.features[f.id]).length === 1) markUnseen(tab);
  });
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
  g.bus.on('recycleFailed', (e) => {
    const c = g.state.creatures.find((x) => x.id === e.creatureId);
    toast(`♻️ ${c?.name ?? 'Kreatur'} wurde nicht recycelt: ${e.reason}`, 'error');
  });
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
    } else if (e.win && e.floor % g.balance.tower.bossEvery === 0) toast(`🗼 Etage ${e.floor} bezwungen! ${amounts(e.rewards)}`, 'rare');
  });
  g.bus.on('towerRank', (e) => toast(`🎖 Kampferfahrung: Rang ${e.rank} – +${Math.round(e.rank * g.balance.tower.xpRankBonus * 100)} % KP und Schaden im Turm`, 'rare'));
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
wireSounds(game, () => view.tab);

export function openTab(tab: string): void {
  view.tab = tab;
  if (view.unseen[tab]) view.unseen = { ...view.unseen, [tab]: 0 };
}

export function refresh(): void {
  syncWorld();
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
  // Never overwrite the stored save with the placeholder state before loading finished, nor with
  // a half caught-up one: closing the app meanwhile keeps the last save, the next start catches up again.
  // While the game holds before a catch-up nothing is played either (a save would count as play for the sync).
  if (!view.ready || game.catchingUp || view.waitFor) return;
  notePlay();
  writeSave();
}

/** Writes the current state (and the notification center) to storage. */
function writeSave(): void {
  saveInbox();
  storage.save(serialize(game.state)).then(
    () => (view.lastSaved = Date.now()),
    (err: unknown) => toast(`Speichern fehlgeschlagen: ${errorText(err)}`, 'error'),
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
    toast(errorText(err), 'error', 6000);
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
  // Mid catch-up (or holding before one, also while reloading into a new version) nothing was
  // played; the stored save and the cloud stay as they are.
  if (game.catchingUp || view.waitFor) return;
  save();
  syncOnHide();
  if (prefs.notifications) scheduleNotices(plannedNotices(game, Date.now()));
}

/** Back in the foreground: the reminders are no longer needed; fetch what other devices did. */
function toForeground(): void {
  cancelNotices();
  const pull = syncOnShow();
  if (!longGap()) return;
  void beforeCatchUp(pull, lookForUpdate(START_TIMEOUT_MS)).then(() => {
    advance(FIRST_SLICE_MS);
    refresh();
  });
}

/** So much time passed that the next step is a catch-up. */
function longGap(): boolean {
  return game.catchingUp === null && Date.now() - game.state.lastTickAt > balance.sim.catchUpThresholdMs;
}

/** Input since the app came to the foreground: a new version then waits for the banner instead of reloading. */
let touched = false;
/** A page reload after a few seconds at most, should the new version not take over. */
const UPDATE_GRACE_MS = 8000;
let holdId = 0;

/**
 * Before a long absence is caught up: take a waiting new version (the page reloads into it)
 * and the newest save of all devices, so the catch-up runs once, in the newest version, on
 * the save that wins. The game holds meanwhile (`view.waitFor`, see `advance`); both
 * downloads run side by side and are waited for `START_TIMEOUT_MS` at most. A later cloud
 * save is still adopted, it then replaces the catch-up.
 */
async function beforeCatchUp(pull: Promise<unknown> | null, update: Promise<(() => void) | null>): Promise<void> {
  const id = ++holdId;
  const deadline = Date.now() + START_TIMEOUT_MS;
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
  touched = false;
  view.waitFor = 'update';
  const apply = await update.catch(() => null);
  if (id !== holdId) return;
  if (apply && !touched && autoUpdateAllowed()) {
    view.waitFor = 'install';
    apply();
    await sleep(UPDATE_GRACE_MS);
    if (id !== holdId) return;
  }
  view.waitFor = 'sync';
  if (pull) await Promise.race([pull, sleep(deadline - Date.now())]);
  if (id === holdId) view.waitFor = null;
}

/** At most one automatic reload into a new version per minute, so a broken update cannot loop. */
function autoUpdateAllowed(): boolean {
  try {
    const key = 'genlab.autoUpdateAt';
    if (Date.now() - Number(sessionStorage.getItem(key) ?? 0) < 60_000) return false;
    sessionStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    return false;
  }
}

/** Device sync hooks into the game (see sync.svelte.ts). */
const syncHost = {
  exportText: () => exportSave(game.state),
  read: (text: string) => importSave(text),
  adopt: (state: GameState) => {
    game.loadState(state);
    // The catch-up report of the replaced save no longer applies; the loop reports the new one.
    view.offline = null;
    // Also while the game holds for the download: the stored save must match the adopted revision.
    writeSave();
    refresh();
  },
  notify: (text: string, kind: 'info' | 'error' = 'info') => toast(text, kind, kind === 'error' ? 6000 : 3500),
  busy: () => game.catchingUp !== null,
};

/**
 * Computing time per call while a long absence is caught up. The „Labor holt auf“ screen
 * animates with CSS (smooth even while the page computes), so a slice can be long; only the
 * progress bar follows the slices. The first call may take longer, so short absences finish
 * at once without showing that screen.
 */
const SLICE_MS = 50;
const FIRST_SLICE_MS = 150;

/** Advances the game to now; long catch-ups (offline, sleeping tab) stay silent and run in slices. */
function advance(budgetMs = SLICE_MS): void {
  // A long absence waits for the cloud save, or for the player to pick a save in a sync conflict.
  if (view.waitFor || (sync.conflict && longGap())) return;
  const quiet = game.catchingUp !== null || Date.now() - game.state.lastTickAt > 5000;
  const run = () => game.update(Date.now(), budgetMs);
  const report = quiet ? silently(run) : run();
  view.catchUp = game.catchingUp;
  if (report && report.simulatedMs / 1000 >= balance.offline.summaryMinSec) view.offline = report;
}

let started = false;
/** Loads the save (async on native platforms), then starts the game loop. */
export async function init(): Promise<void> {
  if (started) return;
  started = true;
  loadInbox();
  for (const type of ['pointerdown', 'keydown'] as const) window.addEventListener(type, () => (touched = true), { capture: true, passive: true });
  // Look for a new version at once: after a long absence it is installed before anything is synced or caught up.
  const update = registerPwa((apply) => (view.applyUpdate = apply), START_TIMEOUT_MS).catch(() => null);
  const hadSave = await loadSave();
  view.ready = true;
  // Before the loop starts, so the game continues on the newest save of all devices.
  const synced = initSync(syncHost);
  if (longGap()) await beforeCatchUp(synced, update);
  await synced;
  initNews(hadSave, (f) => game.state.features[f] === true);
  refresh();
  startLoop();
  // Leftovers from the last session (the app was closed while notices were pending).
  cancelNotices();
  void setupNative({
    save: toBackground,
    resume: () => {
      toForeground();
      advance(FIRST_SLICE_MS);
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

/**
 * Active play time: counts while the game is visible and the player gave any
 * input in the last `activity.idleSec` (click, touch, key, scroll). The core
 * adds it up, starts sessions and stamps milestones.
 */
function trackActivity(): void {
  let lastInput = Date.now();
  let lastTick = Date.now();
  const onInput = () => (lastInput = Date.now());
  for (const type of ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'] as const) window.addEventListener(type, onInput, { passive: true, capture: true });
  setInterval(() => {
    const now = Date.now();
    const dt = now - lastTick;
    lastTick = now;
    if (document.visibilityState === 'visible' && now - lastInput < balance.activity.idleSec * 1000) noteActive(game, dt, now);
  }, 1000);
}

function startLoop(): void {
  advance(FIRST_SLICE_MS);

  let lastRender = 0;
  let lastSlow = 0;
  const loop = (t: number) => {
    advance();
    // Meanwhile the app under the catch-up screen waits; every frame goes to computing.
    if (game.catchingUp) return void requestAnimationFrame(loop);
    if (t - lastRender >= 100) {
      lastRender = t;
      syncWorld();
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
  setInterval(() => advance(), 1000);
  trackActivity();
  setInterval(save, balance.sim.autosaveSec * 1000);
  // Mobile apps are suspended without `beforeunload`; hiding is the reliable moment to save.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') toBackground();
    else {
      toForeground();
      advance(FIRST_SLICE_MS);
    }
  });
  window.addEventListener('beforeunload', save);
  // Closing a tab does not always report `visibilitychange`; the last upload must still leave.
  window.addEventListener('pagehide', toBackground);
}

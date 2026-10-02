import { D, type Decimal } from './num';
import { createCreature } from './creatures';
import { formatNumber } from './format';
import { grant } from './resources';
import { checkUnlocks, unlockFeature } from './systems/unlocks';
import { survivesReset } from './systems/processes';
import { finishRpgRun } from './features/rpg';
import type { PrestigeLayerDef } from './content/types';
import type { GameContext } from './context';
import type { ActionResult } from './actions';

/**
 * Currency gained by resetting now:
 * floor((Σ source / divisor)^exponent) × `prestige.<layer>.gain`.
 * Source is "earned this run" or, for layers like Äon, "currently owned".
 */
export function prestigeGain(ctx: GameContext, layerId: string): Decimal {
  const layer = ctx.content.prestigeLayers.get(layerId);
  const tuning = ctx.balance.prestige[layerId];
  if (!tuning) throw new Error(`balance.prestige.${layerId} fehlt`);
  const source = layer.gainSource === 'owned' ? ctx.state.resources : ctx.state.earned;
  let total = D(0);
  for (const res of layer.gainFrom) total = total.add(source[res] ?? D(0));
  const raw = total.div(tuning.divisor).pow(tuning.exponent).mul(ctx.mods().factor(`prestige.${layerId}.gain`)).floor();
  return raw.gte(tuning.minGain) ? raw : D(0);
}

/**
 * Applies a layer's reset (what survives is data: `PrestigeLayerDef.resets`),
 * then restores what talents guarantee and gives a fresh start creature.
 * Used by prestige layers and by starting an anomaly.
 */
export function resetLayer(ctx: GameContext, layer: PrestigeLayerDef): void {
  const s = ctx.state;
  const r = layer.resets;
  for (const res of r.resources) s.resources[res] = D(ctx.balance.start.resources[res] ?? 0);
  // Travellers (Tagesreisen, Wochenexpedition) are not at home: they and their journey survive.
  const kept = s.processes.filter((p) => survivesReset(ctx, p));
  const away = new Set(kept.map((p) => String(p.id)));
  if (r.creatures) {
    s.creatures = s.creatures.filter((c) => c.job?.kind === 'mission' && away.has(c.job.target));
    // Travellers keep their journey and their genes, but start over like everyone else:
    // no infusion, potion boosts, pure line or hero level from the old run.
    for (const c of s.creatures) {
      c.infusion = { level: 0, ep: 0 };
      c.boosts = {};
      c.boostUses = 0;
      c.lineage = 0;
      delete s.rpg.ranks[String(c.id)];
    }
    s.tower.run = null;
    s.tower.team = [];
    s.tower.lastDefeat = null;
    // The monster leaves the dungeon with what it carries before the stable starts over.
    finishRpgRun(ctx, true);
  }
  if (r.processes) s.processes = kept;
  if (r.buffs) s.buffs = [];
  if (r.dex) s.dex = {};
  if (r.features) s.features = {};
  for (const id of Object.keys(s.upgrades)) {
    const def = ctx.content.upgrades.has(id) ? ctx.content.upgrades.get(id) : null;
    if (def && r.upgradeCategories.includes(def.category)) delete s.upgrades[id];
  }
  ctx.invalidate();
  applyTalentGuarantees(ctx);
  if (s.creatures.every((c) => c.job?.kind === 'mission')) {
    createCreature(ctx, { speciesId: ctx.balance.start.species, rarity: ctx.balance.start.rarity, source: 'start' });
  }
  // Last: RPG loot and talent start resources are no income of the new run.
  s.earned = {};
}

/**
 * What a reset does to running projects, for the confirmation: travellers
 * and projects without creatures (Großforschung, Großprojekt-Bau) keep
 * going, long work in the lab (≥ 1 h, e.g. deep sequencing, ritual eggs) is lost.
 */
export function resetImpact(ctx: GameContext): { travelling: number; building: number; lostLong: number } {
  let travelling = 0;
  let building = 0;
  let lostLong = 0;
  const away = new Set(ctx.state.creatures.filter((c) => c.job?.kind === 'mission').map((c) => c.job!.target));
  for (const p of ctx.state.processes) {
    if (survivesReset(ctx, p)) {
      if (away.has(String(p.id))) travelling++;
      else building++;
    } else if (p.durationMs >= 3_600_000) lostLong++;
  }
  return { travelling, building, lostLong };
}

/** Text for the confirmation dialog (empty when nothing long is running). */
export function resetImpactText(ctx: GameContext): string {
  const { travelling, building, lostLong } = resetImpact(ctx);
  const parts: string[] = [];
  if (lostLong > 0) parts.push(`${lostLong === 1 ? 'Ein langes Projekt im Labor geht' : `${lostLong} lange Projekte im Labor gehen`} verloren (z. B. Tiefensequenzierung, Brutritual).`);
  if (building > 0) parts.push(`${building === 1 ? 'Eine Großforschung oder ein Bau läuft' : `${building} Großforschungen und Bauten laufen`} ungestört weiter.`);
  if (travelling > 0) parts.push(`${travelling === 1 ? 'Eine Reise läuft' : `${travelling} Reisen laufen`} weiter – die Reisenden kommen in den neuen Durchlauf zurück.`);
  return parts.join(' ');
}

/** Talent effects that must survive resets: permanent features and start resources. */
export function applyTalentGuarantees(ctx: GameContext): void {
  for (const t of ctx.content.talents.list) {
    if (!ctx.state.talents[t.id]) continue;
    t.unlocksFeatures?.forEach((f) => unlockFeature(ctx, f));
    for (const [res, amount] of Object.entries(t.onReset ?? {})) grant(ctx, res, amount, `talent:${t.id}`);
  }
}

/** Runs kept for the timeline. */
export const PRESTIGE_LOG_SIZE = 60;

export type TimelineItem =
  /** A finished run of this layer: gain, length since its previous reset, lower-layer resets inside it. */
  | { kind: 'run'; at: number; gain: number; runMs: number; inner: number }
  /** A reset of a higher layer (e.g. an Äon inside the Vererbung timeline). */
  | { kind: 'marker'; at: number; gain: number; layer: string };

/**
 * The prestige log from the point of view of one layer, oldest first: its
 * own runs (length measured from its previous reset, counting lower-layer
 * resets in between), resets of higher layers as markers, lower layers only
 * counted. Layer order is the order of `prestigeLayers`.
 */
export function prestigeTimeline(ctx: GameContext, layerId: string): { items: TimelineItem[]; unrecorded: number; best: number; avgMs: number } {
  const order = (id: string) => ctx.content.prestigeLayers.list.findIndex((l) => l.id === id);
  const self = order(layerId);
  const items: TimelineItem[] = [];
  let since = ctx.state.createdAt;
  let inner = 0;
  for (const e of ctx.state.prestigeLog) {
    const o = order(e.layer);
    if (o === self) {
      items.push({ kind: 'run', at: e.at, gain: e.gain, runMs: Math.max(0, e.at - since), inner });
      since = e.at;
      inner = 0;
    } else if (o > self) {
      items.push({ kind: 'marker', at: e.at, gain: e.gain, layer: e.layer });
      since = e.at;
    } else inner++;
  }
  const runs = items.filter((x): x is Extract<TimelineItem, { kind: 'run' }> => x.kind === 'run');
  return {
    items,
    unrecorded: Math.max(0, (ctx.state.prestige[layerId]?.count ?? 0) - runs.length),
    best: runs.length ? Math.max(...runs.map((r) => r.gain)) : 0,
    avgMs: runs.length ? runs.reduce((s, r) => s + r.runMs, 0) / runs.length : 0,
  };
}

/** When the current run of this layer started (its last reset or a higher one, else the game start). */
export function currentRunStart(ctx: GameContext, layerId: string): number {
  const order = (id: string) => ctx.content.prestigeLayers.list.findIndex((l) => l.id === id);
  const self = order(layerId);
  const last = [...ctx.state.prestigeLog].reverse().find((e) => order(e.layer) >= self);
  return last?.at ?? ctx.state.createdAt;
}

/**
 * Progress towards the next currency point: the source total now, the
 * total needed for one more point, and the share of the way there.
 */
export function nextPrestigePoint(ctx: GameContext, layerId: string): { total: Decimal; needed: Decimal; progress: number } {
  const layer = ctx.content.prestigeLayers.get(layerId);
  const tuning = ctx.balance.prestige[layerId]!;
  const source = layer.gainSource === 'owned' ? ctx.state.resources : ctx.state.earned;
  let total = D(0);
  for (const res of layer.gainFrom) total = total.add(source[res] ?? D(0));
  const mult = ctx.mods().factor(`prestige.${layerId}.gain`);
  const at = (points: number) => D(points / mult).pow(1 / tuning.exponent).mul(tuning.divisor);
  const current = prestigeGain(ctx, layerId);
  const next = Math.max(tuning.minGain, current.toNumber() + 1);
  const from = current.gt(0) ? at(current.toNumber()) : D(0);
  const needed = at(next);
  const progress = Math.min(1, Math.max(0, total.sub(from).div(needed.sub(from).max(1)).toNumber()));
  return { total, needed, progress };
}

/** Bonus per modifier of `modifiersPerPoint`, with the currency owned now and after resetting. */
export function prestigeBonusPreview(ctx: GameContext, layerId: string): { target: string; op: string; before: number; after: number }[] {
  const layer = ctx.content.prestigeLayers.get(layerId);
  const owned = (ctx.state.resources[layer.currency] ?? D(0)).toNumber();
  const gain = prestigeGain(ctx, layerId).toNumber();
  return layer.modifiersPerPoint.map((m) => ({ target: m.target, op: m.op, before: m.value * owned, after: m.value * (owned + gain) }));
}

export interface ResetItem {
  icon: string;
  label: string;
  detail?: string;
}

/** What a reset of this layer takes away and what stays, for the overview. */
export function resetOverview(ctx: GameContext, layerId: string): { lost: ResetItem[]; kept: ResetItem[] } {
  const layer = ctx.content.prestigeLayers.get(layerId);
  const s = ctx.state;
  const r = layer.resets;
  const lost: ResetItem[] = [];
  const kept: ResetItem[] = [];
  const owned = (id: string) => s.resources[id] ?? D(0);

  for (const res of ctx.content.resources.list) {
    if (res.id === layer.currency || owned(res.id).lte(0)) continue;
    (r.resources.includes(res.id) ? lost : kept).push({ icon: res.icon, label: res.name, detail: formatNumber(owned(res.id)) });
  }
  const { travelling, building, lostLong } = resetImpact(ctx);
  if (r.creatures) {
    const home = s.creatures.filter((c) => c.job?.kind !== 'mission');
    const favourites = home.filter((c) => c.locked).length;
    if (home.length > 0) {
      lost.push({ icon: '🐾', label: 'Kreaturen', detail: `${formatNumber(home.length)}${favourites > 0 ? ` (auch ${formatNumber(favourites)} Favoriten ★)` : ''} – du startest mit einer neuen` });
    }
  }
  if (r.processes) {
    const running = s.processes.filter((p) => !survivesReset(ctx, p)).length;
    if (running > 0) lost.push({ icon: '⏳', label: 'Laufende Vorgänge', detail: `${running}${lostLong > 0 ? `, davon ${lostLong} lange` : ''}` });
  }
  if (r.buffs && s.buffs.length > 0) lost.push({ icon: '🧪', label: 'Aktive Tränke', detail: String(s.buffs.length) });
  const levels = (cats: string[], keep: boolean) =>
    Object.entries(s.upgrades).filter(([id, lvl]) => lvl > 0 && ctx.content.upgrades.has(id) && cats.includes(ctx.content.upgrades.get(id).category) === !keep).reduce((n, [, l]) => n + l, 0);
  const resetLevels = levels(r.upgradeCategories, false);
  const keptLevels = levels(r.upgradeCategories, true);
  if (resetLevels > 0) lost.push({ icon: '📜', label: 'Forschung', detail: `${formatNumber(resetLevels)} Stufen` });
  if (r.features) lost.push({ icon: '🔓', label: 'Freischaltungen', detail: 'kommen im neuen Lauf wieder' });

  if (keptLevels > 0) kept.push({ icon: '📜', label: 'Forschung', detail: `${formatNumber(keptLevels)} Stufen` });
  const dex = Object.keys(s.dex).length;
  if (dex > 0) (r.dex ? lost : kept).push({ icon: '📖', label: 'Monster-Dex', detail: `${dex} Einträge` });
  const library = Object.keys(s.geneLibrary).length;
  if (library > 0) kept.push({ icon: '📚', label: 'Genbibliothek', detail: `${library} Allele` });
  if (s.tower.best > 0) kept.push({ icon: '🗼', label: 'Turm-Rekord', detail: `Etage ${s.tower.best}` });
  const talents = Object.values(s.talents).filter(Boolean).length;
  if (talents > 0) kept.push({ icon: '⏳', label: 'Äon-Talente', detail: `${talents} gelernt` });
  const grand = Object.values(s.grandResearch).reduce((n, l) => n + l, 0);
  if (grand > 0) kept.push({ icon: '📜', label: 'Großforschung', detail: `${grand} Stufen` });
  const mega = Object.values(s.megaProjects).reduce((n, m) => n + m.stage, 0);
  if (mega > 0) kept.push({ icon: '🏗️', label: 'Großprojekte', detail: `${mega} Bauphasen` });
  const dynasties = Object.values(s.dynasties).filter((d) => d > 0).length;
  if (dynasties > 0 && s.features['dynasties']) kept.push({ icon: '👑', label: 'Dynastie-Rekorde', detail: `${dynasties} Arten` });
  const anomalies = Object.values(s.anomaliesCompleted).filter(Boolean).length;
  if (anomalies > 0) kept.push({ icon: '🌀', label: 'Anomalie-Belohnungen', detail: `${anomalies} gemeistert` });
  if (travelling > 0) kept.push({ icon: '🧭', label: 'Reisende', detail: `${travelling} kommen in den neuen Lauf zurück` });
  if (building > 0) kept.push({ icon: '🏗️', label: 'Großforschung und Bauten', detail: 'laufen weiter' });
  return { lost, kept };
}

export function performPrestige(ctx: GameContext, layerId: string): ActionResult {
  const layer = ctx.content.prestigeLayers.get(layerId);
  if (!ctx.state.features[layer.feature]) return { ok: false, reason: 'Noch nicht freigeschaltet.' };
  if (ctx.state.anomaly) return { ok: false, reason: 'Während einer Anomalie nicht möglich.' };
  const gain = prestigeGain(ctx, layerId);
  if (gain.lte(0)) return { ok: false, reason: 'Noch kein Gewinn möglich.' };

  const log = ctx.state.prestigeLog;
  const at = ctx.state.lastTickAt;
  log.push({ layer: layerId, at, gain: gain.toNumber(), runMs: Math.max(0, at - (log.at(-1)?.at ?? ctx.state.createdAt)) });
  if (log.length > PRESTIGE_LOG_SIZE) log.splice(0, log.length - PRESTIGE_LOG_SIZE);

  resetLayer(ctx, layer);
  ctx.state.prestige[layerId] = { count: (ctx.state.prestige[layerId]?.count ?? 0) + 1 };
  grant(ctx, layer.currency, gain, `prestige:${layerId}`);
  ctx.invalidate();
  ctx.bus.emit('prestige', { layer: layerId, gain });
  checkUnlocks(ctx);
  return { ok: true };
}

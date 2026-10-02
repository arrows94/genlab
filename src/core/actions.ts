import { D, type Decimal } from './num';
import { upgradeCost, type Cost } from './costs';
import { findCreature, isOccupied } from './creatures';
import { grant, spend } from './resources';
import { checkCondition } from './conditions';
import { jobCount, jobSlots } from './systems/production';
import { checkUnlocks, unlockFeature } from './systems/unlocks';
import { revealHint } from './features/hybrids';
import type { GameContext } from './context';

/**
 * Player actions. The UI only calls these; they validate, mutate the state
 * and emit events. Every action returns a result instead of throwing, so the
 * UI can show a reason.
 */
export type ActionResult = { ok: true } | { ok: false; reason: string };
const ok: ActionResult = { ok: true };
const fail = (reason: string): ActionResult => ({ ok: false, reason });

export function collectAmounts(ctx: GameContext): Record<string, Decimal> {
  const mods = ctx.mods();
  const out: Record<string, Decimal> = {};
  for (const r of ctx.content.resources.list) {
    const amount = mods.apply(`collect.${r.id}`, ctx.balance.collect.amounts[r.id] ?? 0);
    if (amount > 0) out[r.id] = D(amount);
  }
  return out;
}

export function collect(ctx: GameContext): ActionResult {
  if (!ctx.state.features['collect']) return fail('Sammeln ist noch nicht verfügbar.');
  const amounts = collectAmounts(ctx);
  for (const [res, amount] of Object.entries(amounts)) grant(ctx, res, amount, 'collect');
  ctx.bus.emit('collected', { amounts });
  checkUnlocks(ctx);
  return ok;
}

export function upgradeAvailable(ctx: GameContext, id: string): boolean {
  const def = ctx.content.upgrades.get(id);
  return !def.requires || checkCondition(ctx.state, def.requires);
}

export function nextUpgradeCost(ctx: GameContext, id: string): Cost | null {
  const def = ctx.content.upgrades.get(id);
  const level = ctx.state.upgrades[id] ?? 0;
  if (def.maxLevel !== null && level >= def.maxLevel) return null;
  return upgradeCost(def, level, ctx.mods());
}

export function buyUpgrade(ctx: GameContext, id: string): ActionResult {
  const def = ctx.content.upgrades.get(id);
  if (!upgradeAvailable(ctx, id)) return fail('Noch nicht freigeschaltet.');
  const cost = nextUpgradeCost(ctx, id);
  if (!cost) return fail('Maximale Stufe erreicht.');
  const paid = spend(ctx, cost);
  if (!paid.ok) return paid;
  const level = (ctx.state.upgrades[id] ?? 0) + 1;
  ctx.state.upgrades[id] = level;
  ctx.invalidate();
  ctx.bus.emit('upgradeBought', { upgrade: id, level });
  if (level === 1) def.unlocksFeatures?.forEach((f) => unlockFeature(ctx, f));
  for (let i = 0; i < (def.grantsHints ?? 0); i++) revealHint(ctx);
  checkUnlocks(ctx);
  return ok;
}

export function assignJob(ctx: GameContext, creatureId: number, buildingId: string | null): ActionResult {
  const c = findCreature(ctx, creatureId);
  if (!c) return fail('Kreatur nicht gefunden.');
  if (buildingId === null) {
    if (c.job?.kind !== 'building') return fail('Kreatur arbeitet nicht.');
    c.job = null;
    ctx.invalidate();
    return ok;
  }
  const b = ctx.content.buildings.get(buildingId);
  if (!ctx.state.features[b.feature]) return fail('Anlage noch nicht freigeschaltet.');
  if (isOccupied(c)) return fail('Kreatur ist beschäftigt.');
  if (c.job?.target === buildingId) return ok;
  if (jobCount(ctx, buildingId) >= jobSlots(ctx, buildingId)) return fail('Keine freien Plätze.');
  c.job = { kind: 'building', target: buildingId };
  ctx.invalidate();
  return ok;
}

export function renameCreature(ctx: GameContext, creatureId: number, name: string): ActionResult {
  const c = findCreature(ctx, creatureId);
  if (!c) return fail('Kreatur nicht gefunden.');
  const trimmed = name.trim().replace(/\s+/g, ' ').slice(0, ctx.balance.creature.maxNameLength).trim();
  if (!trimmed) return fail('Name darf nicht leer sein.');
  c.name = trimmed;
  // A surname the player gives („Kiko Sonnenschein“, „Kiko von Stein“) becomes the family its offspring inherit.
  const space = trimmed.indexOf(' ');
  if (space > 0) {
    c.family = trimmed.slice(space + 1);
    ctx.state.playerFamilies[c.family] = true;
  }
  return ok;
}

/** Naming of bred creatures: Rufname + family, or the classic blend of the parents' names. */
export function setNameStyle(ctx: GameContext, style: string): ActionResult {
  if (style !== 'family' && style !== 'classic') return { ok: false, reason: 'Unbekannte Namensart.' };
  ctx.state.nameStyle = style;
  return { ok: true };
}

export function toggleLock(ctx: GameContext, creatureId: number): ActionResult {
  const c = findCreature(ctx, creatureId);
  if (!c) return fail('Kreatur nicht gefunden.');
  c.locked = !c.locked;
  return ok;
}

import { D, type Decimal } from '../num';
import { createCreature, findCreature } from '../creatures';
import { catalogueSamples } from '../genetics';
import { grant, trySpend } from '../resources';
import { hashSeed } from '../rng';
import { registerProcessHandler, registerResetSurvivor, startProcess } from '../systems/processes';
import { toCost } from '../costs';
import type { VoyageDecisionDef, VoyageDestinationDef, VoyageEventDef } from '../content/types';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Process } from '../state';
import { campSlots, campsUsed, missionRewardFactor, registerCampProcess, rollMinRarity } from './expedition';
import { revealHint } from './hybrids';
import { mutationForWeek, weekIndex } from './weekly';

/**
 * Wochenexpedition: a team of up to three creatures travels for seven days
 * (real time – it keeps going beyond the offline cap) and occupies a camp.
 * Events on the way are rolled at the start and revealed day by day; at the
 * return the loot waits for one decision ("take the injured beast or keep
 * the loot?"). The destination changes every week and follows the element of
 * the weekly mutation.
 */
export const VOYAGE = 'voyage';
registerCampProcess(VOYAGE);
// The team is far away – an inheritance at home does not call it back.
registerResetSurvivor((_ctx, p) => p.kind === VOYAGE);

const DAY_MS = 86_400_000;

export interface VoyageData extends Record<string, unknown> {
  destination: string;
  team: number[];
  events: string[];
  /** Loot bonus carried over from an earlier decision. */
  bonus: number;
}

/** Destination of the week: follows the weekly mutation's element if one fits. */
export function voyageDestination(ctx: GameContext, nowMs = ctx.state.lastTickAt): VoyageDestinationDef {
  const week = weekIndex(ctx.balance.weekly.epoch, nowMs);
  const mutation = mutationForWeek(ctx.content.weeklyMutations.list, week);
  const elements = new Set((mutation?.modifiers ?? []).map((m) => /^element\.([^.]+)\./.exec(m.target)?.[1]).filter(Boolean));
  const all = ctx.content.voyageDestinations.list;
  const themed = all.filter((d) => elements.has(d.element));
  const pool = themed.length > 0 ? themed : all;
  return pool[hashSeed(`voyage-${week}`) % pool.length]!;
}

export function runningVoyage(ctx: GameContext): Process | undefined {
  return ctx.state.processes.find((p) => p.kind === VOYAGE);
}

export function voyageDurationMs(ctx: GameContext): number {
  return ctx.balance.voyage.days * DAY_MS;
}

/** Events already reached: event i happens on day i + 1. */
export function revealedEvents(ctx: GameContext, p: Process): { day: number; event: VoyageEventDef }[] {
  const d = p.data as VoyageData;
  const days = Math.floor(p.elapsedMs / DAY_MS);
  return d.events.slice(0, days).map((id, i) => ({ day: i + 1, event: ctx.content.voyageEvents.get(id) }));
}

export function startVoyage(ctx: GameContext, teamIds: number[]): ActionResult {
  if (!ctx.state.features['voyage']) return { ok: false, reason: 'Die Wochenexpedition ist noch nicht freigeschaltet.' };
  if (runningVoyage(ctx)) return { ok: false, reason: 'Es ist bereits ein Team unterwegs.' };
  if (ctx.state.voyage.pending) return { ok: false, reason: 'Erst über die Rückkehr der letzten Expedition entscheiden.' };
  const ids = [...new Set(teamIds)];
  if (ids.length === 0) return { ok: false, reason: 'Wähle mindestens eine Kreatur.' };
  if (ids.length > ctx.balance.voyage.maxTeam) return { ok: false, reason: `Höchstens ${ctx.balance.voyage.maxTeam} Kreaturen.` };
  const team = ids.map((id) => findCreature(ctx, id));
  for (const c of team) {
    if (!c) return { ok: false, reason: 'Kreatur nicht gefunden.' };
    if (c.job && c.job.kind !== 'building') return { ok: false, reason: `${c.name} ist beschäftigt.` };
  }
  if (ids.length >= ctx.state.creatures.length) return { ok: false, reason: 'Mindestens eine Kreatur muss im Labor bleiben.' };
  if (campsUsed(ctx) >= campSlots(ctx)) return { ok: false, reason: 'Alle Camps sind belegt.' };
  if (!trySpend(ctx, toCost(ctx.balance.voyage.cost))) return { ok: false, reason: 'Nicht genug Vorräte.' };

  const pool = [...ctx.content.voyageEvents.list];
  const events: string[] = [];
  for (let i = 0; i < ctx.balance.voyage.events && pool.length > 0; i++) {
    const weights: Record<string, number> = {};
    for (const e of pool) weights[e.id] = e.weight;
    const id = ctx.rng.weighted(weights);
    events.push(id);
    pool.splice(pool.findIndex((e) => e.id === id), 1);
  }
  const data: VoyageData = { destination: voyageDestination(ctx).id, team: ids, events, bonus: ctx.state.voyage.nextBonus };
  ctx.state.voyage.nextBonus = 0;
  const proc = startProcess(ctx, VOYAGE, voyageDurationMs(ctx), data);
  for (const c of team) c!.job = { kind: 'mission', target: String(proc.id) };
  ctx.invalidate();
  return { ok: true };
}

registerProcessHandler(VOYAGE, {
  complete(ctx, proc) {
    const d = proc.data as VoyageData;
    const dest = ctx.content.voyageDestinations.get(d.destination);
    const team = d.team.map((id) => findCreature(ctx, id));
    for (const c of team) if (c?.job?.kind === 'mission' && c.job.target === String(proc.id)) c.job = null;

    const events = d.events.map((id) => ctx.content.voyageEvents.get(id));
    const lootPct = d.bonus + events.reduce((sum, e) => sum + (e.effect.lootPct ?? 0), 0);
    // Every team member carries loot; speed makes them better at it.
    const factor = team.reduce((sum, c) => sum + missionRewardFactor(ctx, c), 0) * Math.max(0, 1 + lootPct);
    const loot: Record<string, Decimal> = {};
    for (const [res, [min, max]] of Object.entries(dest.rewards)) loot[res] = D(Math.floor(ctx.rng.range(min, max) * factor));
    for (const e of events) {
      for (const [res, amount] of Object.entries(e.effect.resources ?? {})) loot[res] = (loot[res] ?? D(0)).add(amount);
      if (e.effect.hint && ctx.state.features['hybrids']) revealHint(ctx);
    }
    const decisions: Record<string, number> = {};
    for (const x of ctx.content.voyageDecisions.list) decisions[x.id] = x.weight;
    ctx.state.voyage.pending = {
      destination: dest.id,
      team: d.team,
      events: d.events,
      loot,
      alleleSamples: events.reduce((n, e) => n + (e.effect.alleleSamples ?? 0), 0),
      decision: ctx.rng.weighted(decisions),
    };
    ctx.invalidate();
    ctx.bus.emit('voyageReturned', { destination: dest.id });
  },
});

export function pendingDecision(ctx: GameContext): VoyageDecisionDef | null {
  const p = ctx.state.voyage.pending;
  return p ? ctx.content.voyageDecisions.get(p.decision) : null;
}

/** What an option pays out (loot share + extra resources), for the preview. */
export function optionRewards(ctx: GameContext, option: 0 | 1): Record<string, Decimal> {
  const p = ctx.state.voyage.pending;
  const o = pendingDecision(ctx)?.options[option];
  if (!p || !o) return {};
  const out: Record<string, Decimal> = {};
  for (const [res, v] of Object.entries(p.loot)) out[res] = v.mul(o.lootFactor).floor();
  for (const [res, amount] of Object.entries(o.resources ?? {})) out[res] = (out[res] ?? D(0)).add(amount);
  return out;
}

/** The decision at the return: grants loot and the option's effects. */
export function resolveVoyage(ctx: GameContext, option: 0 | 1): ActionResult {
  const p = ctx.state.voyage.pending;
  const decision = pendingDecision(ctx);
  const o = decision?.options[option];
  if (!p || !decision || !o) return { ok: false, reason: 'Es wartet keine Entscheidung.' };
  for (const [res, amount] of Object.entries(optionRewards(ctx, option))) if (amount.gt(0)) grant(ctx, res, amount, `voyage:${p.destination}`);
  catalogueSamples(ctx, p.alleleSamples);
  let creatureId: number | null = null;
  if (o.creature) {
    // Like a journey find, the new companion always finds a place.
    const dest = ctx.content.voyageDestinations.get(p.destination);
    creatureId = createCreature(ctx, { speciesId: ctx.rng.pick(dest.species), rarity: rollMinRarity(ctx, o.creature.minRarity), source: 'wild' }).id;
  }
  if (o.teamBoost) {
    for (const id of p.team) {
      const c = findCreature(ctx, id);
      if (!c) continue;
      for (const stat of ctx.content.stats.list) c.boosts[stat.id] = (c.boosts[stat.id] ?? 0) + o.teamBoost;
    }
  }
  ctx.state.voyage.nextBonus += o.nextBonus ?? 0;
  ctx.state.voyage.pending = null;
  ctx.invalidate();
  ctx.bus.emit('voyageResolved', { destination: p.destination, decision: decision.id, option, creatureId });
  return { ok: true };
}

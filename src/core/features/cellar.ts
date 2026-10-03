import { grant } from '../resources';
import { Rng, hashSeed } from '../rng';
import { activeLatent, findCreature, isOccupied } from '../creatures';
import { expressLocus } from '../genetics';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature } from '../state';
import type { System } from '../systems/types';
import type { CellarEffect, CellarEnvironmentDef, CellarMatch, CellarRuleDef } from '../content/types';
import { contractDay } from './contracts';
import { activeMutation } from './weekly';
import { cellarCourse, courseCheckpoint, courseEnemies, courseFloorTokens, floorLabel } from './floors';
import { fighterFor, simulateFight, teamSize, type Fighter, type Row } from './tower';

/**
 * Genom-Keller: the counterpart of the tower, below it. A descent is one of a
 * few attempts per day: the team fights level after level (same fight engine
 * as the tower, `cellarCourse` for the foes) until it falls. Unlike the tower
 * the team does not heal between levels – the HP it keeps carries on
 * (Erschöpfung), only a rest vault every `restEvery` levels heals it. Each
 * descent starts at the last checkpoint below the record.
 *
 * From `environmentFrom` on every section of levels has its surroundings
 * (`cellarEnvironments`): rules that weaken or strengthen team members by
 * their genes, Erbanlage, element, row or the team's variety – a team bred to
 * fit beats raw strength. The week's mutation may add a rule of its own, and
 * the torch burns down between the rest vaults (`light`).
 */

const NOT_YET = 'Der Genom-Keller ist noch nicht freigeschaltet.';

/** Last checkpoint at or below the record – where the next descent starts. */
export function cellarCheckpoint(ctx: GameContext): number {
  return courseCheckpoint(cellarCourse(ctx), ctx.state.cellar.best);
}

/** „Ebene −12“. */
export function cellarLevelLabel(ctx: GameContext, level: number): string {
  return floorLabel(cellarCourse(ctx), level);
}

/** Wall-clock time per level in ms. */
export function cellarIntervalMs(ctx: GameContext): number {
  return Math.max(1000, ctx.balance.cellar.fightIntervalSec * 1000);
}

/** New contract day → more attempts; every day that passed counts, up to the stock limit (also offline). */
export function refreshCellarAttempts(ctx: GameContext, nowMs = ctx.state.lastTickAt): void {
  if (!ctx.state.features['cellar']) return;
  const ce = ctx.state.cellar;
  const day = contractDay(ctx, nowMs);
  if (ce.day === day) return;
  const cfg = ctx.balance.cellar;
  const days = ce.day < 0 ? 1 : Math.max(1, day - ce.day);
  ce.attempts = Math.min(cfg.maxAttempts, ce.attempts + cfg.attemptsPerDay * days);
  ce.day = day;
}

export function cellarRowOf(ctx: GameContext, creatureId: number): Row {
  return ctx.state.cellar.back.includes(creatureId) ? 'back' : 'front';
}

export function setCellarRow(ctx: GameContext, creatureId: number, row: Row): ActionResult {
  const ce = ctx.state.cellar;
  if (ce.run) return { ok: false, reason: 'Während eines Abstiegs nicht änderbar.' };
  if (!ce.team.includes(creatureId)) return { ok: false, reason: 'Die Kreatur ist nicht im Keller-Team.' };
  ce.back = ce.back.filter((id) => id !== creatureId);
  if (row === 'back') ce.back.push(creatureId);
  return { ok: true };
}

/** Same team size as the tower; a creature of the tower team cannot join (and the other way round). */
export function setCellarTeam(ctx: GameContext, ids: number[]): ActionResult {
  if (!ctx.state.features['cellar']) return { ok: false, reason: NOT_YET };
  const ce = ctx.state.cellar;
  if (ce.run) return { ok: false, reason: 'Während eines Abstiegs nicht änderbar.' };
  const unique = [...new Set(ids)].filter((id) => findCreature(ctx, id));
  if (unique.length > teamSize(ctx)) return { ok: false, reason: `Höchstens ${teamSize(ctx)} Kreaturen.` };
  const inTower = unique.map((id) => findCreature(ctx, id)!).find((c) => ctx.state.tower.team.includes(c.id));
  if (inTower) return { ok: false, reason: `${inTower.name} steht schon im Turm-Team.` };
  ce.team = unique;
  ce.back = ce.back.filter((id) => unique.includes(id));
  return { ok: true };
}

// ---- Environments ----------------------------------------------------------------

/** Environments of one block of sections, shuffled per block; a block never starts with the last one's end. */
function environmentBlock(ctx: GameContext, block: number): CellarEnvironmentDef[] {
  const list = [...ctx.content.cellarEnvironments.list];
  const rng = Rng.fromSeed(hashSeed(`${cellarCourse(ctx).dice}-env-${block}`));
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng.next() * (i + 1));
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  if (block > 0 && list.length > 1) {
    const before = environmentBlock(ctx, block - 1);
    if (list[0] === before[before.length - 1]) [list[0], list[1]] = [list[1]!, list[0]!];
  }
  return list;
}

/** Surroundings of a level (null for the plain vault above `environmentFrom`); fixed per section. */
export function environmentAt(ctx: GameContext, level: number): CellarEnvironmentDef | null {
  const cfg = ctx.balance.cellar;
  const list = ctx.content.cellarEnvironments.list;
  if (level < cfg.environmentFrom || list.length === 0) return null;
  const section = Math.floor((level - cfg.environmentFrom) / cfg.environmentEvery);
  return environmentBlock(ctx, Math.floor(section / list.length))[section % list.length]!;
}

/** First and last level of the section a level belongs to. */
export function environmentSection(ctx: GameContext, level: number): { from: number; to: number } {
  const cfg = ctx.balance.cellar;
  if (level < cfg.environmentFrom) return { from: 1, to: cfg.environmentFrom - 1 };
  const from = cfg.environmentFrom + Math.floor((level - cfg.environmentFrom) / cfg.environmentEvery) * cfg.environmentEvery;
  return { from, to: from + cfg.environmentEvery - 1 };
}

/** Every rule on a level: its environment's, plus the week's mutation's. */
export function cellarRules(ctx: GameContext, level: number): CellarRuleDef[] {
  const env = environmentAt(ctx, level);
  const weekly = activeMutation(ctx)?.cellar;
  return [...(env?.rules ?? []), ...(weekly ? [weekly] : [])];
}

/** Sees in the dark: expresses an allele with `nightSight`. */
export function hasNightSight(ctx: GameContext, c: Creature): boolean {
  return Object.entries(c.genome).some(([locus, pair]) =>
    ctx.content.genes.has(locus) && expressLocus(ctx.content.genes.get(locus), pair).some((e) => e.allele.nightSight));
}

/** Does `c` match one entry? `team`: the team in its order (for `duplicate`), `row` its row. */
function matchOne(ctx: GameContext, c: Creature, m: CellarMatch, team: readonly Creature[], row: Row): boolean {
  switch (m.kind) {
    case 'element':
      return m.elements.includes(ctx.content.species.get(c.speciesId).element);
    case 'allele': {
      const pair = c.genome[m.locus];
      if (!pair || !ctx.content.genes.has(m.locus)) return false;
      if (m.homozygous) return pair[0] === m.allele && pair[1] === m.allele;
      return expressLocus(ctx.content.genes.get(m.locus), pair).some((e) => e.allele.id === m.allele);
    }
    case 'latent':
      return activeLatent(ctx, c)?.id === m.trait;
    case 'nightSight':
      return hasNightSight(ctx, c);
    case 'row':
      return row === m.row;
    case 'duplicate': {
      const i = team.findIndex((t) => t.id === c.id);
      return team.slice(0, i < 0 ? team.length : i).some((t) => t.speciesId === c.speciesId);
    }
  }
}

const matchAny = (ctx: GameContext, c: Creature, list: readonly CellarMatch[], team: readonly Creature[], row: Row) =>
  list.some((m) => matchOne(ctx, c, m, team, row));

/** How a rule meets a creature: `hit` – the effect applies; `adapted` – it would concern it, but its traits protect it. */
export function ruleFor(ctx: GameContext, rule: CellarRuleDef, c: Creature, team: readonly Creature[], row: Row): 'hit' | 'adapted' | 'none' {
  if (rule.match && !matchAny(ctx, c, rule.match, team, row)) return 'none';
  if (rule.except && matchAny(ctx, c, rule.except, team, row)) return 'adapted';
  return 'hit';
}

/** All rules that hit a creature, added up (stats, miss and hazard add, healing multiplies). */
export function combineEffects(effects: readonly CellarEffect[]): Required<CellarEffect> {
  const out = { stats: {} as NonNullable<CellarEffect['stats']>, miss: 0, heal: 1, hazard: 0 };
  for (const e of effects) {
    for (const [k, v] of Object.entries(e.stats ?? {}) as [keyof NonNullable<CellarEffect['stats']>, number][]) out.stats[k] = (out.stats[k] ?? 0) + v;
    out.miss += e.miss ?? 0;
    out.heal *= e.heal ?? 1;
    out.hazard += e.hazard ?? 0;
  }
  return out;
}

/** A rule's effect is good for whom it hits (a bonus) – otherwise it is a malus. */
function isBonus(e: CellarEffect): boolean {
  const stats = Object.values(e.stats ?? {}).reduce((a, b) => a + b, 0);
  return stats > 0 && !e.miss && !e.hazard && (e.heal ?? 1) >= 1;
}

/**
 * How well a creature fits the rules of a level: rule texts that help it
 * (a bonus that hits it, a malus it is adapted to) and those that hurt it.
 * `team` (in order) decides `duplicate`; without it the creature counts alone.
 */
export function cellarFit(ctx: GameContext, c: Creature, level: number, team: readonly Creature[] = [c]): { good: string[]; bad: string[] } {
  const good: string[] = [];
  const bad: string[] = [];
  const row = cellarRowOf(ctx, c.id);
  for (const rule of cellarRules(ctx, level)) {
    const how = ruleFor(ctx, rule, c, team, row);
    if (how === 'adapted' && !isBonus(rule.effect)) good.push(rule.text);
    if (how === 'hit') (isBonus(rule.effect) ? good : bad).push(rule.text);
  }
  return { good, bad };
}

/** Free creatures of the stable for a level, best fitting first (more helping, fewer hurting rules). */
export function cellarCandidates(ctx: GameContext, level: number): { creature: Creature; good: string[]; bad: string[] }[] {
  return ctx.state.creatures
    .filter((c) => !isOccupied(c) && !ctx.state.tower.team.includes(c.id))
    .map((c) => ({ creature: c, ...cellarFit(ctx, c, level) }))
    .sort((a, b) => b.good.length - b.bad.length - (a.good.length - a.bad.length));
}

/** Extra miss chance from a burnt-down torch (none with night sight). */
export function torchMiss(ctx: GameContext, light: number): number {
  const cfg = ctx.balance.cellar;
  return Math.max(0, cfg.lightMissFrom - light) * cfg.lightMiss;
}

/**
 * A team member as a cellar fighter: its tower values, its cellar row, the HP
 * share it still has and what the level's rules (`effect`) and the torch do to it.
 */
export function cellarFighter(ctx: GameContext, c: Creature, hpShare = 1, effect: Required<CellarEffect> = combineEffects([]), light = 1): Fighter {
  const f = fighterFor(ctx, c);
  const st = effect.stats;
  const scale = (v: number, k: 'hp' | 'atk' | 'def' | 'spd') => Math.max(1, Math.round(v * Math.max(0.1, 1 + (st[k] ?? 0))));
  const maxHp = scale(f.maxHp, 'hp');
  const hp = Math.max(1, Math.round(maxHp * Math.min(1, hpShare)));
  const miss = effect.miss + (hasNightSight(ctx, c) ? 0 : torchMiss(ctx, light));
  return {
    ...f, maxHp, hp, atk: scale(f.atk, 'atk'), def: f.def > 0 ? scale(f.def, 'def') : 0, spd: scale(f.spd, 'spd'), row: cellarRowOf(ctx, c.id),
    ...(miss > 0 ? { miss } : {}), ...(effect.heal !== 1 ? { healing: effect.heal } : {}),
  };
}

/** Starts a descent from the checkpoint; costs one attempt. */
export function startCellarRun(ctx: GameContext): ActionResult {
  const ce = ctx.state.cellar;
  if (!ctx.state.features['cellar']) return { ok: false, reason: NOT_YET };
  if (ce.run) return { ok: false, reason: 'Es läuft bereits ein Abstieg.' };
  refreshCellarAttempts(ctx);
  if (ce.attempts < 1) return { ok: false, reason: 'Keine Abstiege mehr übrig – morgen gibt es neue.' };
  const team = ce.team.map((id) => findCreature(ctx, id)).filter((c): c is Creature => !!c);
  if (team.length === 0) return { ok: false, reason: 'Stelle zuerst ein Keller-Team zusammen.' };
  const busy = team.find(isOccupied);
  if (busy) return { ok: false, reason: `${busy.name} ist beschäftigt.` };
  for (const c of team) c.job = { kind: 'cellar', target: 'team' };
  ce.attempts -= 1;
  const start = cellarCheckpoint(ctx);
  ce.run = { level: start, team: team.map((c) => c.id), hp: team.map(() => 1), light: 1, elapsedMs: 0, startLevel: start + 1 };
  ctx.invalidate();
  return { ok: true };
}

export function endCellarRun(ctx: GameContext): void {
  const ce = ctx.state.cellar;
  const run = ce.run;
  if (!run) return;
  for (const id of run.team) {
    const c = findCreature(ctx, id);
    if (c?.job?.kind === 'cellar') c.job = null;
  }
  const team = run.team.map((id) => findCreature(ctx, id)?.speciesId ?? '?');
  ce.history = [{ level: run.level, startLevel: run.startLevel, team, at: ctx.state.lastTickAt }, ...ce.history].slice(0, ctx.balance.cellar.historySize);
  ce.run = null;
  ctx.invalidate();
  ctx.bus.emit('cellarRunEnded', { level: run.level, startLevel: run.startLevel });
}

/** Gives up the running descent (the attempt stays used). */
export function stopCellarRun(ctx: GameContext): ActionResult {
  if (!ctx.state.cellar.run) return { ok: false, reason: 'Kein Abstieg aktiv.' };
  endCellarRun(ctx);
  return { ok: true };
}

/** Starts the next descent on its own while attempts are left. */
export function setCellarAuto(ctx: GameContext, enabled: boolean): ActionResult {
  if (!ctx.state.features['cellar']) return { ok: false, reason: NOT_YET };
  ctx.state.cellar.auto = enabled;
  return { ok: true };
}

/** Fights the next level of the running descent (`replay`: keep the events for the arena). */
export function fightNextCellarLevel(ctx: GameContext, replay = true): void {
  const ce = ctx.state.cellar;
  const run = ce.run;
  if (!run) return;
  // Fallen team members (HP share 0) and creatures that are gone sit the rest of the descent out.
  const members = run.team.map((id, i) => ({ c: findCreature(ctx, id), i })).filter((m): m is { c: Creature; i: number } => !!m.c);
  const standing = members.filter((m) => (run.hp[m.i] ?? 0) > 0);
  if (standing.length === 0) return endCellarRun(ctx);
  const level = run.level + 1;
  const rules = cellarRules(ctx, level);
  const team = members.map((m) => m.c);
  const light = run.light ?? 1;
  const fighters = standing.map((m) => {
    const hits = rules.filter((r) => ruleFor(ctx, r, m.c, team, cellarRowOf(ctx, m.c.id)) === 'hit');
    const effect = combineEffects(hits.map((r) => r.effect));
    const f = cellarFighter(ctx, m.c, run.hp[m.i], effect, light);
    // Spores, falling rocks …: HP lost before the fight – never the last one.
    if (effect.hazard > 0) f.hp = Math.max(1, f.hp - Math.round(effect.hazard * f.maxHp));
    return f;
  });
  const result = simulateFight(ctx, fighters, courseEnemies(ctx, cellarCourse(ctx), level), ctx.rng, { replay });
  ce.lastResult = { floor: level, win: result.win, log: result.log, fighters: result.fighters, events: result.events, stats: result.stats, at: ctx.state.lastTickAt };
  if (!result.win) {
    ctx.bus.emit('cellarLevel', { level, win: false, rewards: {}, rest: false });
    endCellarRun(ctx);
    return;
  }
  // Erschöpfung: what is left of each fighter's HP carries into the next level.
  standing.forEach((m, k) => {
    run.hp[m.i] = Math.max(0, result.stats.hpLeft[k] ?? 0) / Math.max(1, fighters[k]!.maxHp);
  });
  run.level = level;
  ce.best = Math.max(ce.best, level);
  const cfg = ctx.balance.cellar;
  const rest = cfg.restEvery > 0 && level % cfg.restEvery === 0;
  run.light = Math.max(0, light - cfg.lightPerLevel);
  // A rest vault: everyone heals, the fallen get up again, the torch is lit anew.
  if (rest) {
    run.hp = run.hp.map((share) => Math.min(1, share + cfg.restHeal));
    run.light = 1;
  }
  const rewards = { towerTokens: courseFloorTokens(cellarCourse(ctx), level) };
  for (const [res, v] of Object.entries(rewards)) grant(ctx, res, v, 'cellar');
  ctx.bus.emit('cellarLevel', { level, win: true, rewards, rest });
}

export const cellarSystem: System = {
  id: 'cellar',
  update(ctx, dtMs) {
    if (!ctx.state.features['cellar']) return;
    refreshCellarAttempts(ctx);
    const ce = ctx.state.cellar;
    if (!ce.run) {
      if (ce.auto && ce.attempts >= 1 && ce.team.length > 0) startCellarRun(ctx);
      if (!ce.run) return;
    }
    const interval = cellarIntervalMs(ctx);
    ce.run.elapsedMs += dtMs;
    while (ce.run && ce.run.elapsedMs >= interval) {
      ce.run.elapsedMs -= interval;
      // A long step (offline) fights many levels at once: only the last one is replayed in the arena.
      fightNextCellarLevel(ctx, ce.run.elapsedMs < interval);
    }
  },
};

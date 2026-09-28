import { D, type Decimal } from '../num';
import { Rng, hashSeed } from '../rng';
import { creatureModifiers, effectiveStats, findCreature } from '../creatures';
import { activeLoci, catalogueGenome, libraryHas } from '../genetics';
import { grant } from '../resources';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature } from '../state';
import type { System } from '../systems/types';

/**
 * Genom-Turm: an endless auto-battle. A team of 3–5 creatures fights floor
 * after floor every `fightIntervalSec`; enemies scale endlessly and element
 * strengths/weaknesses matter. A defeat ends the run (it goes on the personal
 * leaderboard); the next run may start from the last checkpoint.
 */

export interface Fighter {
  name: string;
  /** Species (for the arena artwork). */
  speciesId: string;
  element: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  /** Damage multiplier (tower.damage). */
  power: number;
  /** Extra multiplier on super-effective hits (tower.elementDamage). */
  elementPower: number;
  team: boolean;
}

export function teamSize(ctx: GameContext): number {
  return Math.floor(ctx.mods().apply('slots.tower', ctx.balance.tower.baseTeamSize));
}

/** Enemy for a floor – deterministic per floor, independent of the game RNG. */
export function enemyFor(ctx: GameContext, floor: number): Fighter {
  const t = ctx.balance.tower;
  const rng = Rng.fromSeed(hashSeed(`tower-${floor}`));
  const element = rng.pick(ctx.content.elements.list).id;
  const scale = Math.pow(t.enemyGrowth, floor - 1);
  const boss = floor % t.bossEvery === 0;
  const hp = Math.round((t.enemyBase['hp'] ?? 50) * scale * (boss ? t.bossHpMult : 1));
  const names = ctx.content.species.list.filter((s) => s.element === element);
  const species = rng.pick(names.length ? names : ctx.content.species.list);
  return {
    name: `${boss ? 'Boss: ' : ''}${species.name}`,
    speciesId: species.id,
    element,
    hp,
    maxHp: hp,
    atk: Math.round((t.enemyBase['atk'] ?? 8) * scale * (boss ? t.bossAtkMult : 1)),
    def: Math.round((t.enemyBase['def'] ?? 5) * scale),
    spd: Math.round((t.enemyBase['spd'] ?? 5) * Math.sqrt(scale)),
    power: 1,
    elementPower: 1,
    team: false,
  };
}

export function fighterFor(ctx: GameContext, c: Creature): Fighter {
  const s = effectiveStats(ctx, c);
  const own = creatureModifiers(ctx, c);
  const global = ctx.mods();
  return {
    name: c.name,
    speciesId: c.speciesId,
    element: ctx.content.species.get(c.speciesId).element,
    hp: s.hp ?? 1,
    maxHp: s.hp ?? 1,
    atk: s.atk ?? 1,
    def: s.def ?? 0,
    spd: s.spd ?? 1,
    power: global.factor('tower.damage') * own.factor('tower.damage'),
    elementPower: global.factor('tower.elementDamage') * own.factor('tower.elementDamage'),
    team: true,
  };
}

export function elementMultiplier(ctx: GameContext, attacker: string, defender: string): number {
  if (ctx.content.elements.get(attacker).strongAgainst.includes(defender)) return ctx.balance.tower.strongMult;
  if (ctx.content.elements.get(defender).strongAgainst.includes(attacker)) return ctx.balance.tower.weakMult;
  return 1;
}

export function damage(ctx: GameContext, att: Fighter, def: Fighter, rng: Rng): number {
  const mult = elementMultiplier(ctx, att.element, def.element);
  const elem = mult > 1 ? mult * att.elementPower : mult;
  const scale = ctx.balance.tower.defScale;
  return Math.max(1, Math.round(att.atk * att.power * elem * (scale / (scale + def.def)) * rng.range(0.9, 1.1)));
}

/** One hit of a fight: attacker/target are indices into `[...team, enemy]`. */
export interface FightEvent {
  a: number;
  t: number;
  dmg: number;
  /** Target HP after the hit. */
  hp: number;
  /** Element multiplier of the hit (>1 super effective, <1 resisted). */
  m: number;
}

/** Snapshot of a fighter for replaying a fight in the UI. */
export interface FighterSnapshot {
  name: string;
  speciesId: string;
  element: string;
  maxHp: number;
  team: boolean;
}

export interface FightResult {
  win: boolean;
  rounds: number;
  log: string[];
  fighters: FighterSnapshot[];
  events: FightEvent[];
}

const maxEvents = 40;

/** Simulates one floor. Team HP is full at the start of every floor. */
export function simulateFight(ctx: GameContext, team: Fighter[], enemy: Fighter, rng: Rng): FightResult {
  const log: string[] = [];
  const events: FightEvent[] = [];
  const order = [...team, enemy];
  const fighters = order.map((f) => ({ name: f.name, speciesId: f.speciesId, element: f.element, maxHp: f.maxHp, team: f.team }));
  const hit = (att: Fighter, target: Fighter, dmg: number) => {
    if (events.length < maxEvents) {
      events.push({ a: order.indexOf(att), t: order.indexOf(target), dmg, hp: Math.max(0, target.hp), m: elementMultiplier(ctx, att.element, target.element) });
    }
  };
  const all = [...order].sort((a, b) => b.spd - a.spd);
  const done = (win: boolean, rounds: number) => ({ win, rounds, log, fighters, events });
  for (let round = 1; round <= ctx.balance.tower.maxRounds; round++) {
    for (const f of all) {
      if (f.hp <= 0) continue;
      if (f.team) {
        const dmg = damage(ctx, f, enemy, rng);
        enemy.hp -= dmg;
        hit(f, enemy, dmg);
        if (log.length < 12) log.push(`${f.name} trifft für ${dmg}`);
        if (enemy.hp <= 0) {
          log.push(`${enemy.name} besiegt (Runde ${round})`);
          return done(true, round);
        }
      } else {
        const alive = team.filter((t) => t.hp > 0);
        const target = rng.pick(alive);
        const dmg = damage(ctx, f, target, rng);
        target.hp -= dmg;
        hit(f, target, dmg);
        if (log.length < 12) log.push(`${f.name} trifft ${target.name} für ${dmg}`);
        if (team.every((t) => t.hp <= 0)) {
          log.push(`Team besiegt (Runde ${round})`);
          return done(false, round);
        }
      }
    }
  }
  log.push('Zeit abgelaufen');
  return done(false, ctx.balance.tower.maxRounds);
}

export function checkpoint(ctx: GameContext): number {
  const every = ctx.balance.tower.checkpointEvery;
  return Math.floor(ctx.state.tower.best / every) * every;
}

export function setTeam(ctx: GameContext, ids: number[]): ActionResult {
  if (!ctx.state.features['tower']) return { ok: false, reason: 'Der Genom-Turm ist noch nicht freigeschaltet.' };
  if (ctx.state.tower.run) return { ok: false, reason: 'Während eines Laufs nicht änderbar.' };
  const unique = [...new Set(ids)];
  if (unique.length > teamSize(ctx)) return { ok: false, reason: `Höchstens ${teamSize(ctx)} Kreaturen.` };
  if (unique.some((id) => !findCreature(ctx, id))) return { ok: false, reason: 'Kreatur nicht gefunden.' };
  ctx.state.tower.team = unique;
  return { ok: true };
}

export function startRun(ctx: GameContext, fromCheckpoint = true): ActionResult {
  const tw = ctx.state.tower;
  if (!ctx.state.features['tower']) return { ok: false, reason: 'Der Genom-Turm ist noch nicht freigeschaltet.' };
  if (tw.run) return { ok: false, reason: 'Es läuft bereits ein Lauf.' };
  const team = tw.team.map((id) => findCreature(ctx, id)).filter((c): c is Creature => !!c);
  if (team.length === 0) return { ok: false, reason: 'Stelle zuerst ein Team zusammen.' };
  const busy = team.find((c) => c.job && c.job.kind !== 'building');
  if (busy) return { ok: false, reason: `${busy.name} ist beschäftigt.` };
  for (const c of team) c.job = { kind: 'tower', target: 'team' };
  const start = fromCheckpoint ? checkpoint(ctx) : 0;
  tw.run = { floor: start, team: team.map((c) => c.id), elapsedMs: 0, startFloor: start + 1 };
  ctx.invalidate();
  return { ok: true };
}

export function endRun(ctx: GameContext): void {
  const tw = ctx.state.tower;
  const run = tw.run;
  if (!run) return;
  for (const id of run.team) {
    const c = findCreature(ctx, id);
    if (c?.job?.kind === 'tower') c.job = null;
  }
  tw.leaderboard.push({ floor: run.floor, team: run.team.map((id) => findCreature(ctx, id)?.speciesId ?? '?'), at: ctx.state.lastTickAt });
  tw.leaderboard.sort((a, b) => b.floor - a.floor);
  tw.leaderboard = tw.leaderboard.slice(0, ctx.balance.tower.leaderboardSize);
  tw.run = null;
  ctx.invalidate();
  ctx.bus.emit('towerRunEnded', { floor: run.floor });
}

/** Rare alleles a tower reward can still add to the gene library. */
function missingRareAlleles(ctx: GameContext): { locus: string; allele: string }[] {
  return activeLoci(ctx).flatMap((l) => l.alleles.filter((a) => a.weight <= 10 && !libraryHas(ctx, l.id, a.id)).map((a) => ({ locus: l.id, allele: a.id })));
}

/** Side-effect-free preview of what clearing a floor pays. */
export function floorRewardInfo(ctx: GameContext, floor: number): { tokens: Decimal; catalyst: number; allele: boolean; boss: boolean; checkpoint: boolean } {
  const t = ctx.balance.tower;
  const alleleFloor = floor % t.alleleEvery === 0;
  const allele = alleleFloor && missingRareAlleles(ctx).length > 0;
  let tokens = D(t.tokensPerFloor * (1 + t.tokenGrowthPerFloor * (floor - 1))).floor();
  if (alleleFloor && !allele) tokens = tokens.mul(2);
  return {
    tokens,
    catalyst: floor % t.catalystEvery === 0 ? 1 + Math.floor(floor / (t.catalystEvery * 5)) : 0,
    allele,
    boss: floor % t.bossEvery === 0,
    checkpoint: floor % t.checkpointEvery === 0,
  };
}

function floorRewards(ctx: GameContext, floor: number): { rewards: Record<string, Decimal>; allele: { locus: string; allele: string } | null } {
  const t = ctx.balance.tower;
  const rewards: Record<string, Decimal> = {};
  rewards['towerTokens'] = D(t.tokensPerFloor * (1 + t.tokenGrowthPerFloor * (floor - 1))).floor();
  if (floor % t.catalystEvery === 0) rewards['catalyst'] = D(1 + Math.floor(floor / (t.catalystEvery * 5)));
  let allele: { locus: string; allele: string } | null = null;
  if (floor % t.alleleEvery === 0) {
    // A rare allele for the gene library (if one is still missing).
    const missing = missingRareAlleles(ctx);
    if (missing.length > 0) {
      allele = ctx.rng.pick(missing);
      catalogueGenome(ctx, { [allele.locus]: [allele.allele, allele.allele] });
    } else rewards['towerTokens'] = rewards['towerTokens']!.mul(2);
  }
  return { rewards, allele };
}

/** Fights the next floor of the running tower run. */
export function fightNextFloor(ctx: GameContext): void {
  const tw = ctx.state.tower;
  const run = tw.run;
  if (!run) return;
  const team = run.team.map((id) => findCreature(ctx, id)).filter((c): c is Creature => !!c);
  if (team.length === 0) return endRun(ctx);
  const floor = run.floor + 1;
  const result = simulateFight(ctx, team.map((c) => fighterFor(ctx, c)), enemyFor(ctx, floor), ctx.rng);
  tw.lastResult = { floor, win: result.win, log: result.log, fighters: result.fighters, events: result.events, at: ctx.state.lastTickAt };
  if (!result.win) {
    ctx.bus.emit('towerFloor', { floor, win: false, rewards: {}, allele: null });
    endRun(ctx);
    return;
  }
  run.floor = floor;
  tw.best = Math.max(tw.best, floor);
  const { rewards, allele } = floorRewards(ctx, floor);
  for (const [res, v] of Object.entries(rewards)) grant(ctx, res, v, 'tower');
  ctx.bus.emit('towerFloor', { floor, win: true, rewards, allele });
}

export const towerSystem: System = {
  id: 'tower',
  update(ctx, dtMs) {
    const tw = ctx.state.tower;
    const interval = ctx.balance.tower.fightIntervalSec * 1000;
    if (!tw.run) {
      // Auto-restart (tower upgrade) after a defeat, from the checkpoint.
      if (tw.autoRestart && ctx.state.features['towerAuto'] && tw.team.length > 0) startRun(ctx, true);
      return;
    }
    tw.run.elapsedMs += dtMs;
    while (tw.run && tw.run.elapsedMs >= interval) {
      tw.run.elapsedMs -= interval;
      fightNextFloor(ctx);
    }
  },
};

export function setTowerAutoRestart(ctx: GameContext, enabled: boolean): ActionResult {
  if (!ctx.state.features['towerAuto']) return { ok: false, reason: 'Die Turm-Routine ist noch nicht erforscht.' };
  ctx.state.tower.autoRestart = enabled;
  return { ok: true };
}

export function stopRun(ctx: GameContext): ActionResult {
  if (!ctx.state.tower.run) return { ok: false, reason: 'Kein Lauf aktiv.' };
  endRun(ctx);
  return { ok: true };
}

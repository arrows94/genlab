import { D, type Decimal } from '../num';
import { Rng, hashSeed } from '../rng';
import { creatureModifiers, effectiveStats, findCreature } from '../creatures';
import { activeLoci, catalogueGenome, libraryHas } from '../genetics';
import { grant } from '../resources';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature } from '../state';
import type { System } from '../systems/types';
import type { RelicDef } from '../content/types';
import type { ModifierProvider } from '../providers';

/**
 * Genom-Turm: an endless auto-battle. A team of 3–5 creatures fights floor
 * after floor every `fightIntervalSec`; enemies scale endlessly and element
 * strengths/weaknesses matter. Fights run on an Aktionsleiste: speed decides
 * how often a fighter acts and how often it dodges. A defeat ends the run (it goes on the personal
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
  /** Boss trait id (`bossTraits`), enemies only. */
  trait?: string;
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
  const traits = ctx.content.bossTraits.list;
  const trait = boss && floor >= t.bossTraitFromFloor && traits.length > 0 ? rng.pick(traits).id : undefined;
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
    trait,
  };
}

/** Relikt in the team place of this creature, with its level (null if none). */
export function relicFor(ctx: GameContext, c: Creature): { def: RelicDef; level: number } | null {
  const slot = ctx.state.tower.team.indexOf(c.id);
  const id = slot >= 0 ? ctx.state.tower.relicSlots[slot] : null;
  if (!id || !ctx.content.relics.has(id)) return null;
  const level = relicLevel(ctx, id);
  return level > 0 ? { def: ctx.content.relics.get(id), level } : null;
}

export function fighterFor(ctx: GameContext, c: Creature): Fighter {
  const s = effectiveStats(ctx, c);
  const own = creatureModifiers(ctx, c);
  const global = ctx.mods();
  const relic = relicFor(ctx, c);
  const boost = (key: keyof RelicDef['bonus']) => 1 + (relic ? (relic.def.bonus[key] ?? 0) * relic.level : 0);
  const hp = Math.round((s.hp ?? 1) * boost('hp'));
  return {
    name: c.name,
    speciesId: c.speciesId,
    element: ctx.content.species.get(c.speciesId).element,
    hp,
    maxHp: hp,
    atk: Math.round((s.atk ?? 1) * boost('atk')),
    def: Math.round((s.def ?? 0) * boost('def')),
    spd: Math.round((s.spd ?? 1) * boost('spd')),
    power: global.factor('tower.damage') * own.factor('tower.damage'),
    elementPower: global.factor('tower.elementDamage') * own.factor('tower.elementDamage') * boost('element'),
    team: true,
  };
}

// ---- Relikte --------------------------------------------------------------

export function relicLevel(ctx: GameContext, id: string): number {
  return ctx.state.relics[id] ?? 0;
}

/** Turm-Marken for the next level (null at the maximum). */
export function relicCost(ctx: GameContext, id: string): Decimal | null {
  const def = ctx.content.relics.get(id);
  const level = relicLevel(ctx, id);
  return level >= def.maxLevel ? null : D(def.cost).mul(D(def.costGrowth).pow(level)).ceil();
}

export function buyRelic(ctx: GameContext, id: string): ActionResult {
  if (!ctx.state.features['tower']) return { ok: false, reason: 'Der Genom-Turm ist noch nicht freigeschaltet.' };
  const cost = relicCost(ctx, id);
  if (!cost) return { ok: false, reason: 'Das Relikt ist bereits auf der höchsten Stufe.' };
  const owned = ctx.state.resources['towerTokens'] ?? D(0);
  if (owned.lt(cost)) return { ok: false, reason: 'Nicht genug Turm-Marken.' };
  ctx.state.resources['towerTokens'] = owned.sub(cost);
  ctx.state.relics[id] = relicLevel(ctx, id) + 1;
  ctx.invalidate();
  return { ok: true };
}

/** Puts a relic into a team place (or clears it with null). A relic sits in one place at most. */
export function equipRelic(ctx: GameContext, slot: number, id: string | null): ActionResult {
  if (!ctx.state.features['tower']) return { ok: false, reason: 'Der Genom-Turm ist noch nicht freigeschaltet.' };
  if (ctx.state.tower.run) return { ok: false, reason: 'Während eines Laufs nicht änderbar.' };
  if (!Number.isInteger(slot) || slot < 0 || slot >= teamSize(ctx)) return { ok: false, reason: 'Diesen Platz gibt es nicht.' };
  if (id !== null && (!ctx.content.relics.has(id) || relicLevel(ctx, id) < 1)) return { ok: false, reason: 'Dieses Relikt besitzt du noch nicht.' };
  const slots = ctx.state.tower.relicSlots;
  while (slots.length < teamSize(ctx)) slots.push(null);
  if (id !== null) for (let i = 0; i < slots.length; i++) if (slots[i] === id) slots[i] = null;
  slots[slot] = id;
  return { ok: true };
}

// ---- Meilensteine -----------------------------------------------------------

/** Milestones reached (every `milestoneEvery` floors of the record). */
export function towerMilestones(ctx: GameContext): number {
  return Math.floor(ctx.state.tower.best / ctx.balance.tower.milestoneEvery);
}

/** Permanent bonus per milestone reached. */
export const towerMilestoneProvider: ModifierProvider = (ctx, into) => {
  const n = towerMilestones(ctx);
  if (n > 0) into.addAll('tower:milestone', ctx.balance.tower.milestoneModifiers, n);
};

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

/**
 * One moment of a fight for the replay: attacker/target are indices into
 * `[...team, enemy]`. `kind` is missing for a normal hit.
 */
export interface FightEvent {
  /** Fight time in seconds. */
  at: number;
  a: number;
  t: number;
  dmg: number;
  /** Target HP after the event. */
  hp: number;
  /** Element multiplier of the hit (>1 super effective, <1 resisted). */
  m: number;
  /** miss: dodged (dmg 0) · heal: the boss regenerates (a = t) · shift: the boss changes its element (a = t). */
  kind?: 'miss' | 'heal' | 'shift';
  /** New element after a shift. */
  element?: string;
}

/** Snapshot of a fighter for replaying a fight in the UI. */
export interface FighterSnapshot {
  name: string;
  speciesId: string;
  element: string;
  maxHp: number;
  team: boolean;
  /** Seconds between two actions (Aktionsleiste). */
  interval: number;
}

export interface FightResult {
  win: boolean;
  /** Fight time in seconds when it ended. */
  seconds: number;
  log: string[];
  fighters: FighterSnapshot[];
  events: FightEvent[];
}

const maxEvents = 60;
const maxLog = 14;

/** Seconds between two actions of each fighter: relative to the mean speed of everyone in the fight. */
export function actionIntervals(ctx: GameContext, fighters: Fighter[]): number[] {
  const speeds = fighters.map((f) => Math.max(1, f.spd));
  const mean = speeds.reduce((a, b) => a + b, 0) / Math.max(1, speeds.length);
  return speeds.map((spd) => Math.round(Math.pow(mean / spd, ctx.balance.tower.speedExponent) * 1000) / 1000);
}

/** Chance that `defender` dodges a hit of `attacker`: grows with its speed lead. */
export function evadeChance(ctx: GameContext, attacker: Fighter, defender: Fighter): number {
  const t = ctx.balance.tower;
  const lead = Math.max(1, defender.spd) / Math.max(1, attacker.spd) - 1;
  return Math.min(t.maxEvade, Math.max(0, lead * t.evadePerSpeedLead));
}

/**
 * Simulates one floor on a time line (Aktionsleiste): every fighter acts when
 * its bar is full, faster ones more often; faster defenders may dodge. Boss
 * traits tick once per second of fight time. Team HP is full at the start of
 * every floor. Deterministic for a given RNG state.
 */
export function simulateFight(ctx: GameContext, team: Fighter[], enemy: Fighter, rng: Rng): FightResult {
  const log: string[] = [];
  const events: FightEvent[] = [];
  const order = [...team, enemy];
  const intervals = actionIntervals(ctx, order);
  const fighters: FighterSnapshot[] = order.map((f, i) => ({ name: f.name, speciesId: f.speciesId, element: f.element, maxHp: f.maxHp, team: f.team, interval: intervals[i]! }));
  const note = (line: string) => log.length < maxLog && log.push(line);
  const record = (e: FightEvent) => events.length < maxEvents && events.push({ ...e, at: Math.round(e.at * 100) / 100 });
  const done = (win: boolean, seconds: number): FightResult => ({ win, seconds: Math.round(seconds * 10) / 10, log, fighters, events });
  const trait = enemy.trait && ctx.content.bossTraits.has(enemy.trait) ? ctx.content.bossTraits.get(enemy.trait) : null;
  const elements = ctx.content.elements.list.map((e) => e.id);
  const boss = order.length - 1;
  const limit = ctx.balance.tower.maxFightSec;
  // Next action time per fighter; everyone starts with an empty bar.
  const next = intervals.slice();
  let tick = 1;
  let taken = 0;
  const fmt = (sec: number) => `${sec.toFixed(1).replace('.', ',')} s`;

  for (;;) {
    // The next actor: earliest full bar, ties to the faster one, then team before enemy.
    let who = -1;
    for (let i = 0; i < order.length; i++) {
      if (order[i]!.hp <= 0) continue;
      if (who < 0 || next[i]! < next[who]! - 1e-9 || (Math.abs(next[i]! - next[who]!) < 1e-9 && order[i]!.spd > order[who]!.spd)) who = i;
    }
    const now = next[who]!;
    // Boss traits tick every full second of fight time before this action.
    while (tick <= now && tick <= limit) {
      if (trait?.kind === 'shift') {
        enemy.element = elements[(elements.indexOf(enemy.element) + 1) % elements.length]!;
        record({ at: tick, a: boss, t: boss, dmg: 0, hp: enemy.hp, m: 1, kind: 'shift', element: enemy.element });
        note(`${fmt(tick)} · ${enemy.name} wechselt zu ${ctx.content.elements.get(enemy.element).name}`);
      }
      // Regeneration heals a share of the damage taken since the last tick. Scaling with
      // the team's damage (not the boss's max HP) keeps it equally hard on every floor.
      if (trait?.kind === 'regen' && enemy.hp > 0) {
        const healed = Math.min(enemy.maxHp - enemy.hp, Math.round(taken * trait.value));
        if (healed > 0) {
          enemy.hp += healed;
          record({ at: tick, a: boss, t: boss, dmg: healed, hp: enemy.hp, m: 1, kind: 'heal' });
          note(`${fmt(tick)} · ${enemy.name} heilt ${healed}`);
        }
      }
      taken = 0;
      tick++;
    }
    if (now > limit) {
      log.push('Zeit abgelaufen');
      return done(false, limit);
    }
    const att = order[who]!;
    next[who] = now + intervals[who]!;
    const target = att.team ? enemy : rng.pick(team.filter((t) => t.hp > 0));
    const ti = order.indexOf(target);
    const m = elementMultiplier(ctx, att.element, target.element);
    if (rng.chance(evadeChance(ctx, att, target))) {
      record({ at: now, a: who, t: ti, dmg: 0, hp: target.hp, m, kind: 'miss' });
      note(`${fmt(now)} · ${target.name} weicht ${att.name} aus`);
      continue;
    }
    let dmg = damage(ctx, att, target, rng);
    // Element-Schild: only hits with element advantage get through in full.
    if (att.team && trait?.kind === 'shield' && m <= 1) dmg = Math.max(1, Math.round(dmg * trait.value));
    target.hp -= dmg;
    if (att.team) taken += dmg;
    record({ at: now, a: who, t: ti, dmg, hp: Math.max(0, target.hp), m });
    note(`${fmt(now)} · ${att.name} trifft ${att.team ? '' : `${target.name} `}für ${dmg}`);
    if (enemy.hp <= 0) {
      log.push(`${enemy.name} besiegt nach ${fmt(now)}`);
      return done(true, now);
    }
    if (team.every((t) => t.hp <= 0)) {
      log.push(`Team besiegt nach ${fmt(now)}`);
      return done(false, now);
    }
  }
}

/** Time per floor in ms (Äon talent „Sturmlauf“ shortens it). */
export function fightIntervalMs(ctx: GameContext): number {
  return Math.max(1000, ctx.mods().apply('tower.interval', ctx.balance.tower.fightIntervalSec) * 1000);
}

export function checkpoint(ctx: GameContext): number {
  const every = ctx.balance.tower.checkpointEvery;
  return Math.floor(ctx.state.tower.best / every) * every;
}

export function setTeam(ctx: GameContext, ids: number[]): ActionResult {
  if (!ctx.state.features['tower']) return { ok: false, reason: 'Der Genom-Turm ist noch nicht freigeschaltet.' };
  if (ctx.state.tower.run) return { ok: false, reason: 'Während eines Laufs nicht änderbar.' };
  // Ids of creatures that no longer exist are dropped instead of blocking the change.
  const unique = [...new Set(ids)].filter((id) => findCreature(ctx, id));
  if (unique.length > teamSize(ctx)) return { ok: false, reason: `Höchstens ${teamSize(ctx)} Kreaturen.` };
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
  tw.restartFromCheckpoint = fromCheckpoint;
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
  const entry = { floor: run.floor, team: run.team.map((id) => findCreature(ctx, id)?.speciesId ?? '?'), at: ctx.state.lastTickAt };
  tw.leaderboard.push(entry);
  tw.leaderboard.sort((a, b) => b.floor - a.floor);
  tw.leaderboard = tw.leaderboard.slice(0, ctx.balance.tower.leaderboardSize);
  tw.history = [{ ...entry, team: [...entry.team], startFloor: run.startFloor }, ...tw.history].slice(0, ctx.balance.tower.historySize);
  tw.run = null;
  ctx.invalidate();
  ctx.bus.emit('towerRunEnded', { floor: run.floor });
}

/** Rare alleles a tower reward can still add to the gene library. */
function missingRareAlleles(ctx: GameContext): { locus: string; allele: string }[] {
  return activeLoci(ctx).flatMap((l) => l.alleles.filter((a) => a.weight <= 10 && !libraryHas(ctx, l.id, a.id)).map((a) => ({ locus: l.id, allele: a.id })));
}

/** Side-effect-free preview of what clearing a floor pays. */
export function floorRewardInfo(ctx: GameContext, floor: number): { tokens: Decimal; catalyst: number; allele: boolean; boss: boolean; checkpoint: boolean; milestone: boolean } {
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
    milestone: floor % t.milestoneEvery === 0,
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
  const record = floor > tw.best;
  tw.best = Math.max(tw.best, floor);
  const { rewards, allele } = floorRewards(ctx, floor);
  // Milestone records (first time only, the best floor survives every reset) give a time crystal.
  if (record && floor % ctx.balance.timeCrystals.towerEvery === 0) rewards['timeCrystals'] = D(1);
  // Milestones (first time only): Äon-Splitter; the permanent bonus follows the record (towerMilestoneProvider).
  if (record && floor % ctx.balance.tower.milestoneEvery === 0) {
    rewards['aeonShards'] = D(ctx.balance.tower.milestoneShards);
    ctx.invalidate();
  }
  for (const [res, v] of Object.entries(rewards)) grant(ctx, res, v, 'tower');
  ctx.bus.emit('towerFloor', { floor, win: true, rewards, allele });
}

export const towerSystem: System = {
  id: 'tower',
  update(ctx, dtMs) {
    const tw = ctx.state.tower;
    const interval = fightIntervalMs(ctx);
    if (!tw.run) {
      // Auto-restart (tower upgrade) after a defeat, where the last run started (checkpoint or floor 1).
      if (tw.autoRestart && ctx.state.features['towerAuto'] && tw.team.length > 0) startRun(ctx, tw.restartFromCheckpoint);
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

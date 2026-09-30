import { D, type Decimal } from '../num';
import { Rng, hashSeed } from '../rng';
import { creatureModifiers, effectiveStats, findCreature } from '../creatures';
import { activeLoci, catalogueGenome, libraryHas } from '../genetics';
import { grant } from '../resources';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature, FightStats } from '../state';
import type { System } from '../systems/types';
import type { BossTraitDef, RelicDef, StatusId, TargetingMode, TechniqueDef } from '../content/types';
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
  /** Team row: the front row takes most enemy attacks. */
  row?: Row;
  /** Element-Technik id (used every `techniqueEvery`-th action). */
  technique?: string;
  /** Chance of a critical hit (tower.crit). */
  crit?: number;
  /** Share of the damage taken that goes back to the attacker (tower.thorns, „Dornenhaut“). */
  thorns?: number;
  /** Acts almost at once in a fight (tower.firstStrike ≥ 1). */
  firstStrike?: boolean;
  /** Boss of its floor (crown in the arena). */
  boss?: boolean;
  /** Wächter of its floor (a stronger single enemy between the bosses). */
  guard?: boolean;
  /** Second boss trait that wakes below half HP (Phase 2). */
  phaseTrait?: string;
}

export type Row = 'front' | 'back';

/** Role derived from the stats (a hint for the line-up, no rule). */
export type Role = 'tank' | 'attacker' | 'fast';

export const ROLE_INFO: Record<Role, { name: string; icon: string; hint: string }> = {
  tank: { name: 'Tank', icon: '🛡️', hint: 'Viel KP und Verteidigung – gehört nach vorne.' },
  attacker: { name: 'Angreifer', icon: '⚔️', hint: 'Hoher Angriff – hinten geschützt teilt er am meisten aus.' },
  fast: { name: 'Flink', icon: '💨', hint: 'Hohes Tempo – handelt oft und weicht aus.' },
};

/**
 * Role from the stat profile: each stat is compared with the tower's enemy
 * base profile, the strongest one wins (KP and VER both count for the tank).
 */
export function roleOf(ctx: GameContext, stats: { hp?: number; atk?: number; def?: number; spd?: number }): Role {
  const base = ctx.balance.tower.enemyBase;
  const rel = (k: string, v: number | undefined) => (v ?? 0) / Math.max(1, base[k] ?? 1);
  const tank = (rel('hp', stats.hp) + rel('def', stats.def)) / 2;
  const attacker = rel('atk', stats.atk);
  const fast = rel('spd', stats.spd);
  return tank >= attacker && tank >= fast ? 'tank' : attacker >= fast ? 'attacker' : 'fast';
}

export function teamSize(ctx: GameContext): number {
  return Math.floor(ctx.mods().apply('slots.tower', ctx.balance.tower.baseTeamSize));
}

/**
 * Dice for a floor. The three small floors of a former floor n share its element and group size (`step`
 * seeded with n, as before the finer floors), so the tower is not more jagged than it was; floor 3n is
 * exactly the former floor n. The floors in between pick their species with dice of their own (`own`).
 */
function floorDice(ctx: GameContext, prefix: string, floor: number): { step: Rng; own: Rng } {
  const per = ctx.balance.tower.subFloors;
  const step = Rng.fromSeed(hashSeed(`${prefix}-${Math.ceil(floor / per)}`));
  return { step, own: floor % per === 0 ? step : Rng.fromSeed(hashSeed(`${prefix}-${floor}/${per}`)) };
}

/** Boss floor: every `bossEvery`-th. */
export function isBossFloor(ctx: GameContext, floor: number): boolean {
  return floor % ctx.balance.tower.bossEvery === 0;
}

/** Wächter floor: every `guardEvery`-th that is not a boss floor. */
export function isGuardFloor(ctx: GameContext, floor: number): boolean {
  const every = ctx.balance.tower.guardEvery;
  return every > 0 && floor % every === 0 && !isBossFloor(ctx, floor);
}

/**
 * Enemy for a floor – deterministic per floor, independent of the game RNG.
 * `plain` leaves out the boss and Wächter multipliers and the trait (the
 * weekly titan follows the floor's normal strength).
 */
export function enemyFor(ctx: GameContext, floor: number, opts: { plain?: boolean } = {}): Fighter {
  const t = ctx.balance.tower;
  const { step: rng, own } = floorDice(ctx, 'tower', floor);
  const element = rng.pick(ctx.content.elements.list).id;
  const scale = Math.pow(t.enemyGrowth, floor - t.subFloors);
  const boss = !opts.plain && isBossFloor(ctx, floor);
  const guard = !opts.plain && isGuardFloor(ctx, floor);
  const hpMult = boss ? t.bossHpMult : guard ? t.guardHpMult : 1;
  const atkMult = boss ? t.bossAtkMult : guard ? t.guardAtkMult : 1;
  const hp = Math.round((t.enemyBase['hp'] ?? 50) * scale * hpMult);
  const names = ctx.content.species.list.filter((s) => s.element === element);
  const species = own.pick(names.length ? names : ctx.content.species.list);
  const traits = ctx.content.bossTraits.list;
  const trait = boss && floor >= t.bossTraitFromFloor && traits.length > 0 ? rng.pick(traits).id : undefined;
  return {
    name: `${boss ? 'Boss: ' : guard ? 'Wächter: ' : ''}${species.name}`,
    speciesId: species.id,
    element,
    hp,
    maxHp: hp,
    atk: Math.round((t.enemyBase['atk'] ?? 8) * scale * atkMult),
    def: Math.round((t.enemyBase['def'] ?? 5) * scale),
    spd: Math.round((t.enemyBase['spd'] ?? 5) * Math.sqrt(scale)),
    power: 1,
    elementPower: 1,
    team: false,
    trait,
    ...(boss ? { boss: true } : {}),
    ...(guard ? { guard: true } : {}),
    technique: techniqueFor(ctx, element)?.id,
  };
}

/**
 * Everyone the team meets on a floor – deterministic per floor. On a Wächter
 * floor every foe is stronger, the first one is the Wächter. Normal floors
 * from `groupFromFloor` on may bring 2–3 foes that share the floor's strength;
 * boss floors from `companionsFromFloor` on bring two companions in front of
 * the boss, and from `phaseFromFloor` on the boss wakes a second trait below
 * half HP.
 */
export function enemiesFor(ctx: GameContext, floor: number): Fighter[] {
  const t = ctx.balance.tower;
  const main = enemyFor(ctx, floor);
  const { step: rng, own } = floorDice(ctx, 'tower-group', floor);
  const sameElement = ctx.content.species.list.filter((sp) => sp.element === main.element && sp.id !== main.speciesId);
  const pickSpecies = () => (sameElement.length ? own.pick(sameElement) : ctx.content.species.get(main.speciesId));
  if (main.boss) {
    const traits = ctx.content.bossTraits.list.filter((b) => b.id !== main.trait);
    if (floor >= t.phaseFromFloor && main.trait && traits.length) main.phaseTrait = rng.pick(traits).id;
    if (floor < t.companionsFromFloor) return [main];
    main.row = 'back';
    const normalHp = main.maxHp / t.bossHpMult;
    const normalAtk = main.atk / t.bossAtkMult;
    const companions = [0, 1].map((): Fighter => {
      const sp = pickSpecies();
      const hp = Math.max(1, Math.round(normalHp * t.companionHp));
      return { ...main, name: sp.name, speciesId: sp.id, hp, maxHp: hp, atk: Math.max(1, Math.round(normalAtk * t.companionAtk)), trait: undefined, phaseTrait: undefined, boss: undefined, row: 'front' };
    });
    return [...companions, main];
  }
  // The three small floors of a former floor share its group size (thresholds from its floor 3n).
  const stepFloor = Math.ceil(floor / t.subFloors) * t.subFloors;
  if (stepFloor < t.groupFromFloor) return [main];
  // Bigger groups get likelier higher up.
  const r = rng.next();
  const late = stepFloor >= t.groupFromFloor * 2.5;
  const size = r < (late ? 0.3 : 0.5) ? 1 : r < (late ? 0.7 : 0.85) ? 2 : 3;
  if (size === 1) return [main];
  const hp = Math.max(1, Math.round((main.maxHp * (t.groupHp[size - 1] ?? 1)) / size));
  const atk = Math.max(1, Math.round((main.atk * (t.groupAtk[size - 1] ?? 1)) / size));
  return Array.from({ length: size }, (_, i): Fighter => {
    const sp = i === 0 ? ctx.content.species.get(main.speciesId) : pickSpecies();
    return { ...main, name: i === 0 ? main.name : sp.name, speciesId: sp.id, hp, maxHp: hp, atk };
  });
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
  const hp = Math.round((s.hp ?? 1) * boost('hp') * global.factor('tower.hp') * own.factor('tower.hp'));
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
    row: rowOf(ctx, c.id),
    technique: techniqueFor(ctx, ctx.content.species.get(c.speciesId).element)?.id,
    crit: own.apply('tower.crit', 0) + global.apply('tower.crit', 0),
    thorns: own.apply('tower.thorns', 0) + global.apply('tower.thorns', 0),
    firstStrike: own.apply('tower.firstStrike', 0) + global.apply('tower.firstStrike', 0) >= 1,
  };
}

/** The Element-Technik of an element. */
export function techniqueFor(ctx: GameContext, element: string): TechniqueDef | undefined {
  return ctx.content.techniques.list.find((t) => t.element === element);
}

export interface Synergy {
  kind: 'pair' | 'diversity';
  /** Elements involved. */
  elements: string[];
  /** Bonus share (ANG for pairs, damage against the Wandler for diversity). */
  value: number;
  /** Only against a shifting boss. */
  active: boolean;
}

/**
 * Team synergies: every element with two or more members gives those
 * members +pairBonus ANG; three or more different elements give the whole
 * team +diversityBonus damage against the Wandler.
 */
export function teamSynergies(ctx: GameContext, elements: string[], enemyTrait?: string): Synergy[] {
  const t = ctx.balance.tower;
  const counts = new Map<string, number>();
  for (const e of elements) counts.set(e, (counts.get(e) ?? 0) + 1);
  const out: Synergy[] = [...counts.entries()].filter(([, n]) => n >= 2).map(([e]) => ({ kind: 'pair' as const, elements: [e], value: t.pairBonus, active: true }));
  if (counts.size >= 3) {
    const trait = enemyTrait && ctx.content.bossTraits.has(enemyTrait) ? ctx.content.bossTraits.get(enemyTrait) : null;
    out.push({ kind: 'diversity', elements: [...counts.keys()], value: t.diversityBonus, active: trait?.kind === 'shift' });
  }
  return out;
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

/** Highest record ever (a lowered record keeps what was earned). */
export function towerBestEver(ctx: GameContext): number {
  return Math.max(ctx.state.tower.best, ctx.state.tower.bestEver ?? 0);
}

/** Milestones reached (every `milestoneEvery` floors of the highest record ever). */
export function towerMilestones(ctx: GameContext): number {
  return Math.floor(towerBestEver(ctx) / ctx.balance.tower.milestoneEvery);
}

/**
 * Help for stuck saves (options): lowers the record, so the checkpoint and
 * this week's boss fit the team again. Milestone bonuses stay, first-time
 * rewards (time crystal, Äon-Splitter) are not paid again.
 */
export function lowerTowerRecord(ctx: GameContext, floor: number): ActionResult {
  const tw = ctx.state.tower;
  if (!ctx.state.features['tower']) return { ok: false, reason: 'Der Genom-Turm ist noch nicht freigeschaltet.' };
  if (tw.run) return { ok: false, reason: 'Beende zuerst den laufenden Turm-Lauf.' };
  if (!Number.isInteger(floor) || floor < 0) return { ok: false, reason: 'Bitte eine Etage ab 0 angeben.' };
  if (floor >= tw.best) return { ok: false, reason: `Der Rekord kann nur gesenkt werden (aktuell Etage ${tw.best}).` };
  tw.bestEver = towerBestEver(ctx);
  tw.best = floor;
  tw.recordAt = ctx.state.lastTickAt;
  tw.resolve = 0;
  ctx.invalidate();
  return { ok: true };
}

/** Permanent bonus per milestone reached. */
export const towerMilestoneProvider: ModifierProvider = (ctx, into) => {
  const n = towerMilestones(ctx);
  if (n > 0) into.addAll('tower:milestone', ctx.balance.tower.milestoneModifiers, n);
};

/**
 * Kampferfahrung: rank from the XP (rank n → n + 1 costs base × growth^n), the XP into the current
 * rank and what the next one needs, and the bonus per KP and damage.
 */
export function veteranRank(ctx: GameContext, xp = ctx.state.tower.xp ?? 0): { rank: number; into: number; need: number; bonus: number } {
  const t = ctx.balance.tower;
  // Rank n → n + 1 costs base × (1 + step × n): the total up to rank n is quadratic.
  const total = (n: number) => t.xpRankBase * (n + (t.xpRankStep * n * (n - 1)) / 2);
  const a = (t.xpRankBase * t.xpRankStep) / 2;
  const b = t.xpRankBase - a;
  let rank = Math.max(0, Math.floor(a > 0 ? (-b + Math.sqrt(b * b + 4 * a * xp)) / (2 * a) : xp / t.xpRankBase));
  // Guard against rounding at the edge of a rank.
  while (total(rank + 1) <= xp) rank++;
  while (rank > 0 && total(rank) > xp) rank--;
  return { rank, into: xp - total(rank), need: t.xpRankBase * (1 + t.xpRankStep * rank), bonus: rank * t.xpRankBonus };
}

/** Kampferfahrung for winning a floor: more the higher it is, a boss counts several times. */
export function floorXp(ctx: GameContext, floor: number): number {
  const t = ctx.balance.tower;
  return t.xpPerFloor * floor * (isBossFloor(ctx, floor) ? t.xpBossMult : 1);
}

/** Entschlossenheit: hours since the record last rose and the bonus they give (hourly steps, capped). */
export function resolveInfo(ctx: GameContext): { hours: number; bonus: number } {
  const t = ctx.balance.tower;
  const since = ctx.state.tower.recordAt || ctx.state.lastTickAt;
  const hours = Math.max(0, Math.floor((ctx.state.lastTickAt - since) / 3_600_000));
  return { hours, bonus: Math.min(t.resolveCap, (t.resolvePerDay * hours) / 24) };
}

/** Kampferfahrung and Entschlossenheit as a bonus on KP and damage of every tower fighter. */
export const towerVeteranProvider: ModifierProvider = (ctx, into) => {
  const bonus = veteranRank(ctx).bonus + (ctx.state.tower.resolve ?? 0);
  if (bonus <= 0) return;
  into.addAll('tower:veteran', [
    { target: 'tower.hp', op: 'pct', value: bonus },
    { target: 'tower.damage', op: 'pct', value: bonus },
  ]);
};

/** Adds Kampferfahrung for a won floor; a new rank refreshes the bonuses. */
function gainXp(ctx: GameContext, floor: number): void {
  const before = veteranRank(ctx).rank;
  ctx.state.tower.xp = (ctx.state.tower.xp ?? 0) + floorXp(ctx, floor);
  const after = veteranRank(ctx).rank;
  if (after > before) {
    ctx.invalidate();
    ctx.bus.emit('towerRank', { rank: after });
  }
}

export function elementMultiplier(ctx: GameContext, attacker: string, defender: string): number {
  if (ctx.content.elements.get(attacker).strongAgainst.includes(defender)) return ctx.balance.tower.strongMult;
  if (ctx.content.elements.get(defender).strongAgainst.includes(attacker)) return ctx.balance.tower.weakMult;
  return 1;
}

/**
 * First step of the defence: the share of a hit that gets through, 1 / (1 + defWeight × VER / ANG).
 * Only the ratio counts, so a fight lasts about as long on every floor – with a fixed scale fights
 * high up grew longer and longer (VER grows with the floor, the damage per hit did not).
 */
export function defFactor(ctx: GameContext, def: number, atk: number): number {
  return 1 / (1 + (ctx.balance.tower.defWeight * def) / Math.max(1, atk));
}

/**
 * Damage of one hit: attack × multipliers, reduced by defence in two steps –
 * `defFactor` and then a share that depends on VER against the attacker's ANG
 * (up to `defRatio` when VER ≫ ANG). Both only look at ratios, so they work
 * the same on every floor. A hit always does at least 1.
 */

export function damage(ctx: GameContext, att: Fighter, def: Fighter, rng: Rng): number {
  const t = ctx.balance.tower;
  const mult = elementMultiplier(ctx, att.element, def.element);
  const elem = mult > 1 ? mult * att.elementPower : mult;
  const raw = att.atk * att.power * elem * rng.range(0.9, 1.1);
  const guard = 1 - t.defRatio * (def.def / Math.max(1, def.def + att.atk));
  const reduced = raw * defFactor(ctx, def.def, att.atk * att.power) * guard;
  return Math.max(1, Math.round(reduced));
}

/** Row of a team member (front unless marked for the back). */
export function rowOf(ctx: GameContext, creatureId: number): Row {
  return ctx.state.tower.back.includes(creatureId) ? 'back' : 'front';
}

/** Puts a team member into the front or back row. */
export function setRow(ctx: GameContext, creatureId: number, row: Row): ActionResult {
  const tw = ctx.state.tower;
  if (tw.run) return { ok: false, reason: 'Während eines Laufs nicht änderbar.' };
  if (!tw.team.includes(creatureId)) return { ok: false, reason: 'Die Kreatur ist nicht im Team.' };
  tw.back = tw.back.filter((id) => id !== creatureId);
  if (row === 'back') tw.back.push(creatureId);
  return { ok: true };
}

/** How the enemy of a floor picks its targets (boss traits can change it). */
export function targetingOf(ctx: GameContext, enemy: Fighter): TargetingMode {
  const trait = enemy.trait && ctx.content.bossTraits.has(enemy.trait) ? ctx.content.bossTraits.get(enemy.trait) : null;
  return trait?.targeting ?? 'rows';
}

/**
 * Target of an enemy attack. rows: the front row with `frontShare` (if both
 * rows stand), back: the same for the back row, weakest: least HP left.
 */
export function pickTarget(ctx: GameContext, mode: TargetingMode, alive: Fighter[], rng: Rng): Fighter {
  if (mode === 'weakest') return alive.reduce((a, b) => (b.hp < a.hp ? b : a));
  const front = alive.filter((f) => f.row !== 'back');
  const back = alive.filter((f) => f.row === 'back');
  if (front.length === 0 || back.length === 0) return rng.pick(alive);
  const preferred = mode === 'back' ? back : front;
  const other = mode === 'back' ? front : back;
  return rng.pick(rng.chance(ctx.balance.tower.frontShare) ? preferred : other);
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
  /**
   * (none): normal hit · miss: dodged (dmg 0) · heal: HP healed (dmg = amount) ·
   * shift: the boss changes its element (a = t) · tech: a technique is used (dmg = its hit) ·
   * status: a status lands on t · dot: burn/poison tick (a = t) · reflect: damage thrown back at t ·
   * enrage: the enemies' Wut begins (a = t = the first enemy standing).
   */
  kind?: 'miss' | 'heal' | 'shift' | 'tech' | 'status' | 'dot' | 'reflect' | 'phase' | 'sweep' | 'enrage';
  /** New element after a shift. */
  element?: string;
  /** Technique id (tech events). */
  tech?: string;
  /** Status id and until when it lasts (status, dot events). */
  status?: StatusId;
  until?: number;
  /** A critical hit. */
  crit?: boolean;
  /** Damage a shield caught. */
  absorbed?: number;
  /** Boss trait that woke up (phase events). */
  trait?: string;
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
  /** Row (team; enemies: companions in front of their boss). */
  row?: Row;
  /** Boss of the floor. */
  boss?: boolean;
  /** Wächter of the floor. */
  guard?: boolean;
}

export interface FightResult {
  win: boolean;
  /** All damage the enemy took (hits, techniques, burn, thorns) – the weekly boss counts this. */
  dealt: number;
  /** Fight time in seconds when it ended. */
  seconds: number;
  log: string[];
  fighters: FighterSnapshot[];
  events: FightEvent[];
  /** Totals per fighter (for the defeat analysis). */
  stats: FightStats;
}

// Enough for a long group fight (three foes, five fighters, about 40 s) to replay to the end.
export const MAX_FIGHT_EVENTS = 400;
const maxLog = 24;

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

/** Statuses that hurt; Läuterung removes them. */
const HARMFUL: StatusId[] = ['burn', 'poison', 'stun', 'slow'];

/**
 * Simulates one floor on a time line (Aktionsleiste): every fighter acts when
 * its bar is full, faster ones more often; faster defenders may dodge. Every
 * `techniqueEvery`-th action is the fighter's Element-Technik (enemies every
 * `enemyTechniqueEvery`-th). Statuses and boss traits tick once per second of
 * fight time; a boss with a `phaseTrait` gains it below half HP. The team
 * focuses the weakest foe of the front row (companions shield their boss).
 * Team synergies apply at the start. Team HP is full at the start of every
 * floor. Deterministic for a given RNG state.
 */
export function simulateFight(ctx: GameContext, team: Fighter[], enemies: Fighter | Fighter[], rng: Rng, opts: { limitSec?: number; replay?: boolean; enrage?: boolean } = {}): FightResult {
  const cfg = ctx.balance.tower;
  const foes = Array.isArray(enemies) ? enemies : [enemies];
  const log: string[] = [];
  const events: FightEvent[] = [];
  const order = [...team, ...foes];
  const first = team.length;
  const isFoe = (i: number) => i >= first;
  const intervals = actionIntervals(ctx, order);
  const fighters: FighterSnapshot[] = order.map((f, i) => ({
    name: f.name, speciesId: f.speciesId, element: f.element, maxHp: f.maxHp, team: f.team, interval: intervals[i]!,
    ...(f.team ? { row: f.row ?? 'front' } : f.row ? { row: f.row } : {}), ...(f.boss ? { boss: true } : {}), ...(f.guard ? { guard: true } : {}),
  }));
  // Without replay (fights nobody watches, e.g. offline) the events and the protocol stay empty; the outcome is the same.
  const replay = opts.replay ?? true;
  const note = (line: string) => replay && log.length < maxLog && log.push(line);
  const record = (e: FightEvent) => replay && events.length < MAX_FIGHT_EVENTS && events.push({ ...e, at: Math.round(e.at * 100) / 100 });
  let dealt = 0;
  const zeros = () => order.map(() => 0);
  const stats: FightStats = {
    dealt: zeros(), taken: zeros(), healed: zeros(), hits: zeros(), strong: zeros(), weak: zeros(), missed: zeros(), dodged: zeros(),
    hpLeft: zeros(), downAt: order.map(() => -1), shielded: 0, timeout: false, seconds: 0,
  };
  const done = (win: boolean, seconds: number, timeout = false): FightResult => {
    const secs = Math.round(seconds * 10) / 10;
    Object.assign(stats, { hpLeft: order.map((f) => Math.max(0, f.hp)), timeout, seconds: secs });
    return { win, dealt, seconds: secs, log, fighters, events, stats };
  };
  const traitDef = (id: string | undefined) => (id && ctx.content.bossTraits.has(id) ? ctx.content.bossTraits.get(id) : null);
  // Boss traits per fighter; a phase trait joins below half HP.
  const traits = order.map((f) => [traitDef(f.trait)].filter((t): t is BossTraitDef => !!t));
  const woke = order.map(() => false);
  const hasTrait = (i: number, kind: BossTraitDef['kind']) => traits[i]!.find((t) => t.kind === kind);
  const elements = ctx.content.elements.list.map((e) => e.id);
  const limit = opts.limitSec ?? cfg.maxFightSec;
  const fmt = (sec: number) => `${sec.toFixed(1).replace('.', ',')} s`;
  const leader = foes.find((f) => f.boss) ?? foes[foes.length - 1]!;
  // Wut: enemies hit harder with every second after enrageAfterSec (no hard time limit in the tower).
  const enrageOn = opts.enrage ?? true;
  const wut = (at: number) => (enrageOn && at > cfg.enrageAfterSec ? 1 + cfg.enrageGrowth * (at - cfg.enrageAfterSec) : 1);
  let enraged = false;

  // Synergies: pairs of one element hit harder; a colourful team against the Wandler.
  for (const syn of teamSynergies(ctx, team.map((f) => f.element), leader.trait)) {
    if (!syn.active) continue;
    if (syn.kind === 'pair') for (const f of team) if (f.element === syn.elements[0]) f.atk = Math.round(f.atk * (1 + syn.value));
    if (syn.kind === 'diversity') for (const f of team) f.power *= 1 + syn.value;
  }

  // Status per fighter: until when, strength, the source's attack for damage over time and who put it on.
  const statuses = order.map(() => new Map<StatusId, { until: number; value: number; src: number; by: number }>());
  const has = (i: number, id: StatusId, at: number) => {
    const st = statuses[i]!.get(id);
    return st && st.until > at ? st : undefined;
  };
  const techniques = order.map((f) => (f.technique && (f.team || (!f.boss && cfg.enemyTechniqueEvery > 0)) && ctx.content.techniques.has(f.technique) ? ctx.content.techniques.get(f.technique) : null));
  const actions = order.map(() => 0);
  // Next action time per fighter; everyone starts with an empty bar (Erstschlag: acts right away).
  const next = intervals.map((iv, i) => (order[i]!.firstStrike ? Math.min(iv, 0.05) : iv));
  let tick = 1;
  // Damage each fighter took since the last tick (Regeneration).
  const taken = order.map(() => 0);
  const alive = (list: Fighter[]) => list.filter((x) => x.hp > 0);
  const side = (f: Fighter) => (f.team ? team : foes);
  const foesDown = () => foes.every((f) => f.hp <= 0);
  const teamDown = () => team.every((t) => t.hp <= 0);
  const over = () => foesDown() || teamDown();

  const hurt = (i: number, dmg: number, by: number, at: number) => {
    const wasUp = order[i]!.hp > 0;
    order[i]!.hp -= dmg;
    taken[i]! += dmg;
    if (isFoe(i)) dealt += dmg;
    stats.taken[i]! += dmg;
    stats.dealt[by]! += dmg;
    if (wasUp && order[i]!.hp <= 0) stats.downAt[i] = Math.round(at * 100) / 100;
  };

  /** Phase 2: a boss gets its second trait once it drops below half HP. */
  const checkPhase = (i: number, at: number) => {
    const f = order[i]!;
    if (woke[i] || !f.phaseTrait || f.hp <= 0 || f.hp > f.maxHp * cfg.phaseAt) return;
    const t = traitDef(f.phaseTrait);
    woke[i] = true;
    if (!t) return;
    traits[i]!.push(t);
    record({ at, a: i, t: i, dmg: 0, hp: f.hp, m: 1, kind: 'phase', trait: t.id });
    note(`${fmt(at)} · ${f.name} erwacht: ${t.icon} ${t.name}`);
  };

  /** Damage lands on `ti` (after dodging): shield, reflect/thorns. */
  const land = (ai: number, ti: number, dmg: number, at: number, extra: Partial<FightEvent>): void => {
    const target = order[ti]!;
    const shield = has(ti, 'shield', at);
    let absorbed = 0;
    if (shield) {
      absorbed = Math.min(shield.value, dmg);
      shield.value -= absorbed;
      if (shield.value <= 0) statuses[ti]!.delete('shield');
    }
    const hpDmg = dmg - absorbed;
    hurt(ti, hpDmg, ai, at);
    record({ at, a: ai, t: ti, dmg: hpDmg, hp: Math.max(0, target.hp), m: elementMultiplier(ctx, order[ai]!.element, target.element), ...(absorbed ? { absorbed } : {}), ...extra });
    // Dornenhaut and Prisma: a share of the damage goes back to the attacker.
    const back = Math.round(dmg * ((target.thorns ?? 0) + (has(ti, 'reflect', at)?.value ?? 0)));
    if (back > 0 && order[ai]!.hp > 0 && target !== order[ai]) {
      hurt(ai, back, ti, at);
      record({ at, a: ti, t: ai, dmg: back, hp: Math.max(0, order[ai]!.hp), m: 1, kind: 'reflect' });
      checkPhase(ai, at);
    }
    checkPhase(ti, at);
  };

  /** Heals `ti` by `amount` (capped at max HP). */
  const heal = (ai: number, ti: number, amount: number, at: number) => {
    const f = order[ti]!;
    const healed = Math.min(f.maxHp - f.hp, Math.round(amount));
    if (healed <= 0 || f.hp <= 0) return;
    f.hp += healed;
    stats.healed[ti]! += healed;
    record({ at, a: ai, t: ti, dmg: healed, hp: f.hp, m: 1, kind: 'heal' });
  };

  const addStatus = (ai: number, ti: number, id: StatusId, duration: number, value: number, at: number) => {
    const f = order[ti]!;
    let until = at + duration;
    let v = value;
    if (id === 'stun') {
      // Betäubung: the next action slips back by `value` own intervals.
      next[ti] = next[ti]! + intervals[ti]! * value;
      until = next[ti]!;
    }
    if (id === 'shield') v = Math.round(value * f.maxHp);
    statuses[ti]!.set(id, { until, value: v, src: order[ai]!.atk * order[ai]!.power, by: ai });
    record({ at, a: ai, t: ti, dmg: 0, hp: Math.max(0, f.hp), m: 1, kind: 'status', status: id, until: Math.round(until * 100) / 100 });
  };

  /** Whom an attacker hits: the team focuses the weakest foe of the front row, foes follow their targeting. */
  const targetFor = (ai: number): Fighter => {
    const att = order[ai]!;
    if (att.team) {
      const up = alive(foes);
      const front = up.filter((f) => f.row !== 'back');
      return (front.length ? front : up).reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a));
    }
    const mode = traits[ai]![0]?.targeting ?? 'rows';
    return pickTarget(ctx, mode, alive(team), rng);
  };

  /** One hit (or technique hit) from `ai` on `ti`; returns false if it was dodged. */
  const strike = (ai: number, ti: number, at: number, mult: number, extra: Partial<FightEvent>): boolean => {
    const att = order[ai]!;
    const target = order[ti]!;
    const m = elementMultiplier(ctx, att.element, target.element);
    const evade = Math.min(0.6, evadeChance(ctx, att, target) + (has(ti, 'evade', at)?.value ?? 0));
    if (rng.chance(evade)) {
      stats.missed[ai]!++;
      stats.dodged[ti]!++;
      record({ at, a: ai, t: ti, dmg: 0, hp: target.hp, m, kind: 'miss', ...(extra.tech ? { tech: extra.tech } : {}) });
      return false;
    }
    const armor = has(ti, 'armor', at);
    let dmg = damage(ctx, att, armor ? { ...target, def: target.def * (1 + armor.value) } : target, rng);
    const crit = (att.crit ?? 0) > 0 && rng.chance(att.crit!);
    if (crit) dmg = Math.round(dmg * cfg.critMult);
    if (mult !== 1) dmg = Math.max(mult > 0 ? 1 : 0, Math.round(dmg * mult));
    // Element-Schild: only hits with element advantage get through in full.
    const shield = hasTrait(ti, 'shield');
    if (att.team && shield && m <= 1 && dmg > 0) {
      const kept = Math.max(1, Math.round(dmg * shield.value));
      stats.shielded += dmg - kept;
      dmg = kept;
    }
    if (!att.team && dmg > 0) dmg = Math.round(dmg * wut(at));
    stats.hits[ai]!++;
    if (m > 1) stats.strong[ai]!++;
    if (m < 1) stats.weak[ai]!++;
    land(ai, ti, dmg, at, { ...extra, ...(crit ? { crit: true } : {}) });
    return true;
  };

  const finish = (at: number): FightResult | null => {
    if (foesDown()) {
      log.push(`${foes.length > 1 ? 'Alle Gegner' : leader.name} besiegt nach ${fmt(at)}`);
      return done(true, at);
    }
    if (teamDown()) {
      log.push(`Team besiegt nach ${fmt(at)}`);
      return done(false, at);
    }
    return null;
  };

  for (;;) {
    // The next actor: earliest full bar, ties to the faster one, then team before enemies.
    let who = -1;
    for (let i = 0; i < order.length; i++) {
      if (order[i]!.hp <= 0) continue;
      if (who < 0 || next[i]! < next[who]! - 1e-9 || (Math.abs(next[i]! - next[who]!) < 1e-9 && order[i]!.spd > order[who]!.spd)) who = i;
    }
    const now = next[who]!;
    // Boss traits and statuses tick every full second of fight time before this action.
    while (tick <= now && tick <= limit) {
      if (enrageOn && !enraged && tick > cfg.enrageAfterSec) {
        enraged = true;
        const i = order.findIndex((f, k) => isFoe(k) && f.hp > 0);
        if (i >= 0) record({ at: cfg.enrageAfterSec, a: i, t: i, dmg: 0, hp: order[i]!.hp, m: 1, kind: 'enrage' });
        note(`${fmt(cfg.enrageAfterSec)} · Die Gegner werden wütend`);
      }
      for (let i = first; i < order.length; i++) {
        const f = order[i]!;
        if (f.hp > 0 && hasTrait(i, 'shift')) {
          f.element = elements[(elements.indexOf(f.element) + 1) % elements.length]!;
          record({ at: tick, a: i, t: i, dmg: 0, hp: f.hp, m: 1, kind: 'shift', element: f.element });
          note(`${fmt(tick)} · ${f.name} wechselt zu ${ctx.content.elements.get(f.element).name}`);
        }
      }
      for (let i = 0; i < order.length; i++) {
        const f = order[i]!;
        if (f.hp <= 0) continue;
        for (const [id, st] of statuses[i]!) {
          if (id === 'burn' || id === 'poison') {
            // Damage over time, reduced like a hit by the percentage part of the defence.
            let dmg = Math.max(1, Math.round(st.src * st.value * defFactor(ctx, f.def, st.src) * (order[st.by]!.team ? 1 : wut(tick))));
            // The Element-Schild also dampens burn and poison from a source without element advantage.
            const shield = hasTrait(i, 'shield');
            if (shield && order[st.by]!.team && elementMultiplier(ctx, order[st.by]!.element, f.element) <= 1) {
              const kept = Math.max(1, Math.round(dmg * shield.value));
              stats.shielded += dmg - kept;
              dmg = kept;
            }
            hurt(i, dmg, st.by, tick);
            record({ at: tick, a: i, t: i, dmg, hp: Math.max(0, f.hp), m: 1, kind: 'dot', status: id });
            checkPhase(i, tick);
          }
          if (id === 'regen') heal(i, i, st.value * f.maxHp, tick);
          if (st.until <= tick) statuses[i]!.delete(id);
        }
      }
      // Regeneration heals a share of the damage taken since the last tick. Scaling with
      // the team's damage (not the boss's max HP) keeps it equally hard on every floor.
      for (let i = first; i < order.length; i++) {
        const f = order[i]!;
        const regen = hasTrait(i, 'regen');
        if (!regen || f.hp <= 0) continue;
        const healed = Math.min(f.maxHp - f.hp, Math.round(taken[i]! * regen.value));
        if (healed > 0) {
          f.hp += healed;
          stats.healed[i]! += healed;
          record({ at: tick, a: i, t: i, dmg: healed, hp: f.hp, m: 1, kind: 'heal' });
          note(`${fmt(tick)} · ${f.name} heilt ${healed}`);
        }
      }
      taken.fill(0);
      if (over()) break;
      tick++;
    }
    const ended = over() ? finish(tick) : null;
    if (ended) return ended;
    if (now > limit) {
      log.push('Zeit abgelaufen');
      return done(false, limit, true);
    }
    // Burn or poison may have finished the actor off during the ticks.
    if (order[who]!.hp <= 0) continue;
    const att = order[who]!;
    // Verlangsamt: this turn takes longer.
    next[who] = now + intervals[who]! * (1 + (has(who, 'slow', now)?.value ?? 0));
    actions[who]!++;

    // Flächenangriff: every sweepEvery-th action the boss hits the whole back row (or everyone, if nobody stands back).
    const sweep = hasTrait(who, 'sweep');
    if (sweep && actions[who]! % cfg.sweepEvery === 0) {
      const up = alive(team);
      const back = up.filter((f) => f.row === 'back');
      const targets = back.length ? back : up;
      record({ at: now, a: who, t: order.indexOf(targets[0]!), dmg: 0, hp: targets[0]!.hp, m: 1, kind: 'sweep' });
      note(`${fmt(now)} · ${att.name}: ${sweep.icon} ${sweep.name}`);
      for (const tgt of targets) strike(who, order.indexOf(tgt), now, sweep.value, {});
      const res = finish(now);
      if (res) return res;
      continue;
    }

    const tech = techniques[who] && actions[who]! % (order[who]!.team ? cfg.techniqueEvery : cfg.enemyTechniqueEvery) === 0 ? techniques[who]! : null;
    if (tech && tech.target !== 'enemy') {
      // Support techniques: no dice for dodging.
      const own = alive(side(att));
      const targets = tech.target === 'self' ? [att] : tech.target === 'team' ? own : [own.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a))];
      record({ at: now, a: who, t: order.indexOf(targets[0]!), dmg: 0, hp: Math.max(0, targets[0]!.hp), m: 1, kind: 'tech', tech: tech.id });
      note(`${fmt(now)} · ${att.name}: ${tech.icon} ${tech.name}`);
      for (const tgt of targets) {
        const ti = order.indexOf(tgt);
        if (tech.cleanse) for (const id of HARMFUL) statuses[ti]!.delete(id);
        if (tech.heal) heal(who, ti, tech.heal * tgt.maxHp, now);
        if (tech.status) addStatus(who, ti, tech.status.id, tech.status.duration, tech.status.value, now);
      }
      continue;
    }

    const target = targetFor(who);
    const ti = order.indexOf(target);
    const hit = strike(who, ti, now, tech ? tech.hit : 1, tech ? { kind: 'tech', tech: tech.id } : {});
    if (!hit) note(`${fmt(now)} · ${target.name} weicht ${tech ? `${tech.name} von ` : ''}${att.name} aus`);
    else {
      if (tech?.status && target.hp > 0) addStatus(who, ti, tech.status.id, tech.status.duration, tech.status.value, now);
      note(`${fmt(now)} · ${att.name} ${tech ? `${tech.icon} ${tech.name}` : 'trifft'}${att.team && foes.length === 1 ? '' : ` ${target.name}`}`);
    }
    const res = finish(now);
    if (res) return res;
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
  ctx.state.tower.back = ctx.state.tower.back.filter((id) => unique.includes(id));
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

/**
 * Turm-Marken for clearing a floor. The amount per floor may be a fraction
 * (tokensPerFloor × (1 + growth × (floor − 1))); paying the step of the
 * rounded running sum gives whole numbers that add up to exactly that.
 */
export function floorTokens(ctx: GameContext, floor: number): Decimal {
  const t = ctx.balance.tower;
  const total = (f: number) => (f <= 0 ? 0 : Math.round(t.tokensPerFloor * (f + (t.tokenGrowthPerFloor * f * (f - 1)) / 2)));
  return D(Math.max(0, total(floor) - total(floor - 1)));
}

/** Side-effect-free preview of what clearing a floor pays. */
export function floorRewardInfo(ctx: GameContext, floor: number): { tokens: Decimal; catalyst: number; allele: boolean; boss: boolean; guard: boolean; checkpoint: boolean; milestone: boolean } {
  const t = ctx.balance.tower;
  const alleleFloor = floor % t.alleleEvery === 0;
  const allele = alleleFloor && missingRareAlleles(ctx).length > 0;
  let tokens = floorTokens(ctx, floor);
  if (alleleFloor && !allele) tokens = tokens.mul(2);
  return {
    tokens,
    catalyst: floor % t.catalystEvery === 0 ? 1 + Math.floor(floor / (t.catalystEvery * 5)) : 0,
    allele,
    boss: isBossFloor(ctx, floor),
    guard: isGuardFloor(ctx, floor),
    checkpoint: floor % t.checkpointEvery === 0,
    milestone: floor % t.milestoneEvery === 0,
  };
}

function floorRewards(ctx: GameContext, floor: number): { rewards: Record<string, Decimal>; allele: { locus: string; allele: string } | null } {
  const t = ctx.balance.tower;
  const rewards: Record<string, Decimal> = {};
  rewards['towerTokens'] = floorTokens(ctx, floor);
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

/** Fights the next floor of the running tower run (`replay`: keep the events for the arena). */
export function fightNextFloor(ctx: GameContext, replay = true): void {
  const tw = ctx.state.tower;
  const run = tw.run;
  if (!run) return;
  const team = run.team.map((id) => findCreature(ctx, id)).filter((c): c is Creature => !!c);
  if (team.length === 0) return endRun(ctx);
  const floor = run.floor + 1;
  const result = simulateFight(ctx, team.map((c) => fighterFor(ctx, c)), enemiesFor(ctx, floor), ctx.rng, { replay });
  tw.lastResult = { floor, win: result.win, log: result.log, fighters: result.fighters, events: result.events, stats: result.stats, at: ctx.state.lastTickAt };
  if (!result.win) {
    tw.lastDefeat = { floor, at: ctx.state.lastTickAt, fighters: result.fighters, stats: result.stats };
    ctx.bus.emit('towerFloor', { floor, win: false, rewards: {}, allele: null });
    endRun(ctx);
    return;
  }
  run.floor = floor;
  gainXp(ctx, floor);
  // First-time rewards follow the highest record ever, so a lowered record does not pay twice.
  const record = floor > towerBestEver(ctx);
  if (floor > tw.best) {
    // A new record: the Entschlossenheit starts over.
    tw.recordAt = ctx.state.lastTickAt;
    if (tw.resolve) {
      tw.resolve = 0;
      ctx.invalidate();
    }
  }
  tw.best = Math.max(tw.best, floor);
  tw.bestEver = Math.max(tw.bestEver ?? 0, tw.best);
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
    if (!ctx.state.features['tower']) return;
    // Entschlossenheit grows by the hour while the record stands still.
    if (!tw.recordAt) tw.recordAt = ctx.state.lastTickAt;
    const resolve = resolveInfo(ctx).bonus;
    if (resolve !== (tw.resolve ?? 0)) {
      tw.resolve = resolve;
      ctx.invalidate();
    }
    const interval = fightIntervalMs(ctx);
    if (!tw.run) {
      // Auto-restart (tower upgrade) after a defeat, where the last run started (checkpoint or floor 1).
      if (tw.autoRestart && ctx.state.features['towerAuto'] && tw.team.length > 0) startRun(ctx, tw.restartFromCheckpoint);
      return;
    }
    tw.run.elapsedMs += dtMs;
    while (tw.run && tw.run.elapsedMs >= interval) {
      tw.run.elapsedMs -= interval;
      // A long step (offline) fights many floors at once: only the last one is replayed in the arena.
      fightNextFloor(ctx, tw.run.elapsedMs < interval);
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

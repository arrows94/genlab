import { D, type Decimal } from '../num';
import { creatureModifiers, effectiveStats, findCreature, isOccupied } from '../creatures';
import { activeLoci, catalogueGenome, libraryHas } from '../genetics';
import { grant } from '../resources';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature, FightStats } from '../state';
import type { System } from '../systems/types';
import type { RelicDef, TargetingMode } from '../content/types';
import type { ModifierProvider } from '../providers';
import { simulateFight, type Fighter, type Row } from './towerCombat';
import {
  courseCheckpoint, courseEnemies, courseEnemy, courseFloorTokens, courseFloorsToBoss, isCourseBossFloor, isCourseGuardFloor, techniqueFor, towerCourse,
} from './floors';

// The fight engine lives in towerCombat.ts; callers keep importing it from here.
export {
  MAX_FIGHT_EVENTS, actionIntervals, damage, defFactor, elementMultiplier, enrageFactor, evadeChance, pickTarget, simulateFight, teamSynergies,
} from './towerCombat';
export type { FightEvent, FightResult, Fighter, FighterSnapshot, Row, Synergy } from './towerCombat';
// Enemy curves of endless courses live in floors.ts.
export { techniqueFor } from './floors';

/**
 * Genom-Turm: an endless auto-battle. A team of 3–5 creatures fights floor
 * after floor every `fightIntervalSec`; enemies scale endlessly and element
 * strengths/weaknesses matter. Fights run on an Aktionsleiste: speed decides
 * how often a fighter acts and how often it dodges. A defeat ends the run (it goes on the personal
 * leaderboard); the next run may start from the last checkpoint. The fight
 * itself is simulated in `towerCombat.ts`.
 */

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

/** Boss floor of the tower: every `bossEvery`-th. */
export function isBossFloor(ctx: GameContext, floor: number): boolean {
  return isCourseBossFloor(towerCourse(ctx), floor);
}

/** Wächter floor of the tower: every `guardEvery`-th that is not a boss floor. */
export function isGuardFloor(ctx: GameContext, floor: number): boolean {
  return isCourseGuardFloor(towerCourse(ctx), floor);
}

/**
 * Enemy for a tower floor – deterministic per floor, independent of the game RNG.
 * `plain` leaves out the boss and Wächter multipliers and the trait (the
 * weekly titan follows the floor's normal strength).
 */
export function enemyFor(ctx: GameContext, floor: number, opts: { plain?: boolean } = {}): Fighter {
  return courseEnemy(ctx, towerCourse(ctx), floor, opts);
}

/** Everyone the team meets on a tower floor (see `courseEnemies`). */
export function enemiesFor(ctx: GameContext, floor: number): Fighter[] {
  return courseEnemies(ctx, towerCourse(ctx), floor);
}

/** Relikt in the team place of this creature, with its effective level incl. Veredelung (null if none). */
export function relicFor(ctx: GameContext, c: Creature): { def: RelicDef; level: number } | null {
  const slot = ctx.state.tower.team.indexOf(c.id);
  const id = slot >= 0 ? ctx.state.tower.relicSlots[slot] : null;
  if (!id || !ctx.content.relics.has(id)) return null;
  const level = relicPower(ctx, id);
  return level > 0 ? { def: ctx.content.relics.get(id), level } : null;
}

/** Dunkles Relikt in the tower or cellar team place of this creature, with its level (null if none). */
export function darkRelicFor(ctx: GameContext, c: Creature, course: 'tower' | 'cellar'): { def: RelicDef; level: number } | null {
  const team = course === 'tower' ? ctx.state.tower.team : ctx.state.cellar.team;
  const slots = course === 'tower' ? ctx.state.tower.darkSlots : ctx.state.cellar.relicSlots;
  const slot = team.indexOf(c.id);
  const id = slot >= 0 ? slots[slot] : null;
  if (!id || !ctx.content.darkRelics.has(id)) return null;
  const level = relicLevel(ctx, id);
  return level > 0 ? { def: ctx.content.darkRelics.get(id), level } : null;
}

/** Everything a creature wears in a course: the relic and the dark relic in the tower, only the dark one in the cellar. */
function relicsFor(ctx: GameContext, c: Creature, course: 'tower' | 'cellar'): { def: RelicDef; level: number }[] {
  return [course === 'tower' ? relicFor(ctx, c) : null, darkRelicFor(ctx, c, course)].filter((r): r is { def: RelicDef; level: number } => !!r);
}

/** A creature as a fighter of the tower (or, with its dark relic only, of the cellar). */
export function fighterFor(ctx: GameContext, c: Creature, course: 'tower' | 'cellar' = 'tower'): Fighter {
  const s = effectiveStats(ctx, c);
  const own = creatureModifiers(ctx, c);
  const global = ctx.mods();
  const worn = relicsFor(ctx, c, course);
  const boost = (key: keyof RelicDef['bonus']) => worn.reduce((f, r) => f * Math.max(0.1, 1 + (r.def.bonus[key] ?? 0) * r.level), 1);
  // Entschlossenheit is the tower's answer to a standing record – it does not follow the team into the cellar.
  const resolve = course === 'cellar' ? (ctx.state.tower.resolve ?? 0) : 0;
  const towerFactor = (target: string) => {
    if (!resolve) return global.factor(target);
    const t = global.totals(target);
    return (1 + t.add) * (1 + t.pct - resolve) * t.mult;
  };
  const hp = Math.round((s.hp ?? 1) * boost('hp') * towerFactor('tower.hp') * own.factor('tower.hp'));
  return {
    name: c.name,
    speciesId: c.speciesId,
    element: ctx.content.species.get(c.speciesId).element,
    hp,
    maxHp: hp,
    atk: Math.round((s.atk ?? 1) * boost('atk')),
    def: Math.round((s.def ?? 0) * boost('def')),
    spd: Math.round((s.spd ?? 1) * boost('spd')),
    power: towerFactor('tower.damage') * own.factor('tower.damage'),
    elementPower: global.factor('tower.elementDamage') * own.factor('tower.elementDamage') * boost('element'),
    team: true,
    row: rowOf(ctx, c.id),
    technique: techniqueFor(ctx, ctx.content.species.get(c.speciesId).element)?.id,
    crit: own.apply('tower.crit', 0) + global.apply('tower.crit', 0),
    thorns: own.apply('tower.thorns', 0) + global.apply('tower.thorns', 0),
    firstStrike: own.apply('tower.firstStrike', 0) + global.apply('tower.firstStrike', 0) >= 1,
  };
}

// ---- Relikte --------------------------------------------------------------

/** Levels bought, Veredelungen included (a refined relic stands above its `maxLevel`). */
export function relicLevel(ctx: GameContext, id: string): number {
  return ctx.state.relics[id] ?? 0;
}

/** Veredelung: only the tower's relics (Turm-Marken) go beyond their highest level, dark relics stop there. */
export function canRefine(ctx: GameContext, id: string): boolean {
  return ctx.content.relics.has(id);
}

/** Veredelungen bought so far (levels above `maxLevel`). */
export function relicRefinement(ctx: GameContext, id: string): number {
  return Math.max(0, relicLevel(ctx, id) - relicDef(ctx, id).maxLevel);
}

/** Level the bonus counts with: the regular levels, then each Veredelung a little less (share × n^levelPower). */
export function relicPower(ctx: GameContext, id: string, level = relicLevel(ctx, id)): number {
  const def = relicDef(ctx, id);
  const n = Math.max(0, level - def.maxLevel);
  const r = ctx.balance.tower.refine;
  return Math.min(level, def.maxLevel) + (n > 0 ? r.share * Math.pow(n, r.levelPower) : 0);
}

/** A relic or dark relic by id. */
export function relicDef(ctx: GameContext, id: string): RelicDef {
  return ctx.content.relics.has(id) ? ctx.content.relics.get(id) : ctx.content.darkRelics.get(id);
}

/** Resource a relic is bought with. */
export function relicCurrency(def: RelicDef): string {
  return def.currency ?? 'towerTokens';
}

/** Price of the next level or Veredelung in its currency (null at the maximum of a relic that cannot be refined). */
export function relicCost(ctx: GameContext, id: string): Decimal | null {
  const def = relicDef(ctx, id);
  const level = relicLevel(ctx, id);
  if (level < def.maxLevel) return D(def.cost).mul(D(def.costGrowth).pow(level)).ceil();
  if (!canRefine(ctx, id)) return null;
  // Veredelung n (1, 2 …) costs the last regular level × costGrowth^n: flat, so it keeps taking Turm-Marken.
  const last = D(def.cost).mul(D(def.costGrowth).pow(def.maxLevel - 1));
  return last.mul(D(ctx.balance.tower.refine.costGrowth).pow(level - def.maxLevel + 1)).ceil();
}

export function buyRelic(ctx: GameContext, id: string): ActionResult {
  const dark = ctx.content.darkRelics.has(id);
  if (!dark && !ctx.state.features['tower']) return { ok: false, reason: 'Der Genom-Turm ist noch nicht freigeschaltet.' };
  if (dark && !ctx.state.features['cellar']) return { ok: false, reason: 'Der Genom-Keller ist noch nicht freigeschaltet.' };
  const cost = relicCost(ctx, id);
  if (!cost) return { ok: false, reason: 'Das Relikt ist bereits auf der höchsten Stufe.' };
  const currency = relicCurrency(relicDef(ctx, id));
  const owned = ctx.state.resources[currency] ?? D(0);
  if (owned.lt(cost)) return { ok: false, reason: `Nicht genug ${ctx.content.resources.get(currency).name}.` };
  ctx.state.resources[currency] = owned.sub(cost);
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

/**
 * Puts a dark relic into the dark place of a tower or cellar team place (null clears it). It sits in one place
 * per course at most – the same relic may be worn in the tower and in the cellar at once.
 */
export function equipDarkRelic(ctx: GameContext, course: 'tower' | 'cellar', slot: number, id: string | null): ActionResult {
  if (!ctx.state.features['cellar']) return { ok: false, reason: 'Der Genom-Keller ist noch nicht freigeschaltet.' };
  if ((course === 'tower' ? ctx.state.tower.run : ctx.state.cellar.run)) return { ok: false, reason: 'Während eines Laufs nicht änderbar.' };
  if (!Number.isInteger(slot) || slot < 0 || slot >= teamSize(ctx)) return { ok: false, reason: 'Diesen Platz gibt es nicht.' };
  if (id !== null && (!ctx.content.darkRelics.has(id) || relicLevel(ctx, id) < 1)) return { ok: false, reason: 'Dieses dunkle Relikt besitzt du noch nicht.' };
  const slots = course === 'tower' ? ctx.state.tower.darkSlots : ctx.state.cellar.relicSlots;
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

/** Floors until the next boss floor (0 = the given floor is one). */
export function floorsToBoss(ctx: GameContext, floor: number): number {
  return courseFloorsToBoss(towerCourse(ctx), floor);
}

/** Floor of the next tower milestone. */
export function nextMilestoneFloor(ctx: GameContext): number {
  return (towerMilestones(ctx) + 1) * ctx.balance.tower.milestoneEvery;
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
  tw.retreat = 0;
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

/** Time per floor in ms (Äon talent „Sturmlauf“ shortens it). */
export function fightIntervalMs(ctx: GameContext): number {
  return Math.max(1000, ctx.mods().apply('tower.interval', ctx.balance.tower.fightIntervalSec) * 1000);
}

export function checkpoint(ctx: GameContext): number {
  return courseCheckpoint(towerCourse(ctx), ctx.state.tower.best);
}

/** Where the next auto-restart from the checkpoint begins: the checkpoint, minus the checkpoints it stepped back. */
export function restartCheckpoint(ctx: GameContext): number {
  return Math.max(0, checkpoint(ctx) - (ctx.state.tower.retreat ?? 0) * ctx.balance.tower.checkpointEvery);
}

export function setTeam(ctx: GameContext, ids: number[]): ActionResult {
  if (!ctx.state.features['tower']) return { ok: false, reason: 'Der Genom-Turm ist noch nicht freigeschaltet.' };
  if (ctx.state.tower.run) return { ok: false, reason: 'Während eines Laufs nicht änderbar.' };
  // Ids of creatures that no longer exist are dropped instead of blocking the change.
  const unique = [...new Set(ids)].filter((id) => findCreature(ctx, id));
  if (unique.length > teamSize(ctx)) return { ok: false, reason: `Höchstens ${teamSize(ctx)} Kreaturen.` };
  const inCellar = unique.find((id) => ctx.state.cellar.team.includes(id));
  if (inCellar !== undefined) return { ok: false, reason: `${findCreature(ctx, inCellar)!.name} steht schon im Keller-Team.` };
  ctx.state.tower.team = unique;
  ctx.state.tower.back = ctx.state.tower.back.filter((id) => unique.includes(id));
  return { ok: true };
}

/** `auto`: the auto-restart (it may begin below the checkpoint, see `retreat`); a start by hand tries the real checkpoint. */
export function startRun(ctx: GameContext, fromCheckpoint = true, auto = false): ActionResult {
  const tw = ctx.state.tower;
  if (!ctx.state.features['tower']) return { ok: false, reason: 'Der Genom-Turm ist noch nicht freigeschaltet.' };
  if (tw.run) return { ok: false, reason: 'Es läuft bereits ein Lauf.' };
  const team = tw.team.map((id) => findCreature(ctx, id)).filter((c): c is Creature => !!c);
  if (team.length === 0) return { ok: false, reason: 'Stelle zuerst ein Team zusammen.' };
  const busy = team.find(isOccupied);
  if (busy) return { ok: false, reason: `${busy.name} ist beschäftigt.` };
  for (const c of team) c.job = { kind: 'tower', target: 'team' };
  if (!auto) tw.retreat = 0;
  const start = fromCheckpoint ? restartCheckpoint(ctx) : 0;
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

/** Turm-Marken for clearing a floor (whole numbers, see `courseFloorTokens`). */
export function floorTokens(ctx: GameContext, floor: number): Decimal {
  return courseFloorTokens(towerCourse(ctx), floor);
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
    // Evolutionskristalle only for a new highest floor (a retreat would otherwise pay them again and again).
    catalyst: floor % t.catalystEvery === 0 && floor > towerBestEver(ctx) ? 1 + Math.floor(floor / (t.catalystEvery * 5)) : 0,
    allele,
    boss: isBossFloor(ctx, floor),
    guard: isGuardFloor(ctx, floor),
    checkpoint: floor % t.checkpointEvery === 0,
    milestone: floor % t.milestoneEvery === 0,
  };
}

function floorRewards(ctx: GameContext, floor: number, record: boolean): { rewards: Record<string, Decimal>; allele: { locus: string; allele: string } | null } {
  const t = ctx.balance.tower;
  const rewards: Record<string, Decimal> = {};
  rewards['towerTokens'] = floorTokens(ctx, floor);
  if (record && floor % t.catalystEvery === 0) rewards['catalyst'] = D(1 + Math.floor(floor / (t.catalystEvery * 5)));
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
    // Lost right at the start: the next auto-restart begins one checkpoint lower, so the team keeps winning
    // floors (and Kampferfahrung) instead of failing at the checkpoint again and again.
    if (floor === run.startFloor && run.floor > 0) tw.retreat = Math.min((tw.retreat ?? 0) + 1, checkpoint(ctx) / ctx.balance.tower.checkpointEvery);
    ctx.bus.emit('towerFloor', { floor, win: false, rewards: {}, allele: null });
    endRun(ctx);
    return;
  }
  run.floor = floor;
  gainXp(ctx, floor);
  // A cleared checkpoint floor: the auto-restart climbs back up to it.
  const every = ctx.balance.tower.checkpointEvery;
  if (tw.retreat && floor % every === 0) tw.retreat = Math.min(tw.retreat, Math.max(0, (checkpoint(ctx) - floor) / every));
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
  const { rewards, allele } = floorRewards(ctx, floor, record);
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
      if (tw.autoRestart && ctx.state.features['towerAuto'] && tw.team.length > 0) startRun(ctx, tw.restartFromCheckpoint, true);
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

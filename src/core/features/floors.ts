import { D, type Decimal } from '../num';
import { Rng, hashSeed } from '../rng';
import type { GameContext } from '../context';
import type { FloorCurve } from '../content/balance';
import type { TechniqueDef } from '../content/types';
import type { Fighter } from './towerCombat';

/**
 * Endless floor courses: the Genom-Turm today, the Genom-Keller later. A
 * course is its enemy curve (`FloorCurve` in balance.ts) plus the seed
 * prefix of its dice, so two courses with the same numbers still meet
 * different foes. Everything here is deterministic per floor and independent
 * of the game RNG; the fight itself is `simulateFight` in `towerCombat.ts`.
 */
export interface Course {
  id: string;
  /** Seed prefix of the floor dice (`tower` for the Genom-Turm – changing it changes every floor). */
  dice: string;
  curve: FloorCurve;
}

/** The Genom-Turm as a course. */
export function towerCourse(ctx: GameContext): Course {
  return { id: 'tower', dice: 'tower', curve: ctx.balance.tower };
}

/**
 * Dice for a floor. The small floors of a former floor n share its element and group size (`step`
 * seeded with n, as before the finer floors), so the course is not more jagged than it was; floor 3n is
 * exactly the former floor n. The floors in between pick their species with dice of their own (`own`).
 */
function floorDice(prefix: string, per: number, floor: number): { step: Rng; own: Rng } {
  const step = Rng.fromSeed(hashSeed(`${prefix}-${Math.ceil(floor / per)}`));
  return { step, own: floor % per === 0 ? step : Rng.fromSeed(hashSeed(`${prefix}-${floor}/${per}`)) };
}

/** Boss floor: every `bossEvery`-th. */
export function isCourseBossFloor(course: Course, floor: number): boolean {
  return floor % course.curve.bossEvery === 0;
}

/** Wächter floor: every `guardEvery`-th that is not a boss floor. */
export function isCourseGuardFloor(course: Course, floor: number): boolean {
  const every = course.curve.guardEvery;
  return every > 0 && floor % every === 0 && !isCourseBossFloor(course, floor);
}

/** Floors until the next boss floor (0 = the given floor is one). */
export function courseFloorsToBoss(course: Course, floor: number): number {
  const every = course.curve.bossEvery;
  return every - (floor % every || every);
}

/** Last checkpoint at or below a record. */
export function courseCheckpoint(course: Course, best: number): number {
  const every = course.curve.checkpointEvery;
  return Math.floor(best / every) * every;
}

/**
 * Tokens for clearing a floor. The amount per floor may be a fraction
 * (tokensPerFloor × (1 + growth × (floor − 1))); paying the step of the
 * rounded running sum gives whole numbers that add up to exactly that.
 */
export function courseFloorTokens(course: Course, floor: number): Decimal {
  const t = course.curve;
  const total = (f: number) => (f <= 0 ? 0 : Math.round(t.tokensPerFloor * (f + (t.tokenGrowthPerFloor * f * (f - 1)) / 2)));
  return D(Math.max(0, total(floor) - total(floor - 1)));
}

/** The Element-Technik of an element. */
export function techniqueFor(ctx: GameContext, element: string): TechniqueDef | undefined {
  return ctx.content.techniques.list.find((t) => t.element === element);
}

/**
 * Enemy for a floor of a course. `plain` leaves out the boss and Wächter
 * multipliers and the trait (the weekly titan follows the floor's normal strength).
 */
export function courseEnemy(ctx: GameContext, course: Course, floor: number, opts: { plain?: boolean } = {}): Fighter {
  const t = course.curve;
  const { step: rng, own } = floorDice(course.dice, t.subFloors, floor);
  const element = rng.pick(ctx.content.elements.list).id;
  const scale = Math.pow(t.enemyGrowth, floor - t.subFloors);
  const boss = !opts.plain && isCourseBossFloor(course, floor);
  const guard = !opts.plain && isCourseGuardFloor(course, floor);
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
 * Everyone the team meets on a floor of a course. On a Wächter floor every
 * foe is stronger, the first one is the Wächter. Normal floors from
 * `groupFromFloor` on may bring 2–3 foes that share the floor's strength;
 * boss floors from `companionsFromFloor` on bring two companions in front of
 * the boss, and from `phaseFromFloor` on the boss wakes a second trait below
 * half HP.
 */
export function courseEnemies(ctx: GameContext, course: Course, floor: number): Fighter[] {
  const t = course.curve;
  const main = courseEnemy(ctx, course, floor);
  const { step: rng, own } = floorDice(`${course.dice}-group`, t.subFloors, floor);
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
  // The small floors of a former floor share its group size (thresholds from its floor 3n).
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

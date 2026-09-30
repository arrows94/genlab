import { Rng } from '@core/rng';
import { elementMultiplier, enemiesFor, enemyFor, fightLimitSec, simulateFight, techniqueFor, type Fighter } from '@core/features/tower';
import type { Game } from '@core/game';

/**
 * Measures the tower curve: how strong a fixed team must be (a factor k on
 * KP, ANG, VER, and √k on TMP – enemies grow the same way) to win a floor in
 * half of the fights. A boss wall is the factor of the boss floor over the
 * floors before it, in former floors (×1.11 per former floor).
 */
export type TeamKind = 'mixed' | 'advantage' | 'neutral';

const MIXED = ['fire', 'water', 'earth', 'air'];

function teamElements(g: Game, kind: TeamKind, foe: string): string[] {
  if (kind === 'mixed') return MIXED;
  const els = g.content.elements.list.map((e) => e.id);
  const pick = els.find((e) => (kind === 'advantage' ? elementMultiplier(g, e, foe) > 1 : elementMultiplier(g, e, foe) === 1 && elementMultiplier(g, foe, e) === 1))!;
  return [pick, pick, pick, pick];
}

function team(g: Game, elements: string[], k: number): Fighter[] {
  return elements.map((el, i) => ({
    name: `t${i}`, speciesId: 'emberpup', element: el, hp: 3000 * k, maxHp: 3000 * k, atk: 300 * k, def: 150 * k, spd: 60 * Math.sqrt(k),
    power: 1, elementPower: 1, team: true, row: 'front', technique: techniqueFor(g, el)?.id,
  }));
}

export function winRate(g: Game, floor: number, elements: string[], k: number, fights = 16): number {
  let w = 0;
  const foes = enemiesFor(g, floor);
  const limitSec = fightLimitSec(g, floor, foes);
  for (let s = 1; s <= fights; s++) if (simulateFight(g, team(g, elements, k), foes.map((f) => ({ ...f })), Rng.fromSeed(s), { limitSec }).win) w++;
  return w / fights;
}

/** Smallest k (±3 %) that wins the floor in at least half of the fights. */
export function needed(g: Game, floor: number, elements: string[]): number {
  let lo = 1e-3;
  let hi = 1e5;
  while (hi / lo > 1.03) {
    const m = Math.sqrt(lo * hi);
    if (winRate(g, floor, elements, m) >= 0.5) hi = m;
    else lo = m;
  }
  return hi;
}

export interface Wall {
  floor: number;
  trait: string;
  phase: string;
  kind: TeamKind;
  /** Boss factor over the two floors before it (same element and former floor). */
  ratio: number;
  /** The same in former floors (×1.11 each). */
  floors: number;
}

/** Walls of the given boss floors for one kind of team. */
export function walls(g: Game, bossFloors: number[], kind: TeamKind): Wall[] {
  return bossFloors.map((floor) => {
    const boss = enemiesFor(g, floor).find((e) => e.boss) ?? enemyFor(g, floor);
    const els = teamElements(g, kind, boss.element);
    const before = Math.sqrt(needed(g, floor - 1, els) * needed(g, floor - 2, els));
    const ratio = needed(g, floor, els) / before;
    return { floor, trait: boss.trait ?? '', phase: boss.phaseTrait ?? '', kind, ratio, floors: Math.log(ratio) / Math.log(1.11) };
  });
}

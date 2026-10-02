import { effectiveStats, findCreature } from '../creatures';
import type { GameContext } from '../context';
import type { Creature } from '../state';
import {
  checkpoint, enemiesFor, enemyFor, floorRewardInfo, floorsToBoss, isBossFloor, nextMilestoneFloor, resolveInfo, restartCheckpoint,
  roleOf, rowOf, targetingOf, teamSize, towerMilestones, veteranRank, type Row,
} from './tower';
import { elementMultiplier, teamSynergies } from './towerCombat';

/**
 * Everything the tower tab shows about the current run, the next floor and the
 * team, as one plain object (read-only, recomputed by the UI on its slow tick).
 */
export function towerView(ctx: GameContext) {
  const tw = ctx.state.tower;
  const size = teamSize(ctx);
  const teamIds = tw.run?.team ?? tw.team;
  const team = teamIds.map((id) => findCreature(ctx, id)).filter((c): c is Creature => !!c);
  const cp = checkpoint(ctx);
  const current = tw.run?.floor ?? cp;
  const nextFloor = current + 1;
  const enemy = enemyFor(ctx, nextFloor);
  const group = enemiesFor(ctx, nextFloor);
  const top = nextFloor + 3;
  const floors = [];
  for (let f = top; f >= Math.max(1, nextFloor - 4); f--) {
    const info = floorRewardInfo(ctx, f);
    const trait = info.boss ? enemyFor(ctx, f).trait : undefined;
    floors.push({ f, ...info, trait: trait ? ctx.content.bossTraits.get(trait) : null, cleared: tw.run ? f <= tw.run.floor : f <= tw.best, next: f === nextFloor, best: f === tw.best && tw.best > 0 });
  }
  return {
    tw,
    size,
    team,
    cp,
    restartCp: restartCheckpoint(ctx),
    current,
    nextFloor,
    enemy,
    boss: isBossFloor(ctx, nextFloor),
    guard: enemy.guard === true,
    // The column shows only a few floors around the team – the next boss may be far above.
    bossIn: floorsToBoss(ctx, nextFloor),
    trait: enemy.trait ? ctx.content.bossTraits.get(enemy.trait) : null,
    targeting: targetingOf(ctx, enemy),
    group,
    phase: enemy.boss ? (group.find((x) => x.boss)?.phaseTrait ?? null) : null,
    // Rows as data, so the Vorne/Hinten switches re-render with every change.
    rows: Object.fromEntries(team.map((c) => [c.id, rowOf(ctx, c.id)])) as Record<number, Row>,
    synergies: teamSynergies(ctx, team.map((c) => ctx.content.species.get(c.speciesId).element), enemy.trait),
    roles: Object.fromEntries(team.map((c) => [c.id, roleOf(ctx, effectiveStats(ctx, c))])) as Record<number, ReturnType<typeof roleOf>>,
    milestones: towerMilestones(ctx),
    veteran: veteranRank(ctx),
    resolve: resolveInfo(ctx),
    nextMilestone: nextMilestoneFloor(ctx),
    reward: floorRewardInfo(ctx, nextFloor),
    floors,
    aboveBest: tw.best > top,
    matchups: team.map((c) => {
      const el = ctx.content.species.get(c.speciesId).element;
      return { c, dealt: elementMultiplier(ctx, el, enemy.element), taken: elementMultiplier(ctx, enemy.element, el) };
    }),
    auto: ctx.state.features['towerAuto'] === true,
  };
}

export type TowerView = ReturnType<typeof towerView>;

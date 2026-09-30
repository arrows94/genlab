import { describe, expect, it } from 'vitest';
import { refreshTorches } from '@core/features/rpg';
import { unlockFeature } from '@core/systems/unlocks';
import { makeGame } from './helpers';
import { makeHero, playRun, towerMember } from './rpgBot';

/**
 * GenLab RPG balance on the tower scale: how far does one member of a team that holds tower floor F get?
 * GENLAB_RPG=1 prints the table (slow).
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const table = env.GENLAB_RPG === '1';

function measure(floor: number, dungeon: string, runs: number) {
  const g = makeGame(11);
  unlockFeature(g, 'rpg');
  refreshTorches(g);
  for (const d of g.content.rpgDungeons.list) g.state.rpg.cleared[d.id] = 1;
  const hero = makeHero(g, towerMember(g, floor));
  let cleared = 0;
  let depth = 0;
  let rounds = 0;
  const loot: Record<string, number> = {};
  for (let i = 0; i < runs; i++) {
    g.state.rpg.ranks = {};
    const r = playRun(g, hero, dungeon);
    if (r.cleared) cleared++;
    depth += r.depth;
    rounds += r.rounds;
    for (const [k, v] of Object.entries(r.loot)) loot[k] = (loot[k] ?? 0) + v / runs;
  }
  return { clearRate: cleared / runs, depth: depth / runs, rounds: rounds / runs, loot };
}

describe('GenLab RPG – Bot', () => {
  it('a stronger monster gets deeper', () => {
    const weak = measure(3, 'rootMaze', 6);
    const strong = measure(40, 'rootMaze', 6);
    expect(strong.depth).toBeGreaterThan(weak.depth);
    expect(strong.clearRate).toBeGreaterThanOrEqual(weak.clearRate);
  });

  it.runIf(table)('prints the dungeon table', () => {
    const g = makeGame();
    const lines: string[] = [];
    for (const d of g.content.rpgDungeons.list) {
      const row: string[] = [];
      for (const f of [3, 9, 15, 30, 45, 60, 90, 120, 150, 180, 240]) {
        const m = measure(f, d.id, 12);
        row.push(`F${f}: ${Math.round(m.clearRate * 100)}% d${m.depth.toFixed(1)} r${Math.round(m.rounds)} 🗼${Math.round(m.loot['towerTokens'] ?? 0)} 🪬${Math.round(m.loot['runes'] ?? 0)}`);
      }
      lines.push(`${d.name.padEnd(16)} ${row.join(' | ')}`);
    }
    console.log(lines.join('\n'));
  }, 600_000);
});

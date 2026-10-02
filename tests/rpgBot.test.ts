import { describe, expect, it } from 'vitest';
import { dungeonUnlocked, refreshTorches } from '@core/features/rpg';
import { rpgLevel } from '@core/features/rpgCombat';
import { unlockFeature } from '@core/systems/unlocks';
import { makeGame } from './helpers';
import { makeHero, playRun } from './rpgBot';

/**
 * GenLab RPG balance: how far does a monster of level L (in the other world) get in each dungeon?
 * GENLAB_RPG=1 prints the table (slow).
 */
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const table = env.GENLAB_RPG === '1';

function measure(level: number, dungeon: string, runs: number) {
  const g = makeGame(11);
  unlockFeature(g, 'rpg');
  refreshTorches(g);
  for (const d of g.content.rpgDungeons.list) g.state.rpg.cleared[d.id] = 1;
  const hero = makeHero(g, level);
  const xp = g.state.rpg.ranks[String(hero.id)]!;
  let cleared = 0;
  let atBoss = 0;
  let depth = 0;
  let rounds = 0;
  const loot: Record<string, number> = {};
  for (let i = 0; i < runs; i++) {
    g.state.rpg.ranks = { [String(hero.id)]: xp };
    const r = playRun(g, hero, dungeon);
    if (r.cleared) cleared++;
    if (r.depth > g.content.rpgDungeons.get(dungeon).rooms) atBoss++;
    depth += r.depth;
    rounds += r.rounds;
    for (const [k, v] of Object.entries(r.loot)) loot[k] = (loot[k] ?? 0) + v / runs;
  }
  return { clearRate: cleared / runs, bossRate: atBoss > 0 ? cleared / atBoss : 0, atBoss: atBoss / runs, depth: depth / runs, rounds: rounds / runs, loot };
}

/**
 * A fresh monster from level 1 like a player would level it: into the newest open dungeon, but back to the one
 * before after falling early there twice in a row (XP counts even after a defeat). Returns the run and level at
 * which each dungeon was cleared the first time.
 */
function progression(species: string, maxRuns: number, seed = 5) {
  const g = makeGame(seed);
  unlockFeature(g, 'rpg');
  refreshTorches(g);
  const hero = makeHero(g, 1, species);
  const out: { dungeon: string; runs: number; level: number }[] = [];
  let early = 0;
  for (let run = 1; run <= maxRuns; run++) {
    const open = g.content.rpgDungeons.list.filter((d) => dungeonUnlocked(g, d.id));
    const newest = open[open.length - 1]!;
    const d = early >= 2 && open.length > 1 ? open[open.length - 2]! : newest;
    const r = playRun(g, hero, d.id);
    if (d === newest) early = !r.cleared && r.depth <= newest.rooms / 2 ? early + 1 : 0;
    else early = Math.max(0, early - 1);
    if (r.cleared && !out.some((x) => x.dungeon === d.name)) out.push({ dungeon: d.name, runs: run, level: rpgLevel(g, hero.id).level });
    if (out.length === g.content.rpgDungeons.list.length) break;
  }
  return out;
}

describe('GenLab RPG – Bot', () => {
  it('a stronger monster gets deeper', () => {
    const weak = measure(1, 'tidalHalls', 6);
    const strong = measure(30, 'tidalHalls', 6);
    expect(strong.depth).toBeGreaterThan(weak.depth);
    expect(strong.clearRate).toBeGreaterThanOrEqual(weak.clearRate);
  });

  it.runIf(table)('prints the dungeon table', () => {
    const g = makeGame();
    const lines: string[] = [];
    for (const d of g.content.rpgDungeons.list) {
      const row: string[] = [];
      for (const f of [1, 3, 6, 10, 14, 20, 26, 32, 40, 50, 60]) {
        const m = measure(f, d.id, 12);
        row.push(`L${f}: ${Math.round(m.clearRate * 100)}% (Boss ${Math.round(m.atBoss * 100)}%→${Math.round(m.bossRate * 100)}%) d${m.depth.toFixed(1)} r${Math.round(m.rounds)} 🗼${Math.round(m.loot['towerTokens'] ?? 0)}`);
      }
      lines.push(`${d.name.padEnd(16)} ${row.join(' | ')}`);
    }
    console.log(lines.join('\n'));
  }, 600_000);

  it.runIf(table)('prints the progression of a fresh monster', () => {
    const lines: string[] = [];
    for (const species of ['emberpup', 'pebblit', 'zephyrix', 'magmole']) {
      for (const seed of [5, 9]) {
        const p = progression(species, 400, seed);
        lines.push(`${species.padEnd(10)} ${p.map((x) => `${x.dungeon}: Lauf ${x.runs} (Stufe ${x.level})`).join(' | ')}`);
      }
    }
    console.log(lines.join('\n'));
  }, 600_000);
});

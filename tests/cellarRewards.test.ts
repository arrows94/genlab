import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { createCreature } from '@core/creatures';
import { unlockFeature } from '@core/systems/unlocks';
import { eggRarityWeights } from '@core/features/breeding';
import { transferChance } from '@core/features/infusion';
import {
  buyRelic, darkRelicFor, equipDarkRelic, equipRelic, fighterFor, relicCost, setTeam,
} from '@core/features/tower';
import {
  cellarFighter, cellarMilestonesReached, fightNextCellarLevel, nextCellarMilestone, refreshCellarAttempts, setCellarTeam, startCellarRun, weeklyShardRoom,
} from '@core/features/cellar';
import { cellarCourse, courseFloorTokens } from '@core/features/floors';
import { balance, content, makeGame } from './helpers';

const WEEK = 7 * 24 * 3_600_000;

function cellarGame(seed = 5) {
  const g = makeGame(seed);
  for (const f of ['farm', 'breeding', 'tower', 'cellar']) unlockFeature(g, f);
  refreshCellarAttempts(g);
  return g;
}
type G = ReturnType<typeof cellarGame>;

function make(g: G, species: string, power: number) {
  return createCreature(g, { speciesId: species, rarity: 'common', abilities: [], stats: { hp: power * 3, atk: power, def: power / 2, spd: power / 4 }, exactStats: true });
}

/** A descent of an unbeatable team from `from` (cleared) on, `levels` levels deep. */
function descend(g: G, from: number, levels: number) {
  if (g.state.cellar.team.length === 0) setCellarTeam(g, ['emberpup', 'pebblit', 'steamling'].map((s) => make(g, s, 1e9).id));
  g.state.cellar.attempts = Math.max(1, g.state.cellar.attempts);
  expect(startCellarRun(g).ok).toBe(true);
  g.state.cellar.run!.level = from;
  for (let i = 0; i < levels; i++) fightNextCellarLevel(g);
  g.state.cellar.run = null;
  for (const c of g.state.creatures) if (c.job?.kind === 'cellar') c.job = null;
}

describe('Schattenmarken', () => {
  it('every cleared level pays Schattenmarken, more the deeper', () => {
    const g = cellarGame();
    descend(g, 0, 3);
    const course = cellarCourse(g);
    const expected = [1, 2, 3].reduce((n, l) => n + courseFloorTokens(course, l).toNumber(), 0);
    expect(g.state.resources['shadowMarks']!.toNumber()).toBe(expected);
    expect(courseFloorTokens(course, 40).toNumber()).toBeGreaterThan(courseFloorTokens(course, 1).toNumber());
    // No more Turm-Marken from the cellar.
    expect(g.state.resources['towerTokens'] ?? D(0)).toEqual(D(0));
  });
});

describe('Äon-Splitter', () => {
  it('a new boss depth gives one, at most two a week; old depths give none', () => {
    const g = cellarGame();
    const boss = balance.cellar.bossEvery;
    descend(g, boss - 1, 1);
    expect(g.state.resources['aeonShards']!.toNumber()).toBe(balance.cellar.shardsPerBoss);
    // The same depth again: nothing.
    descend(g, boss - 1, 1);
    expect(g.state.resources['aeonShards']!.toNumber()).toBe(balance.cellar.shardsPerBoss);
    // Deeper bosses until the weekly cap.
    descend(g, boss, 3 * boss);
    expect(g.state.resources['aeonShards']!.toNumber()).toBe(balance.cellar.weeklyShards);
    expect(weeklyShardRoom(g)).toBe(0);
    // Next week there is room again.
    g.state.lastTickAt += WEEK;
    expect(weeklyShardRoom(g)).toBe(balance.cellar.weeklyShards);
    descend(g, 4 * boss, boss);
    expect(g.state.resources['aeonShards']!.toNumber()).toBe(balance.cellar.weeklyShards + 1);
  });
});

describe('Tiefen-Meilensteine', () => {
  it('are the source of capsule and research prices, allele transfer and rare rituals', () => {
    const g = cellarGame();
    const ritual = content.breedingRituals.get('noble');
    const before = { capsule: g.mods().factor('cost.capsule'), upgrade: g.mods().factor('cost.upgrade'), transfer: transferChance(g), rare: eggRarityWeights(g, ritual)['rare']! };
    expect(before).toEqual({ capsule: 1, upgrade: 1, transfer: balance.infusion.alleleTransferChance, rare: before.rare });
    const events: string[] = [];
    g.bus.on('cellarMilestone', (e) => events.push(e.milestone));
    descend(g, 0, 40);
    expect(events).toEqual(['depth10', 'depth20', 'depth30', 'depth40']);
    expect(cellarMilestonesReached(g).map((m) => m.id)).toEqual(events);
    expect(nextCellarMilestone(g)!.id).toBe('depth50');
    expect(g.mods().factor('cost.capsule')).toBeCloseTo(0.9);
    expect(g.mods().factor('cost.upgrade')).toBeCloseTo(0.95);
    expect(transferChance(g)).toBeCloseTo(before.transfer + 0.03);
    expect(eggRarityWeights(g, ritual)['rare']!).toBeCloseTo(before.rare * 1.25);
    // Common eggs and normal eggs are untouched.
    expect(eggRarityWeights(g)['rare']).toBe(eggRarityWeights(g)['rare']);
    // Reaching them again pays no second time.
    events.length = 0;
    descend(g, 0, 40);
    expect(events).toEqual([]);
  });
});

describe('dunkle Relikte', () => {
  it('cost Schattenmarken and need the cellar', () => {
    const g = cellarGame();
    const id = content.darkRelics.list[0]!.id;
    expect(buyRelic(g, id).ok).toBe(false);
    g.state.resources['shadowMarks'] = D(1e6);
    g.state.resources['towerTokens'] = D(0);
    const cost = relicCost(g, id)!;
    expect(buyRelic(g, id).ok).toBe(true);
    expect(g.state.resources['shadowMarks']!.toNumber()).toBeCloseTo(1e6 - cost.toNumber());
    expect(relicCost(g, id)!.toNumber()).toBeGreaterThan(cost.toNumber());
    g.state.features['cellar'] = false;
    expect(buyRelic(g, id).ok).toBe(false);
  });

  it('sit in their own place – in the tower next to the relic, and in the cellar – with a bonus and a malus', () => {
    const g = cellarGame();
    g.state.resources['shadowMarks'] = D(1e6);
    g.state.resources['towerTokens'] = D(1e6);
    const dark = content.darkRelics.get('bloodFang');
    const normal = content.relics.list[0]!;
    for (let i = 0; i < 3; i++) buyRelic(g, dark.id);
    buyRelic(g, normal.id);
    const t = make(g, 'emberpup', 300);
    const c = make(g, 'pebblit', 300);
    setTeam(g, [t.id]);
    setCellarTeam(g, [c.id]);
    const towerBase = fighterFor(g, t);
    const cellarBase = cellarFighter(g, c);
    // Places do not mix.
    expect(equipRelic(g, 0, dark.id).ok).toBe(false);
    expect(equipDarkRelic(g, 'tower', 0, normal.id).ok).toBe(false);
    expect(equipRelic(g, 0, normal.id).ok).toBe(true);
    expect(equipDarkRelic(g, 'tower', 0, dark.id).ok).toBe(true);
    expect(equipDarkRelic(g, 'cellar', 0, dark.id).ok).toBe(true);
    expect(darkRelicFor(g, t, 'tower')).toEqual({ def: dark, level: 3 });
    expect(darkRelicFor(g, c, 'cellar')).toEqual({ def: dark, level: 3 });
    // Blutzahn III: +45 % ANG, −15 % KP – in both courses.
    const towerNow = fighterFor(g, t);
    expect(towerNow.atk).toBeGreaterThan(towerBase.atk);
    const cellarNow = cellarFighter(g, c);
    expect(cellarNow.atk).toBe(Math.round(cellarBase.atk * 1.45));
    expect(cellarNow.maxHp).toBe(Math.round(cellarBase.maxHp * 0.85));
    // In the cellar the normal tower relic does not count.
    expect(cellarFighter(g, c).def).toBe(cellarBase.def);
    // Not while a descent runs.
    g.state.cellar.attempts = 1;
    startCellarRun(g);
    expect(equipDarkRelic(g, 'cellar', 0, null).ok).toBe(false);
  });
});

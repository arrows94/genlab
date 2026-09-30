import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { Rng } from '@core/rng';
import { createCreature, effectiveStats } from '@core/creatures';
import { buyUpgrade, nextUpgradeCost, assignJob } from '@core/actions';
import { performPrestige, prestigeGain } from '@core/prestige';
import { unlockFeature } from '@core/systems/unlocks';
import { addBuff } from '@core/systems/buffs';
import { canConsume } from '@core/features/stable';
import { startBreeding } from '@core/features/breeding';
import { revealGenome } from '@core/features/sequencing';
import { usePotion } from '@core/features/market';
import { elementMultiplier, enemiesFor, enemyFor, fighterFor, floorRewardInfo, floorTokens, setTeam, setTowerAutoRestart, simulateFight, startRun, stopRun, teamSize } from '@core/features/tower';
import { buyTalent } from '@core/features/talents';
import { abandonAnomaly, startAnomaly } from '@core/features/anomalies';
import { activeMutation, mutationForWeek, upcomingMutation, weekIndex } from '@core/features/weekly';
import { activeLoci } from '@core/genetics';
import { splice } from '@core/features/splicing';
import { sell } from '@core/features/stable';
import type { Genome } from '@core/state';
import type { Condition } from '@core/content/types';
import { conditionProgress } from '@core/conditions';
import { balance, content, makeGame, NOW } from './helpers';

function endgame(seed = 30, overrides = {}) {
  const g = makeGame(seed, overrides);
  for (const f of ['farm', 'breeding', 'mine', 'sequencing', 'market', 'tower', 'infiniteResearch', 'weekly', 'anomalies', 'aeon', 'inheritance']) unlockFeature(g, f);
  for (const r of ['food', 'gold', 'essence', 'catalyst', 'towerTokens']) g.state.resources[r] = D(1e12);
  return g;
}

function champion(g: ReturnType<typeof endgame>, power: number, species = 'emberpup') {
  return createCreature(g, { speciesId: species, rarity: 'common', abilities: [], stats: { hp: power * 3, atk: power, def: power / 2, spd: power / 4 }, exactStats: true });
}

const topGenome = (): Genome =>
  Object.fromEntries(content.genes.list.filter((l) => !l.requires).map((l) => {
    const top = l.alleles.find((a) => a.top) ?? l.alleles[0]!;
    return [l.id, [top.id, top.id]];
  })) as Genome;

describe('genome tower', () => {
  it('enemies are deterministic per floor and scale endlessly', () => {
    const g = endgame();
    expect(enemyFor(g, 7)).toEqual(enemyFor(g, 7));
    expect(enemyFor(g, 50).hp).toBeGreaterThan(enemyFor(g, 49).hp);
    expect(enemyFor(g, balance.tower.bossEvery).name.startsWith('Boss')).toBe(true);
    expect(enemyFor(g, balance.tower.guardEvery).name.startsWith('Wächter')).toBe(true);
  });

  it('three small floors make one former floor: floor 3n is as strong as the former floor n', () => {
    const g = endgame();
    const base = balance.tower.enemyBase;
    for (const n of [1, 5, 13, 29]) {
      const e = enemyFor(g, 3 * n, { plain: true });
      expect(e.maxHp).toBe(Math.round(base['hp']! * Math.pow(1.11, n - 1)));
      expect(e.atk).toBe(Math.round(base['atk']! * Math.pow(1.11, n - 1)));
    }
    // Boss every 30 floors (former 10), a Wächter on every other tenth floor: alone and stronger.
    expect(enemyFor(g, 30).boss).toBe(true);
    const guard = enemiesFor(g, 50);
    expect(guard).toHaveLength(1);
    expect(guard[0]!.guard).toBe(true);
    expect(guard[0]!.maxHp).toBeGreaterThan(enemyFor(g, 50, { plain: true }).maxHp);
    expect(enemyFor(g, 60).guard).toBeUndefined();
  });

  it('Turm-Marken per floor add up to the formula in whole numbers', () => {
    const g = endgame();
    const t = balance.tower;
    let sum = 0;
    for (let f = 1; f <= 90; f++) {
      const n = floorTokens(g, f).toNumber();
      expect(Number.isInteger(n)).toBe(true);
      sum += n;
    }
    const exact = t.tokensPerFloor * (90 + (t.tokenGrowthPerFloor * 90 * 89) / 2);
    expect(Math.abs(sum - exact)).toBeLessThanOrEqual(0.5);
  });

  it('element strengths and weaknesses matter', () => {
    const g = endgame();
    expect(elementMultiplier(g, 'water', 'fire')).toBe(1.5);
    expect(elementMultiplier(g, 'fire', 'water')).toBe(0.7);
    expect(elementMultiplier(g, 'fire', 'air')).toBe(1);
  });

  it('strong teams win, weak teams lose', () => {
    const g = endgame();
    const strong = [champion(g, 200)].map((c) => fighterFor(g, c));
    const weak = [champion(g, 2)].map((c) => fighterFor(g, c));
    expect(simulateFight(g, strong, enemyFor(g, 1), Rng.fromSeed(1)).win).toBe(true);
    expect(simulateFight(g, weak, enemyFor(g, 30), Rng.fromSeed(1)).win).toBe(false);
  });

  it('runs climb automatically, pay tokens, and end on defeat', () => {
    const g = endgame();
    const team = [champion(g, 40), champion(g, 40), champion(g, 40)];
    expect(setTeam(g, team.map((c) => c.id)).ok).toBe(true);
    const tokens = g.state.resources.towerTokens!;
    expect(startRun(g).ok).toBe(true);
    expect(team.every((c) => c.job?.kind === 'tower')).toBe(true);
    expect(team.some((c) => canConsume(g, c))).toBe(false);
    for (let i = 0; i < 400 && g.state.tower.run; i++) g.step(balance.tower.fightIntervalSec * 1000);
    expect(g.state.tower.run).toBeNull();
    expect(g.state.tower.best).toBeGreaterThan(3);
    expect(g.state.resources.towerTokens!.gt(tokens)).toBe(true);
    expect(g.state.tower.leaderboard[0]!.floor).toBe(g.state.tower.best);
    expect(team.every((c) => c.job === null)).toBe(true);
    expect(g.state.statistics['record.towerFloor']).toBe(g.state.tower.best);
  });

  it('the next run starts at the last checkpoint', () => {
    const g = endgame();
    g.state.tower.best = 2 * balance.tower.checkpointEvery + 7;
    setTeam(g, [champion(g, 10).id]);
    startRun(g, true);
    expect(g.state.tower.run?.startFloor).toBe(2 * balance.tower.checkpointEvery + 1);
  });

  it('auto-restart begins where the last run began (checkpoint or floor 1)', () => {
    const g = endgame();
    unlockFeature(g, 'towerAuto');
    g.state.tower.best = 2 * balance.tower.checkpointEvery + 7;
    setTeam(g, [champion(g, 10).id]);
    setTowerAutoRestart(g, true);
    startRun(g, false);
    stopRun(g);
    g.step(100);
    expect(g.state.tower.run?.startFloor).toBe(1);
    stopRun(g);
    startRun(g, true);
    stopRun(g);
    g.step(100);
    expect(g.state.tower.run?.startFloor).toBe(2 * balance.tower.checkpointEvery + 1);
  });

  it('every alleleEvery-th floor grants a rare allele for the gene library', () => {
    const g = endgame();
    const every = balance.tower.alleleEvery;
    const events: ({ locus: string; allele: string } | null)[] = [];
    g.bus.on('towerFloor', (e) => e.floor === every && events.push(e.allele));
    setTeam(g, [champion(g, 5000).id]);
    startRun(g, false);
    for (let i = 0; i < every; i++) g.step(balance.tower.fightIntervalSec * 1000);
    expect(events[0]).not.toBeNull();
    expect(g.state.geneLibrary[`${events[0]!.locus}:${events[0]!.allele}`]).toBe(true);
  });

  it('fights record replay events consistent with the outcome', () => {
    const g = endgame();
    const team = [champion(g, 30), champion(g, 30, 'bubbloon')].map((c) => fighterFor(g, c));
    const r = simulateFight(g, team, enemyFor(g, 5), Rng.fromSeed(3));
    expect(r.fighters.map((f) => f.team)).toEqual([true, true, false]);
    expect(r.fighters[2]!.speciesId).toBe(enemyFor(g, 5).speciesId);
    expect(r.events.length).toBeGreaterThan(0);
    expect(r.events.length).toBeLessThanOrEqual(40);
    for (const e of r.events) {
      expect(r.fighters[e.a]!.team).not.toBe(r.fighters[e.t]!.team);
      expect(e.hp).toBeGreaterThanOrEqual(0);
    }
    if (r.win && r.events.length < 40) expect(r.events.at(-1)!.hp).toBe(0);
  });

  it('reward preview matches the floor schedule without side effects', () => {
    const g = endgame();
    const library = { ...g.state.geneLibrary };
    const t = balance.tower;
    expect(floorRewardInfo(g, 1).tokens.toNumber()).toBe(t.tokensPerFloor);
    expect(floorRewardInfo(g, t.bossEvery)).toMatchObject({ boss: true, guard: false, checkpoint: true, catalyst: 1 });
    expect(floorRewardInfo(g, t.guardEvery)).toMatchObject({ boss: false, guard: true, checkpoint: false });
    expect(floorRewardInfo(g, t.alleleEvery).allele).toBe(true);
    expect(floorRewardInfo(g, 7)).toMatchObject({ boss: false, guard: false, catalyst: 0, allele: false });
    expect(g.state.geneLibrary).toEqual(library);
  });

  it('creatures that leave the game are removed from the team; stale ids never block changes', () => {
    const g = endgame();
    const [a, b, c] = [champion(g, 10), champion(g, 10), champion(g, 10)];
    expect(setTeam(g, [a.id, b.id]).ok).toBe(true);
    expect(sell(g, [b.id]).ok).toBe(true);
    expect(g.state.tower.team).toEqual([a.id]);
    // A save that still carries a missing id (older bug) can be edited.
    g.state.tower.team = [a.id, 9999];
    expect(setTeam(g, [a.id, 9999, c.id]).ok).toBe(true);
    expect(g.state.tower.team).toEqual([a.id, c.id]);
  });

  it('team size is limited and grows with talents', () => {
    const g = endgame();
    const ids = [1, 2, 3, 4].map(() => champion(g, 5).id);
    expect(teamSize(g)).toBe(3);
    expect(setTeam(g, ids).ok).toBe(false);
    g.state.talents.aeonTeam = true;
    g.invalidate();
    expect(setTeam(g, ids).ok).toBe(true);
  });

  it('auto-restart after defeat with the tower routine', () => {
    const g = endgame();
    setTeam(g, [champion(g, 3).id]);
    buyUpgrade(g, 'towerRoutine');
    g.state.tower.autoRestart = true;
    startRun(g);
    for (let i = 0; i < 50; i++) g.step(balance.tower.fightIntervalSec * 1000);
    expect(g.state.tower.leaderboard.length).toBeGreaterThan(1);
  });

  it('keeps the top runs in the leaderboard and the most recent runs in the history', () => {
    const g = endgame();
    setTeam(g, [champion(g, 3).id]);
    buyUpgrade(g, 'towerRoutine');
    g.state.tower.autoRestart = true;
    startRun(g);
    const tw = g.state.tower;
    for (let i = 0; i < 400 && tw.history.length < balance.tower.historySize + 2; i++) g.step(balance.tower.fightIntervalSec * 1000);
    expect(tw.leaderboard.length).toBe(balance.tower.leaderboardSize);
    expect(tw.history.length).toBe(balance.tower.historySize);
    expect(tw.leaderboard.map((e) => e.floor)).toEqual([...tw.leaderboard.map((e) => e.floor)].sort((a, b) => b - a));
    expect(tw.leaderboard[0]!.floor).toBe(Math.max(...tw.history.map((e) => e.floor)));
    // Newest first.
    for (let i = 1; i < tw.history.length; i++) expect(tw.history[i - 1]!.at).toBeGreaterThanOrEqual(tw.history[i]!.at);
    expect(tw.history.every((e) => e.startFloor >= 1 && e.team.length === 1)).toBe(true);
  });
});

describe('Äon prestige and talents', () => {
  it('gains from owned heritage and resets research, keeping dex, library, talents and tower record', () => {
    const g = endgame();
    g.state.resources.heritage = D(200);
    g.state.prestige.inheritance = { count: 3 };
    g.state.upgrades.autoGatherer = 5;
    g.state.upgrades.geneticMastery = 4;
    g.state.tower.best = 99;
    g.state.geneLibrary['strength:Kt'] = true;
    g.state.talents.aeonHarvest = true;
    const dex = { ...g.state.dex };
    expect(prestigeGain(g, 'aeon').toNumber()).toBe(2);
    expect(performPrestige(g, 'aeon').ok).toBe(true);
    expect(g.state.resources.aeonShards!.toNumber()).toBeGreaterThanOrEqual(2);
    expect(g.state.resources.heritage!.toNumber()).toBe(0);
    expect(g.state.upgrades.autoGatherer).toBeUndefined();
    expect(g.state.upgrades.geneticMastery).toBeUndefined();
    expect(g.state.dex).toEqual(dex);
    expect(g.state.geneLibrary['strength:Kt']).toBe(true);
    expect(g.state.talents.aeonHarvest).toBe(true);
    expect(g.state.tower.best).toBe(99);
    expect(g.state.features.collect).toBe(true);
    expect(g.state.features.aeon).toBe(true);
    expect(g.state.creatures).toHaveLength(1);
  });

  it('talents need their prerequisites and cost shards', () => {
    const g = endgame();
    g.state.resources.aeonShards = D(3);
    expect(buyTalent(g, 'twinBirth').ok).toBe(false);
    expect(buyTalent(g, 'aeonHarvest').ok).toBe(true);
    expect(g.state.resources.aeonShards!.toNumber()).toBe(2);
    expect(buyTalent(g, 'twinBirth')).toEqual({ ok: false, reason: 'Nicht genug Äon-Splitter.' });
    expect(buyTalent(g, 'aeonHarvest').ok).toBe(false);
  });

  it('permanent automation and start resources survive resets', () => {
    const g = endgame();
    g.state.resources.aeonShards = D(10);
    buyTalent(g, 'aeonAutomation');
    buyTalent(g, 'aeonMemory');
    g.state.resources.heritage = D(100);
    performPrestige(g, 'aeon');
    expect(g.state.features.autoBreed).toBe(true);
    expect(g.state.features.autoAssign).toBe(true);
    expect(g.state.features.autoSequence).toBe(true);
    expect(g.state.features.autoRecycle).toBe(true);
    expect(g.state.resources.food!.toNumber()).toBeGreaterThanOrEqual(1000);
  });

  it('"Urgene" activates an extra gene locus in every creature', () => {
    const g = endgame();
    expect(activeLoci(g).some((l) => l.id === 'primal')).toBe(false);
    g.state.resources.aeonShards = D(10);
    buyTalent(g, 'aeonMemory');
    buyTalent(g, 'ancientGenes');
    expect(activeLoci(g).some((l) => l.id === 'primal')).toBe(true);
    for (const c of g.state.creatures) expect(c.genome.primal).toHaveLength(2);
  });

  it('twin births produce a second child', () => {
    const g = endgame();
    g.state.talents.twinBirth = true;
    addBuff(g, 'test', [{ target: 'breeding.twinChance', op: 'add', value: 1 }], 1e9);
    const a = createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    const b = createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    const before = g.state.creatures.length;
    startBreeding(g, a.id, b.id);
    g.advance(120_000);
    expect(g.state.creatures.length).toBe(before + 2);
    expect(g.state.creatures.at(-1)!.generation).toBe(2);
  });
});

describe('perfection hunt', () => {
  it('detects perfect genomes once sequenced', () => {
    const g = endgame();
    const c = createCreature(g, { speciesId: 'ferrox', rarity: 'common', genome: topGenome() });
    expect(g.state.perfection.perfect.ferrox).toBeUndefined();
    revealGenome(g, c);
    expect(g.state.perfection.perfect.ferrox).toBe(true);
    expect(g.state.achievements.perfectGenome).toBeUndefined(); // checked on the next step
    g.step(100);
    expect(g.state.achievements.perfectGenome).toBe(true);
  });

  it('an imperfect genome does not count', () => {
    const g = endgame();
    const c = createCreature(g, { speciesId: 'ferrox', rarity: 'common', genome: { ...topGenome(), strength: ['Kt', 'k'] } });
    revealGenome(g, c);
    expect(g.state.perfection.perfect.ferrox).toBeUndefined();
  });

  it('shiny colour mutations are rare and recorded per species', () => {
    const g = endgame(3, { perfection: { shinyChance: 1 } });
    const c = createCreature(g, { speciesId: 'lumifly', rarity: 'common' });
    expect(c.shiny).toBe(true);
    expect(g.state.perfection.shiny.lumifly).toBe(true);
    const h = endgame(3);
    let shinies = 0;
    for (let i = 0; i < 2000; i++) if (createCreature(h, { speciesId: 'lumifly', rarity: 'common' }).shiny) shinies++;
    expect(shinies).toBeLessThan(8);
  });
});

describe('anomalies', () => {
  it('reset the run, change rules and pay a permanent reward on completion', () => {
    const g = endgame();
    const base = g.mods().apply('breeding.time', 100);
    expect(startAnomaly(g, 'broodFever').ok).toBe(true);
    expect(g.state.anomaly?.levels.broodFever).toBe(1);
    expect(g.state.creatures).toHaveLength(1);
    expect(g.mods().apply('breeding.time', 100)).toBeCloseTo(base * 0.5);
    expect(performPrestige(g, 'inheritance').ok).toBe(false);
    expect(startAnomaly(g, 'famine').ok).toBe(false);

    g.state.earned.gold = D(20000);
    g.step(100);
    expect(g.state.anomaly).toBeNull();
    expect(g.state.anomaliesCompleted.broodFever).toBe(true);
    expect(g.mods().apply('breeding.time', 100)).toBeCloseTo(base * 0.9);
  });

  it('can forbid potions', () => {
    const g = endgame();
    startAnomaly(g, 'ascetic');
    unlockFeature(g, 'market');
    g.state.resources.food = D(1e6);
    expect(usePotion(g, 'feast')).toEqual({ ok: false, reason: 'In dieser Anomalie sind Tränke verboten.' });
    abandonAnomaly(g);
    expect(usePotion(g, 'feast').ok).toBe(true);
    expect(g.state.anomaliesCompleted.ascetic).toBeUndefined();
  });
});

describe('infinite research', () => {
  it('has no max level and diminishing returns', () => {
    const g = endgame();
    for (let i = 0; i < 16; i++) expect(buyUpgrade(g, 'geneticMastery').ok).toBe(true);
    expect(nextUpgradeCost(g, 'geneticMastery')).not.toBeNull();
    const c = createCreature(g, { speciesId: 'pebblit', rarity: 'common', abilities: [], genome: {}, stats: { hp: 100, atk: 100, def: 100, spd: 100 }, exactStats: true });
    const expected = 1 + 0.05 * Math.pow(16, 0.7);
    expect(effectiveStats(g, c).atk).toBe(Math.round(100 * (expected + (g.mods().totals('stat.atk').pct - 0.05 * Math.pow(16, 0.7)))));
    expect(0.05 * Math.pow(16, 0.7)).toBeLessThan(0.05 * 16 / 2);
  });
});

describe('weekly mutation', () => {
  it('is derived from the calendar week, deterministically', () => {
    expect(weekIndex('2024-01-01', Date.parse('2024-01-01T00:00:00Z'))).toBe(0);
    expect(weekIndex('2024-01-01', Date.parse('2024-01-07T23:59:59Z'))).toBe(0);
    expect(weekIndex('2024-01-01', Date.parse('2024-01-08T00:00:00Z'))).toBe(1);
    const list = content.weeklyMutations.list;
    expect(mutationForWeek(list, 42)).toBe(mutationForWeek(list, 42));
    const distinct = new Set(Array.from({ length: 30 }, (_, w) => mutationForWeek(list, w)?.id));
    expect(distinct.size).toBeGreaterThan(4);
  });

  it('only applies once unlocked and changes production rules', () => {
    const g = makeGame();
    expect(activeMutation(g)).toBeNull();
    unlockFeature(g, 'weekly');
    const m = activeMutation(g, NOW)!;
    expect(m).not.toBeNull();
    for (const mod of m.modifiers) expect(g.mods().list(mod.target).some((x) => x.source === `weekly:${m.id}`)).toBe(true);
  });

  it('shows next week\'s mutation in advance', () => {
    const g = makeGame();
    expect(upcomingMutation(g, NOW)).toBeNull();
    unlockFeature(g, 'weekly');
    const week = 7 * 24 * 3600 * 1000;
    expect(upcomingMutation(g, NOW)).toBe(activeMutation(g, NOW + week));
  });

  it('element mutations boost matching workers', () => {
    const g = endgame();
    const ice = createCreature(g, { speciesId: 'frostling', rarity: 'common' });
    assignJob(g, ice.id, 'farm');
    const before = g.productionRates().food!.toNumber();
    addBuff(g, 'iceTest', [{ target: 'element.ice.production', op: 'pct', value: 0.5 }], 1e9);
    expect(g.productionRates().food!.toNumber()).toBeGreaterThan(before);
  });
});

describe('gated gene loci (Urgen) before the talent', () => {
  it('never appear through splicing, not even via an unstable splice', () => {
    const g = endgame(8, { genetics: { ...balance.genetics, splicing: { ...balance.genetics.splicing, instability: 1, maxPerCreature: 100 } } });
    unlockFeature(g, 'splicing');
    g.state.resources.essence = D(1e12);
    g.state.resources.gold = D(1e12);
    const c = createCreature(g, { speciesId: 'pebblit', rarity: 'common', genome: topGenome() });
    c.sequenced = true;
    g.state.geneLibrary['strength:k'] = true;
    for (let i = 0; i < 60; i++) splice(g, c.id, 'strength', 0, i % 2 ? 'k' : 'Kt');
    expect(c.genome.primal).toBeUndefined();
    g.state.geneLibrary['primal:U'] = true;
    expect(splice(g, c.id, 'primal', 0, 'U')).toEqual({ ok: false, reason: 'Unbekanntes Gen.' });
  });
});

describe('condition progress (anomaly goal bar)', () => {
  it('measures countable conditions and combines them', () => {
    const g = makeGame();
    g.state.earned.gold = D(5000);
    expect(conditionProgress(g.state, { type: 'resourceEarned', resource: 'gold', amount: 20000 })).toBeCloseTo(0.25);
    g.state.statistics.hatched = 30;
    const parts: Condition[] = [{ type: 'resourceEarned', resource: 'gold', amount: 20000 }, { type: 'statistic', statistic: 'hatched', amount: 10 }];
    const all: Condition = { type: 'all', of: parts };
    expect(conditionProgress(g.state, all)).toBeCloseTo(0.25);
    expect(conditionProgress(g.state, { type: 'any', of: parts })).toBe(1);
    expect(conditionProgress(g.state, { type: 'feature', feature: 'farm' })).toBeNull();
  });
});

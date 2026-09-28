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
import { elementMultiplier, enemyFor, fighterFor, setTeam, simulateFight, startRun, teamSize } from '@core/features/tower';
import { buyTalent } from '@core/features/talents';
import { abandonAnomaly, startAnomaly } from '@core/features/anomalies';
import { activeMutation, mutationForWeek, weekIndex } from '@core/features/weekly';
import { activeLoci } from '@core/genetics';
import { splice } from '@core/features/splicing';
import type { Genome } from '@core/state';
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
    expect(enemyFor(g, 10).name.startsWith('Boss')).toBe(true);
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
    g.state.tower.best = 27;
    setTeam(g, [champion(g, 10).id]);
    startRun(g, true);
    expect(g.state.tower.run?.startFloor).toBe(21);
  });

  it('floor 25 grants a rare allele for the gene library', () => {
    const g = endgame();
    const events: ({ locus: string; allele: string } | null)[] = [];
    g.bus.on('towerFloor', (e) => e.floor === 25 && events.push(e.allele));
    setTeam(g, [champion(g, 5000).id]);
    startRun(g, false);
    for (let i = 0; i < 25; i++) g.step(balance.tower.fightIntervalSec * 1000);
    expect(events[0]).not.toBeNull();
    expect(g.state.geneLibrary[`${events[0]!.locus}:${events[0]!.allele}`]).toBe(true);
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
});

describe('Äon prestige and talents', () => {
  it('gains from owned heritage and resets research, keeping dex, library, talents and tower record', () => {
    const g = endgame();
    g.state.resources.heritage = D(200);
    g.state.prestige.inheritance = { count: 3 };
    g.state.upgrades.autoGatherer = 5;
    g.state.upgrades.geneticMastery = 4;
    g.state.tower.best = 33;
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
    expect(g.state.tower.best).toBe(33);
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
    expect(g.state.anomaly?.id).toBe('broodFever');
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

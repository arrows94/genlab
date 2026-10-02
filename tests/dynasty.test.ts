import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { createCreature, effectiveStats, findCreature } from '@core/creatures';
import { breedingTimeMs, startBreeding } from '@core/features/breeding';
import { dynastyRecord, dynastyTier, lineageBonus, recordLineage, totalDynastyTiers } from '@core/features/dynasty';
import { applyTalentGuarantees, performPrestige } from '@core/prestige';
import { buyTalent } from '@core/features/talents';
import { planAutoBreed } from '@core/features/automation';
import { deserialize, serialize } from '@core/save';
import { unlockFeature } from '@core/systems/unlocks';
import type { Creature } from '@core/state';
import { balance, content, makeGame } from './helpers';

function dynastyGame(seed = 11, unlocked = true) {
  const g = makeGame(seed);
  unlockFeature(g, 'breeding');
  if (unlocked) unlockFeature(g, 'dynasties');
  g.state.resources.food = D(1e12);
  g.state.resources.gold = D(1e12);
  return g;
}

const pup = (g: ReturnType<typeof dynastyGame>, lineage = 0, species = 'emberpup') =>
  createCreature(g, { speciesId: species, rarity: 'common', abilities: [], genome: {}, lineage, stats: { hp: 30, atk: 10, def: 5, spd: 5 }, exactStats: true });

function hatch(g: ReturnType<typeof dynastyGame>, a: Creature, b: Creature): Creature {
  const ids: number[] = [];
  const off = g.bus.on('eggHatched', (e) => ids.push(e.creatureId));
  expect(startBreeding(g, a.id, b.id).ok).toBe(true);
  g.advance(breedingTimeMs(g, 60, [a, b]) + 1000);
  off();
  return findCreature(g, ids[0]!)!;
}

describe('Stammbaum-Dynastien', () => {
  it('a pure line grows by one per generation, limited by the shallower parent', () => {
    const g = dynastyGame();
    const child = hatch(g, pup(g), pup(g));
    expect(child.speciesId).toBe('emberpup');
    expect(child.lineage).toBe(1);
    expect(hatch(g, pup(g, 4), pup(g, 7)).lineage).toBe(5);
    // A parent of another species breaks the line.
    const mixed = hatch(g, pup(g, 4), pup(g, 4, 'bubbloon'));
    expect(mixed.lineage).toBe(0);
    // Wild creatures start without a line.
    expect(pup(g).lineage).toBe(0);
  });

  it('keeps the deepest line per species as a permanent record', () => {
    const g = dynastyGame();
    hatch(g, pup(g, 11), pup(g, 11));
    expect(dynastyRecord(g, 'emberpup')).toBe(12);
    hatch(g, pup(g, 2), pup(g, 2));
    expect(dynastyRecord(g, 'emberpup')).toBe(12);
    expect(dynastyTier(g, 12)).toBe(2);
    expect(totalDynastyTiers(g)).toBe(2);
    unlockFeature(g, 'inheritance');
    g.state.earned.food = D(1e9);
    expect(performPrestige(g, 'inheritance').ok).toBe(true);
    expect(dynastyRecord(g, 'emberpup')).toBe(12);
  });

  it('pays Äon-Splitter once for the high tiers', () => {
    const g = dynastyGame();
    const tiers: number[] = [];
    g.bus.on('dynastyTier', (e) => tiers.push(e.tier));
    const deep = pup(g, balance.dynasty.tiers[4]!);
    recordLineage(g, deep);
    const shards = balance.dynasty.shardsPerTier.reduce((a, b) => a + b, 0);
    expect(g.state.resources.aeonShards!.toNumber()).toBe(shards);
    expect(tiers).toEqual([5]);
    recordLineage(g, deep);
    expect(g.state.resources.aeonShards!.toNumber()).toBe(shards);
  });

  it('all species together pay at most maxShards', () => {
    const g = dynastyGame();
    const deepest = balance.dynasty.tiers.at(-1)!;
    for (const s of content.species.list) recordLineage(g, createCreature(g, { speciesId: s.id, source: 'other', lineage: deepest }));
    const perSpecies = balance.dynasty.shardsPerTier.reduce((a, b) => a + b, 0);
    expect(perSpecies * content.species.list.length).toBeGreaterThan(balance.dynasty.maxShards);
    expect(g.state.resources.aeonShards!.toNumber()).toBe(balance.dynasty.maxShards);
  });

  it('nothing counts before the unlock: no line, no record', () => {
    const g = dynastyGame(11, false);
    expect(hatch(g, pup(g, 4), pup(g, 4)).lineage).toBe(0);
    recordLineage(g, pup(g, 12));
    expect(g.state.dynasties).toEqual({});
  });

  it('the Äon talent unlocks them for good', () => {
    const g = dynastyGame(11, false);
    expect(g.content.features.get('dynasties').condition).toBeUndefined();
    unlockFeature(g, 'aeon');
    g.state.resources.aeonShards = D(100);
    expect(buyTalent(g, 'aeonHarvest').ok).toBe(true);
    expect(buyTalent(g, 'dynasty').ok).toBe(true);
    expect(g.state.features.dynasties).toBe(true);
    g.state.features = {};
    applyTalentGuarantees(g);
    expect(g.state.features.dynasties).toBe(true);
  });

  it('bonuses: own line, species tier and production', () => {
    const g = dynastyGame(11, false);
    const deep = pup(g, 12);
    const plain = pup(g, 0, 'emberpup');
    const before = effectiveStats(g, deep).atk!;
    const plainBefore = effectiveStats(g, plain).atk!;
    const production = g.mods().factor('production.food');
    expect(before).toBe(plainBefore);

    unlockFeature(g, 'dynasties');
    recordLineage(g, deep);
    const tierBonus = dynastyTier(g, 12) * balance.dynasty.statPerTier;
    expect(lineageBonus(g, deep)).toBeCloseTo(12 * balance.dynasty.statPerDepth);
    expect(effectiveStats(g, deep).atk).toBe(Math.round(before * (1 + lineageBonus(g, deep) + tierBonus)));
    expect(effectiveStats(g, plain).atk).toBe(Math.round(plainBefore * (1 + tierBonus)));
    expect(g.mods().factor('production.food')).toBeGreaterThan(production);
  });

  it('the own line bonus is capped', () => {
    const g = dynastyGame();
    expect(lineageBonus(g, pup(g, 500))).toBe(balance.dynasty.maxDepthBonus);
  });

  it('the Zuchtautomat can deepen the best pure line', () => {
    const g = dynastyGame();
    g.state.creatures = [];
    pup(g, 3); pup(g, 3); pup(g, 9); pup(g, 1);
    const b1 = pup(g, 4, 'bubbloon');
    const b2 = pup(g, 5, 'bubbloon');
    g.state.automation.autoBreed.rule = 'lineage';
    const plan = planAutoBreed(g);
    expect(plan.ok && [plan.a.id, plan.b.id].sort()).toEqual([b1.id, b2.id].sort());
  });

  it('older saves get creatures without a line', () => {
    const g = dynastyGame();
    const raw = JSON.parse(serialize(g.state));
    raw.saveVersion = 7;
    for (const c of raw.state.creatures) delete c.lineage;
    delete raw.state.dynasties;
    const { state } = deserialize(JSON.stringify(raw));
    expect(state.creatures.every((c) => c.lineage === 0)).toBe(true);
    expect(state.dynasties).toEqual({});
  });
});

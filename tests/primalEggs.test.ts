import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { createCreature } from '@core/creatures';
import { rollOffspringSpecies } from '@core/features/hybrids';
import { deliverContract, refreshContracts } from '@core/features/contracts';
import { leaveRpgRun, lootChance, refreshTorches, startRpgRun } from '@core/features/rpg';
import {
  findPrimalEgg,
  incubatePrimalEgg,
  openPrimalEgg,
  primalChances,
  primalEggsOwned,
  primalNestEggs,
  primalNestVisible,
  primalSpecies,
  primalWeights,
} from '@core/features/primalEggs';
import { familyTree } from '@core/features/dex';
import { debugReset } from '@core/debug';
import { plannedNotices } from '@core/notices';
import { performPrestige } from '@core/prestige';
import { unlockFeature } from '@core/systems/unlocks';
import { balance, content, makeGame, NOW } from './helpers';

const H = 3_600_000;
const order = (id: string) => content.rarities.get(id).order;

/** A game with `eggs` Urzeit-Eier in stock (the feature opens with the first one). */
function eggGame(eggs = 1, seed = 7) {
  const g = makeGame(seed);
  findPrimalEgg(g, 'test', eggs);
  g.advance(100);
  return g;
}

/** Lays an egg, lets it finish and opens it; returns the hatchling. */
function hatch(g: ReturnType<typeof makeGame>) {
  expect(incubatePrimalEgg(g).ok).toBe(true);
  const egg = primalNestEggs(g)[0]!;
  egg.elapsedMs = egg.durationMs - 50;
  g.advance(200);
  const result = openPrimalEgg(g, egg.id);
  expect(result.ok).toBe(true);
  return result.hatched!;
}

describe('Urzeitwesen', () => {
  it('stand outside the family tree: no wild find, no recipe, no capsule', () => {
    const primal = primalSpecies(makeGame());
    expect(primal.length).toBeGreaterThanOrEqual(6);
    const results = new Set([...content.recipes.list.map((r) => r.result), ...content.evolutions.list.map((e) => e.to)]);
    for (const s of primal) {
      expect(s.wild, s.id).toBe(false);
      expect(s.eggWeight, s.id).toBeGreaterThan(0);
      expect(results.has(s.id), s.id).toBe(false);
      expect(content.missions.list.some((m) => m.species?.includes(s.id)), s.id).toBe(false);
      expect(content.voyageDestinations.list.some((d) => d.species.includes(s.id)), s.id).toBe(false);
    }
    for (const c of content.capsules.list) expect(c.tierWeights.primal ?? 0, c.id).toBe(0);
  });

  it('pass on their species only among themselves', () => {
    const g = makeGame();
    const raptor = createCreature(g, { speciesId: 'glutraptor', rarity: 'rare' });
    const raptor2 = createCreature(g, { speciesId: 'glutraptor', rarity: 'rare' });
    const pup = createCreature(g, { speciesId: 'emberpup', rarity: 'common' });
    for (let i = 0; i < 30; i++) {
      expect(rollOffspringSpecies(g, raptor, pup)).toBe('emberpup');
      expect(rollOffspringSpecies(g, pup, raptor)).toBe('emberpup');
      expect(rollOffspringSpecies(g, raptor, raptor2)).toBe('glutraptor');
    }
  });

  it('get their own group in the dex; the egg is named only after the first find', () => {
    const fresh = makeGame();
    const group = familyTree(fresh).find((t) => t.tier === 'primal')!;
    expect(group.name).toBe('Urzeitwesen');
    expect(group.nodes.length).toBe(primalSpecies(fresh).length);
    expect(group.nodes[0]!.origins).toMatchObject([{ kind: 'egg', hint: null }]);
    const g = eggGame();
    expect(familyTree(g).find((t) => t.tier === 'primal')!.nodes[0]!.origins[0]!.hint).toContain('Urzeit-Ei');
  });
});

describe('Urzeit-Eier', () => {
  it('open the feature with the first egg; without one nothing can be laid', () => {
    const g = makeGame();
    expect(primalNestVisible(g)).toBe(false);
    expect(incubatePrimalEgg(g).ok).toBe(false);
    findPrimalEgg(g, 'test');
    g.advance(100);
    expect(g.state.features['primalEggs']).toBe(true);
    expect(primalNestVisible(g)).toBe(true);
    expect(primalEggsOwned(g)).toBe(1);
  });

  it('take hours in the Brutkammer, which holds one egg', () => {
    const g = eggGame(2);
    expect(incubatePrimalEgg(g).ok).toBe(true);
    expect(primalEggsOwned(g)).toBe(1);
    const second = incubatePrimalEgg(g);
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.reason).toContain('belegt');
    const egg = primalNestEggs(g)[0]!;
    expect(egg.durationMs).toBe(balance.primalEggs.hours * H);
    expect(openPrimalEgg(g, egg.id).ok).toBe(false);
  });

  it('wait for the player, then hatch an Urzeitwesen of at least the minimum rarity', () => {
    const g = eggGame(1);
    expect(incubatePrimalEgg(g).ok).toBe(true);
    const egg = primalNestEggs(g)[0]!;
    const count = g.state.creatures.length;
    egg.elapsedMs = egg.durationMs;
    g.advance(1000);
    expect(primalNestEggs(g).length).toBe(1); // finished, but still closed
    expect(g.state.creatures.length).toBe(count);
    const result = openPrimalEgg(g, egg.id);
    expect(result.ok).toBe(true);
    const c = result.hatched!;
    expect(content.species.get(c.speciesId).tier).toBe('primal');
    expect(order(c.rarity)).toBeGreaterThanOrEqual(order(balance.primalEggs.minRarity));
    expect(c.generation).toBe(1);
    expect(g.state.statistics['creatures.primal']).toBe(1);
    expect(primalNestEggs(g).length).toBe(0);
  });

  it('hatch even into a full stable', () => {
    const g = eggGame(1);
    g.state.creatures.length = 0;
    const cap = Math.floor(g.mods().apply('slots.stable', balance.stable.baseCapacity));
    for (let i = 0; i < cap; i++) createCreature(g, { speciesId: 'emberpup', rarity: 'common' });
    expect(hatch(g)).toBeDefined();
    expect(g.state.creatures.length).toBe(cap + 1);
  });

  it('weigh every Urzeitwesen by its eggWeight, discovered or not', () => {
    const g = eggGame();
    const before = primalWeights(g);
    expect(before['ammonix']).toBe(content.species.get('ammonix').eggWeight);
    createCreature(g, { speciesId: 'ammonix', rarity: 'rare' });
    expect(primalWeights(g)).toEqual(before);
    const chances = primalChances(g);
    expect(chances.reduce((a, c) => a + c.chance, 0)).toBeCloseTo(1);
    expect(chances.find((c) => c.species.id === 'ammonix')!.discovered).toBe(true);
  });

  it('roll every Urzeitwesen over many eggs; the rarest stays rare', () => {
    const g = eggGame(1, 11);
    const seen: Record<string, number> = {};
    for (let i = 0; i < 300; i++) {
      const c = hatch(g);
      seen[c.speciesId] = (seen[c.speciesId] ?? 0) + 1;
      findPrimalEgg(g, 'test');
    }
    for (const s of primalSpecies(g)) expect(seen[s.id] ?? 0, s.id).toBeGreaterThan(0);
    expect(seen['starseed']!).toBeLessThan(seen['ammonix']!);
  });

  it('outlast both prestiges, in stock and in the Brutkammer', () => {
    const g = eggGame(2);
    expect(incubatePrimalEgg(g).ok).toBe(true);
    g.state.earned['food'] = D(1e30);
    g.state.earned['gold'] = D(1e30);
    unlockFeature(g, 'inheritance');
    expect(performPrestige(g, 'inheritance').ok).toBe(true);
    expect(primalEggsOwned(g)).toBe(1);
    expect(primalNestEggs(g).length).toBe(1);
    expect(g.state.features['primalEggs']).toBe(true);
  });

  it('announce a finished egg while the player is away', () => {
    const g = eggGame();
    expect(incubatePrimalEgg(g).ok).toBe(true);
    const notices = plannedNotices(g, NOW);
    expect(notices.some((n) => n.kind === 'primalEgg' && n.title.includes('Urzeit-Ei'))).toBe(true);
  });

  it('come from the debug tools until a source is decided', () => {
    const g = makeGame();
    expect(debugReset(g, 'primalEgg').ok).toBe(true);
    expect(primalEggsOwned(g)).toBe(1);
  });
});

describe('Urzeit-Eier – Fundquellen', () => {
  it('no source is switched on yet', () => {
    expect(balance.primalEggs.contractChance).toBe(0);
    for (const room of Object.values(balance.rpg.loot)) expect(room.chance?.['primalEgg'] ?? 0).toBe(0);
  });

  it('Gen-Aufträge: a chance per fulfilled contract', () => {
    const g = makeGame(42, { primalEggs: { ...balance.primalEggs, contractChance: 1 } });
    unlockFeature(g, 'contracts');
    refreshContracts(g);
    const offer = g.state.contracts.offers[0]!;
    offer.requirements = [];
    const c = createCreature(g, { speciesId: 'emberpup', rarity: 'common' });
    expect(deliverContract(g, 0, c.id).ok).toBe(true);
    expect(primalEggsOwned(g)).toBe(1);
  });

  it('GenLab RPG: an entry in the loot table, carried home like any loot', () => {
    const boss = balance.rpg.loot.boss!;
    const loot = { ...balance.rpg.loot, boss: { ...boss, chance: { ...boss.chance, primalEgg: 0.05 } } };
    const g = makeGame(42, { rpg: { ...balance.rpg, loot } });
    unlockFeature(g, 'rpg');
    refreshTorches(g, NOW);
    expect(startRpgRun(g, g.state.creatures[0]!.id, 'rootMaze').ok).toBe(true);
    expect(lootChance(g, g.state.rpg.run!, 'boss', 'primalEgg')).toBeGreaterThan(0);
    g.state.rpg.run!.loot = { primalEgg: 1 };
    expect(leaveRpgRun(g).ok).toBe(true);
    expect(primalEggsOwned(g)).toBe(1);
    g.advance(100);
    expect(g.state.features['primalEggs']).toBe(true);
  });
});

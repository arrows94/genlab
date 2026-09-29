import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { createCreature, findCreature } from '@core/creatures';
import { breedingTimeMs, startBreeding } from '@core/features/breeding';
import { foundFamily, givenName } from '@core/names';
import { deserialize, serialize } from '@core/save';
import { unlockFeature } from '@core/systems/unlocks';
import type { Creature } from '@core/state';
import { balance, content, makeGame } from './helpers';

function nameGame(seed = 4) {
  const g = makeGame(seed);
  unlockFeature(g, 'breeding');
  g.state.resources.food = D(1e12);
  g.state.resources.gold = D(1e12);
  g.state.creatures = [];
  return g;
}

const mk = (g: ReturnType<typeof nameGame>, species: string, power: number, family: string | null = null) =>
  createCreature(g, { speciesId: species, rarity: 'common', abilities: [], genome: {}, family, stats: { hp: power, atk: power, def: power, spd: power }, exactStats: true });

function hatch(g: ReturnType<typeof nameGame>, a: Creature, b: Creature): Creature {
  const ids: number[] = [];
  const off = g.bus.on('eggHatched', (e) => ids.push(e.creatureId));
  expect(startBreeding(g, a.id, b.id).ok).toBe(true);
  g.advance(breedingTimeMs(g, 60, [a, b]) + 1000);
  off();
  return findCreature(g, ids[0]!)!;
}

const given = () => content.nameLists.get('given').words;

describe('offspring names: Rufname + Familie', () => {
  it('the stronger parent founds a family named after its element; the child carries it', () => {
    const g = nameGame();
    const strong = mk(g, 'emberpup', 50);
    const weak = mk(g, 'bubbloon', 5);
    const child = hatch(g, strong, weak);
    const [rufname, family, ...rest] = child.name.split(' ');
    expect(rest).toEqual([]);
    expect(given()).toContain(rufname);
    expect(child.family).toBe(family);
    expect(content.elements.get('fire').familyPrefixes.some((p) => family!.startsWith(p))).toBe(true);
    // The founder carries the family from now on (its name stays).
    expect(strong.family).toBe(family);
    expect(strong.name).toBe('Glutwelpe');
    expect(weak.family).toBeNull();
  });

  it('children take the stronger parent’s family, siblings get different Rufnamen', () => {
    const g = nameGame();
    const a = mk(g, 'emberpup', 50, 'Funkenstein');
    const b = mk(g, 'emberpup', 10, 'Tauhain');
    const first = hatch(g, a, b);
    const second = hatch(g, a, b);
    expect(first.family).toBe('Funkenstein');
    expect(second.family).toBe('Funkenstein');
    expect(first.name.split(' ')[0]).not.toBe(second.name.split(' ')[0]);
    // Without a family of its own, the weaker parent's is passed on.
    const c = mk(g, 'bubbloon', 90);
    expect(hatch(g, c, b).family).toBe('Tauhain');
  });

  it('never gets longer than the name limit and never stutters over generations', () => {
    const g = nameGame(9);
    for (let i = 0; i < 300; i++) {
      const family = foundFamily(g, g.rng.pick(content.elements.list).id);
      expect(`${givenName(g, family)} ${family}`.length).toBeLessThanOrEqual(balance.creature.maxNameLength);
    }
    let pair = [mk(g, 'emberpup', 20), mk(g, 'emberpup', 20)] as [Creature, Creature];
    for (let gen = 0; gen < 12; gen++) {
      const x = hatch(g, pair[0], pair[1]);
      const y = hatch(g, pair[0], pair[1]);
      for (const c of [x, y]) {
        expect(c.name).toMatch(/^\S+ \S+$/);
        expect(given()).toContain(c.name.split(' ')[0]);
      }
      g.state.creatures = [x, y];
      pair = [x, y];
    }
  });

  it('keeps names reproducible with the same seed', () => {
    const names = (seed: number) => {
      const g = nameGame(seed);
      return Array.from({ length: 5 }, () => `${givenName(g, null)} ${foundFamily(g, 'water')}`);
    };
    expect(names(5)).toEqual(names(5));
  });

  it('older saves get creatures without a family', () => {
    const g = nameGame();
    mk(g, 'emberpup', 10, 'Funkenstein');
    const raw = JSON.parse(serialize(g.state));
    raw.saveVersion = 7;
    for (const c of raw.state.creatures) delete c.family;
    const { state } = deserialize(JSON.stringify(raw));
    expect(state.creatures.every((c) => c.family === null)).toBe(true);
  });
});

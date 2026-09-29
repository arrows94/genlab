import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { createCreature, findCreature } from '@core/creatures';
import { breedingTimeMs, startBreeding } from '@core/features/breeding';
import { blendNames, epithetFor, foundFamily, givenName, rufname, syllables } from '@core/names';
import { renameCreature, setNameStyle } from '@core/actions';
import { Rng } from '@core/rng';
import { deserialize, serialize } from '@core/save';
import { unlockFeature } from '@core/systems/unlocks';
import type { Creature } from '@core/state';
import { balance, content, makeGame } from './helpers';

function nameGame(seed = 4, freshNameChance = balance.creature.freshNameChance) {
  const g = makeGame(seed, { creature: { ...balance.creature, freshNameChance } });
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

/** A Rufname follows the rules: not too long, at most 3 syllables, no stuttering. */
function wellFormed(name: string) {
  const parts = syllables(name).map((p) => p.toLowerCase());
  return name.length <= balance.creature.maxGivenLength && parts.length <= 3 + 1 && !/(.)\1\1/i.test(name);
}

describe('offspring names: Rufname + Familie', () => {
  it('the stronger parent founds a family named after its element; the child carries it', () => {
    const g = nameGame();
    const strong = mk(g, 'emberpup', 50);
    const weak = mk(g, 'bubbloon', 5);
    const child = hatch(g, strong, weak);
    const [first, family, ...rest] = child.name.split(' ');
    expect(rest).toEqual([]);
    expect(wellFormed(first!)).toBe(true);
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

  it('never gets longer than the name limit, and a line keeps varied names over many generations', () => {
    const g = nameGame(9);
    for (let i = 0; i < 300; i++) {
      const family = foundFamily(g, g.rng.pick(content.elements.list).id);
      expect(`${givenName(g, family)} ${family}`.length).toBeLessThanOrEqual(balance.creature.maxNameLength);
    }
    let pair = [mk(g, 'emberpup', 20), mk(g, 'emberpup', 20)] as [Creature, Creature];
    const late: string[] = [];
    for (let gen = 0; gen < 30; gen++) {
      const x = hatch(g, pair[0], pair[1]);
      const y = hatch(g, pair[0], pair[1]);
      for (const c of [x, y]) {
        expect(c.name).toMatch(/^\S+ \S+$/);
        expect(c.name.length).toBeLessThanOrEqual(balance.creature.maxNameLength);
        const parts = syllables(rufname(c)).map((p) => p.toLowerCase());
        expect(new Set(parts).size, c.name).toBe(parts.length);
        expect(/(.)\1\1/i.test(c.name), c.name).toBe(false);
        if (gen >= 20) late.push(rufname(c));
      }
      g.state.creatures = [x, y];
      pair = [x, y];
    }
    // No convergence to „Fafa“: the last ten generations still have many different Rufnamen.
    expect(new Set(late).size).toBeGreaterThanOrEqual(12);
  });

  it('children mostly blend their parents’ Rufnamen', () => {
    const g = nameGame(3, 0);
    const a = mk(g, 'emberpup', 50, 'Funkenstein');
    const b = mk(g, 'emberpup', 10, 'Funkenstein');
    a.name = 'Kiko Funkenstein';
    b.name = 'Mira Funkenstein';
    for (let i = 0; i < 6; i++) {
      const child = hatch(g, a, b);
      const first = rufname(child).toLowerCase();
      expect(first.startsWith('ki') || first.startsWith('mi'), child.name).toBe(true);
      expect(first.endsWith('ko') || first.endsWith('ra'), child.name).toBe(true);
      g.state.creatures = g.state.creatures.filter((c) => c === a || c === b);
    }
  });

  it('epic and better or shiny creatures get a Beiname from their best stat', () => {
    const g = nameGame();
    const common = createCreature(g, { speciesId: 'emberpup', rarity: 'common' });
    expect(common.epithet).toBeNull();
    const base = content.species.get('emberpup').baseStats;
    const fast = createCreature(g, { speciesId: 'emberpup', rarity: 'epic', stats: { ...base, spd: (base.spd ?? 1) * 3 }, exactStats: true });
    expect(content.nameLists.get('epithet.spd').words).toContain(fast.epithet);
    const shiny = createCreature(g, { speciesId: 'emberpup', rarity: 'common', shiny: true });
    expect(content.nameLists.get('epithet.shiny').words).toContain(shiny.epithet);
    expect(epithetFor(g, { ...common, rarity: 'legendary' })).not.toBeNull();
  });

  it('keeps names reproducible with the same seed', () => {
    const names = (seed: number) => {
      const g = nameGame(seed);
      return Array.from({ length: 5 }, () => `${givenName(g, null)} ${foundFamily(g, 'water')}`);
    };
    expect(names(5)).toEqual(names(5));
  });

  it('the option „Klassisch“ brings back names blended from both parents', () => {
    const g = nameGame();
    expect(g.state.nameStyle).toBe('family');
    expect(setNameStyle(g, 'weird').ok).toBe(false);
    expect(setNameStyle(g, 'classic').ok).toBe(true);
    const a = mk(g, 'emberpup', 50);
    const b = mk(g, 'emberpup', 10);
    a.name = 'Funke';
    b.name = 'Moosbart';
    for (let i = 0; i < 5; i++) {
      const child = hatch(g, a, b);
      expect(child.name).not.toContain(' ');
      expect(/^(Fu|Moo)/.test(child.name), child.name).toBe(true);
      expect(child.name.length).toBeLessThanOrEqual(balance.creature.classicName.maxLength);
      // The family still passes on, so switching back continues the line.
      expect(child.family).toBe(a.family);
      g.state.creatures = [a, b];
    }
    setNameStyle(g, 'family');
    expect(hatch(g, a, b).name).toMatch(/^\S+ \S+$/);
  });

  it('classic blends stay reproducible and fall back when nothing fits', () => {
    const rules = balance.creature.classicName;
    const names = (seed: number) => Array.from({ length: 20 }, () => blendNames(Rng.fromSeed(seed), 'Funke', 'Blubbling', rules, 'x'));
    expect(names(5)).toEqual(names(5));
    expect(blendNames(Rng.fromSeed(1), 'Ab', 'C', rules, 'Glutwelpe')).toBe('Glutwelpe');
  });

  it('a surname the player gives becomes the family of the offspring – and wins over an automatic one', () => {
    const g = nameGame();
    const strong = mk(g, 'emberpup', 50, 'Funkenstein');
    const weak = mk(g, 'emberpup', 10, 'Tauhain');
    expect(renameCreature(g, weak.id, '  Kiko   Sonnenschein ').ok).toBe(true);
    expect(weak.name).toBe('Kiko Sonnenschein');
    expect(weak.family).toBe('Sonnenschein');
    const child = hatch(g, strong, weak);
    expect(child.family).toBe('Sonnenschein');
    expect(child.name.endsWith(' Sonnenschein')).toBe(true);
    // Several words: everything after the Rufname.
    renameCreature(g, strong.id, 'Rex von Stein');
    expect(strong.family).toBe('von Stein');
    // A single word keeps the family.
    renameCreature(g, strong.id, 'Rex');
    expect(strong.family).toBe('von Stein');
  });

  it('a long surname still fits the name limit', () => {
    const g = nameGame();
    const a = mk(g, 'emberpup', 50);
    const b = mk(g, 'emberpup', 10);
    renameCreature(g, a.id, 'Ab Schnuckelputzhausen');
    for (let i = 0; i < 5; i++) {
      const child = hatch(g, a, b);
      expect(child.family).toBe('Schnuckelputzhausen');
      expect(child.name.length).toBeLessThanOrEqual(balance.creature.maxNameLength);
      g.state.creatures = [a, b];
    }
  });

  it('older saves get creatures without a family and Beiname', () => {
    const g = nameGame();
    mk(g, 'emberpup', 10, 'Funkenstein');
    const raw = JSON.parse(serialize(g.state));
    raw.saveVersion = 7;
    for (const c of raw.state.creatures) {
      delete c.family;
      delete c.epithet;
    }
    const { state } = deserialize(JSON.stringify(raw));
    expect(state.creatures.every((c) => c.family === null && c.epithet === null)).toBe(true);
  });
});

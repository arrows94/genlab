import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { Rng } from '@core/rng';
import { blendNames, syllables } from '@core/names';
import { startBreeding } from '@core/features/breeding';
import { unlockFeature } from '@core/systems/unlocks';
import { balance, makeGame } from './helpers';

const rules = balance.creature.offspringName;

describe('offspring names', () => {
  it('splits names into syllables', () => {
    expect(syllables('Glutwelpe')).toEqual(['Glu', 'twe', 'lpe']);
    expect(syllables('Sprössling')).toEqual(['Sprö', 'ssling']);
    expect(syllables('Ferrox')).toEqual(['Fe', 'rrox']);
    expect(syllables('Xyz')).toEqual(['Xyz']);
  });

  it('blends start of one parent with the end of the other', () => {
    const rng = Rng.fromSeed(3);
    for (let i = 0; i < 200; i++) {
      const name = blendNames(rng, 'Glutwelpe', 'Sprössling', rules, 'Fallback');
      expect(name.length).toBeGreaterThanOrEqual(rules.minLength);
      expect(name.length).toBeLessThanOrEqual(rules.maxLength);
      expect(['glutwelpe', 'sprössling']).not.toContain(name.toLowerCase());
      // Always starts with a parent's first syllable.
      expect(/^(glu|sprö)/.test(name.toLowerCase()), name).toBe(true);
    }
  });

  it('is random but reproducible with the same seed', () => {
    const names = (seed: number) => Array.from({ length: 20 }, () => blendNames(Rng.fromSeed(seed), 'Funke', 'Blubbling', rules, 'x'));
    expect(names(5)).toEqual(names(5));
    const rng = Rng.fromSeed(9);
    const variety = new Set(Array.from({ length: 50 }, () => blendNames(rng, 'Funke', 'Blubbling', rules, 'x')));
    expect(variety.size).toBeGreaterThan(3);
  });

  it('falls back when no valid blend exists', () => {
    // "Ab" × "C" can only make 3-letter names (below the minimum length).
    expect(blendNames(Rng.fromSeed(1), 'Ab', 'C', rules, 'Glutwelpe')).toBe('Glutwelpe');
    expect(blendNames(Rng.fromSeed(1), '', 'Funke', rules, 'Glutwelpe')).toBe('Glutwelpe');
  });

  it('hatched offspring get a blended name of their (renamed) parents', () => {
    const g = makeGame(4);
    unlockFeature(g, 'breeding');
    g.state.resources.food = D(1e9);
    const [a, b] = g.state.creatures;
    a!.name = 'Funke';
    b!.name = 'Moosbart';
    startBreeding(g, a!.id, b!.id);
    g.advance(120_000);
    const child = g.state.creatures.at(-1)!;
    expect(child.name).not.toBe('Funke');
    expect(child.name).not.toBe('Moosbart');
    expect(/^(Fu|Moo)/.test(child.name)).toBe(true);
  });
});

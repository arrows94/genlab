import { describe, expect, it } from 'vitest';
import { speciesHabitats, tierProgress } from '@core/features/dex';
import { unlockFeature } from '@core/systems/unlocks';
import { content, makeGame } from './helpers';

describe('dex read model', () => {
  it('names the regions a species lives in, unopened ones stay unnamed', () => {
    const g = makeGame();
    const frost = speciesHabitats(g, 'frostling');
    const peak = frost.find((h) => h.id === 'frostpeak')!;
    expect(peak.name).toBeNull(); // Frostgipfel needs the Kartograf
    expect(frost.find((h) => h.id === 'short')).toBeUndefined(); // region-only species
    expect(speciesHabitats(g, 'emberpup').find((h) => h.id === 'short')?.name).toBe(content.missions.get('short').name); // no species list: every wild species
    g.state.upgrades.cartographer = 10;
    expect(speciesHabitats(g, 'frostling').find((h) => h.id === 'frostpeak')!.name).toBe('Frostgipfel');
    // Hybrids do not live in the wild.
    expect(speciesHabitats(g, 'steamling').filter((h) => h.kind === 'mission')).toEqual([]);
  });

  it('shows voyage destinations once voyages exist', () => {
    const g = makeGame();
    const dest = content.voyageDestinations.list[0]!;
    const sp = dest.species[0]!;
    expect(speciesHabitats(g, sp).find((h) => h.id === dest.id)?.name).toBeNull();
    unlockFeature(g, 'voyage');
    expect(speciesHabitats(g, sp).find((h) => h.id === dest.id)?.name).toBe(dest.name);
  });

  it('counts dex progress per tier', () => {
    const g = makeGame();
    g.state.dex = { 'emberpup:common': true, 'emberpup:rare': true, 'steamling:epic': true };
    const base = tierProgress(g, 'base');
    const bases = content.species.list.filter((s) => s.tier === 'base').length;
    expect(base).toEqual({ entries: 2, entriesTotal: bases * content.rarities.list.length, species: 1, speciesTotal: bases });
    expect(tierProgress(g, 'hybrid').species).toBe(1);
  });
});

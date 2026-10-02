import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { createCreature } from '@core/creatures';
import { buyUpgrade } from '@core/actions';
import { checkEvolution, evolutionsFor, evolve } from '@core/features/evolution';
import {
  averageBase,
  carriesAllele,
  hybridChance,
  isRecipeDiscovered,
  isSpeciesDiscovered,
  rarityAtLeast,
  recipeMatches,
  reprofileStats,
  revealHint,
} from '@core/features/hybrids';
import { unlockFeature } from '@core/systems/unlocks';
import type { HybridRecipeDef } from '@core/content/types';
import { content, makeGame } from './helpers';

const recipe = (id: string) => content.recipes.get(id);
const evolution = (id: string) => content.evolutions.get(id);

function hybridGame(seed = 7) {
  const g = makeGame(seed);
  unlockFeature(g, 'breeding');
  unlockFeature(g, 'hybrids');
  for (const r of ['food', 'gold', 'essence', 'catalyst']) g.state.resources[r] = D(1e9);
  return g;
}

function evoGame(seed = 7) {
  const g = hybridGame(seed);
  unlockFeature(g, 'evolution');
  return g;
}

describe('hybrid helpers', () => {
  it('rarityAtLeast compares rarity order, carriesAllele reads either chromosome', () => {
    const g = hybridGame();
    expect(rarityAtLeast(g, 'epic', 'epic')).toBe(true);
    expect(rarityAtLeast(g, 'legendary', 'rare')).toBe(true);
    expect(rarityAtLeast(g, 'uncommon', 'rare')).toBe(false);

    const c = createCreature(g, { speciesId: 'emberpup', rarity: 'common' });
    c.genome.stamina = ['a', 'Ae'];
    expect(carriesAllele(c, 'stamina', 'Ae')).toBe(true);
    c.genome.stamina = ['a', 'a'];
    expect(carriesAllele(c, 'stamina', 'Ae')).toBe(false);
    // A locus missing from the genome never carries anything.
    delete c.genome.stamina;
    expect(carriesAllele(c, 'stamina', 'Ae')).toBe(false);
  });

  it('recipeMatches: one parent with the allele suffices, a condition is checked against state', () => {
    const g = hybridGame();
    const hawk = createCreature(g, { speciesId: 'stormhawk', rarity: 'common' });
    const zeph = createCreature(g, { speciesId: 'zephyrix', rarity: 'common' });
    hawk.genome.speed = ['a', 'a'];
    zeph.genome.speed = ['a', 'a'];
    expect(recipeMatches(g, recipe('tempest'), hawk, zeph)).toBe(false);
    zeph.genome.speed = ['Tb', 'a'];
    expect(recipeMatches(g, recipe('tempest'), hawk, zeph)).toBe(true);

    // minGeneration uses the younger parent.
    const prism = createCreature(g, { speciesId: 'prismin', rarity: 'common', generation: 5 });
    const volt = createCreature(g, { speciesId: 'voltmouse', rarity: 'common', generation: 1 });
    expect(recipeMatches(g, recipe('voltprism'), prism, volt)).toBe(false);
    volt.generation = 2;
    expect(recipeMatches(g, recipe('voltprism'), prism, volt)).toBe(true);

    const gated: HybridRecipeDef = { ...recipe('steam'), requires: { condition: { type: 'feature', feature: 'evolution' } } };
    const ember = createCreature(g, { speciesId: 'emberpup', rarity: 'common' });
    const bubble = createCreature(g, { speciesId: 'bubbloon', rarity: 'common' });
    expect(recipeMatches(g, gated, ember, bubble)).toBe(false);
    unlockFeature(g, 'evolution');
    expect(recipeMatches(g, gated, ember, bubble)).toBe(true);
  });

  it('hybridChance grows with the Kreuzungstheorie upgrade and is clamped to [0, 1]', () => {
    const g = hybridGame();
    const before = hybridChance(g, recipe('steam'));
    expect(before).toBeGreaterThan(0);
    expect(buyUpgrade(g, 'hybridTheory').ok).toBe(true);
    expect(hybridChance(g, recipe('steam'))).toBeGreaterThan(before);

    expect(hybridChance(g, { ...recipe('steam'), chance: 5 })).toBe(1);
    expect(hybridChance(g, { ...recipe('steam'), chance: -1 })).toBe(0);
  });

  it('a species / recipe counts as discovered once any rarity of the result is in the dex', () => {
    const g = hybridGame();
    expect(isSpeciesDiscovered(g, 'steamling')).toBe(false);
    expect(isRecipeDiscovered(g, recipe('steam'))).toBe(false);
    g.state.dex['steamling:legendary'] = true;
    expect(isSpeciesDiscovered(g, 'steamling')).toBe(true);
    expect(isRecipeDiscovered(g, recipe('steam'))).toBe(true);
    expect(isRecipeDiscovered(g, recipe('magma'))).toBe(false);
  });

  it('revealHint skips hinted and discovered recipes and returns null when none is left', () => {
    const g = hybridGame();
    const all = content.recipes.list.map((r) => r.id);
    // Leave only 'magma' open: 'steam' discovered, the rest hinted.
    g.state.dex['steamling:common'] = true;
    for (const id of all) if (id !== 'magma' && id !== 'steam') g.state.recipeHints[id] = true;
    const events: string[] = [];
    g.bus.on('recipeHinted', (e) => events.push(e.recipe));

    expect(revealHint(g)).toBe('magma');
    expect(g.state.recipeHints.magma).toBe(true);
    expect(g.state.recipeHints.steam).toBeFalsy();
    expect(events).toEqual(['magma']);
    expect(revealHint(g)).toBeNull();
    expect(events).toEqual(['magma']);
  });

  it('averageBase averages two species, reprofileStats scales each stat by target/source base', () => {
    const g = hybridGame();
    // emberpup { hp 20, atk 7, def 4, spd 5 }, bubbloon { hp 24, atk 5, def 6, spd 4 }
    expect(averageBase(g, 'emberpup', 'bubbloon')).toEqual({ hp: 22, atk: 6, def: 5, spd: 4.5 });

    // steamling { hp 26, atk 8, def 6, spd 6 } → geysirus { hp 38, atk 12, def 9, spd 9 }
    const from = content.species.get('steamling').baseStats;
    expect(reprofileStats(g, { hp: 52, atk: 16, def: 12, spd: 12 }, from, 'geysirus')).toEqual({ hp: 76, atk: 24, def: 18, spd: 18 });
    // Rounded, never below 1, a missing stat counts as 0.
    expect(reprofileStats(g, { hp: 1, atk: 0, def: 6, spd: 6 }, from, 'geysirus')).toEqual({ hp: 1, atk: 1, def: 9, spd: 9 });
  });
});

describe('evolution', () => {
  it('evolutionsFor lists only evolutions starting at the creature species', () => {
    const g = evoGame();
    const steam = createCreature(g, { speciesId: 'steamling', rarity: 'common' });
    const ember = createCreature(g, { speciesId: 'emberpup', rarity: 'common' });
    expect(evolutionsFor(g, steam).map((e) => e.id)).toEqual(['geysir']);
    expect(evolutionsFor(g, ember)).toEqual([]);
  });

  it('checkEvolution lists every requirement with a German label and readiness', () => {
    const g = evoGame();
    const c = createCreature(g, { speciesId: 'volcanodrake', rarity: 'rare', generation: 5 });
    const check = checkEvolution(g, c, evolution('phoenix'));
    expect(check.requirements).toEqual([
      { label: 'Generation ≥ 6', met: false },
      { label: 'Seltenheit ≥ Episch', met: false },
      { label: 'Kosten', met: true },
    ]);
    expect(check.ready).toBe(false);

    c.generation = 6;
    c.rarity = 'epic';
    expect(checkEvolution(g, c, evolution('phoenix')).ready).toBe(true);

    g.state.resources.essence = D(10);
    const poor = checkEvolution(g, c, evolution('phoenix'));
    expect(poor.requirements.find((r) => r.label === 'Kosten')?.met).toBe(false);
    expect(poor.ready).toBe(false);
  });

  it('a busy creature cannot evolve, a building worker can', () => {
    const g = evoGame();
    const c = createCreature(g, { speciesId: 'steamling', rarity: 'common', generation: 4 });
    c.job = { kind: 'mission', target: 'x' };
    expect(checkEvolution(g, c, evolution('geysir')).requirements.at(-1)).toEqual({ label: 'Kreatur ist frei', met: false });
    expect(evolve(g, c.id, 'geysir')).toEqual({ ok: false, reason: 'Bedingung fehlt: Kreatur ist frei' });
    expect(c.speciesId).toBe('steamling');

    c.job = { kind: 'building', target: 'x' };
    expect(checkEvolution(g, c, evolution('geysir')).ready).toBe(true);
    expect(evolve(g, c.id, 'geysir').ok).toBe(true);
    expect(c.speciesId).toBe('geysirus');
  });

  it('evolve pays the full cost and keeps a custom name', () => {
    const g = evoGame();
    const c = createCreature(g, { speciesId: 'steamling', rarity: 'epic', generation: 4, name: 'Brodel' });
    const essence = g.state.resources.essence!.toNumber();
    const catalyst = g.state.resources.catalyst!.toNumber();
    expect(evolve(g, c.id, 'geysir').ok).toBe(true);
    expect(g.state.resources.essence!.toNumber()).toBe(essence - 50);
    expect(g.state.resources.catalyst!.toNumber()).toBe(catalyst - 2);
    expect(c.name).toBe('Brodel');
    expect(g.state.dex['geysirus:epic']).toBe(true);
    // The evolved creature has no further evolution path.
    expect(evolutionsFor(g, c)).toEqual([]);
  });

  it('evolve fails with German reasons and changes nothing', () => {
    const g = hybridGame();
    const c = createCreature(g, { speciesId: 'steamling', rarity: 'common', generation: 1 });
    expect(evolve(g, c.id, 'geysir')).toEqual({ ok: false, reason: 'Evolution ist noch nicht freigeschaltet.' });
    unlockFeature(g, 'evolution');
    expect(evolve(g, 99999, 'geysir')).toEqual({ ok: false, reason: 'Kreatur nicht gefunden.' });
    expect(evolve(g, c.id, 'leviathan')).toEqual({ ok: false, reason: 'Diese Kreatur kann sich so nicht entwickeln.' });
    expect(evolve(g, c.id, 'geysir')).toEqual({ ok: false, reason: 'Bedingung fehlt: Generation ≥ 4' });

    const fin = createCreature(g, { speciesId: 'aurorafin', rarity: 'common', generation: 6 });
    fin.genome.stamina = ['a', 'a'];
    expect(evolve(g, fin.id, 'leviathan')).toEqual({ ok: false, reason: 'Das Genom muss zuerst sequenziert werden.' });
    fin.sequenced = true;
    const label = checkEvolution(g, fin, evolution('leviathan')).requirements.find((r) => r.label.startsWith('Allel'))!;
    expect(label.met).toBe(false);
    expect(evolve(g, fin.id, 'leviathan')).toEqual({ ok: false, reason: `Bedingung fehlt: ${label.label}` });

    expect(c.speciesId).toBe('steamling');
    expect(fin.speciesId).toBe('aurorafin');
    expect(g.state.dex['geysirus:common']).toBeFalsy();
    expect(g.state.resources.catalyst!.toNumber()).toBe(1e9);
  });
});

import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { createCreature } from '@core/creatures';
import { buyUpgrade } from '@core/actions';
import { startBreeding } from '@core/features/breeding';
import { breedingPreview } from '@core/features/planner';
import { hybridChance, recipeMatches, revealHint, rollOffspringSpecies } from '@core/features/hybrids';
import { checkEvolution, evolve } from '@core/features/evolution';
import { familyTree } from '@core/features/dex';
import { hintChance, missionAvailable, missionSpecies, startMission } from '@core/features/expedition';
import { addBuff } from '@core/systems/buffs';
import { unlockFeature } from '@core/systems/unlocks';
import { content, makeGame } from './helpers';

const recipe = (id: string) => content.recipes.get(id);

function hybridGame(seed = 4) {
  const g = makeGame(seed);
  unlockFeature(g, 'breeding');
  unlockFeature(g, 'hybrids');
  for (const r of ['food', 'gold', 'essence', 'catalyst']) g.state.resources[r] = D(1e9);
  return g;
}

describe('species pool', () => {
  it('has 12 base species, one per element', () => {
    const base = content.species.list.filter((s) => s.tier === 'base');
    expect(base).toHaveLength(12);
    expect(new Set(base.map((s) => s.element)).size).toBe(12);
  });

  it('every non-base species is reachable by a recipe, an evolution or an Urzeit-Ei', () => {
    const reachable = new Set([
      ...content.recipes.list.map((r) => r.result),
      ...content.evolutions.list.map((e) => e.to),
      ...content.species.list.filter((s) => s.tier === 'primal' && (s.eggWeight ?? 0) > 0).map((s) => s.id),
    ]);
    for (const s of content.species.list.filter((x) => x.tier !== 'base')) expect(reachable.has(s.id), s.id).toBe(true);
  });

  it('every recipe parent is obtainable (wild, region, or itself a result)', () => {
    const obtainable = new Set<string>([
      ...content.species.list.filter((s) => s.wild).map((s) => s.id),
      ...content.missions.list.flatMap((m) => m.species ?? []),
      ...content.recipes.list.map((r) => r.result),
      ...content.evolutions.list.map((e) => e.to),
    ]);
    for (const r of content.recipes.list) for (const p of r.parents) expect(obtainable.has(p), `${r.id}: ${p}`).toBe(true);
  });

  it('the family tree climbs: base → hybrid → rare hybrid → mythic', () => {
    const tier = (id: string) => content.species.get(id).tier;
    expect(tier(recipe('steam').result)).toBe('hybrid');
    expect(tier(recipe('volcano').result)).toBe('rareHybrid');
    expect(tier(content.evolutions.get('phoenix').to)).toBe('mythic');
  });
});

describe('hybrid recipes', () => {
  it('match in either parent order', () => {
    const g = hybridGame();
    const a = createCreature(g, { speciesId: 'emberpup', rarity: 'common' });
    const b = createCreature(g, { speciesId: 'bubbloon', rarity: 'common' });
    expect(recipeMatches(g, recipe('steam'), a, b)).toBe(true);
    expect(recipeMatches(g, recipe('steam'), b, a)).toBe(true);
    expect(recipeMatches(g, recipe('magma'), a, b)).toBe(false);
  });

  it('check generation, rarity and allele requirements', () => {
    const g = hybridGame();
    const magmole = createCreature(g, { speciesId: 'magmole', rarity: 'common', generation: 3 });
    const ember = createCreature(g, { speciesId: 'emberpup', rarity: 'common', generation: 5 });
    expect(recipeMatches(g, recipe('volcano'), magmole, ember)).toBe(false);
    magmole.generation = 4;
    expect(recipeMatches(g, recipe('volcano'), magmole, ember)).toBe(true);

    const moss = createCreature(g, { speciesId: 'mossgolem', rarity: 'rare' });
    const vine = createCreature(g, { speciesId: 'venomvine', rarity: 'uncommon' });
    expect(recipeMatches(g, recipe('grove'), moss, vine)).toBe(false);
    vine.rarity = 'epic';
    expect(recipeMatches(g, recipe('grove'), moss, vine)).toBe(true);

    const hawk = createCreature(g, { speciesId: 'stormhawk', rarity: 'common' });
    const zeph = createCreature(g, { speciesId: 'zephyrix', rarity: 'common' });
    hawk.genome.speed = ['t', 't'];
    zeph.genome.speed = ['T', 't'];
    expect(recipeMatches(g, recipe('tempest'), hawk, zeph)).toBe(false);
    zeph.genome.speed = ['Tb', 't'];
    expect(recipeMatches(g, recipe('tempest'), hawk, zeph)).toBe(true);
  });

  it('only produce hybrids once the feature is unlocked', () => {
    const g = makeGame(1);
    const a = createCreature(g, { speciesId: 'emberpup', rarity: 'common' });
    const b = createCreature(g, { speciesId: 'bubbloon', rarity: 'common' });
    addBuff(g, 'test', [{ target: 'breeding.hybridChance', op: 'add', value: 1 }], 1e9);
    for (let i = 0; i < 50; i++) expect(rollOffspringSpecies(g, a, b)).not.toBe('steamling');
    unlockFeature(g, 'hybrids');
    expect(rollOffspringSpecies(g, a, b)).toBe('steamling');
  });

  it('hatch into the hybrid species with its own stat profile', () => {
    const g = hybridGame();
    const [start, sprout] = g.state.creatures;
    const a = createCreature(g, { speciesId: 'pebblit', rarity: 'common', stats: { hp: 28, atk: 5, def: 8, spd: 2 }, exactStats: true });
    void start;
    void sprout;
    const b = createCreature(g, { speciesId: 'sproutle', rarity: 'common', stats: { hp: 22, atk: 4, def: 6, spd: 4 }, exactStats: true });
    addBuff(g, 'test', [{ target: 'breeding.hybridChance', op: 'add', value: 1 }], 1e9);
    expect(startBreeding(g, a.id, b.id).ok).toBe(true);
    g.advance(120_000);
    const child = g.state.creatures.at(-1)!;
    expect(child.speciesId).toBe('mossgolem');
    expect(g.state.dex[`mossgolem:${child.rarity}`]).toBe(true);
    // Moosgolem profile (34/6/10/3) vs parent average (25/4.5/7/3): noticeably tougher.
    expect(child.stats.hp!).toBeGreaterThan(25);
  });

  it('hybrid chance follows modifiers', () => {
    const g = hybridGame();
    const base = hybridChance(g, recipe('steam'));
    g.state.upgrades.hybridTheory = 2;
    g.invalidate();
    expect(hybridChance(g, recipe('steam'))).toBeCloseTo(base * 1.1);
  });
});

describe('recipe hints and the planner', () => {
  it('reveals each hint once and skips discovered hybrids', () => {
    const g = hybridGame();
    createCreature(g, { speciesId: 'steamling', rarity: 'common' });
    const seen = new Set<string>();
    let id: string | null;
    while ((id = revealHint(g))) {
      expect(seen.has(id)).toBe(false);
      seen.add(id);
    }
    expect(seen.has('steam')).toBe(false);
    expect(seen.size).toBe(content.recipes.list.length - 1);
  });

  it('research reveals a hint per level', () => {
    const g = hybridGame();
    const hinted: string[] = [];
    g.bus.on('recipeHinted', (e) => hinted.push(e.recipe));
    expect(buyUpgrade(g, 'hybridTheory').ok).toBe(true);
    expect(hinted).toHaveLength(1);
    expect(g.state.recipeHints[hinted[0]!]).toBe(true);
  });

  it('the planner names discovered hybrids and hides unknown ones', () => {
    const g = hybridGame();
    const a = createCreature(g, { speciesId: 'emberpup', rarity: 'common' });
    const b = createCreature(g, { speciesId: 'bubbloon', rarity: 'common' });
    expect(breedingPreview(g, a, b).species[0]!.id).toBeNull();
    createCreature(g, { speciesId: 'steamling', rarity: 'rare' });
    expect(breedingPreview(g, a, b).species[0]!.id).toBe('steamling');
  });
});

describe('regions', () => {
  it('open with cartographer levels and have their own species', () => {
    const g = hybridGame();
    unlockFeature(g, 'expedition');
    expect(missionAvailable(g, 'frostpeak')).toBe(false);
    expect(startMission(g, g.state.creatures[0]!.id, 'frostpeak').ok).toBe(false);
    g.state.upgrades.cartographer = 2;
    expect(missionAvailable(g, 'frostpeak')).toBe(true);
    expect(missionSpecies(g, 'frostpeak')).toEqual(['frostling', 'ferrox']);
    expect(missionSpecies(g, 'short')).not.toContain('frostling');
  });

  it('longer expeditions are more likely to find recipe hints', () => {
    const g = hybridGame();
    expect(hintChance(g, 'short')).toBeLessThan(hintChance(g, 'medium'));
    expect(hintChance(g, 'medium')).toBeLessThan(hintChance(g, 'long'));
  });
});

describe('evolution', () => {
  function evoGame() {
    const g = hybridGame();
    unlockFeature(g, 'evolution');
    return g;
  }

  it('changes the species, reprofiles stats and registers the dex', () => {
    const g = evoGame();
    const c = createCreature(g, { speciesId: 'steamling', rarity: 'rare', generation: 4, lineage: 3, stats: { hp: 26, atk: 8, def: 6, spd: 6 }, exactStats: true });
    const events: string[] = [];
    g.bus.on('evolved', (e) => events.push(`${e.from}>${e.to}`));
    const catalyst = g.state.resources.catalyst!.toNumber();
    expect(evolve(g, c.id, 'geysir').ok).toBe(true);
    expect(c.speciesId).toBe('geysirus');
    expect(c.name).toBe('Geysirus');
    expect(c.stats).toEqual({ hp: 38, atk: 12, def: 9, spd: 9 });
    expect(c.lineage).toBe(0); // a new species starts its own pure line
    expect(g.state.dex['geysirus:rare']).toBe(true);
    expect(g.state.resources.catalyst!.toNumber()).toBe(catalyst - 2);
    expect(events).toEqual(['steamling>geysirus']);
    expect(g.state.achievements.firstEvolution).toBe(true);
  });

  it('checks requirements', () => {
    const g = evoGame();
    const c = createCreature(g, { speciesId: 'volcanodrake', rarity: 'rare', generation: 6 });
    expect(evolve(g, c.id, 'phoenix')).toEqual({ ok: false, reason: 'Bedingung fehlt: Seltenheit ≥ Episch' });
    c.rarity = 'legendary';
    g.state.resources.catalyst = D(1);
    expect(evolve(g, c.id, 'phoenix')).toEqual({ ok: false, reason: 'Bedingung fehlt: Kosten' });
    g.state.resources.catalyst = D(8);
    expect(evolve(g, c.id, 'phoenix').ok).toBe(true);
    expect(c.speciesId).toBe('phoenix');
  });

  it('allele requirements need a sequenced genome', () => {
    const g = evoGame();
    const c = createCreature(g, { speciesId: 'aurorafin', rarity: 'common', generation: 6 });
    c.genome.stamina = ['Ae', 'a'];
    expect(checkEvolution(g, c, content.evolutions.get('leviathan')).requirements.find((r) => r.label.startsWith('Allel'))?.met).toBeNull();
    expect(evolve(g, c.id, 'leviathan').ok).toBe(false);
    c.sequenced = true;
    expect(evolve(g, c.id, 'leviathan').ok).toBe(true);
  });

  it('refuses the wrong species or without the feature', () => {
    const g = hybridGame();
    const c = createCreature(g, { speciesId: 'steamling', rarity: 'common', generation: 9 });
    expect(evolve(g, c.id, 'geysir').ok).toBe(false);
    unlockFeature(g, 'evolution');
    expect(evolve(g, c.id, 'phoenix').ok).toBe(false);
  });
});

describe('dex family tree', () => {
  it('hides undiscovered hybrids, shows hints, reveals recipes on discovery', () => {
    const g = hybridGame();
    const node = () => familyTree(g).flatMap((t) => t.nodes).find((n) => n.species.id === 'magmole')!;
    expect(node().discovered).toBe(false);
    expect(node().origins[0]).toMatchObject({ revealed: false, hint: null, from: [null, null] });

    g.state.recipeHints.magma = true;
    expect(node().origins[0]!.hint).toBe(content.recipes.get('magma').hint);
    expect(node().origins[0]!.from).toEqual([null, null]);

    createCreature(g, { speciesId: 'magmole', rarity: 'epic' });
    expect(node().discovered).toBe(true);
    expect(node().rarities).toBe(1);
    expect(node().origins[0]!.from).toEqual(['Glutwelpe', 'Kieselkauz']);
  });

  it('groups species by tier', () => {
    const g = hybridGame();
    expect(familyTree(g).map((t) => [t.tier, t.nodes.length])).toEqual([
      ['base', 12],
      ['hybrid', 10],
      ['rareHybrid', 7],
      ['mythic', 4],
      ['primal', 7],
    ]);
  });
});

import { describe, expect, it } from 'vitest';
import { makeGame, content, balance } from './helpers';
import { unlockFeature } from '@core/systems/unlocks';
import { createCreature } from '@core/creatures';
import { addBuff } from '@core/systems/buffs';
import { D } from '@core/num';
import { activeLoci } from '@core/genetics';
import {
  alleleQuality, applyEp, bestTransfer, breakthrough, breakthroughCost, breakthroughPartners, epForLevel, infuse,
  infusionCandidates, infusionEp, infusionPreview, infusionProgress, maxInfusionLevel, nextRarity, transferChance,
} from '@core/features/infusion';
import { batchFragments, capsuleCost, capsuleSpecies, fragmentValue, openCapsules } from '@core/features/recycler';
import type { Genome } from '@core/state';

function richGame(seed = 21, overrides = {}) {
  const g = makeGame(seed, overrides);
  for (const f of ['breeding', 'sequencing', 'infusion', 'recycler', 'hybrids']) unlockFeature(g, f);
  for (const r of ['food', 'gold', 'essence', 'catalyst', 'fragments']) g.state.resources[r] = D(1e9);
  return g;
}

/** Genome with the most common (effect-free) allele on every base locus. */
const normal = (): Genome =>
  Object.fromEntries(content.genes.list.filter((l) => !l.requires).map((l) => {
    const common = [...l.alleles].sort((a, b) => b.weight - a.weight)[0]!.id;
    return [l.id, [common, common]];
  })) as Genome;

describe('infusion math', () => {
  it('EP per level grows geometrically and the max level comes from balance', () => {
    const g = richGame();
    const b = balance.infusion;
    expect(maxInfusionLevel(g)).toBe(b.maxLevel);
    for (let lvl = 1; lvl <= b.maxLevel; lvl++) {
      expect(epForLevel(g, lvl)).toBe(Math.round(b.levelEpBase * Math.pow(b.levelEpGrowth, lvl - 1)));
      if (lvl > 1) expect(epForLevel(g, lvl)).toBeGreaterThan(epForLevel(g, lvl - 1));
    }
    // Exactly the cumulative EP of all levels reaches max with nothing left over.
    let total = 0;
    for (let lvl = 1; lvl <= b.maxLevel; lvl++) total += epForLevel(g, lvl);
    expect(applyEp(g, 0, total)).toEqual({ level: b.maxLevel, ep: 0 });
    expect(applyEp(g, 0, total - 1)).toEqual({ level: b.maxLevel - 1, ep: epForLevel(g, b.maxLevel) - 1 });
    // Progress is EP / next-level cost, and 1 at max level.
    expect(infusionProgress(g, 3, epForLevel(g, 4) / 2)).toBeCloseTo(0.5);
    expect(infusionProgress(g, b.maxLevel, 0)).toBe(1);
  });

  it('EP per victim scales with rarity, generation and the infusion.ep modifier', () => {
    const g = richGame();
    const b = balance.infusion;
    for (const r of content.rarities.list) {
      const c = createCreature(g, { speciesId: 'pebblit', rarity: r.id, generation: 1 });
      expect(infusionEp(g, c)).toBe(Math.round(b.epByRarity[r.id] ?? 0));
    }
    const gen5 = createCreature(g, { speciesId: 'pebblit', rarity: 'rare', generation: 5 });
    expect(infusionEp(g, gen5)).toBe(Math.round(b.epByRarity.rare! * (1 + b.epPerGeneration * 4)));

    addBuff(g, 'test', [{ target: 'infusion.ep', op: 'pct', value: 1 }], 60_000);
    expect(infusionEp(g, gen5)).toBe(Math.round(b.epByRarity.rare! * (1 + b.epPerGeneration * 4) * 2));
  });

  it('transfer chance follows its modifier but is capped at 100 %', () => {
    const g = richGame();
    expect(transferChance(g)).toBeCloseTo(balance.infusion.alleleTransferChance);
    addBuff(g, 'small', [{ target: 'infusion.transferChance', op: 'add', value: 0.1 }], 60_000);
    expect(transferChance(g)).toBeCloseTo(balance.infusion.alleleTransferChance + 0.1);
    addBuff(g, 'huge', [{ target: 'infusion.transferChance', op: 'add', value: 5 }], 60_000);
    expect(transferChance(g)).toBe(1);
  });
});

describe('infusion candidates, transfers and preview', () => {
  it('candidates are other creatures of the same species only', () => {
    const g = richGame();
    const target = createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    const same = createCreature(g, { speciesId: 'pebblit', rarity: 'epic' });
    const other = createCreature(g, { speciesId: 'zephyrix', rarity: 'common' });
    const cands = infusionCandidates(g, target);
    expect(cands).toContain(same);
    expect(cands).not.toContain(target);
    expect(cands).not.toContain(other);
    expect(cands.every((c) => c.speciesId === 'pebblit')).toBe(true);
  });

  it('alleleQuality rates rare effect alleles higher and visual/empty ones as 0', () => {
    const strength = content.genes.get('strength');
    const q = (id: string) => alleleQuality(strength.alleles.find((a) => a.id === id));
    expect(q('k')).toBe(0);
    expect(q('Kt')).toBeGreaterThan(q('K'));
    expect(q('K')).toBeGreaterThan(0);
    expect(alleleQuality(undefined)).toBe(0);
  });

  it('bestTransfer needs both sequenced and picks the largest gain into the weakest slot', () => {
    const g = richGame();
    const target = createCreature(g, { speciesId: 'pebblit', rarity: 'common', genome: { ...normal(), strength: ['K', 'k'] } });
    const victim = createCreature(g, { speciesId: 'pebblit', rarity: 'common', genome: { ...normal(), strength: ['k', 'Kt'], stamina: ['A', 'a'] } });
    expect(bestTransfer(g, target, victim)).toBeNull();
    target.sequenced = true;
    expect(bestTransfer(g, target, victim)).toBeNull();
    victim.sequenced = true;
    const t = bestTransfer(g, target, victim)!;
    expect(t.locus.id).toBe('strength');
    expect(t.allele).toBe('Kt');
    expect(t.slot).toBe(1); // replaces the weaker 'k', keeps 'K'
    const strength = content.genes.get('strength');
    expect(t.gain).toBe(alleleQuality(strength.alleles.find((a) => a.id === 'Kt')));

    // A victim with nothing better than the target offers no transfer.
    const weak = createCreature(g, { speciesId: 'pebblit', rarity: 'common', genome: normal() });
    weak.sequenced = true;
    expect(bestTransfer(g, target, weak)).toBeNull();
    expect(activeLoci(g).length).toBeGreaterThan(0);
  });

  it('preview matches the actual infusion result', () => {
    const g = richGame();
    const target = createCreature(g, { speciesId: 'pebblit', rarity: 'common', genome: normal() });
    target.infusion = { level: 1, ep: 7 };
    target.sequenced = true;
    const victims = [
      createCreature(g, { speciesId: 'pebblit', rarity: 'rare', generation: 2, genome: { ...normal(), strength: ['Kt', 'k'] } }),
      createCreature(g, { speciesId: 'pebblit', rarity: 'uncommon', genome: normal() }),
      createCreature(g, { speciesId: 'pebblit', rarity: 'common', generation: 4, genome: normal() }),
    ];
    victims[0]!.sequenced = true;
    victims[1]!.sequenced = true;
    const preview = infusionPreview(g, target, victims);
    const ep = victims.reduce((s, v) => s + infusionEp(g, v), 0);
    expect(preview.ep).toBe(ep);
    expect(preview.level).toBe(1);
    expect({ level: preview.newLevel, ep: preview.newEp }).toEqual(applyEp(g, 1, 7 + ep));
    expect(preview.transferChance).toBe(transferChance(g));
    expect(preview.transferCandidates).toBe(1);

    const events: { ep: number; levelsGained: number }[] = [];
    g.bus.on('infused', (e) => events.push({ ep: e.ep, levelsGained: e.levelsGained }));
    expect(infuse(g, target.id, victims.map((v) => v.id)).ok).toBe(true);
    expect(target.infusion).toEqual({ level: preview.newLevel, ep: preview.newEp });
    expect(events).toEqual([{ ep: preview.ep, levelsGained: preview.newLevel - preview.level }]);
  });

  it('infuse refuses favourites, busy creatures, itself and maxed targets without consuming anything', () => {
    const g = richGame();
    const target = createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    const fav = createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    fav.locked = true;
    const busy = createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    busy.job = { kind: 'building', target: 'farm' };
    const free = createCreature(g, { speciesId: 'pebblit', rarity: 'common' });

    expect(infuse(g, target.id, [free.id, fav.id]).ok).toBe(false);
    expect(infuse(g, target.id, [free.id, busy.id]).ok).toBe(false);
    expect(infuse(g, target.id, [target.id]).ok).toBe(false);
    expect(g.state.creatures).toEqual(expect.arrayContaining([fav, busy, free]));
    expect(target.infusion).toEqual({ level: 0, ep: 0 });

    target.infusion = { level: maxInfusionLevel(g), ep: 0 };
    expect(infuse(g, target.id, [free.id])).toEqual({ ok: false, reason: 'Maximale Infusionsstufe erreicht – Durchbruch möglich.' });
    expect(g.state.creatures).toContain(free);
  });
});

describe('breakthrough', () => {
  it('partners are same species and rarity, cost comes from balance and is paid', () => {
    const g = richGame();
    const target = createCreature(g, { speciesId: 'pebblit', rarity: 'uncommon' });
    const partner = createCreature(g, { speciesId: 'pebblit', rarity: 'uncommon' });
    const wrongRarity = createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    const wrongSpecies = createCreature(g, { speciesId: 'zephyrix', rarity: 'uncommon' });
    const partners = breakthroughPartners(g, target);
    expect(partners).toContain(partner);
    expect(partners).not.toContain(target);
    expect(partners).not.toContain(wrongRarity);
    expect(partners).not.toContain(wrongSpecies);

    const cost = breakthroughCost(g, target);
    expect(cost.catalyst!.toNumber()).toBe(balance.infusion.breakthroughCost.uncommon!.catalyst);
    expect(cost.essence!.toNumber()).toBe(balance.infusion.breakthroughCost.uncommon!.essence);
    expect(Object.keys(breakthroughCost(g, createCreature(g, { speciesId: 'pebblit', rarity: 'legendary' })))).toHaveLength(0);

    target.infusion = { level: maxInfusionLevel(g), ep: 0 };
    const essence = g.state.resources.essence!;
    const catalyst = g.state.resources.catalyst!;
    expect(breakthrough(g, target.id, partner.id).ok).toBe(true);
    expect(target.rarity).toBe(nextRarity(g, 'uncommon'));
    expect(target.infusion).toEqual({ level: 0, ep: 0 });
    expect(g.state.creatures).not.toContain(partner);
    expect(essence.sub(g.state.resources.essence!).toNumber()).toBe(cost.essence!.toNumber());
    expect(catalyst.sub(g.state.resources.catalyst!).toNumber()).toBe(cost.catalyst!.toNumber());
  });

  it('a favourite partner is listed but cannot be consumed, and missing resources block it', () => {
    const g = richGame();
    const target = createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    target.infusion = { level: maxInfusionLevel(g), ep: 0 };
    const fav = createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    fav.locked = true;
    expect(breakthroughPartners(g, target)).toContain(fav);
    expect(breakthrough(g, target.id, fav.id).ok).toBe(false);
    expect(g.state.creatures).toContain(fav);

    const partner = createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    g.state.resources.catalyst = D(0);
    expect(breakthrough(g, target.id, partner.id).ok).toBe(false);
    expect(target.rarity).toBe('common');
    expect(g.state.creatures).toContain(partner);
  });
});

describe('recycler values', () => {
  it('fragment value by rarity and generation; batch is the sum', () => {
    const g = richGame();
    const r = balance.recycler;
    const made = content.rarities.list.map((rar) => createCreature(g, { speciesId: 'pebblit', rarity: rar.id }));
    for (const c of made) expect(fragmentValue(g, c).toNumber()).toBe(Math.floor(r.fragmentsByRarity[c.rarity] ?? 0));
    const values = made.map((c) => fragmentValue(g, c).toNumber());
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]!);

    const old = createCreature(g, { speciesId: 'pebblit', rarity: 'epic', generation: 11 });
    expect(fragmentValue(g, old).toNumber()).toBe(Math.floor(r.fragmentsByRarity.epic! * (1 + r.perGeneration * 10)));

    const batch = [...made, old];
    expect(batchFragments(g, batch).toNumber()).toBe(batch.reduce((s, c) => s + fragmentValue(g, c).toNumber(), 0));
    expect(batchFragments(g, []).toNumber()).toBe(0);

    addBuff(g, 'yield', [{ target: 'capsule.fragmentYield', op: 'pct', value: 0.5 }], 60_000);
    expect(fragmentValue(g, old).toNumber()).toBe(Math.floor(r.fragmentsByRarity.epic! * (1 + r.perGeneration * 10) * 1.5));
  });

  it('capsule cost scales with count, applies the cost.capsule discount and rounds up', () => {
    const g = richGame();
    const premium = content.capsules.get('premium');
    const one = capsuleCost(g, 'premium');
    for (const [res, amount] of Object.entries(premium.cost)) {
      expect(one[res]!.toNumber()).toBe(amount);
      expect(capsuleCost(g, 'premium', 7)[res]!.toNumber()).toBe(amount * 7);
    }
    addBuff(g, 'discount', [{ target: 'cost.capsule', op: 'pct', value: -0.33 }], 60_000);
    const cheap = capsuleCost(g, 'standard', 1);
    expect(cheap.fragments!.toNumber()).toBe(Math.ceil(15 * 0.67));
    expect(Number.isInteger(cheap.fragments!.toNumber())).toBe(true);
    expect(capsuleCost(g, 'standard', 3).fragments!.toNumber()).toBe(Math.ceil(15 * 0.67 * 3));

    // Opening actually charges the displayed cost.
    const before = g.state.resources.fragments!;
    const cost = capsuleCost(g, 'standard', 3);
    expect(openCapsules(g, 'standard', 3).ok).toBe(true);
    expect(before.sub(g.state.resources.fragments!).toNumber()).toBe(cost.fragments!.toNumber());
  });

  it('capsule species pools respect tier weights and the element choice', () => {
    const g = richGame();
    const standard = content.capsules.get('standard');
    const pools = capsuleSpecies(g, standard, null);
    expect(pools.mythic).toBeUndefined(); // tier weight 0
    const all = Object.values(pools).flat();
    const expected = content.species.list.filter((s) => (standard.tierWeights[s.tier] ?? 0) > 0).map((s) => s.id);
    expect(all.sort()).toEqual(expected.sort());
    for (const [tier, list] of Object.entries(pools)) {
      for (const id of list!) expect(content.species.get(id).tier).toBe(tier);
    }
    // The standard capsule ignores the element; the element capsule filters by it.
    expect(capsuleSpecies(g, standard, 'fire')).toEqual(pools);
    const element = content.capsules.get('element');
    const fire = Object.values(capsuleSpecies(g, element, 'fire')).flat();
    expect(fire.length).toBeGreaterThan(0);
    expect(fire).toContain('emberpup');
    for (const id of fire) expect(content.species.get(id).element).toBe('fire');
    expect(Object.values(capsuleSpecies(g, element, null)).flat().length).toBe(all.length);
  });
});

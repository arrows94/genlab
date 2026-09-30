import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { createCreature, effectiveStats } from '@core/creatures';
import { canConsume, sell, sellValue, stableCapacity, stableFree } from '@core/features/stable';
import { applyEp, breakthrough, epForLevel, infuse, infusionEp, infusionPreview, pickInfusionVictims } from '@core/features/infusion';
import { capsuleOdds, fragmentValue, openCapsules, pityCounter, recycle } from '@core/features/recycler';
import {
  autoAssign, automationSystem, autoRecycleCandidates, inRecycler, planAutoBreed, recycleDurationMs, recyclerQueue, recyclingNow, sendToRecycler,
  setAutoAssign, setAutoBreed, setAutoRecycle, speciesLostWith, takeBackFromRecycler,
} from '@core/features/automation';
import { breedByHand, breedingCost, lastPair, startBreeding } from '@core/features/breeding';
import { startMission, missionDurationMs } from '@core/features/expedition';
import { startSequencing } from '@core/features/sequencing';
import { rarityChances, rarityWeights } from '@core/rarity';
import { EMPTY_FILTER, filterCreatures, sortCreatures } from '@core/queries';
import { unlockFeature } from '@core/systems/unlocks';
import { deserialize, serialize } from '@core/save';
import type { Genome } from '@core/state';
import { balance, content, makeGame } from './helpers';

function richGame(seed = 21, overrides = {}) {
  const g = makeGame(seed, overrides);
  for (const f of ['breeding', 'farm', 'mine', 'expedition', 'sequencing', 'infusion', 'recycler', 'hybrids', 'autoAssign', 'autoBreed']) unlockFeature(g, f);
  for (const r of ['food', 'gold', 'essence', 'catalyst', 'fragments']) g.state.resources[r] = D(1e9);
  return g;
}

const normal = (): Genome =>
  Object.fromEntries(content.genes.list.filter((l) => !l.requires).map((l) => {
    const common = [...l.alleles].sort((a, b) => b.weight - a.weight)[0]!.id;
    return [l.id, [common, common]];
  })) as Genome;

describe('stable', () => {
  it('limits breeding (eggs count as occupied places)', () => {
    const g = richGame();
    while (g.state.creatures.length < stableCapacity(g) - 1) createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    const [a, b, c, d] = g.state.creatures;
    g.state.upgrades.nestExpansion = 2;
    g.invalidate();
    expect(stableFree(g)).toBe(1);
    expect(startBreeding(g, a!.id, b!.id).ok).toBe(true);
    expect(stableFree(g)).toBe(0);
    expect(startBreeding(g, c!.id, d!.id)).toEqual({ ok: false, reason: 'Der Stall ist voll.' });
  });

  it('releases wild finds for gold when full', () => {
    const g = richGame(3, { stable: { baseCapacity: 2 } });
    const events: number[] = [];
    g.bus.on('stableFull', (e) => events.push(e.lost));
    const c = g.state.creatures[0]!;
    for (let i = 0; i < 30; i++) {
      startMission(g, c.id, 'long');
      g.step(missionDurationMs(g, 'long'));
    }
    expect(g.state.creatures).toHaveLength(2);
    expect(events.length).toBeGreaterThan(5);
  });
});

describe('consuming creatures (sell)', () => {
  it('never consumes favourites or busy creatures', () => {
    const g = richGame();
    const [a, b] = g.state.creatures;
    const free = createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    const locked = createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    locked.locked = true;
    a!.job = { kind: 'building', target: 'farm' };
    const seq = createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    startSequencing(g, seq.id);
    expect(canConsume(g, free)).toBe(true);
    expect(canConsume(g, locked)).toBe(false);
    expect(canConsume(g, a!)).toBe(false);
    expect(canConsume(g, seq)).toBe(false);
    expect(sell(g, [locked.id]).ok).toBe(false);
    expect(sell(g, [free.id, a!.id]).ok).toBe(false);
    expect(g.state.creatures).toContain(free);
    void b;
  });

  it('sells in batches for rarity/generation based value', () => {
    const g = richGame();
    const x = createCreature(g, { speciesId: 'pebblit', rarity: 'rare', generation: 3 });
    const y = createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    expect(sellValue(g, x).gold!.toNumber()).toBe(Math.floor(90 * 1.2));
    const gold = g.state.resources.gold!;
    expect(sell(g, [x.id, y.id]).ok).toBe(true);
    expect(g.state.resources.gold!.sub(gold).toNumber()).toBe(108 + 10);
    expect(g.state.statistics.sold).toBe(2);
  });

  it('keeps at least one creature', () => {
    const g = makeGame();
    expect(sell(g, [g.state.creatures[0]!.id]).ok).toBe(false);
  });
});

describe('infusion', () => {
  it('EP depends on rarity and generation; levels cost exponentially more', () => {
    const g = richGame();
    const epic = createCreature(g, { speciesId: 'pebblit', rarity: 'epic', generation: 3 });
    expect(infusionEp(g, epic)).toBe(Math.round(150 * 1.2));
    expect(epForLevel(g, 2)).toBeGreaterThan(epForLevel(g, 1));
    expect(applyEp(g, 0, epForLevel(g, 1) + epForLevel(g, 2) + 1)).toEqual({ level: 2, ep: 1 });
    expect(applyEp(g, 9, 1e9)).toEqual({ level: 10, ep: 0 });
  });

  it('absorbs same-species creatures and raises all stats', () => {
    const g = richGame();
    const target = createCreature(g, { speciesId: 'pebblit', rarity: 'common', abilities: [], genome: normal(), stats: { hp: 100, atk: 100, def: 100, spd: 100 }, exactStats: true });
    const victims = Array.from({ length: 5 }, () => createCreature(g, { speciesId: 'pebblit', rarity: 'uncommon' }));
    const other = createCreature(g, { speciesId: 'zephyrix', rarity: 'common' });
    expect(infuse(g, target.id, [other.id])).toEqual({ ok: false, reason: 'Nur Kreaturen derselben Art können infundiert werden.' });

    const preview = infusionPreview(g, target, victims);
    expect(preview.ep).toBe(125);
    expect(infuse(g, target.id, victims.map((v) => v.id)).ok).toBe(true);
    expect(target.infusion.level).toBe(preview.newLevel);
    expect(target.infusion.level).toBeGreaterThanOrEqual(2);
    expect(effectiveStats(g, target).atk).toBe(Math.round(100 * (1 + 0.05 * target.infusion.level)));
    for (const v of victims) expect(g.state.creatures).not.toContain(v);
  });

  it('can transfer a better allele from sequenced victims', () => {
    const g = richGame(5, { infusion: { ...balance.infusion, alleleTransferChance: 1 } });
    const target = createCreature(g, { speciesId: 'pebblit', rarity: 'common', genome: normal() });
    const victim = createCreature(g, { speciesId: 'pebblit', rarity: 'common', genome: { ...normal(), strength: ['Kt', 'k'] } });
    target.sequenced = true;
    victim.sequenced = true;
    const events: { locus: string; allele: string }[][] = [];
    g.bus.on('infused', (e) => events.push(e.transferred));
    infuse(g, target.id, [victim.id]);
    expect(target.genome.strength).toContain('Kt');
    expect(events[0]).toEqual([{ locus: 'strength', allele: 'Kt' }]);
  });

  it('does not transfer from unsequenced victims', () => {
    const g = richGame(5, { infusion: { ...balance.infusion, alleleTransferChance: 1 } });
    const target = createCreature(g, { speciesId: 'pebblit', rarity: 'common', genome: normal() });
    const victim = createCreature(g, { speciesId: 'pebblit', rarity: 'common', genome: { ...normal(), strength: ['Kt', 'Kt'] } });
    target.sequenced = true;
    infuse(g, target.id, [victim.id]);
    expect(target.genome.strength).toEqual(['k', 'k']);
  });

  it('quick picks take the cheapest victims up to a rarity and stop at the goal level', () => {
    const g = richGame();
    const target = createCreature(g, { speciesId: 'pebblit', rarity: 'rare' });
    const commons = Array.from({ length: 12 }, (_, i) => createCreature(g, { speciesId: 'pebblit', rarity: 'common', generation: 1 + (i % 3) }));
    const uncommon = createCreature(g, { speciesId: 'pebblit', rarity: 'uncommon' });
    const shiny = createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    shiny.shiny = true;
    const infused = createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    infused.infusion = { level: 1, ep: 0 };
    commons[0]!.locked = true;

    const all = pickInfusionVictims(g, target, { maxRarity: 'common', goal: 'all' });
    expect(all).toHaveLength(11);
    expect(all).not.toContain(commons[0]);
    expect(all).not.toContain(shiny);
    expect(all).not.toContain(infused);
    expect(all.map((c) => c.generation)).toEqual([...all.map((c) => c.generation)].sort((a, b) => a - b));
    expect(pickInfusionVictims(g, target, { maxRarity: 'uncommon', goal: 'all' })).toContain(uncommon);

    const next = pickInfusionVictims(g, target, { maxRarity: 'uncommon', goal: 'nextLevel' });
    expect(infusionPreview(g, target, next).newLevel).toBe(1);
    expect(infusionPreview(g, target, next.slice(0, -1)).newLevel).toBe(0);
    const max = pickInfusionVictims(g, target, { maxRarity: 'uncommon', goal: 'maxLevel' });
    expect(max.length).toBeGreaterThanOrEqual(next.length);

    expect(pickInfusionVictims(g, target, { maxRarity: 'uncommon', goal: 'all', donorsOnly: true })).toEqual([]);
  });

  it('breakthrough at max level raises rarity, but never above legendary', () => {
    const g = richGame();
    const target = createCreature(g, { speciesId: 'pebblit', rarity: 'epic' });
    const partner = createCreature(g, { speciesId: 'pebblit', rarity: 'epic' });
    const wrong = createCreature(g, { speciesId: 'pebblit', rarity: 'rare' });
    expect(breakthrough(g, target.id, partner.id).ok).toBe(false);
    target.infusion = { level: 10, ep: 0 };
    expect(breakthrough(g, target.id, wrong.id).ok).toBe(false);
    expect(breakthrough(g, target.id, partner.id).ok).toBe(true);
    expect(target.rarity).toBe('legendary');
    expect(target.infusion.level).toBe(0);
    expect(g.state.creatures).not.toContain(partner);
    expect(g.state.dex['pebblit:legendary']).toBe(true);

    target.infusion = { level: 10, ep: 0 };
    const partner2 = createCreature(g, { speciesId: 'pebblit', rarity: 'legendary' });
    expect(breakthrough(g, target.id, partner2.id).ok).toBe(false);
    expect(target.rarity).toBe('legendary');
  });
});

describe('gene recycler & capsules', () => {
  it('recycles creatures into fragments', () => {
    const g = richGame();
    g.state.resources.fragments = D(0);
    const a = createCreature(g, { speciesId: 'pebblit', rarity: 'epic' });
    const b = createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    const expected = fragmentValue(g, a).add(fragmentValue(g, b));
    expect(recycle(g, [a.id, b.id]).ok).toBe(true);
    expect(g.state.resources.fragments!.eq(expected)).toBe(true);
  });

  it('shows exact odds that sum to 1', () => {
    const g = richGame();
    for (const c of content.capsules.list) {
      expect(Object.values(capsuleOdds(g, c.id)).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    }
    expect(capsuleOdds(g, 'premium').common).toBe(0);
  });

  it('pity guarantees an epic after threshold − 1 misses', () => {
    const g = richGame(9, { stable: { baseCapacity: 10_000 } });
    const def = content.capsules.get('standard');
    let sinceEpic = 0;
    let maxStreak = 0;
    const res = openCapsules(g, 'standard', 600);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    for (const r of res.results) {
      if (content.rarities.get(r.rarity).order >= 3) sinceEpic = 0;
      else sinceEpic++;
      maxStreak = Math.max(maxStreak, sinceEpic);
    }
    expect(maxStreak).toBeLessThanOrEqual(def.pity.threshold - 1);
    expect(res.results.some((r) => r.pity)).toBe(true);
    expect(pityCounter(g, 'standard')).toBe(sinceEpic);
  });

  it('element capsules only contain the chosen element, including hybrids', () => {
    const g = richGame(2, { stable: { baseCapacity: 10_000 } });
    const res = openCapsules(g, 'element', 300, 'fire');
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const species = new Set(res.results.map((r) => r.speciesId));
    for (const s of species) expect(content.species.get(s).element).toBe('fire');
    expect([...species].some((s) => content.species.get(s).tier !== 'base')).toBe(true);
    expect(openCapsules(g, 'element', 1).ok).toBe(false);
  });

  it('needs stable space and fragments', () => {
    const g = richGame(2, { stable: { baseCapacity: 3 } });
    expect(openCapsules(g, 'standard', 5)).toEqual({ ok: false, reason: 'Nicht genug Platz im Stall.' });
    g.state.resources.fragments = D(10);
    expect(openCapsules(g, 'standard', 1)).toEqual({ ok: false, reason: 'Nicht genug Gen-Fragmente.' });
  });

  it('mythics are far rarer from capsules than from breeding with a maxed ancestor lab', () => {
    const g = richGame();
    g.state.upgrades.ancestorLab = 10;
    g.invalidate();
    const breeding = rarityChances(rarityWeights(content, balance, g.mods())).mythic!;
    for (const c of content.capsules.list) expect(capsuleOdds(g, c.id).mythic!).toBeLessThan(breeding / 2);
  });
});

describe('automation', () => {
  it('auto-assign puts the best creature for each work stat into the buildings', () => {
    const g = richGame();
    const strong = createCreature(g, { speciesId: 'pebblit', rarity: 'common', abilities: [], genome: normal(), stats: { hp: 10, atk: 99, def: 1, spd: 1 }, exactStats: true });
    const tough = createCreature(g, { speciesId: 'pebblit', rarity: 'common', abilities: [], genome: normal(), stats: { hp: 99, atk: 1, def: 1, spd: 1 }, exactStats: true });
    expect(autoAssign(g).ok).toBe(true);
    expect(strong.job).toEqual({ kind: 'building', target: 'mine' });
    expect(tough.job).toEqual({ kind: 'building', target: 'farm' });
  });

  it('runs periodically when enabled, also offline', () => {
    const g = richGame();
    expect(setAutoAssign(g, true).ok).toBe(true);
    for (const c of g.state.creatures) c.job = null;
    g.simulateOffline(60_000);
    expect(g.state.creatures.some((c) => c.job?.kind === 'building')).toBe(true);
  });

  it('auto-breeds the best two for the rule', () => {
    const g = richGame();
    const best = createCreature(g, { speciesId: 'zephyrix', rarity: 'common', stats: { hp: 1, atk: 1, def: 1, spd: 90 }, exactStats: true, abilities: [], genome: normal() });
    const second = createCreature(g, { speciesId: 'zephyrix', rarity: 'common', stats: { hp: 1, atk: 1, def: 1, spd: 80 }, exactStats: true, abilities: [], genome: normal() });
    expect(setAutoBreed(g, { enabled: true, rule: 'spd' }).ok).toBe(true);
    g.advance(balance.automation.intervalSec * 1000 + 100);
    expect(best.job?.kind).toBe('nest');
    expect(second.job?.kind).toBe('nest');
    expect(setAutoBreed(g, { rule: 'nonsense' }).ok).toBe(false);
  });

  describe('breeding goals', () => {
    const fresh = () => {
      const g = richGame();
      g.state.creatures = [];
      return g;
    };
    const make = (g: ReturnType<typeof richGame>, speciesId: string, extra: Partial<Parameters<typeof createCreature>[1]> = {}) =>
      createCreature(g, { speciesId, rarity: 'common', abilities: [], genome: normal(), ...extra });
    const pair = (g: ReturnType<typeof richGame>) => {
      const plan = planAutoBreed(g);
      return plan.ok ? [plan.a.id, plan.b.id].sort() : plan.reason;
    };

    it('hybrid: picks parents of an undiscovered recipe', () => {
      const g = fresh();
      make(g, 'pebblit');
      make(g, 'pebblit');
      const fire = make(g, 'emberpup');
      const water = make(g, 'bubbloon');
      setAutoBreed(g, { rule: 'hybrid' });
      expect(pair(g)).toEqual([fire.id, water.id].sort());
      for (const r of content.rarities.list) g.state.dex[`steamling:${r.id}`] = true;
      for (const r of content.rarities.list) g.state.dex[`magmole:${r.id}`] = true;
      expect(typeof pair(g)).toBe('string');
    });

    it('hybrid: honours recipe requirements such as a carried allele', () => {
      const g = fresh();
      make(g, 'stormhawk');
      make(g, 'zephyrix');
      const carrier = make(g, 'zephyrix', { genome: { ...normal(), speed: ['Tb', 't'] } });
      setAutoBreed(g, { rule: 'hybrid' });
      const plan = planAutoBreed(g);
      expect(plan.ok && [plan.a.id, plan.b.id]).toContain(carrier.id);
    });

    it('dex: breeds the cheapest pair of a species with missing entries', () => {
      const g = fresh();
      make(g, 'emberpup');
      make(g, 'emberpup');
      const young = make(g, 'pebblit', { generation: 2 });
      const younger = make(g, 'pebblit', { generation: 1 });
      make(g, 'pebblit', { generation: 9 });
      for (const r of content.rarities.list) g.state.dex[`emberpup:${r.id}`] = true;
      setAutoBreed(g, { rule: 'dex' });
      expect(pair(g)).toEqual([young.id, younger.id].sort());
    });

    it('allele: only uses sequenced carriers of the target allele', () => {
      const g = fresh();
      const genome = { ...normal(), strength: ['Kt', 'Kt'] as [string, string] };
      const hidden = make(g, 'pebblit', { genome });
      const known = make(g, 'pebblit', { genome });
      const other = make(g, 'pebblit');
      known.sequenced = true;
      other.sequenced = true;
      expect(setAutoBreed(g, { rule: 'allele', allele: 'strength:Kt' }).ok).toBe(true);
      expect(pair(g)).toEqual([known.id, other.id].sort()); // one known carrier spreads it
      known.sequenced = false;
      expect(pair(g)).toBe('Keine sequenzierte Kreatur trägt das Ziel-Allel.');
      known.sequenced = true;
      hidden.sequenced = true;
      expect(pair(g)).toEqual([hidden.id, known.id].sort());
      expect(setAutoBreed(g, { allele: 'strength:nope' }).ok).toBe(false);
    });

    it('abilities and cheap goals', () => {
      const g = fresh();
      const gifted = make(g, 'pebblit', { generation: 5, abilities: [content.abilities.list[0]!.id] });
      const legendary = make(g, 'pebblit', { generation: 6, abilities: [content.abilities.list.find((a) => a.tier === 'legendary')!.id] });
      const plainA = make(g, 'pebblit', { generation: 1 });
      const plainB = make(g, 'pebblit', { generation: 2 });
      setAutoBreed(g, { rule: 'abilities' });
      expect(pair(g)).toEqual([gifted.id, legendary.id].sort());
      setAutoBreed(g, { rule: 'cheap' });
      expect(pair(g)).toEqual([plainA.id, plainB.id].sort());
    });

    it('respects the budget', () => {
      const g = fresh();
      make(g, 'pebblit', { generation: 10 });
      make(g, 'pebblit', { generation: 10 });
      setAutoBreed(g, { rule: 'power', budget: 0.1 });
      g.state.resources.food = D(1);
      expect(pair(g)).toBe('Nicht genug Ressourcen.');
      g.state.resources.food = D(1e9);
      expect(planAutoBreed(g).ok).toBe(true);
      g.state.resources.food = breedingCost(g, 11).food!.mul(5); // affordable, but more than 10 %
      expect(pair(g)).toMatch(/Budget/);
    });

    it('waits on a full stable and removes nobody itself', () => {
      const g = fresh();
      make(g, 'pebblit', { stats: { hp: 90, atk: 90, def: 90, spd: 90 }, exactStats: true });
      make(g, 'pebblit', { stats: { hp: 80, atk: 80, def: 80, spd: 80 }, exactStats: true });
      while (stableFree(g) > 0) make(g, 'pebblit', { stats: { hp: 5, atk: 5, def: 5, spd: 5 }, exactStats: true });
      setAutoBreed(g, { enabled: true, rule: 'power' });
      expect(pair(g)).toBe('Der Stall ist voll.');
      const before = g.state.creatures.length;
      g.advance(balance.automation.intervalSec * 1000 * 3);
      expect(g.state.creatures).toHaveLength(before);
    });
  });

  describe('protection rules for every automatic removal (tester report)', () => {
    const setup = () => {
      const g = richGame();
      unlockFeature(g, 'autoRecycle');
      g.state.creatures = [];
      const mk = (speciesId: string, power: number, extra: Partial<Parameters<typeof createCreature>[1]> = {}) =>
        createCreature(g, { speciesId, rarity: 'common', abilities: [], genome: normal(), stats: { hp: power, atk: power, def: power, spd: power }, exactStats: true, ...extra });
      return { g, mk };
    };

    it('favourites survive both automatons even when nothing else is left to take', () => {
      const { g, mk } = setup();
      const favs = Array.from({ length: 6 }, (_, i) => mk('pebblit', 1 + i));
      for (const c of favs) c.locked = true;
      while (stableFree(g) > 0) {
        const c = mk('pebblit', 1);
        c.locked = true;
      }
      setAutoRecycle(g, { enabled: true, keepPerSpecies: 0, keepSequenced: false, maxRarity: 'mythic' });
      setAutoBreed(g, { enabled: true, rule: 'power' });
      const before = g.state.creatures.length;
      for (let i = 0; i < 10; i++) g.advance(balance.automation.intervalSec * 1000 + 100);
      expect(g.state.creatures.filter((c) => c.locked)).toHaveLength(before);
      expect(autoRecycleCandidates(g)).toEqual([]);
    });
  });

  describe('recycling automaton', () => {
    const setup = () => {
      const g = richGame();
      unlockFeature(g, 'autoRecycle');
      g.state.creatures = [];
      const mk = (speciesId: string, power: number, extra: Partial<Parameters<typeof createCreature>[1]> = {}) =>
        createCreature(g, { speciesId, rarity: 'common', abilities: [], genome: normal(), stats: { hp: power, atk: power, def: power, spd: power }, exactStats: true, ...extra });
      return { g, mk };
    };

    it('knows which species a hand-picked batch would take from the stable (warning)', () => {
      const { g, mk } = setup();
      const lone = mk('zephyrix', 1);
      mk('pebblit', 90);
      const weakPebblit = mk('pebblit', 2);
      expect(speciesLostWith(g, [lone.id])).toEqual(['zephyrix']);
      expect(speciesLostWith(g, [weakPebblit.id])).toEqual([]);
      expect(sendToRecycler(g, [lone.id]).ok).toBe(true);
    });

    it('keeps the strongest per species and protected creatures', () => {
      const { g, mk } = setup();
      const best = mk('pebblit', 90);
      const second = mk('pebblit', 80);
      const weak = mk('pebblit', 5);
      const weaker = mk('pebblit', 3);
      const locked = mk('pebblit', 1);
      locked.locked = true;
      const shiny = mk('pebblit', 1);
      shiny.shiny = true;
      const sequenced = mk('pebblit', 2);
      sequenced.sequenced = true;
      const rare = mk('pebblit', 1, { rarity: 'rare' });
      const lonely = mk('emberpup', 1);
      expect(setAutoRecycle(g, { enabled: true, keepPerSpecies: 2 }).ok).toBe(true);
      expect(autoRecycleCandidates(g)).toEqual([weaker, weak]);
      setAutoRecycle(g, { keepSequenced: false, keepPerSpecies: 0 });
      const all = autoRecycleCandidates(g);
      expect(all).toHaveLength(6);
      expect(all).toEqual(expect.arrayContaining([sequenced, lonely, weaker, weak, second, best]));
      expect(all.at(-1)).toBe(best);
      g.advance(balance.automation.intervalSec * 1000 + recycleDurationMs(g) * 8);
      expect(g.state.creatures).toEqual(expect.arrayContaining([locked, shiny, rare]));
      expect(g.state.creatures).not.toContain(weak);
    });

    it('never takes the pair the breeding automaton wants next', () => {
      const { g, mk } = setup();
      mk('pebblit', 90);
      const cheapA = mk('pebblit', 1);
      const cheapB = mk('pebblit', 2);
      cheapA.generation = 1;
      cheapB.generation = 1;
      for (const c of g.state.creatures.slice(0, 1)) c.generation = 5;
      setAutoRecycle(g, { enabled: true, keepPerSpecies: 0 });
      setAutoBreed(g, { enabled: true, rule: 'cheap' });
      expect(autoRecycleCandidates(g)).not.toContain(cheapA);
      expect(autoRecycleCandidates(g)).not.toContain(cheapB);
    });

    it('"full" mode recycles one creature only when the stable is full', () => {
      const { g, mk } = setup();
      mk('pebblit', 90);
      const weak = mk('pebblit', 1);
      setAutoRecycle(g, { enabled: true, keepPerSpecies: 1, when: 'full' });
      g.advance(balance.automation.intervalSec * 1000 + 100);
      expect(g.state.creatures).toContain(weak);
      while (stableFree(g) > 0) mk('emberpup', 50);
      const before = g.state.creatures.length;
      const fragments = g.state.resources.fragments!;
      g.advance(balance.automation.intervalSec * 1000 + recycleDurationMs(g) + 100);
      expect(g.state.creatures).toHaveLength(before - 1);
      expect(g.state.creatures).not.toContain(weak);
      expect(g.state.resources.fragments!.gt(fragments)).toBe(true);
    });

    it('takes one creature at a time into the Zerlege-Kammer and needs its time', () => {
      const { g, mk } = setup();
      mk('pebblit', 90);
      const weakest = mk('pebblit', 1);
      const weak = mk('pebblit', 2);
      setAutoRecycle(g, { enabled: true, keepPerSpecies: 1 });
      g.advance(balance.automation.intervalSec * 1000 + 100);
      expect(recyclingNow(g)?.creature).toBe(weakest);
      expect(g.state.creatures).toContain(weak);
      const fragments = g.state.resources.fragments!;
      g.advance(recycleDurationMs(g) - 500);
      expect(g.state.creatures).toContain(weakest);
      expect(recyclingNow(g)!.progress).toBeGreaterThan(0.9);
      g.advance(1000);
      expect(g.state.creatures).not.toContain(weakest);
      expect(g.state.resources.fragments!.gt(fragments)).toBe(true);
      // The next one goes in right away.
      expect(recyclingNow(g)?.creature).toBe(weak);
      expect(recyclingNow(g)!.progress).toBeLessThan(0.1);
    });

    it('starts at minutes and research brings it down to seconds', () => {
      const g = richGame();
      unlockFeature(g, 'autoRecycle');
      expect(recycleDurationMs(g)).toBe(balance.recycler.autoSec * 1000);
      expect(recycleDurationMs(g)).toBeGreaterThanOrEqual(120_000);
      g.state.upgrades['recyclerSpeed'] = content.upgrades.get('recyclerSpeed').maxLevel!;
      g.invalidate();
      expect(recycleDurationMs(g)).toBeLessThanOrEqual(10_000);
      // What the player sends is much quicker than the automat's picks.
      g.state.upgrades['recyclerSpeed'] = 0;
      g.invalidate();
      expect(recycleDurationMs(g, true)).toBe(balance.recycler.manualSec * 1000);
      expect(recycleDurationMs(g, true)).toBeLessThan(recycleDurationMs(g) / 5);
    });

    it('a creature can still be rescued from the chamber, and switching off frees it', () => {
      const { g, mk } = setup();
      mk('pebblit', 90);
      const a = mk('pebblit', 1);
      const b = mk('pebblit', 2);
      setAutoRecycle(g, { enabled: true, keepPerSpecies: 1 });
      g.advance(balance.automation.intervalSec * 1000 + 100);
      expect(inRecycler(g, a.id)).toBe(true);
      a.locked = true;
      g.advance(100);
      expect(recyclingNow(g)).toBeNull();
      g.advance(balance.automation.intervalSec * 1000 + recycleDurationMs(g));
      expect(g.state.creatures).toContain(a);
      expect(inRecycler(g, b.id) || !g.state.creatures.includes(b)).toBe(true);
      setAutoRecycle(g, { enabled: false });
      g.advance(100);
      expect(recyclingNow(g)).toBeNull();
    });

    it('other automations leave the creature in the chamber alone', () => {
      const { g, mk } = setup();
      mk('pebblit', 90);
      const a = mk('pebblit', 1);
      setAutoRecycle(g, { enabled: true, keepPerSpecies: 1 });
      g.advance(balance.automation.intervalSec * 1000 + 100);
      expect(inRecycler(g, a.id)).toBe(true);
      unlockFeature(g, 'autoAssign');
      setAutoAssign(g, true);
      autoAssign(g);
      expect(a.job).toBeNull();
      expect(inRecycler(g, a.id)).toBe(true);
    });

    it('makes room for the Zuchtautomat, which waits on a full stable – nobody else takes from the chamber', () => {
      const { g, mk } = setup();
      unlockFeature(g, 'autoBreed');
      while (stableFree(g) > 0) mk('pebblit', 10 + g.state.creatures.length);
      setAutoRecycle(g, { enabled: true, keepPerSpecies: 2, when: 'full' });
      setAutoBreed(g, { enabled: true, rule: 'power' });
      const d = recycleDurationMs(g);
      let finished = 0;
      let taken = 0;
      let hatched = 0;
      g.bus.on('eggHatched', () => hatched++);
      let last: { id: number; elapsed: number } | null = null;
      for (let t = 0; t < 300; t++) {
        g.advance(d / 30);
        const cur = g.state.automation.recycling;
        if (last && cur?.creatureId !== last.id && !g.state.creatures.some((c) => c.id === last!.id)) {
          if (last.elapsed > d * 0.9) finished++;
          else taken++;
        }
        last = cur ? { id: cur.creatureId, elapsed: cur.elapsedMs } : null;
      }
      expect(taken).toBe(0);
      expect(finished).toBeGreaterThan(2);
      // Every place the chamber freed went to a new egg.
      expect(hatched).toBeGreaterThan(2);
    });

    it('finishes a creature even if the Zuchtautomat would like it as a parent by then', () => {
      const { g, mk } = setup();
      unlockFeature(g, 'autoBreed');
      mk('pebblit', 90);
      const a = mk('pebblit', 1);
      mk('pebblit', 2);
      setAutoRecycle(g, { enabled: true, keepPerSpecies: 1 });
      g.advance(balance.automation.intervalSec * 1000 + 100);
      expect(inRecycler(g, a.id)).toBe(true);
      // Now the breeder wants the cheapest pair – which would include the chamber creature.
      setAutoBreed(g, { enabled: true, rule: 'cheap' });
      g.advance(recycleDurationMs(g));
      expect(g.state.creatures).not.toContain(a);
    });

    it('creatures sent from the lab go through the chamber one by one – also without the automat', () => {
      const g = richGame();
      unlockFeature(g, 'recycler');
      g.state.creatures = [];
      const mk = (power: number) =>
        createCreature(g, { speciesId: 'pebblit', rarity: 'common', abilities: [], genome: normal(), stats: { hp: power, atk: power, def: power, spd: power }, exactStats: true });
      const [a, b, c] = [mk(1), mk(2), mk(3)];
      const keep = mk(90);
      keep.locked = true;
      expect(sendToRecycler(g, [keep.id]).ok).toBe(false);
      expect(sendToRecycler(g, [a.id, b.id, c.id]).ok).toBe(true);
      // The first goes in right away, the others wait; nothing is gone yet.
      expect(recyclingNow(g)?.creature).toBe(a);
      expect(recyclingNow(g)?.manual).toBe(true);
      expect(recyclerQueue(g)).toEqual([b, c]);
      expect(g.state.creatures).toHaveLength(4);
      // Taken back while waiting.
      expect(takeBackFromRecycler(g, c.id).ok).toBe(true);
      expect(inRecycler(g, c.id)).toBe(false);
      const fragments = g.state.resources.fragments ?? D(0);
      g.advance(recycleDurationMs(g, true) * 2 + 500);
      expect(g.state.creatures).toEqual([c, keep]);
      expect(g.state.resources.fragments!.gt(fragments)).toBe(true);
      expect(recyclingNow(g)).toBeNull();
    });

    it('what the player sent comes before the automat’s picks, and never counts against „je Art behalten“', () => {
      const { g, mk } = setup();
      const strong = mk('pebblit', 90);
      const weak = mk('pebblit', 1);
      setAutoRecycle(g, { enabled: true, keepPerSpecies: 1 });
      expect(sendToRecycler(g, [strong.id]).ok).toBe(true);
      expect(recyclingNow(g)?.creature).toBe(strong);
      g.advance(recycleDurationMs(g, true) + 100);
      expect(g.state.creatures).not.toContain(strong);
      // Now the automat's rules apply to what is left: the weak one is the strongest of its species.
      g.advance(balance.automation.intervalSec * 1000 + recycleDurationMs(g));
      expect(g.state.creatures).toContain(weak);
    });

    it('a creature sent by the player is taken back out of the chamber', () => {
      const { g, mk } = setup();
      const a = mk('pebblit', 1);
      mk('pebblit', 2);
      sendToRecycler(g, [a.id]);
      g.advance(1000);
      expect(recyclingNow(g)?.creature).toBe(a);
      expect(takeBackFromRecycler(g, a.id).ok).toBe(true);
      expect(recyclingNow(g)).toBeNull();
      g.advance(recycleDurationMs(g) * 2);
      expect(g.state.creatures).toContain(a);
    });

    it('processes several creatures in one long (offline) step', () => {
      const { g, mk } = setup();
      mk('pebblit', 90);
      for (let i = 0; i < 4; i++) mk('pebblit', 1 + i);
      setAutoRecycle(g, { enabled: true, keepPerSpecies: 1 });
      g.advance(balance.automation.intervalSec * 1000 + 100);
      g.step(recycleDurationMs(g) * 4);
      expect(g.state.creatures).toHaveLength(1);
    });

    it('is only available after research', () => {
      const g = richGame();
      expect(setAutoRecycle(g, { enabled: true }).ok).toBe(false);
      unlockFeature(g, 'autoRecycle');
      expect(setAutoRecycle(g, { maxRarity: 'nope' }).ok).toBe(false);
      expect(setAutoRecycle(g, { keepPerSpecies: -1 }).ok).toBe(false);
    });
  });

  it('is only available after unlocking', () => {
    const g = makeGame();
    expect(autoAssign(g).ok).toBe(false);
    expect(setAutoBreed(g, { enabled: true }).ok).toBe(false);
    expect(automationSystem.id).toBe('automation');
  });
});

describe('creature list queries', () => {
  it('filters and sorts', () => {
    const g = richGame();
    const a = createCreature(g, { speciesId: 'frostling', rarity: 'epic', generation: 5 });
    const b = createCreature(g, { speciesId: 'pebblit', rarity: 'common', generation: 2 });
    a.name = 'Eisprinz';
    expect(filterCreatures(g, { ...EMPTY_FILTER, search: 'eispr' })).toEqual([a]);
    expect(filterCreatures(g, { ...EMPTY_FILTER, element: 'ice' })).toEqual([a]);
    expect(filterCreatures(g, { ...EMPTY_FILTER, rarity: 'epic' })).toEqual([a]);
    b.locked = true;
    expect(filterCreatures(g, { ...EMPTY_FILTER, status: 'locked' })).toEqual([b]);
    b.genome.strength = ['K', 'k'];
    expect(filterCreatures(g, { ...EMPTY_FILTER, allele: { locus: 'strength', allele: 'K' } })).not.toContain(b);
    b.sequenced = true;
    expect(filterCreatures(g, { ...EMPTY_FILTER, allele: { locus: 'strength', allele: 'K' } })).toContain(b);
    a.job = { kind: 'mission', target: '1' };
    expect(filterCreatures(g, { ...EMPTY_FILTER, hideAway: true })).not.toContain(a);
    expect(filterCreatures(g, { ...EMPTY_FILTER, hideAway: true, status: 'busy' })).toContain(a);
    a.job = null;
    expect(sortCreatures(g, [b, a], 'rarity')[0]).toBe(a);
    expect(sortCreatures(g, [a, b], 'newest')[0]).toBe(b);
    expect(sortCreatures(g, [b, a], 'generation')[0]).toBe(a);
  });
});

describe('pedigree, records and migration', () => {
  it('keeps parent and grandparent snapshots', () => {
    const g = richGame();
    const [a, b] = g.state.creatures;
    startBreeding(g, a!.id, b!.id);
    g.advance(120_000);
    const child = g.state.creatures.at(-1)!;
    const c2 = createCreature(g, { speciesId: 'pebblit', rarity: 'common' });
    startBreeding(g, child.id, c2.id);
    g.advance(300_000);
    const grandchild = g.state.creatures.at(-1)!;
    expect(grandchild.ancestry?.[0]?.name).toBe(child.name);
    expect(grandchild.ancestry?.[0]?.parents?.map((p) => p.name)).toEqual([a!.name, b!.name]);
    expect(g.state.statistics['record.generation']).toBeGreaterThanOrEqual(3);
  });

  it('v3 saves gain infusion + ancestry fields', () => {
    const g = makeGame();
    const raw = JSON.parse(serialize(g.state));
    raw.saveVersion = 3;
    for (const c of raw.state.creatures) {
      delete c.infusion;
      delete c.ancestry;
    }
    delete raw.state.automation;
    const { state } = deserialize(JSON.stringify(raw));
    expect(state.creatures[0]!.infusion).toEqual({ level: 0, ep: 0 });
    expect(state.creatures[0]!.ancestry).toBeNull();
    expect(state.automation.autoAssign).toBe(false);
  });
});

describe('infusion chamber helpers', () => {
  it('reports progress and stats at other levels', async () => {
    const { infusionProgress, statsAtInfusion, epForLevel } = await import('@core/features/infusion');
    const g = richGame();
    expect(infusionProgress(g, 0, epForLevel(g, 1) / 2)).toBeCloseTo(0.5);
    expect(infusionProgress(g, 10, 0)).toBe(1);
    const c = createCreature(g, { speciesId: 'pebblit', rarity: 'common', abilities: [], genome: normal(), stats: { hp: 100, atk: 100, def: 100, spd: 100 }, exactStats: true });
    expect(statsAtInfusion(g, c, 4).atk).toBe(120);
    expect(c.infusion.level).toBe(0);
  });
});

describe('Zuchtbuch', () => {
  it('remembers the last pair bred by hand, not the automat’s', () => {
    const g = richGame();
    g.state.upgrades.nestExpansion = 1; // a second nest for the automat's egg
    g.invalidate();
    const [a, b, c, d] = ['emberpup', 'emberpup', 'bubbloon', 'bubbloon'].map((s) => createCreature(g, { speciesId: s, source: 'other' }));
    expect(breedByHand(g, a!.id, b!.id).ok).toBe(true);
    expect(g.state.lastPair).toEqual({ a: a!.id, b: b!.id, ritual: null });
    // Needs the research.
    expect(lastPair(g)).toBeNull();
    unlockFeature(g, 'breedRepeat');
    expect(lastPair(g)).toMatchObject({ a: { id: a!.id }, b: { id: b!.id }, ritual: null });
    // The Zuchtautomat breeds with startBreeding: the memory stays.
    expect(startBreeding(g, c!.id, d!.id).ok).toBe(true);
    expect(g.state.lastPair!.b).toBe(b!.id);
    // Gone parents: nothing to repeat.
    g.state.creatures = g.state.creatures.filter((x) => x.id !== b!.id);
    expect(lastPair(g)).toBeNull();
  });
});

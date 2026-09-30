import { describe, expect, it } from 'vitest';
import { assignJob, type ActionResult } from '@core/actions';
import { createCreature } from '@core/creatures';
import {
  contractCandidates,
  contractDay,
  contractLevel,
  contractReward,
  deliverContract,
  fulfillableCount,
  nextContractDay,
  refreshContracts,
  requirementStatus,
  requirementText,
  rerollContract,
} from '@core/features/contracts';
import { activeLoci, libraryHas, missingAlleles } from '@core/genetics';
import { deserialize, serialize } from '@core/save';
import type { ContractOffer, Genome } from '@core/state';
import { unlockFeature } from '@core/systems/unlocks';
import { NOW, balance, content, makeGame } from './helpers';

const DAY = 86_400_000;

function contractGame(seed = 42) {
  const g = makeGame(seed);
  unlockFeature(g, 'contracts');
  refreshContracts(g);
  return g;
}

/** Plain genome: the most common allele everywhere, with overrides. */
function genome(g: ReturnType<typeof makeGame>, overrides: Genome = {}): Genome {
  const out: Genome = {};
  for (const l of activeLoci(g)) {
    const common = [...l.alleles].sort((a, b) => b.weight - a.weight)[0]!.id;
    out[l.id] = [common, common];
  }
  return { ...out, ...overrides };
}

function creature(g: ReturnType<typeof makeGame>, overrides: Genome = {}, sequenced = true) {
  const c = createCreature(g, { speciesId: 'emberpup', source: 'other', genome: genome(g, overrides) });
  c.sequenced = sequenced;
  return c;
}

describe('contract board', () => {
  it('appears with the feature and rolls a stable board per day', () => {
    const g = makeGame();
    refreshContracts(g);
    expect(g.state.contracts.offers).toHaveLength(0);
    unlockFeature(g, 'contracts');
    refreshContracts(g);
    const board = g.state.contracts;
    expect(board.offers).toHaveLength(balance.contracts.offersPerDay);
    expect(board.day).toBe(contractDay(g, NOW));
    expect(new Set(board.offers.map((o) => o.template)).size).toBe(board.offers.length);
    // Same save and day → same offers (no server needed, reloads keep them).
    expect(contractGame().state.contracts.offers).toEqual(board.offers);
  });

  it('keeps the board during the day and renews it the next day', () => {
    const g = contractGame();
    const first = structuredClone(g.state.contracts.offers);
    refreshContracts(g, NOW + 60_000);
    expect(g.state.contracts.offers).toEqual(first);
    g.state.contracts.rerolls = 1;
    refreshContracts(g, nextContractDay(g, NOW));
    expect(g.state.contracts.day).toBe(contractDay(g, NOW) + 1);
    expect(g.state.contracts.rerolls).toBe(0);
  });

  it('starts the day at the configured hour', () => {
    const g = makeGame();
    const midnight = Math.floor(NOW / DAY) * DAY;
    const start = midnight + balance.contracts.dayStartHourUtc * 3_600_000;
    expect(contractDay(g, start)).toBe(contractDay(g, start - 1) + 1);
    expect(nextContractDay(g, start - 1)).toBe(start);
  });

  it('offers only unlocked levels and puts the hardest one last', () => {
    const g = contractGame();
    expect(contractLevel(g)).toBe(1);
    expect(g.state.contracts.offers.every((o) => content.contracts.get(o.template).level === 1)).toBe(true);

    g.state.contracts.completed = balance.contracts.levelThresholds[2]!;
    expect(contractLevel(g)).toBe(3);
    refreshContracts(g, NOW + DAY);
    const levels = g.state.contracts.offers.map((o) => content.contracts.get(o.template).level);
    expect(Math.max(...levels)).toBeLessThanOrEqual(3);
    expect(levels[levels.length - 1]).toBe(Math.max(...levels));
  });

  it('rolls reachable requirements: rare alleles, known to the library when possible', () => {
    const g = contractGame();
    g.state.contracts.completed = balance.contracts.levelThresholds[1]!;
    g.state.geneLibrary['pattern:R'] = true;
    let patternOffers = 0;
    for (let day = 1; day <= 60; day++) {
      refreshContracts(g, NOW + day * DAY);
      for (const offer of g.state.contracts.offers) {
        const loci = offer.requirements.filter((r) => r.kind === 'expresses' || r.kind === 'genotype').map((r) => (r as { locus: string }).locus);
        expect(new Set(loci).size).toBe(loci.length);
        for (const r of offer.requirements) {
          expect(requirementText(g, r)).not.toContain('undefined');
          if (r.kind !== 'expresses' && r.kind !== 'genotype') continue;
          const locus = content.genes.get(r.locus);
          const allele = locus.alleles.find((a) => a.id === r.allele)!;
          // Recessive contracts may ask for a common allele (s/s); all others for a rarer one.
          if (offer.template === 'hiddenTrait') expect(allele.dominance).toBeLessThan(Math.max(...locus.alleles.map((a) => a.dominance)));
          else expect(allele.weight).toBeLessThan(Math.max(...locus.alleles.map((a) => a.weight)));
          // The only catalogued visual allele is preferred for pattern contracts.
          if (offer.template === 'showPattern') {
            expect(r).toEqual({ kind: 'expresses', locus: 'pattern', allele: 'R' });
            patternOffers++;
          }
        }
      }
    }
    expect(patternOffers).toBeGreaterThan(0);
  });

  it('allows one exchange per day', () => {
    const g = contractGame();
    const before = structuredClone(g.state.contracts.offers);
    expect(rerollContract(g, 0).ok).toBe(true);
    const after = g.state.contracts.offers;
    expect(after[0]).not.toEqual(before[0]);
    expect(after.slice(1)).toEqual(before.slice(1));
    expect(new Set(after.map((o) => o.template)).size).toBe(after.length);
    expect(rerollContract(g, 1).ok).toBe(false);
  });
});

/** Failure reason of an action (empty when it succeeded). */
const reason = (r: ActionResult) => (r.ok ? '' : r.reason);

describe('delivering', () => {
  const offer = (requirements: ContractOffer['requirements'], template = 'purebred'): ContractOffer => ({ template, requirements, done: false });

  it('checks genes only on sequenced creatures', () => {
    const g = contractGame();
    const striped = creature(g, { pattern: ['R', 's'] });
    const hidden = creature(g, { pattern: ['R', 'R'] }, false);
    const req = { kind: 'expresses' as const, locus: 'pattern', allele: 'R' };
    expect(requirementStatus(g, striped, req)).toBe('met');
    expect(requirementStatus(g, striped, { kind: 'genotype', locus: 'pattern', allele: 'R' })).toBe('unmet');
    expect(requirementStatus(g, hidden, req)).toBe('unknown');
    expect(requirementStatus(g, hidden, { kind: 'element', element: 'fire' })).toBe('met');
    const { ready, maybe } = contractCandidates(g, offer([req]));
    expect(ready.map((c) => c.id)).toContain(striped.id);
    expect(maybe.map((c) => c.id)).toContain(hidden.id);

    g.state.contracts.offers = [offer([req]), offer([{ kind: 'genotype', locus: 'pattern', allele: 'O' }])];
    expect(fulfillableCount(g)).toBe(1);
  });

  it('counts top alleles expressed or homozygous', () => {
    const g = contractGame();
    const c = creature(g, { strength: ['Kt', 'Kt'], stamina: ['Ae', 'a'], speed: ['T', 'Tb'] });
    expect(requirementStatus(g, c, { kind: 'topLoci', count: 3, homozygous: false })).toBe('met');
    expect(requirementStatus(g, c, { kind: 'topLoci', count: 2, homozygous: true })).toBe('unmet');
    expect(requirementStatus(g, c, { kind: 'topLoci', count: 1, homozygous: true })).toBe('met');
  });

  it('brings a Fackel per contract once the GenLab RPG is open', () => {
    const g = contractGame();
    const offer = g.state.contracts.offers[0]!;
    expect(contractReward(g, offer)['torches']).toBeUndefined();
    unlockFeature(g, 'rpg');
    expect(contractReward(g, offer)['torches']!.toNumber()).toBe(balance.rpg.contractTorches);
  });

  it('hands the creature over for the rewards', () => {
    const g = contractGame();
    unlockFeature(g, 'biolab');
    unlockFeature(g, 'farm');
    expect(assignJob(g, g.state.creatures[0]!.id, 'farm').ok).toBe(true);
    const c = creature(g, { pattern: ['R', 'R'] });
    g.state.contracts.offers[0] = offer([{ kind: 'genotype', locus: 'pattern', allele: 'R' }]);
    const reward = contractReward(g, g.state.contracts.offers[0]);
    expect(reward.food!.gt(0)).toBe(true);
    expect(reward.essence!.toNumber()).toBe(40);

    expect(deliverContract(g, 0, c.id).ok).toBe(true);
    expect(g.state.creatures.some((x) => x.id === c.id)).toBe(false);
    expect(g.state.resources.essence!.toNumber()).toBe(40);
    expect(g.state.contracts.offers[0]!.done).toBe(true);
    expect(g.state.contracts.completed).toBe(1);
    expect(g.state.statistics.contracts).toBe(1);
    expect(deliverContract(g, 0, g.state.creatures[1]?.id ?? -1).ok).toBe(false);
  });

  it('refuses unfit, unsequenced, busy and last creatures', () => {
    const g = contractGame();
    const req = { kind: 'genotype' as const, locus: 'pattern', allele: 'R' };
    g.state.contracts.offers[0] = offer([req]);
    const wrong = creature(g, { pattern: ['R', 's'] });
    const unknown = creature(g, { pattern: ['R', 'R'] }, false);
    const busy = creature(g, { pattern: ['R', 'R'] });
    unlockFeature(g, 'farm');
    expect(assignJob(g, busy.id, 'farm').ok).toBe(true);
    expect(reason(deliverContract(g, 0, wrong.id))).toContain('erfüllt');
    expect(reason(deliverContract(g, 0, unknown.id))).toContain('sequenzieren');
    expect(reason(deliverContract(g, 0, busy.id))).toContain('beschäftigt');

    const solo = contractGame(7);
    solo.state.creatures[0]!.genome = genome(solo, { pattern: ['R', 'R'] });
    solo.state.creatures[0]!.sequenced = true;
    solo.state.contracts.offers[0] = offer([req]);
    expect(reason(deliverContract(solo, 0, solo.state.creatures[0]!.id))).toContain('bleiben');
  });

  it('gene samples fill the rarest gaps of the library', () => {
    const g = contractGame();
    const c = creature(g, { strength: ['Kt', 'Kt'], stamina: ['Ae', 'Ae'] });
    const rarest = missingAlleles(g)[0]!;
    g.state.contracts.offers[0] = offer([{ kind: 'topLoci', count: 2, homozygous: false }], 'topTwo');
    expect(deliverContract(g, 0, c.id).ok).toBe(true);
    expect(libraryHas(g, rarest.locus, rarest.allele)).toBe(true);
  });
});

describe('contract content and saves', () => {
  it('every template level is reachable', () => {
    for (const t of content.contracts.list) expect(t.level).toBeLessThanOrEqual(balance.contracts.levelThresholds.length);
  });

  it('old saves get an empty board', () => {
    const g = makeGame();
    const json = JSON.parse(serialize(g.state, NOW));
    delete json.state.contracts;
    const { state } = deserialize(JSON.stringify(json));
    expect(state.contracts).toEqual({ day: -1, offers: [], rerolls: 0, completed: 0 });
  });
});

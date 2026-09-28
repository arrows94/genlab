import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { createCreature, effectiveStats } from '@core/creatures';
import {
  catalogueGenome, ensureGenomes, expressLocus, expressedAppearance, genomeModifiers, genotypeDistribution, inheritGenome, phenotypeLabel, rollGenome,
} from '@core/genetics';
import { breedingTimeMs, startBreeding } from '@core/features/breeding';
import { breedingPreview } from '@core/features/planner';
import { sequencingCost, sequencingTimeMs, startSequencing } from '@core/features/sequencing';
import { maxSplices, splice } from '@core/features/splicing';
import { unlockFeature } from '@core/systems/unlocks';
import { deserialize, serialize } from '@core/save';
import { Game } from '@core/game';
import type { Genome } from '@core/state';
import { balance, content, makeGame } from './helpers';

const locus = (id: string) => content.genes.get(id);
/** Homozygous for the most common ("wild type") allele at every locus. */
const normal = (): Genome =>
  Object.fromEntries(
    content.genes.list.filter((l) => !l.requires).map((l) => {
      const common = [...l.alleles].sort((a, b) => b.weight - a.weight)[0]!.id;
      return [l.id, [common, common]];
    }),
  ) as Genome;

describe('allele expression', () => {
  it('dominant allele masks the recessive one', () => {
    expect(expressLocus(locus('strength'), ['k', 'K']).map((e) => [e.allele.id, e.share])).toEqual([['K', 1]]);
    expect(phenotypeLabel(locus('strength'), ['Kt', 'K'])).toBe('Titanenkraft');
  });

  it('recessive traits need two copies', () => {
    expect(phenotypeLabel(locus('fertility'), ['F', 'f'])).toBe('Normal');
    expect(phenotypeLabel(locus('fertility'), ['F', 'F'])).toBe('Fruchtbar');
  });

  it('codominant alleles are both expressed at 50 %', () => {
    const e = expressLocus(locus('yield'), ['E', 'e']);
    expect(e.map((x) => [x.allele.id, x.share])).toEqual([['E', 0.5], ['e', 0.5]]);
  });

  it('turns expressed alleles into modifiers', () => {
    const g = makeGame();
    const genome = { ...normal(), strength: ['K', 'k'], yield: ['E', 'e'], fertility: ['F', 'F'] } as Genome;
    const mods = genomeModifiers(g, genome);
    expect(mods.find((m) => m.target === 'stat.atk')?.value).toBeCloseTo(0.2);
    expect(mods.find((m) => m.target === 'production.food')?.value).toBeCloseTo(0.1);
    expect(mods.find((m) => m.target === 'breeding.time')?.value).toBeCloseTo(0.8);
  });

  it('genes change effective stats', () => {
    const g = makeGame();
    const c = createCreature(g, { speciesId: 'pebblit', rarity: 'common', abilities: [], genome: normal(), stats: { hp: 100, atk: 100, def: 100, spd: 100 }, exactStats: true });
    expect(effectiveStats(g, c).atk).toBe(100);
    c.genome.strength = ['Kt', 'k'];
    expect(effectiveStats(g, c).atk).toBe(145);
  });

  it('visual alleles change the rendered appearance', () => {
    const g = makeGame();
    const c = createCreature(g, { speciesId: 'pebblit', rarity: 'common', genome: { ...normal(), color: ['al', 'al'], pattern: ['S', 's'] } });
    const look = expressedAppearance(g, c);
    expect(look.lightness).toBe(86);
    expect(look.pattern).toBe('spots');
  });
});

describe('Mendelian inheritance', () => {
  it('Kk × Kk gives 1:2:1 genotypes', () => {
    expect(genotypeDistribution(locus('strength'), ['K', 'k'], ['K', 'k']).map((o) => [o.key, o.p])).toEqual([
      ['K/k', 0.5],
      ['K/K', 0.25],
      ['k/k', 0.25],
    ]);
  });

  it('the simulated inheritance matches the expected ratios', () => {
    const g = makeGame(99);
    const parent = { ...normal(), strength: ['K', 'k'] } as Genome;
    const counts: Record<string, number> = {};
    const n = 20_000;
    for (let i = 0; i < n; i++) {
      const [x, y] = inheritGenome(g, parent, parent, 0).strength!;
      const key = [x, y].sort().join('');
      counts[key] = (counts[key] ?? 0) + 1;
    }
    expect(counts.KK! / n).toBeCloseTo(0.25, 1);
    expect(counts.Kk! / n).toBeCloseTo(0.5, 1);
    expect(counts.kk! / n).toBeCloseTo(0.25, 1);
  });

  it('only mutation can introduce alleles the parents do not carry', () => {
    const g = makeGame(5);
    const parent = normal();
    for (let i = 0; i < 500; i++) expect(inheritGenome(g, parent, parent, 0)).toEqual(parent);
    let mutated = 0;
    for (let i = 0; i < 2000; i++) {
      const child = inheritGenome(g, parent, parent, 1);
      if (JSON.stringify(child) !== JSON.stringify(parent)) mutated++;
    }
    expect(mutated).toBeGreaterThan(0);
  });

  it('hatched offspring get a Mendelian genome from their parents', () => {
    const g = makeGame(3);
    unlockFeature(g, 'breeding');
    g.state.resources.food = D(1e9);
    const [a, b] = g.state.creatures;
    a!.genome = { ...normal(), strength: ['K', 'K'] };
    b!.genome = { ...normal(), strength: ['k', 'k'] };
    startBreeding(g, a!.id, b!.id);
    g.advance(120_000);
    const child = g.state.creatures.at(-1)!;
    expect(child.generation).toBe(2);
    expect([...child.genome.strength!].sort()).toEqual(['K', 'k']);
    expect(child.sequenced).toBe(false);
  });

  it('two FF parents breed faster (recessive fertility)', () => {
    const g = makeGame();
    unlockFeature(g, 'breeding');
    const [a, b] = g.state.creatures;
    a!.genome = normal();
    b!.genome = normal();
    const base = breedingTimeMs(g, 2, [a, b]);
    a!.genome.fertility = ['F', 'F'];
    b!.genome.fertility = ['F', 'F'];
    expect(breedingTimeMs(g, 2, [a, b])).toBeCloseTo(base * 0.64);
  });
});

describe('hidden genomes and sequencing', () => {
  function labGame() {
    const g = makeGame(8);
    unlockFeature(g, 'sequencing');
    g.state.resources.essence = D(1000);
    return g;
  }

  it('new creatures have a full but hidden genome', () => {
    const g = makeGame();
    const c = g.state.creatures[0]!;
    expect(Object.keys(c.genome).sort()).toEqual(content.genes.list.filter((l) => !l.requires).map((l) => l.id).sort());
    expect(c.sequenced).toBe(false);
  });

  it('sequencing costs essence + time, reveals the genome and fills the library', () => {
    const g = labGame();
    const c = g.state.creatures[0]!;
    const cost = sequencingCost(g, c).essence!.toNumber();
    expect(startSequencing(g, c.id).ok).toBe(true);
    expect(g.state.resources.essence!.toNumber()).toBe(1000 - cost);
    expect(startSequencing(g, c.id).ok).toBe(false);
    g.advance(sequencingTimeMs(g) - 1000);
    expect(c.sequenced).toBe(false);
    g.advance(1100);
    expect(c.sequenced).toBe(true);
    for (const [l, pair] of Object.entries(c.genome)) for (const a of pair) expect(g.state.geneLibrary[`${l}:${a}`]).toBe(true);
    expect(g.state.statistics.sequenced).toBe(1);
    expect(g.state.achievements.firstSequence).toBe(true);
  });

  it('the library counts each allele once', () => {
    const g = makeGame();
    const genome = normal();
    const first = catalogueGenome(g, genome);
    expect(first).toHaveLength(content.genes.list.filter((l) => !l.requires).length);
    expect(catalogueGenome(g, genome)).toHaveLength(0);
  });

  it('ensureGenomes fills missing loci (old saves or newly added genes)', () => {
    const g = makeGame();
    const c = g.state.creatures[0]!;
    delete c.genome.affinity;
    c.genome.strength = ['gone', 'k'];
    ensureGenomes(g);
    expect(c.genome.affinity).toHaveLength(2);
    expect(c.genome.strength!.every((a) => locus('strength').alleles.some((x) => x.id === a))).toBe(true);
  });

  it('old v2 saves without genomes load with rolled genomes', () => {
    const g = makeGame();
    const raw = JSON.parse(serialize(g.state));
    raw.saveVersion = 2;
    for (const c of raw.state.creatures) {
      c.genome = null;
      delete c.splices;
    }
    const loaded = new Game({ content, balance, state: deserialize(JSON.stringify(raw)).state });
    const c = loaded.state.creatures[0]!;
    expect(Object.keys(c.genome)).toHaveLength(content.genes.list.filter((l) => !l.requires).length);
    expect(c.splices).toBe(0);
  });
});

describe('breeding planner', () => {
  it('shows exact genotype odds only for sequenced parents', () => {
    const g = makeGame();
    unlockFeature(g, 'breeding');
    const [a, b] = g.state.creatures;
    a!.genome = { ...normal(), strength: ['K', 'k'] };
    b!.genome = { ...normal(), strength: ['K', 'k'] };

    let preview = breedingPreview(g, a!, b!);
    expect(preview.loci.every((l) => !l.known)).toBe(true);

    a!.sequenced = true;
    b!.sequenced = true;
    preview = breedingPreview(g, a!, b!);
    const strength = preview.loci.find((l) => l.locus === 'strength')!;
    expect(strength.known).toBe(true);
    expect(strength.outcomes.map((o) => [o.phenotype, o.p])).toEqual([
      ['Kraftvoll', 0.5],
      ['Kraftvoll', 0.25],
      ['Normal', 0.25],
    ]);
  });

  it('shows species and rarity odds', () => {
    const g = makeGame();
    unlockFeature(g, 'breeding');
    const [a, b] = g.state.creatures;
    const preview = breedingPreview(g, a!, b!);
    expect(preview.species).toEqual([{ id: a!.speciesId, p: 0.5 }, { id: b!.speciesId, p: 0.5 }]);
    expect(Object.values(preview.rarity).reduce((x, y) => x + y, 0)).toBeCloseTo(1);
  });

  it('shows undiscovered hybrids as unknown', () => {
    const g = makeGame();
    unlockFeature(g, 'hybrids');
    const a = createCreature(g, { speciesId: 'emberpup', rarity: 'common' });
    const b = createCreature(g, { speciesId: 'bubbloon', rarity: 'common' });
    const preview = breedingPreview(g, a, b);
    expect(preview.species[0]).toEqual({ id: null, p: 0.15 });
    expect(preview.species.reduce((x, s) => x + s.p, 0)).toBeCloseTo(1);
  });
});

describe('gene splicing', () => {
  function spliceGame(instability: number) {
    const g = makeGame(12, { genetics: { ...balance.genetics, splicing: { ...balance.genetics.splicing, instability } } });
    unlockFeature(g, 'splicing');
    for (const r of ['essence', 'gold']) g.state.resources[r] = D(1e9);
    const c = g.state.creatures[0]!;
    c.genome = normal();
    c.sequenced = true;
    g.state.geneLibrary['strength:Kt'] = true;
    return { g, c };
  }

  it('transfers an allele from the gene library', () => {
    const { g, c } = spliceGame(0);
    expect(splice(g, c.id, 'strength', 0, 'Kt').ok).toBe(true);
    expect(c.genome.strength).toEqual(['Kt', 'k']);
    expect(c.splices).toBe(1);
  });

  it('requires sequencing and a catalogued allele', () => {
    const { g, c } = spliceGame(0);
    expect(splice(g, c.id, 'armor', 0, 'Pd').ok).toBe(false);
    c.sequenced = false;
    expect(splice(g, c.id, 'strength', 0, 'Kt').ok).toBe(false);
  });

  it('is limited per creature and gets more expensive', () => {
    const { g, c } = spliceGame(0);
    const before = g.state.resources.essence!;
    for (let i = 0; i < maxSplices(g); i++) {
      c.genome.strength = ['k', 'k'];
      expect(splice(g, c.id, 'strength', 0, 'Kt').ok).toBe(true);
    }
    c.genome.strength = ['k', 'k'];
    expect(splice(g, c.id, 'strength', 0, 'Kt').ok).toBe(false);
    expect(before.sub(g.state.resources.essence!).toNumber()).toBe(80 * (1 + 2.5 + 6.25));
  });

  it('instability leaves the target untouched and scrambles another locus', () => {
    const { g, c } = spliceGame(1);
    const events: { success: boolean; scrambledLocus: string | null }[] = [];
    g.bus.on('spliced', (e) => events.push(e));
    expect(splice(g, c.id, 'strength', 0, 'Kt').ok).toBe(true);
    expect(c.genome.strength).toEqual(['k', 'k']);
    expect(events[0]!.success).toBe(false);
    expect(events[0]!.scrambledLocus).not.toBe('strength');
  });

  it('rolled genomes are deterministic per seed', () => {
    expect(rollGenome(makeGame(77))).toEqual(rollGenome(makeGame(77)));
  });
});

describe('splicing workbench helpers', () => {
  it('previews phenotype and stat changes of a splice', async () => {
    const { splicePreview } = await import('@core/features/splicing');
    const g = makeGame();
    const c = createCreature(g, { speciesId: 'pebblit', rarity: 'common', abilities: [], genome: normal(), stats: { hp: 100, atk: 100, def: 100, spd: 100 }, exactStats: true });
    const p = splicePreview(g, c, 'strength', 0, 'Kt')!;
    expect(p.current).toBe('k');
    expect(p.phenotypeBefore).toBe('Normal');
    expect(p.phenotypeAfter).toBe('Titanenkraft');
    expect(p.statsBefore.atk).toBe(100);
    expect(p.statsAfter.atk).toBe(145);
    expect(p.visibleChange).toBe(true);
    // Recessive allele next to the dominant one stays hidden.
    c.genome.fertility = ['f', 'f'];
    expect(splicePreview(g, c, 'fertility', 0, 'F')!.visibleChange).toBe(false);
    expect(c.genome.strength).toEqual(['k', 'k']);
  });

  it('describes modifiers in German', async () => {
    const { describeModifier } = await import('@core/queries');
    const g = makeGame();
    expect(describeModifier(g, { target: 'stat.atk', op: 'pct', value: 0.2 })).toBe('+20 % Angriff');
    expect(describeModifier(g, { target: 'breeding.time', op: 'mult', value: 0.8 })).toBe('Brutzeit ×0,8');
    expect(describeModifier(g, { target: 'production.gold', op: 'pct', value: 0.6 })).toBe('+60 % Gold-Ertrag');
  });
});

import { describe, expect, it } from 'vitest';
import { contentData, balance } from '@content/index';
import { ContentValidationError, buildContentDB, validateContent } from '@core/content/validate';
import type { ContentData } from '@core/content/types';

const clone = (): ContentData => structuredClone(contentData);

describe('content validation', () => {
  it('accepts the shipped content', () => {
    expect(validateContent(contentData)).toEqual([]);
  });

  it('balance covers every rarity', () => {
    for (const r of contentData.rarities) {
      expect(balance.rarity.weights[r.id], r.id).toBeGreaterThanOrEqual(0);
      expect(balance.rarity.statMultiplier[r.id], r.id).toBeGreaterThan(0);
    }
  });

  it('reports duplicate ids', () => {
    const data = clone();
    data.species.push({ ...data.species[0]! });
    expect(validateContent(data).join('\n')).toMatch(/species\[emberpup\]: doppelte id/);
  });

  it('reports broken references and targets with readable paths', () => {
    const data = clone();
    data.species[0]!.element = 'lava';
    data.upgrades[0]!.modifiers = [{ target: 'nonsense.target', op: 'add', value: 1 }];
    data.recipes[0]!.result = 'ghost';
    const issues = validateContent(data).join('\n');
    expect(issues).toContain('species[emberpup].element: unbekannte elements-id "lava"');
    expect(issues).toContain('ungültiges Modifier-Ziel "nonsense.target"');
    expect(issues).toContain('recipes[steam].result: unbekannte species-id "ghost"');
  });

  it('reports missing stats', () => {
    const data = clone();
    delete data.species[1]!.baseStats.spd;
    expect(validateContent(data).join('\n')).toContain('species[bubbloon].baseStats.spd: muss eine Zahl sein');
  });

  it('buildContentDB throws a ContentValidationError', () => {
    const data = clone();
    data.buildings[0]!.produces = 'diamonds';
    expect(() => buildContentDB(data)).toThrow(ContentValidationError);
  });
});

describe('gene content', () => {
  it('rejects gene library goals above the number of alleles', () => {
    const data = structuredClone(contentData);
    data.achievements.push({ id: 'impossible', name: 'x', description: 'x', condition: { type: 'geneLibrary', count: 999 }, modifiers: [] });
    expect(validateContent(data).join('\n')).toContain('achievements[impossible].condition.count: 999 liegt nicht in');
  });
});

describe('perfection achievements', () => {
  it('"all species" goals match the number of species', () => {
    for (const id of ['perfectGenomeAll', 'shinyAll']) {
      const a = contentData.achievements.find((x) => x.id === id)!;
      expect(a.condition.type === 'statistic' && a.condition.amount, id).toBe(contentData.species.length);
    }
  });
});

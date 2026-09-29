import { describe, expect, it } from 'vitest';
import type { Condition } from '@core/content/types';
import { balance, content } from './helpers';

/**
 * Guard rails for the long-term design (TODO „Leitplanken“):
 *  1. The start stays quick: anything running longer than an hour needs an inheritance first.
 *  2. Long projects are a bonus, never a gate: no unlock, research, region or recipe depends on them.
 */
const HOUR = 3600;

/** Systems whose processes run for hours, keyed by the feature that opens them. */
const LONG_FEATURES = ['grandResearch', 'specialBreeding', 'deepSequencing', 'voyage', 'megaProjects'];
/** Statistics that only long projects raise. */
const LONG_STATISTICS = ['voyages', 'completed.voyage', 'completed.deepSequence', 'completed.grandResearch', 'completed.megaProject'];

/** Does this condition only hold after at least one inheritance (directly or through a feature)? */
function needsInheritance(c: Condition | undefined, seen = new Set<string>()): boolean {
  if (!c) return false;
  switch (c.type) {
    case 'prestigeCount':
      return c.count >= 1 && (c.layer === 'inheritance' || c.layer === 'aeon');
    case 'all':
      return c.of.some((x) => needsInheritance(x, seen));
    case 'any':
      return c.of.length > 0 && c.of.every((x) => needsInheritance(x, seen));
    case 'feature': {
      if (seen.has(c.feature)) return false;
      seen.add(c.feature);
      return needsInheritance(content.features.get(c.feature).condition, seen);
    }
    case 'towerFloor':
      return needsInheritance({ type: 'feature', feature: 'tower' }, seen);
    default:
      return false;
  }
}

/** Every reference a condition makes to a long project. */
function longRefs(c: Condition | undefined): string[] {
  if (!c) return [];
  switch (c.type) {
    case 'all':
    case 'any':
      return c.of.flatMap(longRefs);
    case 'feature':
      return LONG_FEATURES.includes(c.feature) ? [`feature ${c.feature}`] : [];
    case 'statistic':
      return LONG_STATISTICS.includes(c.statistic) ? [`statistic ${c.statistic}`] : [];
    case 'megaProject':
      return [`megaProject ${c.project}`];
    default:
      return [];
  }
}

describe('Leitplanken', () => {
  it('the start stays quick: everything longer than an hour comes after the first inheritance', () => {
    for (const f of LONG_FEATURES) expect(needsInheritance(content.features.get(f).condition), f).toBe(true);
    for (const m of content.missions.list.filter((x) => x.durationSec > HOUR)) expect(needsInheritance(m.requires), `mission ${m.id}`).toBe(true);
    // The short loops stay short even deep into a run.
    expect(balance.genetics.sequencing.baseTimeSec).toBeLessThanOrEqual(HOUR);
    expect(balance.breeding.baseTimeSec * (1 + balance.breeding.timePerGeneration * 29)).toBeLessThanOrEqual(HOUR / 4);
  });

  it('long projects are a bonus: no basic system waits for one', () => {
    const gates: [string, Condition | undefined][] = [
      ...content.features.list.filter((f) => !LONG_FEATURES.includes(f.id)).map((f) => [`feature ${f.id}`, f.condition] as [string, Condition | undefined]),
      ...content.upgrades.list.map((u) => [`upgrade ${u.id}`, u.requires] as [string, Condition | undefined]),
      ...content.missions.list.map((m) => [`mission ${m.id}`, m.requires] as [string, Condition | undefined]),
      ...content.recipes.list.map((r) => [`recipe ${r.id}`, r.requires?.condition] as [string, Condition | undefined]),
      ...content.contracts.list.map((t) => [`contract ${t.id}`, t.requires] as [string, Condition | undefined]),
      ...content.anomalies.list.map((a) => [`anomaly ${a.id}`, a.requires] as [string, Condition | undefined]),
      ...content.genes.list.map((l) => [`gene ${l.id}`, l.requires] as [string, Condition | undefined]),
    ];
    for (const [where, cond] of gates) expect(longRefs(cond), where).toEqual([]);
    // Long projects only add bonuses – they never unlock a system themselves.
    for (const r of content.grandResearch.list) expect((r as { unlocksFeatures?: unknown }).unlocksFeatures, r.id).toBeUndefined();
  });

  it('only endgame bonuses (talent tiers 4–5, resonance) wait for the Großprojekt', () => {
    const gated = [
      ...content.talents.list.filter((t) => longRefs(t.unlock).length > 0).map((t) => t.tier),
      ...content.resonances.list.filter((r) => longRefs(r.requires).length > 0).map(() => 'resonance'),
    ];
    for (const g of gated) expect(g === 'resonance' || (typeof g === 'number' && g >= 4)).toBe(true);
  });
});

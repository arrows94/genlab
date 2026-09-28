import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { assignJob, buyUpgrade } from '@core/actions';
import { createCreature } from '@core/creatures';
import { researchEffect, researchParent, researchTree, timeToAfford } from '@core/research';
import { unlockFeature } from '@core/systems/unlocks';
import { content, makeGame } from './helpers';

const find = (g: ReturnType<typeof makeGame>, id: string) => researchTree(g).flatMap((b) => b.nodes).find((x) => x.def.id === id);

describe('research tree', () => {
  it('puts every research into a theme', () => {
    for (const u of content.upgrades.list.filter((x) => x.category === 'research')) expect(u.theme, u.id).toBeTruthy();
  });

  it('shows the next step locked under its parent, further steps stay hidden', () => {
    const g = makeGame();
    unlockFeature(g, 'research');
    expect(find(g, 'mineExpansion')).toBeUndefined(); // Grabungslizenz not available yet
    unlockFeature(g, 'breeding');
    const locked = find(g, 'mineExpansion')!;
    expect(locked.status).toBe('locked');
    expect(locked.missing).toEqual(['„Grabungslizenz“ erforschen']);
    expect(researchParent(g, locked.def)?.id).toBe('minePermit');

    g.state.resources.food = D(1e6);
    expect(buyUpgrade(g, 'minePermit').ok).toBe(true);
    const mine = researchTree(g).find((b) => b.theme.id === 'mine')!;
    expect(mine.nodes.map((x) => [x.def.id, x.depth])).toEqual([['minePermit', 0], ['mineExpansion', 1], ['richVeins', 1]]);
    expect(mine.nodes[0]!.status).toBe('maxed');
    expect(mine.nodes[1]!.status).toBe('open');
  });

  it('names progress requirements', () => {
    const g = makeGame();
    for (const f of ['research', 'breeding', 'mine', 'sequencing']) unlockFeature(g, f);
    g.state.statistics.hatched = 12;
    const auto = find(g, 'breedingAutomaton')!;
    expect(auto.status).toBe('locked');
    expect(auto.missing).toEqual(['40 Eier ausgebrütet (12/40)']);
  });

  it('estimates the time until a research is affordable', () => {
    const g = makeGame();
    unlockFeature(g, 'farm');
    const c = createCreature(g, { speciesId: 'sproutle', source: 'other' });
    expect(timeToAfford(g, { food: D(100) })).toBeNull(); // no income yet
    assignJob(g, c.id, 'farm');
    const rate = g.productionRates().food!.toNumber();
    g.state.resources.food = D(40);
    expect(timeToAfford(g, { food: D(100) })).toBeCloseTo((60 / rate) * 1000);
    expect(timeToAfford(g, { food: D(10) })).toBe(0);
  });

  it('reports the current effect (mult compounds)', () => {
    expect(researchEffect(content.upgrades.get('fertileSoil'), 2)!.value).toBeCloseTo(1.44);
    expect(researchEffect(content.upgrades.get('strongHands'), 3)).toEqual({ op: 'pct', value: 1.5 });
    expect(researchEffect(content.upgrades.get('minePermit'), 1)).toBeNull();
  });
});

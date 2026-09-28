import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { createCreature } from '@core/creatures';
import { inheritAbilities } from '@core/abilities';
import { nextRarity, startBreeding } from '@core/features/breeding';
import { MISSION, wildHybridSpecies } from '@core/features/expedition';
import {
  currentStage, depositMegaProject, depositPreview, megaConstruction, megaProgress, megaRemaining, megaState,
} from '@core/features/megaProjects';
import { buyResonance, buyTalent, resonanceCost, resonanceScale } from '@core/features/talents';
import { fightIntervalMs } from '@core/features/tower';
import { bossAttempts } from '@core/features/weeklyBoss';
import { useTimeCrystal } from '@core/features/timeCrystals';
import { plannedNotices } from '@core/notices';
import { performPrestige, resetImpactText } from '@core/prestige';
import { getProcessHandler } from '@core/systems/processes';
import { unlockFeature } from '@core/systems/unlocks';
import type { Process } from '@core/state';
import { NOW, balance, content, makeGame } from './helpers';

const H = 3_600_000;
const observatory = content.megaProjects.get('observatory');

function megaGame(seed = 7) {
  const g = makeGame(seed);
  for (const f of ['farm', 'mine', 'biolab', 'breeding', 'expedition', 'tower', 'inheritance', 'aeon', 'megaProjects']) unlockFeature(g, f);
  g.state.prestige.inheritance = { count: 3 };
  g.state.tower.best = 20; // the Äon (and with it the Großprojekt) comes back after each reset
  return g;
}

/** Pays every stage resource in full. */
function fund(g: ReturnType<typeof megaGame>, factor = 1) {
  const stage = currentStage(g, observatory)!;
  for (const [res, amount] of Object.entries(stage.cost)) g.state.resources[res] = D(amount * factor);
}

describe('Großprojekt: Äon-Observatorium', () => {
  it('opens together with the Äon', () => {
    expect(content.features.get('megaProjects').condition).toEqual({ type: 'feature', feature: 'aeon' });
    const g = makeGame();
    expect(depositMegaProject(g, 'observatory').ok).toBe(false);
  });

  it('takes deposits over several visits, up to what is missing', () => {
    const g = megaGame();
    const stage = currentStage(g, observatory)!;
    fund(g, 0.5);
    g.state.resources.gold = D(stage.cost.gold! * 0.5);
    expect(depositMegaProject(g, 'observatory', 0.5).ok).toBe(true);
    expect(megaState(g, 'observatory').paid.gold!.toNumber()).toBe(stage.cost.gold! * 0.25);
    expect(megaProgress(g, observatory)).toBeCloseTo(0.25);
    // Paying in more than needed keeps the rest.
    g.state.resources.gold = D(stage.cost.gold! * 10);
    g.state.resources.towerTokens = D(0);
    expect(depositMegaProject(g, 'observatory').ok).toBe(true);
    expect(g.state.resources.gold!.toNumber()).toBe(stage.cost.gold! * 10 - stage.cost.gold! * 0.75);
    expect(Object.keys(megaRemaining(g, observatory))).toEqual(['towerTokens']);
    expect(megaConstruction(g, 'observatory')).toBeUndefined();
    expect(depositMegaProject(g, 'observatory')).toEqual({ ok: false, reason: 'Nichts zum Einzahlen vorhanden.' });
  });

  it('builds each stage by the clock once it is paid', () => {
    const g = megaGame();
    const stage = currentStage(g, observatory)!;
    fund(g);
    expect(depositMegaProject(g, 'observatory').ok).toBe(true);
    const proc = megaConstruction(g, 'observatory')!;
    expect(proc.durationMs).toBe(stage.hours * H);
    fund(g);
    expect(Object.keys(depositPreview(g, observatory))).toHaveLength(0);
    expect(depositMegaProject(g, 'observatory').ok).toBe(false);
    g.simulateOffline(stage.hours * H + 1000);
    expect(megaState(g, 'observatory').stage).toBe(1);
    expect(megaState(g, 'observatory').paid).toEqual({});
    expect(currentStage(g, observatory)!.name).toBe(observatory.stages[1]!.name);
  });

  it('keeps deposits and a running construction through an Äon', () => {
    const g = megaGame();
    fund(g);
    expect(depositMegaProject(g, 'observatory').ok).toBe(true);
    g.state.resources.heritage = D(500);
    expect(resetImpactText(g)).toContain('Bau läuft ungestört weiter');
    expect(performPrestige(g, 'aeon').ok).toBe(true);
    expect(megaConstruction(g, 'observatory')).toBeDefined();
    g.simulateOffline(observatory.stages[0]!.hours * H + 1000);
    expect(megaState(g, 'observatory').stage).toBe(1);

    fund(g, 0.5);
    expect(depositMegaProject(g, 'observatory').ok).toBe(true);
    const paid = megaProgress(g, observatory);
    g.state.earned.food = D(1e15);
    g.state.earned.gold = D(1e15);
    unlockFeature(g, 'inheritance');
    expect(performPrestige(g, 'inheritance').ok).toBe(true);
    expect(megaProgress(g, observatory)).toBeCloseTo(paid);
  });

  it('announces a finished stage and takes time crystals', () => {
    const g = megaGame();
    unlockFeature(g, 'contracts');
    g.state.resources.timeCrystals = D(1);
    fund(g);
    depositMegaProject(g, 'observatory');
    const proc = megaConstruction(g, 'observatory')!;
    expect(useTimeCrystal(g, proc.id).ok).toBe(true);
    expect(plannedNotices(g, NOW).find((n) => n.kind === 'megaProject')?.body).toContain('Fundament');
  });
});

describe('Äon talent tiers 4 and 5', () => {
  function tierGame() {
    const g = megaGame();
    g.state.resources.aeonShards = D(1000);
    for (const t of content.talents.list.filter((x) => x.tier <= 3)) g.state.talents[t.id] = true;
    return g;
  }

  it('are sealed until the observatory stages are built', () => {
    for (const t of content.talents.list.filter((x) => x.tier >= 4)) expect(t.unlock?.type, t.id).toBe('megaProject');
    const g = tierGame();
    expect(buyTalent(g, 'bloodline')).toEqual({ ok: false, reason: 'Diese Talentstufe ist noch versiegelt.' });
    g.state.megaProjects.observatory = { stage: 2, paid: {} };
    expect(buyTalent(g, 'bloodline').ok).toBe(true);
    expect(buyTalent(g, 'risingBrood')).toEqual({ ok: false, reason: 'Diese Talentstufe ist noch versiegelt.' });
    g.state.megaProjects.observatory = { stage: 4, paid: {} };
    expect(buyTalent(g, 'risingBrood').ok).toBe(true);
  });

  it('Starke Blutlinie passes on every parent ability', () => {
    const g = tierGame();
    const [a, b, c] = content.abilities.list.map((x) => x.id);
    let kept = 0;
    for (let i = 0; i < 20; i++) kept += inheritAbilities(g, [a!, b!], [c!], 0).length;
    expect(kept).toBeLessThan(60);
    g.state.talents.bloodline = true;
    g.invalidate();
    for (let i = 0; i < 20; i++) expect(inheritAbilities(g, [a!, b!], [c!], 0)).toHaveLength(3);
  });

  it('Wilde Kreuzungen brings discovered hybrids home from expeditions', () => {
    const g = tierGame();
    g.state.dex['glacierfin:common'] = true;
    expect(wildHybridSpecies(g, 'frostpeak')).toEqual(['glacierfin']);
    expect(wildHybridSpecies(g, 'shadowwood')).toEqual([]);
    const found = (talent: boolean) => {
      g.state.talents.wildHybrids = talent;
      g.invalidate();
      const species: string[] = [];
      const off = g.bus.on('missionCompleted', (e) => {
        const c = g.state.creatures.find((x) => x.id === e.wildCreatureId);
        if (c) species.push(c.speciesId);
      });
      for (let i = 0; i < 120; i++) {
        const proc: Process = { id: 10_000 + i, kind: MISSION, durationMs: 1, elapsedMs: 1, data: { missionId: 'frostpeak', creatureId: -1 } };
        getProcessHandler(MISSION)!.complete(g, proc);
        g.state.creatures = [];
      }
      off();
      return species;
    };
    expect(found(false)).not.toContain('glacierfin');
    const withTalent = found(true);
    expect(withTalent).toContain('glacierfin');
    expect(withTalent).toContain('frostling');
  });

  it('Aufstrebende Brut lifts a hatchling one rarity step', () => {
    expect(nextRarity(makeGame(), 'common')).toBe('uncommon');
    expect(nextRarity(makeGame(), 'mythic')).toBe('mythic');
    const g = tierGame();
    g.state.buffs.push({ id: 9_999, source: 'test', remainingMs: 1e12, modifiers: [{ target: 'breeding.rarityUp', op: 'add', value: 1 }], creatureId: null });
    g.state.buffs.push({ id: 9_998, source: 'test', remainingMs: 1e12, modifiers: [{ target: 'rarity.weight.common', op: 'mult', value: 1e6 }], creatureId: null });
    g.state.resources.food = D(1e12);
    g.state.resources.gold = D(1e12);
    g.invalidate();
    for (let i = 0; i < 5; i++) {
      const a = createCreature(g, { speciesId: 'emberpup', rarity: 'common', source: 'other' });
      const b = createCreature(g, { speciesId: 'emberpup', rarity: 'common', source: 'other' });
      const before = new Set(g.state.creatures.map((c) => c.id));
      expect(startBreeding(g, a.id, b.id).ok).toBe(true);
      g.simulateOffline(12 * H);
      const child = g.state.creatures.find((c) => !before.has(c.id) && c.parents);
      expect(child?.rarity).toBe('uncommon');
      g.state.creatures = [];
    }
  });

  it('Sturmlauf halves the tower pace, Titanenjäger adds boss attacks', () => {
    const g = tierGame();
    expect(fightIntervalMs(g)).toBe(balance.tower.fightIntervalSec * 1000);
    expect(bossAttempts(g)).toEqual({ perDay: balance.weeklyBoss.attemptsPerDay, max: balance.weeklyBoss.maxAttempts });
    g.state.talents.towerRush = true;
    g.state.talents.titanHunter = true;
    g.invalidate();
    expect(fightIntervalMs(g)).toBe(balance.tower.fightIntervalSec * 500);
    expect(bossAttempts(g)).toEqual({ perDay: balance.weeklyBoss.attemptsPerDay + 1, max: balance.weeklyBoss.maxAttempts + 2 });
  });
});

describe('Äon-Resonanz', () => {
  it('opens with the star map and grows endlessly with diminishing returns', () => {
    const g = megaGame();
    g.state.resources.aeonShards = D(1000);
    const def = content.resonances.get('harvestResonance');
    expect(buyResonance(g, def.id).ok).toBe(false);
    g.state.megaProjects.observatory = { stage: observatory.stages.length, paid: {} };
    const base = g.mods().totals('production.food').pct;

    expect(buyResonance(g, def.id).ok).toBe(true);
    expect(g.state.resources.aeonShards!.toNumber()).toBe(1000 - def.cost);
    expect(g.mods().totals('production.food').pct).toBeCloseTo(base + 0.25);
    expect(resonanceCost(def, 1)).toBe(Math.ceil(def.cost * def.costGrowth));

    expect(buyResonance(g, def.id).ok).toBe(true);
    expect(g.state.resonance[def.id]).toBe(2);
    expect(g.mods().totals('production.food').pct).toBeCloseTo(base + 0.25 * resonanceScale(def, 2));
    // Each level adds less than the one before.
    expect(resonanceScale(def, 3) - resonanceScale(def, 2)).toBeLessThan(resonanceScale(def, 2) - resonanceScale(def, 1));

    g.state.resources.aeonShards = D(0);
    expect(buyResonance(g, def.id)).toEqual({ ok: false, reason: 'Nicht genug Äon-Splitter.' });
  });

  it('survives an Äon', () => {
    const g = megaGame();
    g.state.resonance.battleResonance = 3;
    g.state.megaProjects.observatory = { stage: 4, paid: {} };
    g.state.resources.heritage = D(500);
    expect(performPrestige(g, 'aeon').ok).toBe(true);
    expect(g.state.resonance.battleResonance).toBe(3);
    expect(g.state.megaProjects.observatory!.stage).toBe(4);
  });
});

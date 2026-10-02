import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { buyUpgrade } from '@core/actions';
import { createCreature } from '@core/creatures';
import { autoSequenceOnce, inRecycler, sendToRecycler, setAutoSequence } from '@core/features/automation';
import { campSlots } from '@core/features/expedition';
import { grandCost, grandHours, grandLevel, grandSlots, runningGrandResearch, startGrandResearch } from '@core/features/grandResearch';
import { sequencerSlots, sequencerUsed } from '@core/features/sequencing';
import { useTimeCrystal } from '@core/features/timeCrystals';
import { performPrestige } from '@core/prestige';
import { plannedNotices } from '@core/notices';
import { unlockFeature } from '@core/systems/unlocks';
import { NOW, content, makeGame } from './helpers';

const H = 3_600_000;

function grandGame() {
  const g = makeGame();
  unlockFeature(g, 'expedition');
  unlockFeature(g, 'inheritance');
  g.state.prestige.inheritance = { count: 1 };
  unlockFeature(g, 'grandResearch');
  for (const res of ['food', 'gold', 'essence', 'catalyst', 'fragments']) g.state.resources[res] = D(1e9);
  return g;
}

describe('Großforschung', () => {
  it('opens after the first inheritance', () => {
    expect(content.features.get('grandResearch').condition).toEqual({ type: 'prestigeCount', layer: 'inheritance', count: 1 });
    const g = makeGame();
    expect(startGrandResearch(g, 'expeditionNetwork').ok).toBe(false);
  });

  it('runs for hours on its own slot and grants a permanent bonus', () => {
    const g = grandGame();
    const def = content.grandResearch.get('expeditionNetwork');
    const camps = campSlots(g);
    expect(startGrandResearch(g, def.id).ok).toBe(true);
    expect(runningGrandResearch(g)[0]!.durationMs).toBe(grandHours(def, 1) * H);
    expect(grandSlots(g)).toBe(1);
    expect(startGrandResearch(g, 'timeLab').ok).toBe(false); // slot taken
    g.simulateOffline(grandHours(def, 1) * H + 1000);
    expect(grandLevel(g, def.id)).toBe(1);
    expect(campSlots(g)).toBe(camps + 1);
  });

  it('later levels cost and take more, up to the maximum', () => {
    const g = grandGame();
    const def = content.grandResearch.get('breedingGrounds');
    expect(grandHours(def, 2)).toBe(def.hours * def.hoursGrowth);
    expect(grandCost(g, def, 2).essence!.toNumber()).toBe(def.cost.essence! * def.costGrowth);
    g.state.grandResearch[def.id] = def.maxLevel;
    expect(startGrandResearch(g, def.id)).toEqual({ ok: false, reason: 'Bereits vollständig erforscht.' });
  });

  it('keeps levels and the running project through an inheritance', () => {
    const g = grandGame();
    g.state.grandResearch.timeLab = 1;
    expect(startGrandResearch(g, 'sequencerArray').ok).toBe(true);
    g.state.earned.food = D(1e12);
    g.state.earned.gold = D(1e12);
    expect(performPrestige(g, 'inheritance').ok).toBe(true);
    expect(g.state.grandResearch.timeLab).toBe(1);
    expect(runningGrandResearch(g)).toHaveLength(1);
  });

  it('works with time crystals and notifications', () => {
    const g = grandGame();
    unlockFeature(g, 'contracts');
    g.state.resources.timeCrystals = D(1);
    expect(startGrandResearch(g, 'eternalHarvest').ok).toBe(true);
    const p = runningGrandResearch(g)[0]!;
    expect(useTimeCrystal(g, p.id).ok).toBe(true);
    expect(p.elapsedMs).toBe(4 * H);
    expect(plannedNotices(g, NOW).some((n) => n.kind === 'grandResearch')).toBe(true);
  });
});

describe('Sequenzier-Roboter', () => {
  function robotGame() {
    const g = makeGame();
    unlockFeature(g, 'sequencing');
    g.state.resources.essence = D(1e6);
    g.state.resources.gold = D(1e6);
    g.state.statistics.sequenced = 5;
    return g;
  }

  it('is a research that unlocks the automation', () => {
    const g = robotGame();
    expect(setAutoSequence(g, true).ok).toBe(false);
    expect(buyUpgrade(g, 'autoSequencer').ok).toBe(true);
    expect(g.state.features.autoSequence).toBe(true);
    expect(setAutoSequence(g, true).ok).toBe(true);
  });

  it('fills free sequencers with the strongest unknown genomes', () => {
    const g = robotGame();
    unlockFeature(g, 'autoSequence');
    const weak = createCreature(g, { speciesId: 'sproutle', source: 'other', stats: { hp: 1, atk: 1, def: 1, spd: 1 }, exactStats: true });
    const strong = createCreature(g, { speciesId: 'emberpup', source: 'other', stats: { hp: 99, atk: 99, def: 99, spd: 99 }, exactStats: true });
    expect(autoSequenceOnce(g)).toBe(sequencerSlots(g));
    const target = (g.state.processes[0]!.data as { creatureId: number }).creatureId;
    expect(target).toBe(strong.id);
    expect(target).not.toBe(weak.id);
    expect(autoSequenceOnce(g)).toBe(0); // slots full
  });

  it('leaves creatures sent to the recycler alone', () => {
    const g = robotGame();
    unlockFeature(g, 'autoSequence');
    unlockFeature(g, 'recycler');
    const doomed = createCreature(g, { speciesId: 'emberpup', source: 'other', stats: { hp: 99, atk: 99, def: 99, spd: 99 }, exactStats: true });
    expect(sendToRecycler(g, [doomed.id]).ok).toBe(true);
    expect(inRecycler(g, doomed.id)).toBe(true);
    autoSequenceOnce(g);
    const targets = g.state.processes.map((p) => (p.data as { creatureId?: number }).creatureId);
    expect(targets).not.toContain(doomed.id);
  });

  it('runs on its own when switched on', () => {
    const g = robotGame();
    unlockFeature(g, 'autoSequence');
    createCreature(g, { speciesId: 'emberpup', source: 'other' });
    g.advance(g.balance.automation.intervalSec * 1000 + 100);
    expect(sequencerUsed(g)).toBe(0);
    expect(setAutoSequence(g, true).ok).toBe(true);
    g.advance(g.balance.automation.intervalSec * 1000 + 100);
    expect(sequencerUsed(g)).toBe(1);
  });
});

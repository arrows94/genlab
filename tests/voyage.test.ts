import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { createCreature } from '@core/creatures';
import { startMission } from '@core/features/expedition';
import { startDeepSequencing } from '@core/features/deepSequencing';
import { revealGenome } from '@core/features/sequencing';
import { performPrestige, resetImpactText } from '@core/prestige';
import { optionRewards, pendingDecision, resolveVoyage, revealedEvents, runningVoyage, startVoyage, voyageDestination, voyageDurationMs, voyageBonus } from '@core/features/voyage';
import { mutationForWeek, weekIndex } from '@core/features/weekly';
import { plannedNotices } from '@core/notices';
import { deserialize, serialize } from '@core/save';
import { unlockFeature } from '@core/systems/unlocks';
import { NOW, balance, content, makeGame } from './helpers';

const DAY = 86_400_000;

function voyageGame(seed = 3) {
  const g = makeGame(seed);
  unlockFeature(g, 'expedition');
  unlockFeature(g, 'voyage');
  g.state.resources.food = D(1e6);
  g.state.resources.gold = D(1e6);
  for (const sp of ['zephyrix', 'bubbloon', 'voltmouse']) createCreature(g, { speciesId: sp, source: 'other' });
  return g;
}

/** Game with a returned voyage whose decision is forced to `decision`. */
function returned(decision: string, seed = 3) {
  const g = voyageGame(seed);
  const team = g.state.creatures.slice(1, 3).map((c) => c.id);
  expect(startVoyage(g, team).ok).toBe(true);
  g.simulateOffline(voyageDurationMs(g) + 1000);
  g.state.voyage.pending!.decision = decision;
  return { g, team };
}

describe('Wochenexpedition', () => {
  it('unlocks after the second inheritance', () => {
    const f = content.features.get('voyage');
    expect(f.condition).toEqual({ type: 'prestigeCount', layer: 'inheritance', count: 2 });
    const g = makeGame();
    expect(startVoyage(g, [g.state.creatures[0]!.id]).ok).toBe(false);
  });

  it('picks the destination by week and follows the weekly mutation element', () => {
    const g = voyageGame();
    let themed = 0;
    for (let week = 0; week < 40; week++) {
      const at = NOW + week * 7 * DAY;
      const dest = voyageDestination(g, at);
      const m = mutationForWeek(content.weeklyMutations.list, weekIndex(balance.weekly.epoch, at));
      const elements = (m?.modifiers ?? []).map((x) => /^element\.([^.]+)\./.exec(x.target)?.[1]).filter(Boolean);
      if (elements.length > 0 && content.voyageDestinations.list.some((d) => elements.includes(d.element))) {
        expect(elements).toContain(dest.element);
        themed++;
      }
    }
    expect(themed).toBeGreaterThan(0);
  });

  it('sends a team for seven days and blocks a camp', () => {
    const g = voyageGame();
    const [lead, a, b, c] = g.state.creatures;
    expect(startVoyage(g, [a!.id, b!.id, c!.id, lead!.id]).ok).toBe(false); // > maxTeam
    const food = g.state.resources.food!.toNumber();
    expect(startVoyage(g, [a!.id, b!.id]).ok).toBe(true);
    expect(g.state.resources.food!.toNumber()).toBeCloseTo(food - balance.voyage.cost.food!, 3);
    expect(a!.job?.kind).toBe('mission');
    expect(runningVoyage(g)!.durationMs).toBe(balance.voyage.days * DAY);
    // The only camp is taken – no other expedition, no second voyage.
    expect(startMission(g, c!.id, 'short')).toEqual({ ok: false, reason: 'Alle Camps sind belegt.' });
    expect(startVoyage(g, [c!.id]).ok).toBe(false);
  });

  it('reveals one event per day', () => {
    const g = voyageGame();
    expect(startVoyage(g, [g.state.creatures[1]!.id]).ok).toBe(true);
    const p = runningVoyage(g)!;
    expect(revealedEvents(g, p)).toHaveLength(0);
    g.simulateOffline(2.5 * DAY);
    expect(revealedEvents(g, p).map((e) => e.day)).toEqual([1, 2]);
    expect(new Set((p.data as { events: string[] }).events).size).toBe(balance.voyage.events);
  });

  it('draws events of everywhere or of its own destination', () => {
    let local = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const g = voyageGame(seed);
      expect(startVoyage(g, [g.state.creatures[1]!.id]).ok).toBe(true);
      const d = runningVoyage(g)!.data as { destination: string; events: string[] };
      for (const id of d.events) {
        const only = content.voyageEvents.get(id).destinations;
        if (only) {
          expect(only).toContain(d.destination);
          local++;
        }
      }
    }
    expect(local).toBeGreaterThan(0);
  });

  it('brings Zeitkristalle and (with the GenLab RPG) Fackeln home on top of the loot', () => {
    const plain = returned('injured', 3).g;
    expect(plain.state.voyage.pending!.loot['torches']).toBeUndefined();
    const g = voyageGame(3);
    unlockFeature(g, 'contracts');
    unlockFeature(g, 'rpg');
    expect(voyageBonus(g)).toEqual(balance.voyage.bonus);
    const team = g.state.creatures.slice(1, 3).map((c) => c.id);
    expect(startVoyage(g, team).ok).toBe(true);
    g.simulateOffline(voyageDurationMs(g) + 1000);
    const loot = g.state.voyage.pending!.loot;
    expect(loot['timeCrystals']!.toNumber()).toBeGreaterThanOrEqual(balance.voyage.bonus['timeCrystals']!);
    expect(loot['torches']!.toNumber()).toBe(balance.voyage.bonus['torches']);
  });

  it('comes back by the real clock and waits for a decision', () => {
    const g = voyageGame();
    const member = g.state.creatures[1]!;
    expect(startVoyage(g, [member.id]).ok).toBe(true);
    const report = g.simulateOffline(8 * DAY);
    expect(report.simulatedMs).toBeLessThan(DAY);
    expect(report.completed.voyage).toBe(1);
    expect(runningVoyage(g)).toBeUndefined();
    expect(member.job).toBeNull();
    expect(g.state.voyage.pending).not.toBeNull();
    expect(pendingDecision(g)).not.toBeNull();
    // A new voyage has to wait until the decision is made.
    expect(startVoyage(g, [member.id]).ok).toBe(false);
  });

  it('taking the injured beast costs loot and brings an epic creature', () => {
    const { g } = returned('injuredBeast');
    const loot = g.state.voyage.pending!.loot;
    const keep = optionRewards(g, 1);
    const take = optionRewards(g, 0);
    for (const res of Object.keys(loot)) expect(take[res]!.lte(keep[res]!)).toBe(true);
    const count = g.state.creatures.length;
    const found: (number | null)[] = [];
    g.bus.on('voyageResolved', (e) => found.push(e.creatureId));
    expect(resolveVoyage(g, 0).ok).toBe(true);
    expect(g.state.creatures).toHaveLength(count + 1);
    const c = g.state.creatures.find((x) => x.id === found[0])!;
    expect(content.rarities.get(c.rarity).order).toBeGreaterThanOrEqual(content.rarities.get('epic').order);
    expect(g.state.voyage.pending).toBeNull();
    expect(g.state.statistics.voyages).toBe(1);
    expect(resolveVoyage(g, 0).ok).toBe(false);
  });

  it('keeping the old map boosts the next voyage', () => {
    const { g, team } = returned('oldMap');
    expect(resolveVoyage(g, 0).ok).toBe(true);
    expect(g.state.voyage.nextBonus).toBe(0.5);
    expect(startVoyage(g, team).ok).toBe(true);
    expect((runningVoyage(g)!.data as { bonus: number }).bonus).toBe(0.5);
    expect(g.state.voyage.nextBonus).toBe(0);
  });

  it('lessons boost every team member permanently', () => {
    const { g, team } = returned('mentor');
    expect(resolveVoyage(g, 0).ok).toBe(true);
    for (const id of team) expect(g.state.creatures.find((c) => c.id === id)!.boosts.atk).toBeCloseTo(0.05);
  });

  it('announces the return and survives a save', () => {
    const g = voyageGame();
    expect(startVoyage(g, [g.state.creatures[1]!.id]).ok).toBe(true);
    const notice = plannedNotices(g, NOW).find((n) => n.kind === 'voyage');
    expect(notice?.at).toBe(NOW + voyageDurationMs(g));
    g.simulateOffline(voyageDurationMs(g) + 1000);
    const { state } = deserialize(serialize(g.state, NOW));
    expect(state.voyage.pending!.loot).toEqual(g.state.voyage.pending!.loot);
    const old = JSON.parse(serialize(makeGame().state, NOW));
    delete old.state.voyage;
    expect(deserialize(JSON.stringify(old)).state.voyage).toEqual({ pending: null, nextBonus: 0 });
  });
});

describe('long projects and inheritance', () => {
  it('travellers keep going through an inheritance, lab work does not', () => {
    const g = voyageGame();
    unlockFeature(g, 'inheritance');
    unlockFeature(g, 'sequencing');
    g.state.prestige.inheritance = { count: 2 };
    unlockFeature(g, 'deepSequencing');
    g.state.resources.essence = D(1e6);
    // Two camps: one for the voyage, one for a journey.
    const camp = content.upgrades.list.find((u) => u.modifiers.some((m) => m.target === 'slots.camp'))!;
    g.state.upgrades[camp.id] = 1;
    g.invalidate();
    const [, a, b, c] = g.state.creatures;
    expect(startVoyage(g, [a!.id]).ok).toBe(true);
    expect(startMission(g, b!.id, 'mistmoor').ok).toBe(true);
    revealGenome(g, c!);
    expect(startDeepSequencing(g, c!.id).ok).toBe(true);
    g.state.earned.food = D(1e12);
    g.state.earned.gold = D(1e12);
    a!.infusion = { level: 5, ep: 100 };
    a!.boosts = { atk: 0.3 };
    a!.boostUses = 6;
    a!.lineage = 4;

    expect(performPrestige(g, 'inheritance').ok).toBe(true);
    // Travellers start over like everyone else: no infusion, potion boosts or pure line from the old run.
    expect(a!.infusion).toEqual({ level: 0, ep: 0 });
    expect(a!.boosts).toEqual({});
    expect(a!.boostUses).toBe(0);
    expect(a!.lineage).toBe(0);
    // Voyage and journey with their travellers survive, the deep sequencing (lab) is gone.
    expect(g.state.processes.map((p) => p.kind).sort()).toEqual(['mission', 'voyage']);
    expect(g.state.creatures.map((x) => x.id)).toEqual(expect.arrayContaining([a!.id, b!.id]));
    expect(g.state.creatures.some((x) => x.id === c!.id)).toBe(false);
    // A fresh start creature is at home.
    expect(g.state.creatures.filter((x) => x.job === null)).toHaveLength(1);

    g.simulateOffline(voyageDurationMs(g) + 1000);
    expect(g.state.voyage.pending).not.toBeNull();
    expect(g.state.creatures.find((x) => x.id === a!.id)?.job).toBeNull();
  });
});

describe('Unterricht (teamBoost)', () => {
  it('stops at the Kraftfutter cap', async () => {
    const { maxStatBoost } = await import('@core/features/market');
    const { g, team } = returned('mentor');
    const c = g.state.creatures.find((x) => x.id === team[0])!;
    const cap = maxStatBoost(g);
    expect(cap).toBeGreaterThan(0);
    c.boosts = Object.fromEntries(content.stats.list.map((s) => [s.id, cap]));
    expect(resolveVoyage(g, 0).ok).toBe(true);
    for (const s of content.stats.list) expect(c.boosts[s.id]).toBeCloseTo(cap, 9);
    const other = g.state.creatures.find((x) => x.id === team[1])!;
    for (const s of content.stats.list) expect(other.boosts[s.id]).toBeCloseTo(0.05, 9);
  });
});

describe('reset impact text', () => {
  it('names lost lab work and travellers', () => {
    const g = voyageGame();
    expect(resetImpactText(g)).toBe('');
    expect(startVoyage(g, [g.state.creatures[1]!.id]).ok).toBe(true);
    expect(resetImpactText(g)).toContain('Eine Reise läuft weiter');
  });
});

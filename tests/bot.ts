import { assignJob, buyUpgrade, collect, nextUpgradeCost } from '@core/actions';
import { canAfford } from '@core/costs';
import { breedingCost, eggs, nestSlots, offspringGeneration, startBreeding } from '@core/features/breeding';
import { campSlots, runningMissions, startMission } from '@core/features/expedition';
import { jobCount, jobSlots } from '@core/systems/production';
import { visibleUpgrades } from '@core/queries';
import { creaturePower } from '@core/creatures';
import type { Game } from '@core/game';
import { canConsume, sell, stableFree } from '@core/features/stable';

export interface TimelineEntry {
  min: number;
  what: string;
}

/**
 * A simple greedy "player" used to check pacing: clicks a few times per
 * second, buys the cheapest research, breeds, explores and fills jobs.
 */
export function playBot(g: Game, minutes: number, clicksPerSec = 2): TimelineEntry[] {
  const timeline: TimelineEntry[] = [];
  const now = () => Math.round((g.state.simTimeMs / 60_000) * 10) / 10;
  g.bus.on('featureUnlocked', (e) => timeline.push({ min: now(), what: `Freigeschaltet: ${e.feature}` }));
  g.bus.on('upgradeBought', (e) => timeline.push({ min: now(), what: `Forschung: ${e.upgrade} ${e.level}` }));
  g.bus.on('eggHatched', () => timeline.push({ min: now(), what: 'Ei geschlüpft' }));
  g.bus.on('missionCompleted', (e) => e.wildCreatureId && timeline.push({ min: now(), what: 'Wilde Kreatur gefunden' }));
  g.bus.on('achievementUnlocked', (e) => timeline.push({ min: now(), what: `Erfolg: ${e.achievement}` }));

  for (let sec = 0; sec < minutes * 60; sec++) {
    for (let i = 0; i < clicksPerSec; i++) collect(g);

    // Research: cheapest affordable (by total cost).
    const affordable = visibleUpgrades(g)
      .map((u) => ({ u, cost: nextUpgradeCost(g, u.id) }))
      .filter((x) => x.cost && canAfford(g.state, x.cost))
      .sort((a, b) => sum(a.cost!) - sum(b.cost!));
    if (affordable[0]) buyUpgrade(g, affordable[0].u.id);

    // Stable management: sell the weakest spare creatures when nearly full.
    if (stableFree(g) <= 1) {
      const spare = g.state.creatures.filter((c) => canConsume(g, c)).sort((a, b) => creaturePower(g, a) - creaturePower(g, b));
      if (spare.length > 0) sell(g, spare.slice(0, 3).map((c) => c.id));
    }

    // Breeding: the two strongest available creatures; if too expensive, the cheapest (lowest generation) pair.
    if (g.state.features.breeding && eggs(g).length < nestSlots(g)) {
      const pool = g.state.creatures.filter((c) => c.job?.kind !== 'nest' && c.job?.kind !== 'mission');
      const strong = [...pool].sort((a, b) => creaturePower(g, b) - creaturePower(g, a));
      const cheap = [...pool].sort((a, b) => a.generation - b.generation);
      for (const pair of [strong, cheap]) {
        if (pair.length >= 2 && canAfford(g.state, breedingCost(g, offspringGeneration(pair[0], pair[1])))) {
          startBreeding(g, pair[0]!.id, pair[1]!.id);
          break;
        }
      }
    }

    // Missions: short missions whenever a camp is free and food allows.
    if (g.state.features.expedition && runningMissions(g).length < campSlots(g)) {
      const idle = g.state.creatures.find((c) => c.job === null);
      if (idle && g.state.resources.food!.gte(100)) startMission(g, idle.id, 'short');
    }

    // Jobs: fill free slots round-robin (building with the fewest workers first).
    for (;;) {
      const idle = g.state.creatures.find((c) => c.job === null);
      const open = g.content.buildings.list
        .filter((b) => g.state.features[b.feature] && jobCount(g, b.id) < jobSlots(g, b.id))
        .sort((a, b) => jobCount(g, a.id) - jobCount(g, b.id));
      if (!idle || !open[0] || !assignJob(g, idle.id, open[0].id).ok) break;
    }

    g.advance(1000);
  }
  return timeline;
}

function sum(cost: Record<string, { toNumber(): number }>): number {
  return Object.values(cost).reduce((a, v) => a + v.toNumber(), 0);
}

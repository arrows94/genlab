import { assignJob, buyUpgrade, collect, nextUpgradeCost } from '@core/actions';
import { canAfford } from '@core/costs';
import { breedingCost, eggs, nestSlots, offspringGeneration, startBreeding } from '@core/features/breeding';
import { campSlots, runningMissions, startMission } from '@core/features/expedition';
import { jobCount, jobSlots } from '@core/systems/production';
import { visibleUpgrades } from '@core/queries';
import { creaturePower } from '@core/creatures';
import type { Game } from '@core/game';

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

    // Breeding: the two strongest available creatures (improves the line).
    if (g.state.features.breeding && eggs(g).length < nestSlots(g)) {
      const pool = g.state.creatures.filter((c) => c.job?.kind !== 'nest' && c.job?.kind !== 'mission').sort((a, b) => creaturePower(g, b) - creaturePower(g, a));
      if (pool.length >= 2 && canAfford(g.state, breedingCost(g, offspringGeneration(pool[0], pool[1])))) {
        startBreeding(g, pool[0]!.id, pool[1]!.id);
      }
    }

    // Missions: short missions whenever a camp is free and food allows.
    if (g.state.features.expedition && runningMissions(g).length < campSlots(g)) {
      const idle = g.state.creatures.find((c) => c.job === null);
      if (idle && g.state.resources.food!.gte(100)) startMission(g, idle.id, 'short');
    }

    // Jobs: fill free slots with idle creatures.
    for (const b of g.content.buildings.list) {
      if (!g.state.features[b.feature]) continue;
      while (jobCount(g, b.id) < jobSlots(g, b.id)) {
        const idle = g.state.creatures.find((c) => c.job === null);
        if (!idle || !assignJob(g, idle.id, b.id).ok) break;
      }
    }

    g.advance(1000);
  }
  return timeline;
}

function sum(cost: Record<string, { toNumber(): number }>): number {
  return Object.values(cost).reduce((a, v) => a + v.toNumber(), 0);
}

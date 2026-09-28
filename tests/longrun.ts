import { assignJob } from '@core/actions';
import { canAfford, toCost } from '@core/costs';
import { creaturePower, effectiveStats } from '@core/creatures';
import { availableRituals, eggCost, eggs, nestSlots, offspringGeneration, startBreeding } from '@core/features/breeding';
import { contractCandidates, contractLevel, deliverContract } from '@core/features/contracts';
import { deepSequencingBlocker, deepSequencingCost, startDeepSequencing } from '@core/features/deepSequencing';
import { campSlots, campsUsed, missionAvailable, startMission } from '@core/features/expedition';
import { sequencerSlots, sequencerUsed, sequencingCost, startSequencing, isBeingSequenced } from '@core/features/sequencing';
import { consumeBlocker } from '@core/features/stable';
import { claimDaily, dailyAvailable } from '@core/features/daily';
import { grandAvailable, grandCost, grandLevel, grandSlots, runningGrandResearch, startGrandResearch } from '@core/features/grandResearch';
import { pendingDecision, resolveVoyage, runningVoyage, startVoyage } from '@core/features/voyage';
import type { Game } from '@core/game';
import type { Creature } from '@core/state';
import { playBot } from './bot';

/**
 * Long-term player for balancing: uses the slow systems (Gen-Aufträge,
 * Tagesreisen, Wochenexpedition, Brutrituale, Tiefensequenzierung) the way
 * a reasonable idle player would. Called once per simulated second by the
 * bot while a session is running.
 */
export function useLongTermSystems(g: Game): void {
  const free = (c: Creature) => c.job === null || c.job.kind === 'building';
  const fastest = () => g.state.creatures.filter(free).sort((a, b) => (effectiveStats(g, b).spd ?? 0) - (effectiveStats(g, a).spd ?? 0));

  // Großforschung: the cheapest open project whenever the slot is free.
  if (g.state.features.grandResearch && runningGrandResearch(g).length < grandSlots(g)) {
    const open = g.content.grandResearch.list
      .filter((d) => grandAvailable(g, d) && grandLevel(g, d.id) < d.maxLevel && canAfford(g.state, grandCost(g, d)))
      .sort((a, b) => a.hours - b.hours);
    if (open[0]) startGrandResearch(g, open[0].id);
  }

  // Tagesbelohnung: claimed at the first check-in of the day.
  if (dailyAvailable(g)) claimDaily(g);

  // Gen-Aufträge: hand over the weakest fitting creature (pulled from its job).
  for (const [slot, offer] of g.state.contracts.offers.entries()) {
    if (offer.done) continue;
    const ready = contractCandidates(g, offer).ready.filter((c) => free(c) && !c.locked).sort((a, b) => creaturePower(g, a) - creaturePower(g, b));
    const pick = ready[0];
    if (!pick || g.state.creatures.length <= 3) continue;
    if (pick.job) assignJob(g, pick.id, null);
    if (!consumeBlocker(g, pick)) deliverContract(g, slot, pick.id);
  }

  // Sequencing keeps the gene library growing and lets contracts see genes; deep sequencing afterwards.
  if (g.state.features.sequencing && sequencerUsed(g) < sequencerSlots(g)) {
    const raw = g.state.creatures.filter((c) => !c.sequenced && !isBeingSequenced(g, c.id)).sort((a, b) => creaturePower(g, b) - creaturePower(g, a))[0];
    if (raw && canAfford(g.state, sequencingCost(g, raw))) startSequencing(g, raw.id);
    else if (g.state.features.deepSequencing && canAfford(g.state, deepSequencingCost(g))) {
      const deep = g.state.creatures.filter((c) => !deepSequencingBlocker(g, c)).sort((a, b) => creaturePower(g, b) - creaturePower(g, a))[0];
      if (deep) startDeepSequencing(g, deep.id);
    }
  }

  // Wochenexpedition: decide (always the first option – usually the creature), then send the next team.
  if (pendingDecision(g)) resolveVoyage(g, 0);
  if (g.state.features.voyage && !runningVoyage(g) && campsUsed(g) < campSlots(g) && canAfford(g.state, toCost(g.balance.voyage.cost))) {
    const team = fastest().slice(0, g.balance.voyage.maxTeam);
    if (team.length === g.balance.voyage.maxTeam && g.state.creatures.length > team.length + 3) startVoyage(g, team.map((c) => c.id));
  }

  // Tagesreise: the best one available, when food is plentiful.
  if (g.state.features.expedition && campsUsed(g) < campSlots(g)) {
    const journey = ['cloudridge', 'mistmoor'].find((id) => missionAvailable(g, id) && canAfford(g.state, toCost(g.content.missions.get(id).cost)));
    const c = fastest()[0];
    if (journey && c && g.state.creatures.length > 4) startMission(g, c.id, journey);
  }

  // Brutritual: only with a second nest, so normal breeding keeps going.
  const rituals = availableRituals(g);
  if (rituals.length > 0 && nestSlots(g) >= 2 && eggs(g).length < nestSlots(g) && !eggs(g).some((p) => p.data.ritual)) {
    const pool = g.state.creatures.filter((c) => free(c)).sort((a, b) => creaturePower(g, b) - creaturePower(g, a));
    const ritual = rituals[rituals.length - 1]!;
    const [a, b] = pool;
    if (a && b && canAfford(g.state, eggCost(g, offspringGeneration(a, b), ritual))) startBreeding(g, a.id, b.id, ritual.id);
  }
}

export interface DayReport {
  day: number;
  inheritances: number;
  heritage: number;
  contracts: number;
  contractLevel: number;
  journeys: number;
  voyagesStarted: number;
  voyages: number;
  rituals: number;
  deepSequenced: number;
  latentActive: number;
  creatures: number;
  foodPerSec: number;
  essencePerSec: number;
  /** Share of all income this day that came from the new systems, per resource. */
  share: Record<string, number>;
  /** Features unlocked on this day (in order). */
  unlocked: string[];
}

export interface LongRunOptions {
  days: number;
  /** Check-ins per day and minutes played per check-in. */
  sessions?: number;
  sessionMin?: number;
}

const DAY_MS = 86_400_000;
const NEW_SOURCES = /^(contract:|voyage:|daily$|mission:(mistmoor|cloudridge))/;

/**
 * Plays like an idle player over several days: a few active sessions per
 * day (the bot at full attention), the rest of the day away. Absences go
 * through the real offline path (capped production, timers by the clock).
 */
export function playDays(g: Game, opts: LongRunOptions): DayReport[] {
  const { days, sessions = 3, sessionMin = 20 } = opts;
  const reports: DayReport[] = [];
  const count = { journeys: 0, rituals: 0, voyages: 0 };
  g.bus.on('missionCompleted', (e) => (e.missionId === 'mistmoor' || e.missionId === 'cloudridge') && count.journeys++);
  g.bus.on('processStarted', (e) => {
    if (e.kind === 'voyage') count.voyages++;
    if (e.kind !== 'egg') return;
    const p = g.state.processes.find((x) => x.id === e.processId);
    if (p?.data.ritual) count.rituals++;
  });
  const fromNew: Record<string, number> = {};
  const unlocked: string[] = [];
  g.bus.on('featureUnlocked', (e) => {
    if (!unlockedEver.has(e.feature)) unlocked.push(e.feature);
    unlockedEver.add(e.feature);
  });
  const unlockedEver = new Set(Object.keys(g.state.features));
  g.bus.on('resourceGained', (e) => {
    if (NEW_SOURCES.test(e.source)) fromNew[e.resource] = (fromNew[e.resource] ?? 0) + e.amount.toNumber();
  });

  const gap = (DAY_MS - sessions * sessionMin * 60_000) / sessions;
  for (let day = 1; day <= days; day++) {
    const before: Record<string, number> = {};
    for (const [k, v] of Object.entries(g.state.earnedTotal)) before[k] = v.toNumber();
    for (const k of Object.keys(fromNew)) delete fromNew[k];
    unlocked.length = 0;

    for (let s = 0; s < sessions; s++) {
      playBot(g, sessionMin, { prestigeAt: 2, prestigeGrowth: 0.5, longTerm: true, wallClock: true });
      g.update(g.state.lastTickAt + gap);
    }

    const share: Record<string, number> = {};
    for (const [k, v] of Object.entries(g.state.earnedTotal)) {
      const gained = v.toNumber() - (before[k] ?? 0);
      if (gained > 0 && fromNew[k]) share[k] = Math.round((fromNew[k]! / gained) * 1000) / 1000;
    }
    const rates = g.productionRates();
    reports.push({
      day,
      inheritances: g.state.prestige.inheritance?.count ?? 0,
      heritage: Math.round(g.state.resources.heritage?.toNumber() ?? 0),
      contracts: g.state.contracts.completed,
      contractLevel: contractLevel(g),
      journeys: count.journeys,
      voyagesStarted: count.voyages,
      voyages: g.state.statistics.voyages ?? 0,
      rituals: count.rituals,
      deepSequenced: g.state.statistics['completed.deepSequence'] ?? 0,
      latentActive: g.state.creatures.filter((c) => c.deepSequenced && c.latent).length,
      creatures: g.state.creatures.length,
      foodPerSec: Math.round(rates.food?.toNumber() ?? 0),
      essencePerSec: Math.round((rates.essence?.toNumber() ?? 0) * 10) / 10,
      share,
      unlocked: [...unlocked],
    });
  }
  return reports;
}

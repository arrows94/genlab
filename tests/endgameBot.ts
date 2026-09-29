import { creaturePower } from '@core/creatures';
import { abandonAnomaly, anomalyAvailable, anomalyBest, startAnomalies } from '@core/features/anomalies';
import { depositMegaProject, megaAvailable, megaConstruction, megaRemaining, currentStage } from '@core/features/megaProjects';
import { AEON_CURRENCY, buyResonance, buyTalent, resonanceAvailable, resonanceCost, resonanceLevel, talentAvailable } from '@core/features/talents';
import { buyRelic, elementMultiplier, enemyFor, equipRelic, relicCost, relicLevel, setTeam, setTowerAutoRestart, startRun, stopRun, teamSize } from '@core/features/tower';
import { attackWeeklyBoss } from '@core/features/weeklyBoss';
import { performPrestige, prestigeGain } from '@core/prestige';
import type { Game } from '@core/game';
import type { Creature } from '@core/state';

/**
 * Endgame player for balancing over several Äons: keeps a tower team
 * climbing (with relics), spends boss attacks, feeds the Großprojekt, learns
 * talents and resonance, plays anomaly runs for new records, and starts an
 * Äon once the shard gain is worth it.
 */
export interface EndgameOptions {
  /** Start an Äon once it pays this many shards … */
  aeonAt?: number;
  /** … plus this many more per Äon already done (later Äons wait for more). */
  aeonGrowth?: number;
  /** Share of the owned resources paid into the Großprojekt at each check-in (the rest before an Äon). */
  depositShare?: number;
  /** Play anomaly runs right after an inheritance (default true). */
  anomalies?: boolean;
  /** Give up an anomaly run after this many hours (the plan is not tried again until the next Äon). */
  anomalyTimeoutH?: number;
}

/** What the bot remembers between calls (not part of the save). */
interface BotMemory {
  inheritances: number;
  aeons: number;
  startedAt: number;
  plan: string;
  failed: Set<string>;
}
const memories = new WeakMap<Game, BotMemory>();
function memory(g: Game): BotMemory {
  let m = memories.get(g);
  if (!m) {
    m = { inheritances: g.state.prestige.inheritance?.count ?? 0, aeons: g.state.prestige.aeon?.count ?? 0, startedAt: 0, plan: '', failed: new Set() };
    memories.set(g, m);
  }
  return m;
}

/** Called once at the start of every play session. */
export function endgameCheckIn(g: Game, opts: EndgameOptions = {}): void {
  const { depositShare = 0.3 } = opts;
  feedMegaProjects(g, depositShare);
  buyRelics(g);
  // The tower routine keeps the same team forever: rebuild it from the strongest creatures each visit.
  if (g.state.tower.run) stopRun(g);
  climbTower(g);
  // Weekly boss: all attacks of the day (the team must not be climbing).
  if (g.state.features.weeklyBoss && g.state.tower.team.length > 0) {
    for (let i = 0; i < 10 && g.state.weeklyBoss.attempts > 0; i++) if (!attackWeeklyBoss(g).ok) break;
  }
}

/** Called every few simulated seconds while a session runs. */
export function useEndgameSystems(g: Game, opts: EndgameOptions = {}): void {
  const { aeonAt = 3, aeonGrowth = 2, anomalies = true, anomalyTimeoutH = 12 } = opts;
  climbTower(g);
  spendShards(g);
  if (anomalies) playAnomalies(g, anomalyTimeoutH);

  if (g.state.features.aeon && !g.state.anomaly) {
    const done = g.state.prestige.aeon?.count ?? 0;
    const gain = prestigeGain(g, 'aeon').toNumber();
    if (gain >= aeonAt + aeonGrowth * done) {
      // Everything that the Äon would take is better spent on the Großprojekt.
      feedMegaProjects(g, 1);
      performPrestige(g, 'aeon');
      spendShards(g);
    }
  }
}

/**
 * How much a creature is worth against the next boss above the record (the
 * run starts at the checkpoint below it), like a player sorting by „Vorteil vs.“:
 * the element matchup, and an Element-Schild lets only advantaged hits through.
 */
function bossMatchup(g: Game): (c: Creature) => number {
  const every = g.balance.tower.bossEvery;
  const boss = enemyFor(g, (Math.floor(g.state.tower.best / every) + 1) * every);
  const trait = boss.trait && g.content.bossTraits.has(boss.trait) ? g.content.bossTraits.get(boss.trait) : null;
  if (trait?.kind === 'shift') return () => 1;
  return (c) => {
    const m = elementMultiplier(g, g.content.species.get(c.speciesId).element, boss.element);
    return trait?.kind === 'shield' && m <= 1 ? m * trait.value : m;
  };
}

/** Strongest free creatures against the next boss as tower team; a new run whenever none is going. */
function climbTower(g: Game): void {
  if (!g.state.features.tower || g.state.tower.run) return;
  if (g.state.features.towerAuto && !g.state.tower.autoRestart) setTowerAutoRestart(g, true);
  const size = teamSize(g);
  const matchup = bossMatchup(g);
  const score = new Map(g.state.creatures.map((c) => [c.id, creaturePower(g, c) * matchup(c)]));
  const free = g.state.creatures
    .filter((c) => c.job === null || c.job.kind === 'building' || c.job.kind === 'tower')
    .sort((a, b) => score.get(b.id)! - score.get(a.id)!)
    .slice(0, size);
  if (free.length === 0) return;
  // Keep production going while the stable is small.
  if (g.state.creatures.length < size + 4) return;
  setTeam(g, free.map((c) => c.id));
  // Best relics to the strongest creatures (the team is sorted by power).
  const owned = g.content.relics.list.filter((r) => relicLevel(g, r.id) > 0).sort((a, b) => relicLevel(g, b.id) - relicLevel(g, a.id));
  for (let i = 0; i < size; i++) equipRelic(g, i, owned[i]?.id ?? null);
  startRun(g);
}

/**
 * Turm-Marken the observatory still needs for its current stage stay put;
 * the rest buys relic levels, cheapest first.
 */
function buyRelics(g: Game): void {
  if (!g.state.features.tower) return;
  let reserve = 0;
  for (const def of g.content.megaProjects.list) if (megaAvailable(g, def)) reserve += megaRemaining(g, def)['towerTokens']?.toNumber() ?? 0;
  for (let i = 0; i < 30; i++) {
    const spare = (g.state.resources['towerTokens']?.toNumber() ?? 0) - reserve;
    const next = g.content.relics.list
      .map((r) => ({ id: r.id, cost: relicCost(g, r.id)?.toNumber() ?? Infinity }))
      .filter((x) => x.cost <= spare)
      .sort((a, b) => a.cost - b.cost)[0];
    if (!next || !buyRelic(g, next.id).ok) break;
  }
}

/**
 * Anomaly runs right after an inheritance (the reset then costs little):
 * every anomaly already mastered at its best stage, plus one of them a stage
 * higher – so each success raises the record by one. A run that takes too
 * long is given up, and that plan waits until the next Äon.
 */
function playAnomalies(g: Game, timeoutH: number): void {
  if (!g.state.features.anomalies) return;
  const m = memory(g);
  const aeons = g.state.prestige.aeon?.count ?? 0;
  if (aeons !== m.aeons) {
    m.aeons = aeons;
    m.failed.clear();
  }
  if (g.state.anomaly) {
    if (g.state.lastTickAt - m.startedAt > timeoutH * 3_600_000) {
      abandonAnomaly(g);
      m.failed.add(m.plan);
    }
    return;
  }
  const count = g.state.prestige.inheritance?.count ?? 0;
  if (count === m.inheritances) return;
  m.inheritances = count;
  const plan = anomalyPlan(g, m.failed);
  if (plan && startAnomalies(g, plan).ok) {
    m.startedAt = g.state.lastTickAt;
    m.plan = planKey(plan);
  }
}

function anomalyPlan(g: Game, failed: Set<string>): Record<string, number> | null {
  const list = g.content.anomalies.list.filter((a) => anomalyAvailable(g, a.id));
  const base: Record<string, number> = {};
  for (const a of list) if (anomalyBest(g, a.id) > 0) base[a.id] = anomalyBest(g, a.id);
  const up = list.filter((a) => anomalyBest(g, a.id) < g.balance.anomalies.maxLevel).sort((a, b) => anomalyBest(g, a.id) - anomalyBest(g, b.id));
  for (const a of up) {
    const plan = { ...base, [a.id]: anomalyBest(g, a.id) + 1 };
    if (!failed.has(planKey(plan))) return plan;
  }
  return null;
}

const planKey = (plan: Record<string, number>) => Object.entries(plan).sort(([a], [b]) => a.localeCompare(b)).map(([id, l]) => `${id}${l}`).join(' ');

/** Cheapest learnable talent first, then the cheapest resonance. */
function spendShards(g: Game): void {
  if (!g.state.features.aeon) return;
  for (let i = 0; i < 20; i++) {
    const shards = g.state.resources[AEON_CURRENCY]?.toNumber() ?? 0;
    const talent = g.content.talents.list
      .filter((t) => !g.state.talents[t.id] && talentAvailable(g, t.id) && t.cost <= shards)
      .sort((a, b) => a.cost - b.cost)[0];
    if (talent) {
      if (!buyTalent(g, talent.id).ok) break;
      continue;
    }
    const res = g.content.resonances.list
      .filter((r) => resonanceAvailable(g, r))
      .map((r) => ({ r, cost: resonanceCost(r, resonanceLevel(g, r.id)) }))
      .filter((x) => x.cost <= shards)
      .sort((a, b) => a.cost - b.cost)[0];
    if (!res || !buyResonance(g, res.r.id).ok) break;
  }
}

function feedMegaProjects(g: Game, share: number): void {
  for (const def of g.content.megaProjects.list) {
    if (megaAvailable(g, def) && currentStage(g, def) && !megaConstruction(g, def.id)) depositMegaProject(g, def.id, share);
  }
}

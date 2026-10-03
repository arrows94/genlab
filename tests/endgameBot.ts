import { buyUpgrade } from '@core/actions';
import { effectiveStats } from '@core/creatures';
import { abandonAnomaly, anomalyAvailable, anomalyBest, startAnomalies } from '@core/features/anomalies';
import { depositMegaProject, megaAvailable, megaConstruction, megaRemaining, currentStage } from '@core/features/megaProjects';
import { AEON_CURRENCY, buyResonance, buyTalent, resonanceAvailable, resonanceCost, resonanceLevel, talentAvailable } from '@core/features/talents';
import { buyRelic, elementMultiplier, enemyFor, equipDarkRelic, equipRelic, relicCost, relicLevel, roleOf, setRow, setTeam, setTowerAutoRestart, startRun, stopRun, teamSize } from '@core/features/tower';
import { buyOffer, offerPrice, towerOffers } from '@core/features/quartermaster';
import { cellarCheckpoint, cellarEnemies, cellarFit, setCellarAuto, setCellarRow, setCellarTeam } from '@core/features/cellar';
import { attackWeeklyBoss, bossAttempts } from '@core/features/weeklyBoss';
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
  /** Use the Genom-Keller once it is open (default true). */
  cellar?: boolean;
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
  ensureTowerRoutine(g);
  buyOffers(g);
  buyRelics(g);
  if (opts.cellar !== false) buyDarkRelics(g);
  // The tower routine keeps the same team forever: rebuild it from the strongest creatures each visit.
  // The tower comes first: a cellar team that is not down there gives its members back.
  if (g.state.tower.run) stopRun(g);
  if (!g.state.cellar.run) setCellarTeam(g, []);
  climbTower(g);
  if (opts.cellar !== false) descendCellar(g);
  // Weekly boss: attacks are saved for the strongest team (right before a reset, see spendBossAttacks);
  // only what the next daily refill would push over the limit is used now.
  if (g.state.features.weeklyBoss && g.state.tower.team.length > 0) {
    const { perDay, max } = bossAttempts(g);
    for (let i = 0; i < 10 && g.state.weeklyBoss.attempts > max - perDay; i++) if (!attackWeeklyBoss(g).ok) break;
  }
}

/**
 * All saved weekly-boss attacks, with a freshly picked team – called right
 * before an inheritance or an Äon, when the stable is at its strongest (the
 * titan stays the same all week, the stable starts over after a reset).
 */
export function spendBossAttacks(g: Game): void {
  if (!g.state.features.weeklyBoss || g.state.weeklyBoss.attempts < 1) return;
  if (g.state.tower.run) stopRun(g);
  climbTower(g);
  if (g.state.tower.team.length === 0) return;
  for (let i = 0; i < 10 && g.state.weeklyBoss.attempts > 0; i++) if (!attackWeeklyBoss(g).ok) break;
}

/** Called every few simulated seconds while a session runs. */
export function useEndgameSystems(g: Game, opts: EndgameOptions = {}): void {
  const { aeonAt = 3, aeonGrowth = 2, anomalies = true, anomalyTimeoutH = 12 } = opts;
  ensureTowerRoutine(g);
  climbTower(g);
  if (opts.cellar !== false) descendCellar(g);
  spendShards(g);
  if (anomalies) playAnomalies(g, anomalyTimeoutH);

  if (g.state.features.aeon && !g.state.anomaly) {
    const done = g.state.prestige.aeon?.count ?? 0;
    const gain = prestigeGain(g, 'aeon').toNumber();
    if (gain >= aeonAt + aeonGrowth * done) {
      // Everything that the Äon would take is better spent on the Großprojekt.
      feedMegaProjects(g, 1);
      spendBossAttacks(g);
      performPrestige(g, 'aeon');
      spendShards(g);
    }
  }
}

/**
 * How much a creature is worth against the next boss above the record (the
 * run starts at the checkpoint below it), like a player sorting by „Vorteil vs.“:
 * staying power (KP, VER against the foe's ATK) times damage (ANG, TMP against
 * the foe's TMP – actions come with (TMP ratio)^0.8), times the element matchup;
 * an Element-Schild lets only advantaged hits through. When the last runs ended
 * on the same floor, the bot builds its team for that floor instead – like a
 * player who looks at what stops them.
 */
function fightValue(g: Game): (c: Creature) => number {
  const every = g.balance.tower.bossEvery;
  const h = g.state.tower.history;
  const stuck = h.length >= 2 && h[0]!.floor === h[1]!.floor ? h[0]!.floor + 1 : null;
  const foe = enemyFor(g, stuck ?? (Math.floor(g.state.tower.best / every) + 1) * every);
  const trait = foe.trait && g.content.bossTraits.has(foe.trait) ? g.content.bossTraits.get(foe.trait) : null;
  return (c) => {
    const s = effectiveStats(g, c);
    const worth = (s.hp ?? 0) * (1 + (s.def ?? 0) / Math.max(1, foe.atk)) * (s.atk ?? 0) * Math.pow(Math.max(1, s.spd ?? 0) / Math.max(1, foe.spd), 0.8);
    if (trait?.kind === 'shift') return worth;
    const m = elementMultiplier(g, g.content.species.get(c.speciesId).element, foe.element);
    return worth * (trait?.kind === 'shield' && m <= 1 ? m * trait.value : m);
  };
}

/** Strongest free creatures against the next boss (or the floor it is stuck on) as tower team; a new run whenever none is going. */
function climbTower(g: Game): void {
  if (!g.state.features.tower || g.state.tower.run) return;
  if (g.state.features.towerAuto && !g.state.tower.autoRestart) setTowerAutoRestart(g, true);
  const size = teamSize(g);
  const value = fightValue(g);
  const score = new Map(g.state.creatures.map((c) => [c.id, value(c)]));
  const free = g.state.creatures
    .filter((c) => c.job === null || c.job.kind === 'building' || c.job.kind === 'tower')
    .filter((c) => !g.state.cellar.team.includes(c.id))
    .sort((a, b) => score.get(b.id)! - score.get(a.id)!)
    .slice(0, size);
  if (free.length === 0) return;
  // Keep production going while the stable is small.
  if (g.state.creatures.length < size + 4) return;
  setTeam(g, free.map((c) => c.id));
  // Rows like a player would: real tanks in front, the rest behind. Without tanks everyone stays in front –
  // that spreads the hits most evenly.
  const tanks = new Set(free.filter((c) => roleOf(g, effectiveStats(g, c)) === 'tank').map((c) => c.id));
  const useRows = tanks.size > 0 && tanks.size < free.length;
  for (const c of free) setRow(g, c.id, useRows && !tanks.has(c.id) ? 'back' : 'front');
  // Best relics to the strongest creatures (the team is sorted by fight value).
  const owned = g.content.relics.list.filter((r) => relicLevel(g, r.id) > 0).sort((a, b) => relicLevel(g, b.id) - relicLevel(g, a.id));
  for (let i = 0; i < size; i++) equipRelic(g, i, owned[i]?.id ?? null);
  startRun(g);
}

/**
 * The Turm-Routine (auto-restart) first – an Äon resets research, and without it the tower only
 * fights while someone watches. A player buys it back right away.
 */
function ensureTowerRoutine(g: Game): void {
  if (g.state.features.tower && !g.state.features.towerAuto) buyUpgrade(g, 'towerRoutine');
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

/** Quartiermeister: whatever costs at most a quarter of the Turm-Marken on hand, cheapest first (the rest goes to relics). */
function buyOffers(g: Game): void {
  if (!g.state.features.quartermaster) return;
  for (let i = 0; i < 60; i++) {
    const tokens = g.state.resources['towerTokens']?.toNumber() ?? 0;
    const next = towerOffers(g)
      .map((o) => ({ id: o.id, price: offerPrice(g, o.id).toNumber() }))
      .filter((x) => x.price <= tokens / 4)
      .sort((a, b) => a.price - b.price)
      .find((x) => buyOffer(g, x.id).ok);
    if (!next) break;
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

/**
 * Genom-Keller like an idle player: auto-descent on, and whenever no descent
 * runs a team from what the tower left – strength against the next level's
 * foes, ×1.3 for every rule that helps and ×0.7 for every rule that hurts
 * there; the dark relics go to the strongest places.
 */
function descendCellar(g: Game): void {
  if (!g.state.features.cellar || g.state.cellar.run) return;
  // The tower first: until its team is full (after a reset) the cellar waits, so it never holds the best creatures.
  if (g.state.tower.team.length < teamSize(g)) return;
  if (!g.state.cellar.auto) setCellarAuto(g, true);
  const next = cellarCheckpoint(g) + 1;
  const foe = cellarEnemies(g, next).find((f) => f.boss) ?? cellarEnemies(g, next)[0]!;
  const tower = new Set(g.state.tower.team);
  const free = g.state.creatures.filter((c) => (c.job === null || c.job.kind === 'building') && !tower.has(c.id));
  const value = (c: Creature) => {
    const s = effectiveStats(g, c);
    const worth = (s.hp ?? 0) * (1 + (s.def ?? 0) / Math.max(1, foe.atk)) * (s.atk ?? 0) * Math.pow(Math.max(1, s.spd ?? 0) / Math.max(1, foe.spd), 0.8);
    const fit = cellarFit(g, c, next);
    return worth * elementMultiplier(g, g.content.species.get(c.speciesId).element, foe.element) * Math.pow(1.3, fit.good.length) * Math.pow(0.7, fit.bad.length);
  };
  const size = teamSize(g);
  if (free.length < size) return;
  const team = free.sort((a, b) => value(b) - value(a)).slice(0, size);
  if (!setCellarTeam(g, team.map((c) => c.id)).ok) return;
  // The sturdiest one in front, the rest behind (the cellar is long: spread the hits).
  const tanks = new Set(team.filter((c) => roleOf(g, effectiveStats(g, c)) === 'tank').map((c) => c.id));
  for (const c of team) setCellarRow(g, c.id, tanks.size > 0 && !tanks.has(c.id) ? 'back' : 'front');
  const owned = g.content.darkRelics.list.filter((r) => relicLevel(g, r.id) > 0).sort((a, b) => relicLevel(g, b.id) - relicLevel(g, a.id));
  for (let i = 0; i < size; i++) equipDarkRelic(g, 'cellar', i, owned[i]?.id ?? null);
}

/** Schattenmarken buy the cheapest dark relic level; the same relics also go into the tower's dark places. */
function buyDarkRelics(g: Game): void {
  if (!g.state.features.cellar) return;
  for (let i = 0; i < 30; i++) {
    const marks = g.state.resources['shadowMarks']?.toNumber() ?? 0;
    const next = g.content.darkRelics.list
      .map((r) => ({ id: r.id, cost: relicCost(g, r.id)?.toNumber() ?? Infinity }))
      .filter((x) => x.cost <= marks)
      .sort((a, b) => a.cost - b.cost)[0];
    if (!next || !buyRelic(g, next.id).ok) break;
  }
  if (g.state.tower.run) return;
  const owned = g.content.darkRelics.list.filter((r) => relicLevel(g, r.id) > 0).sort((a, b) => relicLevel(g, b.id) - relicLevel(g, a.id));
  for (let i = 0; i < teamSize(g); i++) equipDarkRelic(g, 'tower', i, owned[i]?.id ?? null);
}

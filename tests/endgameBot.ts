import { creaturePower } from '@core/creatures';
import { depositMegaProject, megaAvailable, megaConstruction, currentStage } from '@core/features/megaProjects';
import { AEON_CURRENCY, buyResonance, buyTalent, resonanceAvailable, resonanceCost, resonanceLevel, talentAvailable } from '@core/features/talents';
import { setTeam, setTowerAutoRestart, startRun, stopRun, teamSize } from '@core/features/tower';
import { attackWeeklyBoss } from '@core/features/weeklyBoss';
import { performPrestige, prestigeGain } from '@core/prestige';
import type { Game } from '@core/game';

/**
 * Endgame player for balancing over several Äons: keeps a tower team
 * climbing, spends boss attacks, feeds the Großprojekt, learns talents and
 * resonance, and starts an Äon once the shard gain is worth it.
 */
export interface EndgameOptions {
  /** Start an Äon once it pays this many shards … */
  aeonAt?: number;
  /** … plus this many more per Äon already done (later Äons wait for more). */
  aeonGrowth?: number;
  /** Share of the owned resources paid into the Großprojekt at each check-in (the rest before an Äon). */
  depositShare?: number;
}

/** Called once at the start of every play session. */
export function endgameCheckIn(g: Game, opts: EndgameOptions = {}): void {
  const { depositShare = 0.3 } = opts;
  feedMegaProjects(g, depositShare);
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
  const { aeonAt = 3, aeonGrowth = 2 } = opts;
  climbTower(g);
  spendShards(g);

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

/** Strongest free creatures as tower team; a new run whenever none is going. */
function climbTower(g: Game): void {
  if (!g.state.features.tower || g.state.tower.run) return;
  if (g.state.features.towerAuto && !g.state.tower.autoRestart) setTowerAutoRestart(g, true);
  const size = teamSize(g);
  const free = g.state.creatures
    .filter((c) => c.job === null || c.job.kind === 'building' || c.job.kind === 'tower')
    .sort((a, b) => creaturePower(g, b) - creaturePower(g, a))
    .slice(0, size);
  if (free.length === 0) return;
  // Keep production going while the stable is small.
  if (g.state.creatures.length < size + 4) return;
  setTeam(g, free.map((c) => c.id));
  startRun(g);
}

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

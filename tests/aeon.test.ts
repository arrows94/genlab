import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { createCreature } from '@core/creatures';
import { unlockFeature } from '@core/systems/unlocks';
import { playBot } from './bot';
import { makeGame } from './helpers';
import { playDays, type DayReport } from './longrun';

// GENLAB_AEON=1 plays several weeks with the endgame bot (tower, Äon, talents, Großprojekt) – takes many minutes.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

const print = (reports: DayReport[]) => {
  for (const d of reports) {
    console.log(
      `Tag ${String(d.day).padStart(2)}  Vererbungen ${String(d.inheritances).padStart(3)}  Erbgut ${String(d.heritage).padStart(6)}  Turm ${String(d.towerBest).padStart(3)}` +
        `  Boss ${Math.round(d.bossShare * 100)} %  Äonen ${d.aeons}  Splitter ${d.shards}  Talente ${d.talents}  Resonanz ${d.resonance}  Observatorium ${d.observatory}/4` +
        `${d.unlocked.length ? `  neu: ${d.unlocked.join(', ')}` : ''}`,
    );
  }
};

/** A game just before its first Äon: three inheritances, tower floor 20, a strong stable. */
function lateGame() {
  const g = makeGame(77);
  for (const f of ['farm', 'research', 'breeding', 'mine', 'expedition', 'biolab', 'sequencing', 'market', 'inheritance', 'tower', 'weekly', 'infiniteResearch', 'grandResearch']) unlockFeature(g, f);
  g.state.prestige.inheritance = { count: 3 };
  g.state.tower.best = 20;
  g.state.resources.heritage = D(900);
  for (const [r, v] of Object.entries({ food: 1e9, gold: 2e9, essence: 3e8, catalyst: 150, fragments: 2000, towerTokens: 400 })) g.state.resources[r] = D(v);
  const species = ['emberpup', 'bubbloon', 'pebblit', 'zephyrix', 'voltmouse', 'sproutle', 'frostling', 'umbrat', 'lumifly', 'ferrox'];
  for (const s of species) createCreature(g, { speciesId: s, rarity: 'epic', source: 'other' });
  g.invalidate();
  return g;
}

describe('endgame bot', () => {
  it('climbs the tower, feeds the observatory, starts an Äon and spends the shards', () => {
    const g = lateGame();
    let aeons = 0;
    g.bus.on('prestige', (e) => e.layer === 'aeon' && aeons++);
    playBot(g, 5, { endgame: { aeonAt: 3 }, wallClock: true });

    expect(g.state.features.aeon).toBe(true);
    expect(aeons).toBe(1);
    // sqrt(900 / 50) = 4 shards, all spent on tier-1 talents (1 + 1 + 2).
    expect(Object.keys(g.state.talents).length).toBeGreaterThanOrEqual(3);
    // Resources that the Äon would have taken went into the Fundament instead.
    const paid = g.state.megaProjects.observatory?.paid ?? {};
    expect(Object.keys(paid).length > 0 || (g.state.megaProjects.observatory?.stage ?? 0) > 0 || g.state.processes.some((p) => p.kind === 'megaProject')).toBe(true);
    // A tower run is going (it keeps going through the Äon, the record stays).
    expect(g.state.tower.best).toBeGreaterThanOrEqual(20);
  }, 60_000);

  it.skipIf(!env.GENLAB_AEON)('several weeks: Äons, talents and the observatory keep coming', () => {
    const g = makeGame(2024);
    const reports = playDays(g, { days: Number(env.GENLAB_AEON_DAYS ?? 28), endgame: true });
    print(reports);
    const last = reports.at(-1)!;
    expect(last.aeons).toBeGreaterThanOrEqual(1);
    expect(last.talents).toBeGreaterThan(0);
    expect(last.observatory).toBeGreaterThanOrEqual(1);
  }, 3 * 3_600_000);
});

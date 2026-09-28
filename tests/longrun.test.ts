import { describe, expect, it } from 'vitest';
import { runningVoyage } from '@core/features/voyage';
import { makeGame } from './helpers';
import { playDays, type DayReport } from './longrun';

// GENLAB_TIMELINE=1 prints the day table; GENLAB_LONGRUN=1 also plays two weeks (several minutes).
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const print = (reports: DayReport[]) => {
  if (!env.GENLAB_TIMELINE && !env.GENLAB_LONGRUN) return;
  for (const d of reports) {
    console.log(
      `Tag ${String(d.day).padStart(2)}  Vererbungen ${String(d.inheritances).padStart(3)}  Aufträge ${String(d.contracts).padStart(3)} (Stufe ${d.contractLevel})` +
        `  Tagesreisen ${d.journeys}  Wochenexp. ${d.voyages}/${d.voyagesStarted}  Rituale ${d.rituals}  Tiefenseq. ${d.deepSequenced}` +
        `  Anteil neuer Systeme ${JSON.stringify(d.share)}${d.unlocked.length ? `  neu: ${d.unlocked.join(', ')}` : ''}`,
    );
  }
};

/** Main income stays with production; the new systems add to it. */
const MAX_SHARE = 0.25;

/**
 * Idle player over several days (3 check-ins of 20 min per day): the long
 * systems must unlock, be used, and not take over the economy.
 */
describe('multi-day pacing (bot)', () => {
  it('uses the long-term systems over three days', () => {
    const g = makeGame(2024);
    const reports = playDays(g, { days: 3 });
    print(reports);
    const last = reports.at(-1)!;

    // Gen-Aufträge are running by day 3.
    expect(last.contracts).toBeGreaterThanOrEqual(3);
    // The voyage starts after the second inheritance and keeps going through later ones.
    expect(last.voyagesStarted).toBeGreaterThanOrEqual(1);
    expect(last.inheritances).toBeGreaterThan(reports[0]!.inheritances);
    expect(!!runningVoyage(g) || g.state.voyage.pending !== null || last.voyages > 0).toBe(true);
    // Contracts and journeys add income, but production stays the main source.
    for (const d of reports) for (const res of ['food', 'gold', 'essence']) expect(d.share[res] ?? 0, `Tag ${d.day} ${res}`).toBeLessThanOrEqual(MAX_SHARE);
  }, 180_000);

  it.skipIf(!env.GENLAB_LONGRUN)('two weeks: contract levels and voyages keep coming', () => {
    const g = makeGame(2024);
    const reports = playDays(g, { days: 14 });
    print(reports);
    const last = reports.at(-1)!;
    expect(last.contractLevel).toBeGreaterThanOrEqual(3);
    expect(last.voyages).toBeGreaterThanOrEqual(1);
    for (const d of reports) for (const res of ['food', 'gold', 'essence']) expect(d.share[res] ?? 0).toBeLessThanOrEqual(MAX_SHARE);
  }, 3_600_000);
});

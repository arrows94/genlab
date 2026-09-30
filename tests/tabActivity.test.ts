import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { eggs, startBreeding } from '@core/features/breeding';
import { setTeam, startRun } from '@core/features/tower';
import { unlockFeature } from '@core/systems/unlocks';
import { tabActivity } from '@core/tabActivity';
import { makeGame } from './helpers';

describe('Tab-Aktivität', () => {
  it('shows the egg that hatches next, and nothing for a ritual egg waiting to be opened', () => {
    const g = makeGame(5);
    for (const f of ['breeding', 'hybrids']) unlockFeature(g, f);
    g.state.prestige.inheritance = { count: 2 };
    unlockFeature(g, 'specialBreeding');
    for (const res of ['food', 'gold', 'essence', 'catalyst']) g.state.resources[res] = D(1e9);
    expect(tabActivity(g).breeding).toBeUndefined();

    const [a, b] = g.state.creatures;
    expect(startBreeding(g, a!.id, b!.id, 'noble').ok).toBe(true);
    expect(startBreeding(g, a!.id, b!.id).ok).toBe(true);
    const normal = eggs(g).find((p) => !p.data.ritual)!;
    normal.elapsedMs = normal.durationMs / 2;
    const act = tabActivity(g).breeding!;
    expect(act.count).toBe(2);
    expect(act.progress).toBeCloseTo(0.5);
    expect(act.loop).toBe(false);

    // Ritual egg done: it waits for the player – news (badge), not work.
    const ritual = eggs(g).find((p) => p.data.ritual)!;
    ritual.elapsedMs = ritual.durationMs;
    g.advance(normal.durationMs);
    expect(tabActivity(g).breeding).toBeUndefined();
  });

  it('marks a running tower run as endless work', () => {
    const g = makeGame(5);
    for (const f of ['farm', 'breeding', 'tower']) unlockFeature(g, f);
    setTeam(g, g.state.creatures.slice(0, 1).map((c) => c.id));
    expect(tabActivity(g).tower).toBeUndefined();
    expect(startRun(g).ok).toBe(true);
    expect(tabActivity(g).tower).toMatchObject({ loop: true, count: 1 });
  });
});

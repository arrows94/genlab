import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { activeLatent, createCreature, effectiveStats, findCreature, inheritLatent, rollLatent } from '@core/creatures';
import { deepSequencingBlocker, deepSequencingTimeMs, startDeepSequencing } from '@core/features/deepSequencing';
import { revealGenome, sequencerSlots, startSequencing } from '@core/features/sequencing';
import { consumeBlocker } from '@core/features/stable';
import { deserialize, serialize } from '@core/save';
import { unlockFeature } from '@core/systems/unlocks';
import { Game } from '@core/game';
import { NOW, balance, content, makeGame } from './helpers';

const H = 3_600_000;

function deepGame(seed = 8) {
  const g = makeGame(seed);
  unlockFeature(g, 'sequencing');
  g.state.prestige.inheritance = { count: 1 };
  unlockFeature(g, 'deepSequencing');
  g.state.resources.essence = D(1e6);
  return g;
}

function sequenced(g: ReturnType<typeof makeGame>, latent: string | null) {
  const c = createCreature(g, { speciesId: 'emberpup', source: 'other', latent });
  revealGenome(g, c);
  return c;
}

describe('Erbanlagen', () => {
  it('about a third of new creatures carry one, stable per save and creature', () => {
    const g = makeGame();
    let carriers = 0;
    for (let id = 1; id <= 2000; id++) {
      const t = rollLatent(g, id);
      expect(rollLatent(g, id)).toBe(t);
      if (t) {
        carriers++;
        expect(content.latentTraits.has(t)).toBe(true);
      }
    }
    expect(carriers / 2000).toBeGreaterThan(balance.deepSequencing.latentChance - 0.05);
    expect(carriers / 2000).toBeLessThan(balance.deepSequencing.latentChance + 0.05);
  });

  it('are inherited even while hidden', () => {
    const g = makeGame();
    const a = createCreature(g, { speciesId: 'emberpup', source: 'other', latent: 'titanBlood' });
    const b = createCreature(g, { speciesId: 'emberpup', source: 'other', latent: null });
    let inherited = 0;
    for (let id = 1000; id < 3000; id++) if (inheritLatent(g, a, b, id) === 'titanBlood') inherited++;
    // One carrier parent: roughly `latentInherit`, plus the rare new roll of the same trait.
    expect(inherited / 2000).toBeGreaterThan(balance.deepSequencing.latentInherit - 0.06);
    expect(inherited / 2000).toBeLessThan(balance.deepSequencing.latentInherit + 0.06);
  });

  it('only take effect once revealed', () => {
    const g = deepGame();
    const c = sequenced(g, 'titanBlood');
    const hp = effectiveStats(g, c).hp!;
    expect(activeLatent(g, c)).toBeNull();
    c.deepSequenced = true;
    g.invalidate();
    expect(activeLatent(g, c)?.id).toBe('titanBlood');
    expect(effectiveStats(g, c).hp).toBeGreaterThan(hp);
  });
});

describe('Tiefensequenzierung', () => {
  it('needs the first inheritance and a sequenced creature', () => {
    const early = makeGame();
    unlockFeature(early, 'sequencing');
    early.state.resources.essence = D(1e6);
    const c = createCreature(early, { speciesId: 'emberpup', source: 'other' });
    revealGenome(early, c);
    expect(startDeepSequencing(early, c.id).ok).toBe(false);

    const g = deepGame();
    const raw = createCreature(g, { speciesId: 'emberpup', source: 'other' });
    expect(deepSequencingBlocker(g, raw)).toContain('normal sequenzieren');
    expect(startDeepSequencing(g, raw.id).ok).toBe(false);
  });

  it('takes eight hours in a sequencer slot and reveals the Erbanlage', () => {
    const g = deepGame();
    const c = sequenced(g, 'goldNose');
    const other = createCreature(g, { speciesId: 'emberpup', source: 'other' });
    expect(startDeepSequencing(g, c.id).ok).toBe(true);
    expect(g.state.processes[0]!.durationMs).toBe(8 * H);
    expect(deepSequencingTimeMs(g)).toBe(balance.deepSequencing.hours * H);
    // Shares the sequencer slots and protects the creature from being sold.
    expect(sequencerSlots(g)).toBe(1);
    expect(startSequencing(g, other.id).ok).toBe(false);
    expect(consumeBlocker(g, c)).not.toBeNull();
    expect(startDeepSequencing(g, c.id).ok).toBe(false);

    const events: unknown[] = [];
    g.bus.on('deepSequenced', (e) => events.push(e));
    const report = g.simulateOffline(20 * H);
    expect(report.completed.deepSequence).toBe(1);
    expect(c.deepSequenced).toBe(true);
    expect(activeLatent(g, c)?.id).toBe('goldNose');
    expect(events).toEqual([{ creatureId: c.id, latent: 'goldNose', awakened: false }]);
    expect(deepSequencingBlocker(g, c)).toContain('Bereits');
  });

  it('may awaken a sleeping Urgen allele with the talent', () => {
    let awakened = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const g = deepGame(seed);
      g.state.talents.ancientGenes = true;
      const c = sequenced(g, null);
      c.genome.primal = ['u', 'u'];
      expect(startDeepSequencing(g, c.id).ok).toBe(true);
      const p = g.state.processes[0]!;
      p.elapsedMs = p.durationMs - 10;
      g.advance(200);
      expect(c.deepSequenced).toBe(true);
      if (c.genome.primal.includes('U')) awakened++;
    }
    expect(awakened).toBeGreaterThan(0);
    expect(awakened).toBeLessThan(40);
  });

  it('old saves roll their Erbanlagen once and keep them', () => {
    const g = makeGame();
    const json = JSON.parse(serialize(g.state, NOW));
    json.saveVersion = 5;
    for (const c of json.state.creatures) {
      delete c.latent;
      delete c.deepSequenced;
    }
    const { state } = deserialize(JSON.stringify(json));
    const loaded = new Game({ content, balance, state });
    const c = findCreature(loaded, state.creatures[0]!.id)!;
    expect(c.deepSequenced).toBe(false);
    expect(c.latent === null || content.latentTraits.has(c.latent)).toBe(true);
    expect(c.latent).toBe(rollLatent(loaded, c.id));
  });
});

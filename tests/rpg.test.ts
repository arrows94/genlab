import { describe, expect, it } from 'vitest';
import { nextTorchAt, refreshTorches, torches } from '@core/features/rpg';
import { deserialize, serialize } from '@core/save';
import { unlockFeature } from '@core/systems/unlocks';
import { D } from '@core/num';
import { NOW, balance, makeGame } from './helpers';

const HOUR = 3_600_000;

function rpgGame() {
  const g = makeGame();
  unlockFeature(g, 'rpg');
  refreshTorches(g, NOW);
  return g;
}

describe('GenLab RPG – Fackeln', () => {
  it('stays apart from the normal game: no condition unlocks it', () => {
    const g = makeGame();
    expect(g.content.features.get('rpg').condition).toBeUndefined();
    refreshTorches(g, NOW);
    expect(torches(g)).toBe(0);
    expect(nextTorchAt(g)).toBeNull();
  });

  it('fills the stock once on unlock', () => {
    const g = rpgGame();
    expect(torches(g)).toBe(balance.rpg.maxTorches);
    expect(nextTorchAt(g)).toBeNull();
  });

  it('refills one Fackel per interval up to the limit, also across long breaks', () => {
    const g = rpgGame();
    g.state.resources['torches'] = D(0);
    refreshTorches(g, NOW);
    expect(nextTorchAt(g)).toBe(NOW + balance.rpg.torchHours * HOUR);
    refreshTorches(g, NOW + balance.rpg.torchHours * HOUR - 1);
    expect(torches(g)).toBe(0);
    refreshTorches(g, NOW + balance.rpg.torchHours * HOUR);
    expect(torches(g)).toBe(1);
    // The next one counts from the planned time, not from the late check.
    expect(nextTorchAt(g)).toBe(NOW + 2 * balance.rpg.torchHours * HOUR);
    refreshTorches(g, NOW + 100 * HOUR);
    expect(torches(g)).toBe(balance.rpg.maxTorches);
    expect(nextTorchAt(g)).toBeNull();
  });

  it('keeps extra Fackeln from rewards above the limit', () => {
    const g = rpgGame();
    g.state.resources['torches'] = D(balance.rpg.maxTorches + 2);
    refreshTorches(g, NOW + 100 * HOUR);
    expect(torches(g)).toBe(balance.rpg.maxTorches + 2);
  });

  it('old saves get the new state with defaults', () => {
    const g = makeGame();
    const raw = JSON.parse(serialize(g.state, NOW));
    delete raw.state.rpg;
    const { state } = deserialize(JSON.stringify(raw));
    expect(state.rpg.torchAt).toBe(-1);
  });
});

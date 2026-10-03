import { describe, expect, it } from 'vitest';
import { D } from '@core/num';
import { content } from '@content/index';
import { buyOffer, offerLeft, offerPrice, offerUnit, towerOffers } from '@core/features/quartermaster';
import { floorTokens } from '@core/features/tower';
import { unlockFeature } from '@core/systems/unlocks';
import { debugReset } from '@core/debug';
import { resetLayer } from '@core/prestige';
import { makeGame } from './helpers';

const WEEK = 7 * 24 * 3600 * 1000;

function shopGame(best = 150) {
  const g = makeGame(11);
  for (const f of ['farm', 'breeding', 'tower', 'quartermaster', 'evolution', 'recycler', 'contracts']) unlockFeature(g, f);
  g.state.tower.best = best;
  g.state.tower.bestEver = best;
  g.state.resources.towerTokens = D(1e7);
  return g;
}

describe('Quartiermeister', () => {
  it('opens with the tower record', () => {
    const g = makeGame(11);
    unlockFeature(g, 'tower');
    expect(buyOffer(g, 'catalyst').ok).toBe(false);
    g.state.tower.best = 100;
    g.step(100);
    expect(g.state.features['quartermaster']).toBe(true);
  });

  it('trades Turm-Marken for the resource at a price that follows the record', () => {
    const g = shopGame();
    const def = content.towerOffers.get('catalyst');
    expect(offerUnit(g).toNumber()).toBe(floorTokens(g, 150).toNumber());
    const price = offerPrice(g, 'catalyst');
    expect(price.toNumber()).toBe(Math.ceil(floorTokens(g, 150).toNumber() * def.floors));
    const crystals = g.state.resources.catalyst?.toNumber() ?? 0;
    expect(buyOffer(g, 'catalyst').ok).toBe(true);
    expect(g.state.resources.catalyst!.toNumber()).toBe(crystals + def.amount);
    expect(g.state.resources.towerTokens!.toNumber()).toBe(1e7 - price.toNumber());
    // Every purchase in the week costs more; a higher record raises the price too.
    expect(offerPrice(g, 'catalyst').toNumber()).toBeCloseTo(price.toNumber() * def.priceGrowth, -1);
    const higher = shopGame(300);
    expect(offerPrice(higher, 'catalyst').gt(price)).toBe(true);
  });

  it('has a weekly limit that a new week lifts', () => {
    const g = shopGame();
    const def = content.towerOffers.get('fragments');
    for (let i = 0; i < def.weeklyLimit; i++) expect(buyOffer(g, 'fragments').ok).toBe(true);
    expect(offerLeft(g, 'fragments')).toBe(0);
    expect(buyOffer(g, 'fragments')).toEqual({ ok: false, reason: 'Diese Woche ist das Angebot ausverkauft.' });
    g.state.lastTickAt += WEEK;
    expect(offerLeft(g, 'fragments')).toBe(def.weeklyLimit);
    expect(offerPrice(g, 'fragments').toNumber()).toBe(Math.ceil(offerUnit(g).toNumber() * def.floors));
    expect(buyOffer(g, 'fragments').ok).toBe(true);
  });

  it('refuses without enough Turm-Marken and hides offers of locked resources', () => {
    const g = shopGame();
    g.state.resources.towerTokens = D(1);
    expect(buyOffer(g, 'catalyst')).toEqual({ ok: false, reason: 'Nicht genug Turm-Marken.' });
    // Keimöl belongs to the Fähigkeits-Elixier.
    expect(towerOffers(g).some((o) => o.resource === 'germOil')).toBe(false);
    expect(buyOffer(g, 'germOil').ok).toBe(false);
    unlockFeature(g, 'abilityElixir');
    expect(towerOffers(g).some((o) => o.resource === 'germOil')).toBe(true);
  });

  it('keeps the week through an Äon and starts over with the debug reset', () => {
    const g = shopGame();
    buyOffer(g, 'catalyst');
    resetLayer(g, content.prestigeLayers.get('aeon'));
    expect(offerLeft(g, 'catalyst')).toBe(content.towerOffers.get('catalyst').weeklyLimit - 1);
    expect(debugReset(g, 'quartermaster').ok).toBe(true);
    expect(offerLeft(g, 'catalyst')).toBe(content.towerOffers.get('catalyst').weeklyLimit);
  });
});

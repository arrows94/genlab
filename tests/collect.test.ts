import { describe, expect, it } from 'vitest';
import { assignJob, collect, collectAmounts } from '@core/actions';
import { stamina, staminaMax } from '@core/features/collect';
import { productionRates } from '@core/systems/production';
import { unlockFeature } from '@core/systems/unlocks';
import { deserialize, serialize } from '@core/save';
import { NOW, balance, makeGame } from './helpers';

const food = (g: ReturnType<typeof makeGame>) => g.state.resources.food?.toNumber() ?? 0;
const noFinds = { ...balance.collect, finds: { ...balance.collect.finds, chance: 0 } };

describe('Sammeln', () => {
  it('starts rested: a click spends one point of Ausdauer', () => {
    const g = makeGame();
    expect(stamina(g)).toBe(staminaMax(g));
    collect(g);
    expect(stamina(g)).toBe(staminaMax(g) - 1);
  });

  it('an exhausted click only brings what has refilled so far', () => {
    const g = makeGame(42, { collect: noFinds });
    for (let i = 0; i < staminaMax(g); i++) collect(g);
    const before = food(g);
    collect(g);
    expect(food(g)).toBe(before);
    g.advance(200);
    const full = g.mods().apply('collect.food', 1);
    expect(collectAmounts(g).food!.toNumber()).toBeCloseTo(full * balance.collect.stamina.perSec * 0.2);
    collect(g);
    expect(food(g)).toBeCloseTo(before + full * balance.collect.stamina.perSec * 0.2);
    expect(stamina(g)).toBeCloseTo(0);
  });

  it('refills over game time, at most to the maximum', () => {
    const g = makeGame();
    for (let i = 0; i < staminaMax(g); i++) collect(g);
    g.advance(1000);
    expect(stamina(g)).toBeCloseTo(balance.collect.stamina.perSec);
    g.advance(3_600_000);
    expect(stamina(g)).toBe(staminaMax(g));
  });

  it('caps what an auto-clicker gets per minute', () => {
    const human = makeGame(1, { collect: noFinds });
    const bot = makeGame(1, { collect: noFinds });
    for (let sec = 0; sec < 60; sec++) {
      for (let i = 0; i < 3; i++) collect(human);
      for (let i = 0; i < 50; i++) collect(bot);
      human.advance(1000);
      bot.advance(1000);
    }
    // 16× the clicks bring no more than a full bar plus the refill, barely more than steady clicking.
    const full = bot.mods().apply('collect.food', 1);
    expect(food(bot)).toBeLessThanOrEqual(full * (staminaMax(bot) + balance.collect.stamina.perSec * 60) + 1e-6);
    expect(food(bot)).toBeLessThan(food(human) * 1.15);
  });

  it('adds seconds of the current production to a click', () => {
    const g = makeGame(42, { collect: noFinds });
    unlockFeature(g, 'farm');
    expect(assignJob(g, g.state.creatures[0]!.id, 'farm').ok).toBe(true);
    const rate = productionRates(g).food!.toNumber();
    expect(rate).toBeGreaterThan(0);
    expect(collectAmounts(g).food!.toNumber()).toBeCloseTo(1 + rate * balance.collect.productionSeconds);
  });

  it('Fundstücke turn up only on rested clicks and at most once per cooldown', () => {
    const always = { ...balance.collect, finds: { ...balance.collect.finds, chance: 1 } };
    const g = makeGame(42, { collect: always });
    const finds: number[] = [];
    g.bus.on('collected', (e) => e.find && finds.push(e.find.amount.toNumber()));
    const cooldown = balance.collect.finds.cooldownSec * 1000;
    collect(g);
    expect(finds).toHaveLength(0); // not in the first minutes of a game
    g.advance(cooldown);
    g.state.collect.spent = 0;
    collect(g);
    collect(g);
    expect(finds).toHaveLength(1);
    expect(finds[0]).toBeCloseTo(balance.collect.finds.clicks);
    expect(g.state.statistics.collectFinds).toBe(1);

    g.advance(cooldown);
    g.state.collect.spent = staminaMax(g);
    collect(g);
    expect(finds).toHaveLength(1);
    g.state.collect.spent = 0;
    collect(g);
    expect(finds).toHaveLength(2);
  });

  it('old saves without the field load rested', () => {
    const g = makeGame();
    const plain = JSON.parse(serialize(g.state, NOW));
    delete plain.state.collect;
    const { state } = deserialize(JSON.stringify(plain));
    expect(state.collect).toEqual({ spent: 0, nextFindAt: 0 });
  });
});

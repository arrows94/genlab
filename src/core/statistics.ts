import type { EventBus } from './events';
import type { GameEvents } from './gameEvents';
import type { GameContext } from './context';

/**
 * Statistics and records are pure event listeners; systems never update
 * counters directly. `getCtx` is a getter because the state can be replaced
 * (load/import).
 */
export function attachStatistics(bus: EventBus<GameEvents>, getCtx: () => GameContext): () => void {
  const stats = () => getCtx().state.statistics;
  const inc = (key: string, by = 1) => {
    const s = stats();
    s[key] = (s[key] ?? 0) + by;
  };
  const record = (key: string, value: number) => {
    const s = stats();
    if (value > (s[key] ?? 0)) s[key] = value;
  };
  const offs = [
    bus.on('collected', () => inc('clicks')),
    bus.on('creatureAdded', (e) => {
      inc('creaturesObtained');
      inc(`creatures.${e.source}`);
      const ctx = getCtx();
      const c = ctx.state.creatures.find((x) => x.id === e.creatureId);
      if (c) {
        record('record.generation', c.generation);
        record('record.rarity', ctx.content.rarities.get(c.rarity).order);
      }
    }),
    bus.on('dexDiscovered', () => inc('dexEntries')),
    bus.on('processCompleted', (e) => inc(`completed.${e.kind}`)),
    bus.on('upgradeBought', () => inc('upgradesBought')),
    bus.on('prestige', (e) => inc(`prestige.${e.layer}`)),
    bus.on('eggHatched', () => inc('hatched')),
    bus.on('missionCompleted', (e) => {
      if (e.wildCreatureId !== null) inc('wildFound');
    }),
    bus.on('potionUsed', () => inc('potionsUsed')),
    bus.on('sequenced', () => inc('sequenced')),
    bus.on('evolved', () => inc('evolved')),
    bus.on('spliced', (e) => inc(e.success ? 'splices' : 'splicesFailed')),
    bus.on('sold', (e) => inc('sold', e.count)),
    bus.on('recycled', (e) => inc('recycled', e.count)),
    bus.on('infused', (e) => {
      inc('infused', e.victims);
      const c = getCtx().state.creatures.find((x) => x.id === e.targetId);
      if (c) record('record.infusion', c.infusion.level);
    }),
    bus.on('breakthrough', (e) => {
      inc('breakthroughs');
      record('record.rarity', getCtx().content.rarities.get(e.rarity).order);
    }),
    bus.on('capsuleOpened', (e) => {
      inc('capsulesOpened');
      if (e.pity) inc('capsulePity');
    }),
  ];
  return () => offs.forEach((off) => off());
}

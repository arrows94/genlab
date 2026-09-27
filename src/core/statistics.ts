import type { EventBus } from './events';
import type { GameEvents } from './gameEvents';
import type { GameState } from './state';

/**
 * Statistics are pure event listeners; systems never update counters
 * directly. `getState` is a getter because the state object can be replaced
 * (load/import).
 */
export function attachStatistics(bus: EventBus<GameEvents>, getState: () => GameState): () => void {
  const inc = (key: string, by = 1) => {
    const s = getState().statistics;
    s[key] = (s[key] ?? 0) + by;
  };
  const offs = [
    bus.on('collected', () => inc('clicks')),
    bus.on('creatureAdded', (e) => {
      inc('creaturesObtained');
      inc(`creatures.${e.source}`);
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
  ];
  return () => offs.forEach((off) => off());
}

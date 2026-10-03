import type { EventBus } from './events';
import type { GameEvents } from './gameEvents';
import type { GameContext } from './context';
import { stampMilestone } from './activity';

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
    bus.on('collected', (e) => {
      inc('clicks');
      if (e.find) inc('collectFinds');
    }),
    bus.on('creatureAdded', (e) => {
      inc('creaturesObtained');
      inc(`creatures.${e.source}`);
      const ctx = getCtx();
      const c = ctx.state.creatures.find((x) => x.id === e.creatureId);
      if (c) {
        record('record.generation', c.generation);
        record('record.lineage', c.lineage ?? 0);
        record('record.rarity', ctx.content.rarities.get(c.rarity).order);
      }
    }),
    bus.on('dexDiscovered', () => inc('dexEntries')),
    bus.on('processCompleted', (e) => inc(`completed.${e.kind}`)),
    bus.on('upgradeBought', () => inc('upgradesBought')),
    bus.on('prestige', (e) => inc(`prestige.${e.layer}`)),
    bus.on('eggHatched', (e) => {
      inc('hatched');
      // Per species: the Genom-Keller's „Schatten deiner Dynastie“ takes the most bred one.
      const c = getCtx().state.creatures.find((x) => x.id === e.creatureId);
      if (c) inc(`bred.${c.speciesId}`);
    }),
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
    bus.on('towerFloor', (e) => {
      if (!e.win) return;
      record('record.towerFloor', e.floor);
      if (getCtx().balance.activity.towerMilestones.includes(e.floor)) stampMilestone(getCtx(), `tower:${e.floor}`);
    }),
    bus.on('cellarLevel', (e) => {
      if (e.win) record('record.cellarLevel', e.level);
    }),
    // Milestones: when (in active play time) something was first reached.
    bus.on('featureUnlocked', (e) => stampMilestone(getCtx(), `feature:${e.feature}`)),
    bus.on('achievementUnlocked', (e) => stampMilestone(getCtx(), `achievement:${e.achievement}`)),
    bus.on('anomalyCompleted', () => inc('anomaliesCompleted')),
    bus.on('perfectGenome', () => inc('perfectGenomes')),
    bus.on('shiny', () => inc('shinies')),
    bus.on('contractCompleted', () => inc('contracts')),
    bus.on('voyageResolved', () => inc('voyages')),
    bus.on('capsuleOpened', (e) => {
      inc('capsulesOpened');
      if (e.pity) inc('capsulePity');
    }),
  ];
  return () => offs.forEach((off) => off());
}

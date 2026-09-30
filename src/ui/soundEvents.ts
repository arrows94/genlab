import { content } from '@content/index';
import { EGG } from '@core/features/breeding';
import type { Game } from '@core/game';
import { play } from './sound';

/**
 * Which game events play which sound. Everyday events that automations
 * trigger all the time only sound in their own tab; rare results always do,
 * and events that carry `auto` stay silent. Catch-up, background tabs and
 * throttling are handled by `play` itself. Sounds that belong to an
 * animation (capsules, tower replay, Zerlege-Kammer) are played by their
 * components.
 */
export function wireSounds(g: Game, currentTab: () => string): void {
  const inTab = (tab: string) => currentTab() === tab;
  const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let lastHatch = { key: '', at: 0 };
  let clicks = { n: 0, at: 0 };
  let bossTiers = g.state.weeklyBoss?.tiers ?? 0;

  // ---- Grundgefühl ----
  g.bus.on('collected', () => {
    // Fast clicking climbs in pitch; a pause starts low again.
    const t = now();
    clicks = { n: t - clicks.at < 450 ? clicks.n + 1 : 0, at: t };
    play('collect', clicks.n);
  });
  g.bus.on('upgradeBought', (e) => {
    const def = content.upgrades.get(e.upgrade);
    play(def.maxLevel !== null && e.level >= def.maxLevel ? 'researchMax' : 'research');
  });
  g.bus.on('featureUnlocked', (e) => {
    if (!e.silent) play('unlock');
  });
  g.bus.on('achievementUnlocked', () => play('achievement'));

  // ---- Brutstation ----
  g.bus.on('processStarted', (e) => {
    if (e.kind === EGG && inTab('breeding')) play('eggLaid');
  });
  g.bus.on('eggHatched', (e) => {
    const c = g.state.creatures.find((x) => x.id === e.creatureId);
    const t = now();
    const key = [...e.parents].sort().join('-');
    // Twins hatch from one egg in the same moment.
    const twin = key === lastHatch.key && t - lastHatch.at < 80;
    lastHatch = { key, at: t };
    if (!c) return;
    const order = content.rarities.get(c.rarity).order;
    const rare = order >= 2 || content.species.get(c.speciesId).tier !== 'base';
    if (twin) play('twins');
    else if (e.ritual) play('ritualBell');
    else if (rare) play('hatchRare', order);
    else if (inTab('breeding')) play('hatch');
  });
  g.bus.on('dexDiscovered', (e) => {
    if (g.state.creatures.length > 1 && content.species.get(e.species).tier !== 'base') play('discovery');
  });
  g.bus.on('infused', (e) => play(e.levelsGained > 0 ? 'infuseLevel' : 'infuse'));
  g.bus.on('breakthrough', () => play('breakthrough'));
  g.bus.on('dynastyTier', () => play('dynasty'));

  // ---- Genlabor ----
  g.bus.on('sequenced', () => {
    if (inTab('genetics')) play('sequenced');
  });
  g.bus.on('deepSequenced', () => play('deepSequenced'));
  g.bus.on('alleleCatalogued', () => {
    if (inTab('genetics')) play('catalogued');
  });
  g.bus.on('spliced', (e) => play(e.success ? 'spliceOk' : 'spliceFail'));

  // ---- Wirtschaft & Erkundung ----
  g.bus.on('potionUsed', () => play('potion'));
  g.bus.on('missionCompleted', (e) => {
    if (e.wildCreatureId !== null) play('wild');
    else if (inTab('expedition')) play('horn');
  });
  g.bus.on('voyageReturned', () => play('tension'));
  g.bus.on('contractCompleted', () => play('contract'));
  g.bus.on('dailyClaimed', () => play('chest'));

  // ---- Turm & Endgame ----
  g.bus.on('towerFloor', (e) => {
    // Milestone records pay Äon-Splitter; the replay in the tower tab plays the rest.
    if (e.win && e.rewards['aeonShards']) play('milestone');
  });
  // With the Turm-Routine runs end (and restart) on their own – only audible in the tower.
  g.bus.on('towerRunEnded', () => {
    if (inTab('tower')) play('runEnded');
  });
  g.bus.on('weeklyBossHit', () => {
    const tiers = g.state.weeklyBoss?.tiers ?? 0;
    play(tiers > bossTiers ? 'bossTier' : 'bossHit');
    bossTiers = tiers;
  });
  g.bus.on('prestige', (e) => play(e.layer === 'aeon' ? 'aeon' : 'prestige'));
  g.bus.on('talentBought', () => play('talent'));
  g.bus.on('resonanceBought', () => play('talent'));
  g.bus.on('megaProjectStage', () => play('construction'));
  g.bus.on('anomalyStarted', () => play('anomalyStart'));
  g.bus.on('anomalyCompleted', () => play('anomalyDone'));
}

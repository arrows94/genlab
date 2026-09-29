import { content } from '@content/index';
import { EGG } from '@core/features/breeding';
import type { Game } from '@core/game';
import { play } from './sound';

/**
 * Which game events play which sound (Brutstation and Genlabor). Everyday
 * events that automations trigger all the time only sound in their own tab;
 * rare results always do. Catch-up, background tabs and throttling are
 * handled by `play` itself.
 */
export function wireSounds(g: Game, currentTab: () => string): void {
  const inTab = (tab: string) => currentTab() === tab;
  let lastHatch = { key: '', at: 0 };

  g.bus.on('processStarted', (e) => {
    if (e.kind === EGG && inTab('breeding')) play('eggLaid');
  });
  g.bus.on('eggHatched', (e) => {
    const c = g.state.creatures.find((x) => x.id === e.creatureId);
    const now = performance.now();
    const key = [...e.parents].sort().join('-');
    // Twins hatch from one egg in the same moment.
    const twin = key === lastHatch.key && now - lastHatch.at < 80;
    lastHatch = { key, at: now };
    if (!c) return;
    const rare = content.rarities.get(c.rarity).order >= 2 || content.species.get(c.speciesId).tier !== 'base';
    if (twin) play('twins');
    else if (rare) play('hatchRare');
    else if (inTab('breeding')) play('hatch');
  });
  g.bus.on('dexDiscovered', (e) => {
    if (g.state.creatures.length > 1 && content.species.get(e.species).tier !== 'base') play('discovery');
  });
  g.bus.on('sequenced', () => {
    if (inTab('genetics')) play('sequenced');
  });
  g.bus.on('deepSequenced', () => play('deepSequenced'));
  g.bus.on('alleleCatalogued', () => {
    if (inTab('genetics')) play('catalogued');
  });
  g.bus.on('spliced', (e) => play(e.success ? 'spliceOk' : 'spliceFail'));
}

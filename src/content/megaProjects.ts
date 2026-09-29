import type { MegaProjectDef } from '@core/content/types';

/**
 * Großprojekte: buildings that take days. Each stage is paid in over several
 * visits, then builds by the real clock. Progress is never reset, so a
 * stage can be fed right before an Äon with resources that would be lost.
 * Costs are sized to what a run holds shortly before an Äon (bot: ~10⁹–10¹⁰
 * gold, 10⁸–10⁹ essence, 100–200 crystals, ~1.500 fragments), so each stage
 * takes a few visits or one Äon's leftovers.
 */
export const megaProjects: MegaProjectDef[] = [
  {
    id: 'observatory', name: 'Äon-Observatorium', icon: '🔭',
    description: 'Ein Turm über den Zeiten. Seine Linsen und Sternkarten öffnen neue Stufen im Talentbaum und die endlose Resonanz.',
    requires: { type: 'feature', feature: 'aeon' },
    stages: [
      { name: 'Fundament', description: 'Ein Sockel aus Turmgestein, verankert im Erbgut.', cost: { gold: 1e9, towerTokens: 300 }, hours: 12 },
      { name: 'Kuppel', description: 'Öffnet die vierte Stufe im Talentbaum.', cost: { essence: 2e8, catalyst: 100 }, hours: 24 },
      { name: 'Linsen', description: 'Geschliffen aus Gen-Fragmenten, gebündelt im Turmlicht. Öffnet die Äon-Resonanz.', cost: { fragments: 3000, towerTokens: 1500 }, hours: 24 },
      { name: 'Sternkarte', description: 'Öffnet die fünfte Stufe im Talentbaum.', cost: { gold: 2e10, essence: 2e9, catalyst: 300 }, hours: 48 },
    ],
  },
];

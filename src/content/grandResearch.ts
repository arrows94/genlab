import type { GrandResearchDef } from '@core/content/types';

/**
 * Großforschung: projects that run for hours or days on a separate research
 * slot (instant research stays as it is). Their levels are permanent – they
 * survive inheritance and Äon – so a week-long project is never wasted.
 */
const afterInheritance = { type: 'prestigeCount', layer: 'inheritance', count: 1 } as const;

export const grandResearch: GrandResearchDef[] = [
  {
    id: 'breedingGrounds', name: 'Brutgründe', icon: '🪺', hours: 8, hoursGrowth: 2, maxLevel: 2,
    description: '+1 Nest pro Stufe.', cost: { essence: 400, gold: 20000 }, costGrowth: 4, requires: afterInheritance,
    modifiers: [{ target: 'slots.nest', op: 'add', value: 1 }],
  },
  {
    id: 'expeditionNetwork', name: 'Expeditionsnetz', icon: '🏕️', hours: 12, hoursGrowth: 2, maxLevel: 2,
    description: '+1 Camp pro Stufe.', cost: { essence: 500, gold: 30000 }, costGrowth: 4, requires: afterInheritance,
    modifiers: [{ target: 'slots.camp', op: 'add', value: 1 }],
  },
  {
    id: 'sequencerArray', name: 'Sequenzer-Array', icon: '🔬', hours: 12, hoursGrowth: 2, maxLevel: 2,
    description: '+1 Sequenzierer pro Stufe.', cost: { essence: 600 }, costGrowth: 4, requires: afterInheritance,
    modifiers: [{ target: 'slots.sequencer', op: 'add', value: 1 }],
  },
  {
    id: 'timeLab', name: 'Zeitlabor', icon: '⏱️', hours: 16, hoursGrowth: 1.5, maxLevel: 3,
    description: '+4 h Offline-Fortschritt pro Stufe.', cost: { essence: 800, catalyst: 2 }, costGrowth: 2.5, requires: afterInheritance,
    modifiers: [{ target: 'offline.capHours', op: 'add', value: 4 }],
  },
  {
    id: 'geneticAtlas', name: 'Genetischer Atlas', icon: '🧬', hours: 24, hoursGrowth: 1.5, maxLevel: 3,
    description: '+2 % Mutationschance und +15 % Hybrid-Chance pro Stufe.', cost: { essence: 1000, fragments: 50 }, costGrowth: 2.5,
    requires: { type: 'feature', feature: 'hybrids' },
    modifiers: [{ target: 'breeding.mutation', op: 'add', value: 0.02 }, { target: 'breeding.hybridChance', op: 'pct', value: 0.15 }],
  },
  {
    id: 'tradeNetwork', name: 'Züchternetzwerk', icon: '📋', hours: 24, hoursGrowth: 1.5, maxLevel: 3,
    description: '+25 % Belohnungen für Gen-Aufträge und Tagesbelohnung pro Stufe.', cost: { essence: 1200, catalyst: 3 }, costGrowth: 2.5,
    requires: { type: 'feature', feature: 'contracts' },
    modifiers: [{ target: 'contracts.reward', op: 'pct', value: 0.25 }, { target: 'daily.reward', op: 'pct', value: 0.25 }],
  },
  {
    id: 'eternalHarvest', name: 'Ewige Ernte', icon: '🌾', hours: 48, hoursGrowth: 1.5, maxLevel: 5,
    description: '+50 % Nahrung, Gold und Essenz pro Stufe.', cost: { essence: 2000, catalyst: 5 }, costGrowth: 3, requires: afterInheritance,
    modifiers: [
      { target: 'production.food', op: 'pct', value: 0.5 },
      { target: 'production.gold', op: 'pct', value: 0.5 },
      { target: 'production.essence', op: 'pct', value: 0.5 },
    ],
  },
];

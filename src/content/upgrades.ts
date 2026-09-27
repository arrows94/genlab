import type { UpgradeDef } from '@core/content/types';

const research = { type: 'feature', feature: 'research' } as const;

export const upgrades: UpgradeDef[] = [
  {
    id: 'strongHands', name: 'Kräftige Hände', category: 'research', requires: research,
    description: '+50 % Nahrung pro Klick.',
    cost: { food: 20 }, costGrowth: 1.8, maxLevel: 10,
    modifiers: [{ target: 'collect.food', op: 'pct', value: 0.5 }],
  },
  {
    id: 'autoGatherer', name: 'Auto-Sammler', category: 'research', requires: research,
    description: 'Sammelt automatisch 0,2 Nahrung/s.',
    cost: { food: 40 }, costGrowth: 1.6, maxLevel: 25,
    modifiers: [{ target: 'production.food', op: 'add', value: 0.2 }],
  },
  {
    id: 'farmExpansion', name: 'Farm-Ausbau', category: 'research', requires: { type: 'feature', feature: 'farm' },
    description: '+1 Platz auf der Farm.',
    cost: { food: 75 }, costGrowth: 3, maxLevel: 4,
    modifiers: [{ target: 'slots.farm', op: 'add', value: 1 }],
  },
  {
    id: 'fertileSoil', name: 'Fruchtbarer Boden', category: 'research', requires: { type: 'feature', feature: 'farm' },
    description: '+25 % Nahrungsproduktion.',
    cost: { food: 120 }, costGrowth: 1.9, maxLevel: 20,
    modifiers: [{ target: 'production.food', op: 'pct', value: 0.25 }],
  },
  {
    id: 'minePermit', name: 'Grabungslizenz', category: 'research', requires: research,
    description: 'Schaltet die Mine frei.',
    cost: { food: 200 }, costGrowth: 1, maxLevel: 1,
    modifiers: [], unlocksFeatures: ['mine'],
  },
  {
    id: 'mineExpansion', name: 'Minen-Ausbau', category: 'research', requires: { type: 'feature', feature: 'mine' },
    description: '+1 Platz in der Mine.',
    cost: { gold: 60 }, costGrowth: 3, maxLevel: 4,
    modifiers: [{ target: 'slots.mine', op: 'add', value: 1 }],
  },
  {
    id: 'timeVault', name: 'Zeitgewölbe', category: 'research', requires: { type: 'feature', feature: 'mine' },
    description: '+2 h maximaler Offline-Fortschritt.',
    cost: { gold: 500 }, costGrowth: 2.5, maxLevel: 6,
    modifiers: [{ target: 'offline.capHours', op: 'add', value: 2 }],
  },
];

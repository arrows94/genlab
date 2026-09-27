import type { ElementDef } from '@core/content/types';

export const elements: ElementDef[] = [
  { id: 'fire', name: 'Feuer', color: '#ff7043', strongAgainst: ['nature', 'ice', 'metal'] },
  { id: 'water', name: 'Wasser', color: '#42a5f5', strongAgainst: ['fire', 'earth'] },
  { id: 'earth', name: 'Erde', color: '#a1887f', strongAgainst: ['electric', 'poison', 'fire'] },
  { id: 'air', name: 'Luft', color: '#b3e5fc', strongAgainst: ['nature', 'poison'] },
  { id: 'electric', name: 'Elektro', color: '#ffee58', strongAgainst: ['water', 'air', 'metal'] },
  { id: 'nature', name: 'Natur', color: '#66bb6a', strongAgainst: ['water', 'earth'] },
  { id: 'ice', name: 'Eis', color: '#80deea', strongAgainst: ['nature', 'air'] },
  { id: 'shadow', name: 'Schatten', color: '#7e57c2', strongAgainst: ['light', 'crystal'] },
  { id: 'light', name: 'Licht', color: '#fff59d', strongAgainst: ['shadow', 'poison'] },
  { id: 'metal', name: 'Metall', color: '#b0bec5', strongAgainst: ['ice', 'crystal'] },
  { id: 'poison', name: 'Gift', color: '#ab47bc', strongAgainst: ['nature', 'water'] },
  { id: 'crystal', name: 'Kristall', color: '#f48fb1', strongAgainst: ['electric', 'light'] },
];

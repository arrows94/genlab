import type { AbilityDef } from '@core/content/types';

export const abilities: AbilityDef[] = [
  { id: 'diligent', name: 'Fleißig', tier: 'common', scope: 'job', description: '+10 % Ertrag bei der Arbeit.', modifiers: [{ target: 'production.food', op: 'pct', value: 0.1 }, { target: 'production.gold', op: 'pct', value: 0.1 }] },
  { id: 'tough', name: 'Zäh', tier: 'common', scope: 'self', description: '+10 % KP.', modifiers: [{ target: 'stat.hp', op: 'pct', value: 0.1 }] },
  { id: 'swift', name: 'Flink', tier: 'uncommon', scope: 'self', description: '+15 % Tempo.', modifiers: [{ target: 'stat.spd', op: 'pct', value: 0.15 }] },
  { id: 'mutagenic', name: 'Mutagen', tier: 'rare', scope: 'global', description: '+2 % Mutationschance beim Brüten.', modifiers: [{ target: 'breeding.mutation', op: 'add', value: 0.02 }] },
  { id: 'nurturer', name: 'Brutpfleger', tier: 'epic', scope: 'global', description: '−10 % Brutzeit.', modifiers: [{ target: 'breeding.time', op: 'pct', value: -0.1 }] },
  { id: 'goldheart', name: 'Goldherz', tier: 'legendary', scope: 'global', description: '+25 % Goldproduktion.', modifiers: [{ target: 'production.gold', op: 'pct', value: 0.25 }] },
];

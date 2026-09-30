import type { LatentTraitDef } from '@core/content/types';

/**
 * Erbanlagen: hidden traits (about a third of all creatures carry one). They
 * are inherited even while hidden and only work after a deep sequencing
 * (Tiefensequenzierung) revealed them. Stronger than abilities, since they
 * cost a deep sequencing and some breeding to get.
 */
export const latentTraits: LatentTraitDef[] = [
  { id: 'titanBlood', name: 'Titanenblut', weight: 3, scope: 'self', description: '+25 % KP und Verteidigung.',
    modifiers: [{ target: 'stat.hp', op: 'pct', value: 0.25 }, { target: 'stat.def', op: 'pct', value: 0.25 }] },
  { id: 'hunter', name: 'Jägerinstinkt', weight: 3, scope: 'self', description: '+25 % Angriff, +10 % Tempo, im Turm 15 % kritische Treffer.',
    modifiers: [{ target: 'stat.atk', op: 'pct', value: 0.25 }, { target: 'stat.spd', op: 'pct', value: 0.1 }, { target: 'tower.crit', op: 'add', value: 0.15 }] },
  { id: 'thornSkin', name: 'Dornenhaut', weight: 2, scope: 'self', description: '+10 % Verteidigung; im Turm gehen 30 % des erlittenen Schadens an den Angreifer zurück.',
    modifiers: [{ target: 'stat.def', op: 'pct', value: 0.1 }, { target: 'tower.thorns', op: 'add', value: 0.3 }] },
  { id: 'goldNose', name: 'Goldnase', weight: 3, scope: 'job', description: '+40 % Gold bei der Arbeit.',
    modifiers: [{ target: 'production.gold', op: 'pct', value: 0.4 }] },
  { id: 'harvester', name: 'Erntesegen', weight: 3, scope: 'job', description: '+40 % Nahrung bei der Arbeit.',
    modifiers: [{ target: 'production.food', op: 'pct', value: 0.4 }] },
  { id: 'essenceVein', name: 'Essenzader', weight: 2, scope: 'job', description: '+40 % Essenz bei der Arbeit.',
    modifiers: [{ target: 'production.essence', op: 'pct', value: 0.4 }] },
  { id: 'wanderer', name: 'Fernweh', weight: 2, scope: 'global', description: '+5 % Beute bei Erkundungen.',
    modifiers: [{ target: 'mission.reward', op: 'pct', value: 0.05 }] },
  { id: 'broodKeeper', name: 'Nesthüter', weight: 2, scope: 'global', description: '−5 % Brutzeit.',
    modifiers: [{ target: 'breeding.time', op: 'pct', value: -0.05 }] },
  { id: 'geneWeaver', name: 'Genweber', weight: 1, scope: 'global', description: '+2 % Mutationschance beim Brüten.',
    modifiers: [{ target: 'breeding.mutation', op: 'add', value: 0.02 }] },
];

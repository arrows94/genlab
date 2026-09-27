import type { EvolutionDef, HybridRecipeDef } from '@core/content/types';

/**
 * Hybrid recipes: parents (either order) → result with a chance per egg.
 * Requirements apply to the parents; `allele` = at least one parent carries it.
 */
export const recipes: HybridRecipeDef[] = [
  // Base × base → hybrid
  { id: 'steam', parents: ['emberpup', 'bubbloon'], result: 'steamling', chance: 0.15, hint: 'Wo Feuer auf Wasser trifft …' },
  { id: 'magma', parents: ['emberpup', 'pebblit'], result: 'magmole', chance: 0.15, hint: 'Glühendes Gestein unter der Erde.' },
  { id: 'storm', parents: ['zephyrix', 'voltmouse'], result: 'stormhawk', chance: 0.15, hint: 'Wind und Blitz vereint.' },
  { id: 'moss', parents: ['pebblit', 'sproutle'], result: 'mossgolem', chance: 0.15, hint: 'Ein Stein, auf dem etwas wächst.' },
  { id: 'glacier', parents: ['bubbloon', 'frostling'], result: 'glacierfin', chance: 0.15, hint: 'Gefrorenes Wasser, lebendig.' },
  { id: 'dusk', parents: ['umbrat', 'lumifly'], result: 'duskmoth', chance: 0.12, hint: 'Zwischen Tag und Nacht.' },
  { id: 'rust', parents: ['ferrox', 'bubbloon'], result: 'rustling', chance: 0.15, hint: 'Metall, das zu lange im Regen stand.' },
  { id: 'venom', parents: ['toxling', 'sproutle'], result: 'venomvine', chance: 0.15, hint: 'Eine Pflanze, die man nicht anfassen sollte.' },
  { id: 'geode', parents: ['prismin', 'pebblit'], result: 'geodite', chance: 0.15, hint: 'Ein unscheinbarer Stein mit Geheimnis.' },
  { id: 'voltprism', parents: ['prismin', 'voltmouse'], result: 'voltprism', chance: 0.12, hint: 'Ein Kristall, der Strom leitet.', requires: { minGeneration: 2 } },

  // Hybrid × base/hybrid → rare hybrid
  { id: 'volcano', parents: ['magmole', 'emberpup'], result: 'volcanodrake', chance: 0.08, hint: 'Noch mehr Feuer für den Maulwurf – aus einer alten Linie.', requires: { minGeneration: 4 } },
  { id: 'tempest', parents: ['stormhawk', 'zephyrix'], result: 'tempestlord', chance: 0.08, hint: 'Ein blitzschneller Sturm braucht blitzschnelle Gene.', requires: { allele: { locus: 'speed', allele: 'Tb' } } },
  { id: 'grove', parents: ['mossgolem', 'venomvine'], result: 'ancientgrove', chance: 0.08, hint: 'Nur seltene Pflanzen bilden einen Urwald.', requires: { minRarity: 'rare' } },
  { id: 'eclipse', parents: ['duskmoth', 'umbrat'], result: 'eclipsewing', chance: 0.08, hint: 'Die Dämmerung wird dunkler – dunkle Gene helfen.', requires: { allele: { locus: 'color', allele: 'D' } } },
  { id: 'aurora', parents: ['glacierfin', 'lumifly'], result: 'aurorafin', chance: 0.08, hint: 'Licht, das im Eis tanzt.', requires: { minGeneration: 3 } },
  { id: 'prismgolem', parents: ['geodite', 'voltprism'], result: 'prismgolem', chance: 0.06, hint: 'Zwei Kristallwesen aus langer Zucht.', requires: { minGeneration: 5 } },

  // Rare × rare → mythic
  { id: 'chrono', parents: ['eclipsewing', 'prismgolem'], result: 'chronodrake', chance: 0.04, hint: 'Schatten und Kristall – nur die Edelsten.', requires: { minRarity: 'legendary' } },
];

/** Evolutions: a creature changes species when all requirements are met. */
export const evolutions: EvolutionDef[] = [
  { id: 'geysir', from: 'steamling', to: 'geysirus', description: 'Der Dampf wird zur Fontäne.', requires: { minGeneration: 4, cost: { catalyst: 2, essence: 50 } } },
  { id: 'phoenix', from: 'volcanodrake', to: 'phoenix', description: 'Aus der Glut wiedergeboren.', requires: { minGeneration: 6, minRarity: 'epic', cost: { catalyst: 8, essence: 500 } } },
  { id: 'leviathan', from: 'aurorafin', to: 'leviathan', description: 'Die Tiefe ruft.', requires: { minGeneration: 6, allele: { locus: 'stamina', allele: 'Ae' }, cost: { catalyst: 8, essence: 500 } } },
  { id: 'worldtree', from: 'ancientgrove', to: 'worldtree', description: 'Wurzeln bis ans Ende der Welt.', requires: { minGeneration: 7, minRarity: 'epic', cost: { catalyst: 10, essence: 800 } } },
];

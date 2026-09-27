import type { GeneLocusDef } from '@core/content/types';

/**
 * Gene loci. Each creature carries two alleles per locus.
 * Higher `dominance` wins; equal dominance = codominant (both at 50 %).
 * `weight` = frequency in wild/new genomes (rare alleles have low weight).
 */
export const genes: GeneLocusDef[] = [
  {
    id: 'strength', name: 'Kraft', category: 'stat', description: 'Beeinflusst den Angriff.',
    alleles: [
      { id: 'Kt', name: 'Titanenkraft', symbol: 'Kᵗ', dominance: 3, weight: 3, color: '#ff3d00', modifiers: [{ target: 'stat.atk', op: 'pct', value: 0.45 }] },
      { id: 'K', name: 'Kraftvoll', symbol: 'K', dominance: 2, weight: 30, color: '#ff7043', modifiers: [{ target: 'stat.atk', op: 'pct', value: 0.2 }] },
      { id: 'k', name: 'Normal', symbol: 'k', dominance: 1, weight: 70, color: '#795548', modifiers: [] },
    ],
  },
  {
    id: 'stamina', name: 'Ausdauer', category: 'stat', description: 'Beeinflusst die Lebenspunkte.',
    alleles: [
      { id: 'Ae', name: 'Unermüdlich', symbol: 'Aᵉ', dominance: 3, weight: 3, color: '#00c853', modifiers: [{ target: 'stat.hp', op: 'pct', value: 0.45 }] },
      { id: 'A', name: 'Zäh', symbol: 'A', dominance: 2, weight: 30, color: '#66bb6a', modifiers: [{ target: 'stat.hp', op: 'pct', value: 0.2 }] },
      { id: 'a', name: 'Normal', symbol: 'a', dominance: 1, weight: 70, color: '#4e6b50', modifiers: [] },
    ],
  },
  {
    id: 'speed', name: 'Tempo', category: 'stat', description: 'Beeinflusst das Tempo.',
    alleles: [
      { id: 'Tb', name: 'Blitzschnell', symbol: 'Tᵇ', dominance: 3, weight: 3, color: '#ffd600', modifiers: [{ target: 'stat.spd', op: 'pct', value: 0.45 }] },
      { id: 'T', name: 'Flink', symbol: 'T', dominance: 2, weight: 30, color: '#ffee58', modifiers: [{ target: 'stat.spd', op: 'pct', value: 0.2 }] },
      { id: 't', name: 'Normal', symbol: 't', dominance: 1, weight: 70, color: '#8d8a4f', modifiers: [] },
    ],
  },
  {
    id: 'armor', name: 'Panzer', category: 'stat', description: 'Beeinflusst die Verteidigung.',
    alleles: [
      { id: 'Pd', name: 'Diamanthaut', symbol: 'Pᵈ', dominance: 3, weight: 3, color: '#80d8ff', modifiers: [{ target: 'stat.def', op: 'pct', value: 0.5 }] },
      { id: 'P', name: 'Gepanzert', symbol: 'P', dominance: 2, weight: 25, color: '#b0bec5', modifiers: [{ target: 'stat.def', op: 'pct', value: 0.25 }] },
      { id: 'p', name: 'Normal', symbol: 'p', dominance: 1, weight: 75, color: '#607d8b', modifiers: [] },
    ],
  },
  {
    id: 'yield', name: 'Ertrag', category: 'trait', description: 'Mehr Ertrag bei der Arbeit. Kodominant: beide Allele wirken zur Hälfte.',
    alleles: [
      { id: 'E', name: 'Ergiebig', symbol: 'E', dominance: 1, weight: 25, color: '#8fd16a', modifiers: [
        { target: 'production.food', op: 'pct', value: 0.2 },
        { target: 'production.gold', op: 'pct', value: 0.2 },
        { target: 'production.essence', op: 'pct', value: 0.2 },
      ] },
      { id: 'Eg', name: 'Goldader', symbol: 'Eᵍ', dominance: 1, weight: 5, color: '#f2c14e', modifiers: [{ target: 'production.gold', op: 'pct', value: 0.6 }] },
      { id: 'e', name: 'Normal', symbol: 'e', dominance: 1, weight: 70, color: '#546e7a', modifiers: [] },
    ],
  },
  {
    id: 'fertility', name: 'Fruchtbarkeit', category: 'trait', description: 'Rezessiv: nur reinerbige Träger (FF) brüten schneller.',
    alleles: [
      { id: 'f', name: 'Normal', symbol: 'f', dominance: 2, weight: 80, color: '#6d4c41', modifiers: [] },
      { id: 'F', name: 'Fruchtbar', symbol: 'F', dominance: 1, weight: 20, color: '#f48fb1', modifiers: [{ target: 'breeding.time', op: 'mult', value: 0.8 }] },
    ],
  },
  {
    id: 'color', name: 'Farbe', category: 'visual', description: 'Färbung. Albino ist rezessiv.',
    alleles: [
      { id: 'N', name: 'Normal', symbol: 'N', dominance: 2, weight: 60, color: '#90a4ae', modifiers: [] },
      { id: 'D', name: 'Dunkel', symbol: 'D', dominance: 2, weight: 25, color: '#37474f', modifiers: [], visual: { lightness: 36, saturation: 55 } },
      { id: 'al', name: 'Albino', symbol: 'aₗ', dominance: 1, weight: 10, color: '#f5f5f5', modifiers: [{ target: 'stat.spd', op: 'pct', value: 0.05 }], visual: { saturation: 12, lightness: 86 } },
    ],
  },
  {
    id: 'pattern', name: 'Muster', category: 'visual', description: 'Zeichnung des Fells. Schlicht ist rezessiv.',
    alleles: [
      { id: 'S', name: 'Gefleckt', symbol: 'S', dominance: 2, weight: 30, color: '#a1887f', modifiers: [], visual: { pattern: 'spots' } },
      { id: 'R', name: 'Gestreift', symbol: 'R', dominance: 2, weight: 30, color: '#8d6e63', modifiers: [], visual: { pattern: 'stripes' } },
      { id: 'O', name: 'Geringelt', symbol: 'O', dominance: 2, weight: 10, color: '#ce93d8', modifiers: [], visual: { pattern: 'rings' } },
      { id: 's', name: 'Schlicht', symbol: 's', dominance: 1, weight: 40, color: '#5d4037', modifiers: [], visual: { pattern: 'none' } },
    ],
  },
  {
    id: 'affinity', name: 'Element-Affinität', category: 'trait', description: 'Stärkt Element-Angriffe (Genom-Turm) und etwas den Angriff.',
    alleles: [
      { id: 'X', name: 'Affin', symbol: 'X', dominance: 1, weight: 30, color: '#9b6bff', modifiers: [
        { target: 'tower.elementDamage', op: 'pct', value: 0.25 },
        { target: 'stat.atk', op: 'pct', value: 0.05 },
      ] },
      { id: 'x', name: 'Normal', symbol: 'x', dominance: 1, weight: 70, color: '#4a4063', modifiers: [] },
    ],
  },
];

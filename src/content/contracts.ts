import type { ContractTemplateDef } from '@core/content/types';

/**
 * Gen-Aufträge: templates for the daily contract board. Open parameters
 * (which locus, which allele, which element) are rolled per offer from what
 * the player already knows (gene library, dex), so the pool stays varied.
 * Higher levels unlock with completed contracts (`balance.contracts`).
 */
export const contracts: ContractTemplateDef[] = [
  // Stufe 1 – ein sichtbares Merkmal
  {
    id: 'showPattern', name: 'Musterschau', client: 'Zirkus Farbenfroh', level: 1, weight: 3,
    requirements: [{ kind: 'expresses', category: 'visual' }],
    reward: { minutes: 10, resources: { essence: 15 } },
  },
  {
    id: 'strongOne', name: 'Kräftiger Helfer', client: 'Hof Grünwiese', level: 1, weight: 3,
    requirements: [{ kind: 'expresses', category: 'stat' }],
    reward: { minutes: 10, resources: { essence: 15 } },
  },
  {
    id: 'elementTrait', name: 'Elementarer Arbeiter', client: 'Gilde der Elementkundler', level: 1, weight: 2,
    requirements: [{ kind: 'element' }, { kind: 'expresses', category: 'trait' }],
    reward: { minutes: 15, resources: { essence: 20 } },
  },

  // Stufe 2 – reinerbig, auch rezessiv
  {
    id: 'purebred', name: 'Reinerbig gesucht', client: 'Zuchtverein Mendelhof', level: 2, weight: 3,
    requirements: [{ kind: 'genotype' }],
    reward: { minutes: 20, resources: { essence: 40 } },
  },
  {
    id: 'hiddenTrait', name: 'Verborgenes Erbe', client: 'Professorin Allel', level: 2, weight: 2,
    requirements: [{ kind: 'genotype', recessive: true }],
    reward: { minutes: 25, resources: { essence: 50, fragments: 10 } },
  },
  {
    id: 'elementPure', name: 'Reine Linie', client: 'Tierpark Nordheim', level: 2, weight: 2,
    requirements: [{ kind: 'element' }, { kind: 'genotype' }],
    reward: { minutes: 25, resources: { essence: 50 } },
  },

  // Stufe 3 – Hybride und Top-Allele
  {
    id: 'hybridOrder', name: 'Kreuzung auf Bestellung', client: 'Kuriositätenkabinett Kessel', level: 3, weight: 2,
    requires: { type: 'feature', feature: 'hybrids' },
    requirements: [{ kind: 'minTier', tier: 'hybrid' }, { kind: 'expresses', category: 'trait' }],
    reward: { minutes: 40, resources: { essence: 80, catalyst: 1, timeCrystals: 1 } },
  },
  {
    id: 'topTwo', name: 'Talentprobe', client: 'Arena Stahlring', level: 3, weight: 3,
    requirements: [{ kind: 'topLoci', count: 2, homozygous: false }, { kind: 'minGeneration', generation: 3 }],
    reward: { minutes: 40, resources: { essence: 80, timeCrystals: 1 }, alleleSamples: 1 },
  },
  {
    id: 'rareBreed', name: 'Seltenes Exemplar', client: 'Gräfin von Morgentau', level: 3, weight: 2,
    requirements: [{ kind: 'minRarity', rarity: 'rare' }, { kind: 'genotype' }],
    reward: { minutes: 40, resources: { essence: 80, fragments: 20, timeCrystals: 1 } },
  },

  // Stufe 4 – mehrere reinerbige Top-Allele
  {
    id: 'eliteLine', name: 'Eliteblut', client: 'Akademie der Genkunde', level: 4, weight: 3,
    requires: { type: 'prestigeCount', layer: 'inheritance', count: 1 },
    requirements: [{ kind: 'topLoci', count: 3, homozygous: true }],
    reward: { minutes: 90, resources: { essence: 200, fragments: 30, timeCrystals: 1 }, alleleSamples: 1 },
  },
  {
    id: 'rareHybrid', name: 'Meisterkreuzung', client: 'Kuriositätenkabinett Kessel', level: 4, weight: 2,
    requires: { type: 'prestigeCount', layer: 'inheritance', count: 1 },
    requirements: [{ kind: 'minTier', tier: 'rareHybrid' }, { kind: 'genotype' }],
    reward: { minutes: 90, resources: { essence: 200, catalyst: 2, timeCrystals: 1 } },
  },
  {
    id: 'epicPure', name: 'Turmrekrut', client: 'Wächter des Genom-Turms', level: 4, weight: 2,
    requires: { type: 'prestigeCount', layer: 'inheritance', count: 1 },
    requirements: [{ kind: 'minRarity', rarity: 'epic' }, { kind: 'element' }, { kind: 'topLoci', count: 2, homozygous: true }],
    reward: { minutes: 90, resources: { essence: 200, towerTokens: 20, timeCrystals: 1 } },
  },

  // Stufe 5 – Äon: fast perfekte Genome
  {
    id: 'masterwork', name: 'Meisterwerk', client: 'Der Zeitlose Sammler', level: 5, weight: 3,
    requires: { type: 'feature', feature: 'aeon' },
    requirements: [{ kind: 'topLoci', count: 4, homozygous: true }, { kind: 'minGeneration', generation: 8 }],
    reward: { minutes: 180, resources: { aeonShards: 1, essence: 400, timeCrystals: 2 } },
  },
  {
    id: 'mythicOrder', name: 'Mythische Bestellung', client: 'Der Zeitlose Sammler', level: 5, weight: 2,
    requires: { type: 'feature', feature: 'aeon' },
    requirements: [{ kind: 'minTier', tier: 'mythic' }, { kind: 'topLoci', count: 2, homozygous: true }],
    reward: { minutes: 180, resources: { aeonShards: 1, catalyst: 3, timeCrystals: 2 } },
  },
  {
    id: 'primalOrder', name: 'Urblut', client: 'Hüter der Urgene', level: 5, weight: 2,
    requires: { type: 'talent', talent: 'ancientGenes' },
    requirements: [{ kind: 'genotype', locus: 'primal', allele: 'U' }, { kind: 'topLoci', count: 3, homozygous: true }],
    reward: { minutes: 180, resources: { aeonShards: 2, timeCrystals: 2 }, alleleSamples: 1 },
  },
];

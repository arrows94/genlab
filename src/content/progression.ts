import type { AchievementDef, DexRewardDef, FeatureDef, PrestigeLayerDef } from '@core/content/types';

/**
 * Feature unlock order: Sammeln → Farm → Brutstation → Mine → Erkundung →
 * Bio-Labor → Infusion → Sequenzierung → Markt → Gen-Recycler → Hybride →
 * Prestige → Endgame. Features without `condition` are unlocked by upgrades,
 * dex milestones or later phases.
 */
export const features: FeatureDef[] = [
  { id: 'collect', name: 'Sammeln', tab: 'lab', hint: 'Klicke auf „Sammeln“, um Nahrung zu finden.', condition: { type: 'always' } },
  { id: 'farm', name: 'Farm', tab: 'facilities', hint: 'Die Farm ist offen! Schicke deine Kreatur zur Arbeit.', condition: { type: 'resourceEarned', resource: 'food', amount: 15 } },
  { id: 'research', name: 'Forschung', tab: 'research', hint: 'Forschung verfügbar – investiere Nahrung in Verbesserungen.', condition: { type: 'resourceEarned', resource: 'food', amount: 40 } },
  { id: 'breeding', name: 'Brutstation', tab: 'breeding', hint: 'Zwei Kreaturen können jetzt Nachwuchs bekommen.' },
  { id: 'mine', name: 'Mine', hint: 'Die Mine liefert Gold.' },
  { id: 'expedition', name: 'Erkundung', tab: 'expedition', hint: 'Schicke Kreaturen auf Erkundung.' },
  { id: 'biolab', name: 'Bio-Labor', hint: 'Im Bio-Labor entsteht Essenz.' },
  { id: 'infusion', name: 'Infusion', hint: 'Verstärke Kreaturen mit Artgenossen.' },
  { id: 'sequencing', name: 'Sequenzierlabor', hint: 'Entschlüssele Genome.' },
  { id: 'market', name: 'Markt', tab: 'market', hint: 'Der Markt verkauft Tränke.' },
  { id: 'recycler', name: 'Gen-Recycler', hint: 'Zerlege Kreaturen in Gen-Fragmente.' },
  { id: 'hybrids', name: 'Hybride', hint: 'Kreuzungen verschiedener Arten sind möglich.' },
  { id: 'dex', name: 'Monster-Dex', tab: 'dex', hint: 'Der Monster-Dex sammelt deine Entdeckungen.', condition: { type: 'creatureCount', count: 2 } },
  { id: 'legendaryHeritage', name: 'Legendäres Erbgut', hint: 'Legendäres Erbgut erforschbar.' },
  { id: 'primordialChamber', name: 'Ur-Gen-Kammer', hint: 'Die Ur-Gen-Kammer ist erwacht.' },
  { id: 'inheritance', name: 'Vererbung', tab: 'prestige', hint: 'Vererbung möglich: Tausche Fortschritt gegen dauerhaftes Erbgut.', condition: { type: 'resourceEarned', resource: 'gold', amount: 25_000 } },
  { id: 'stats', name: 'Statistik', tab: 'stats', hint: 'Statistiken freigeschaltet.', condition: { type: 'statistic', statistic: 'clicks', amount: 25 } },
];

export const dexRewards: DexRewardDef[] = [
  { id: 'dexCommon', rarity: 'common', modifiersPerEntry: [{ target: 'production.food', op: 'pct', value: 0.02 }] },
  { id: 'dexUncommon', rarity: 'uncommon', modifiersPerEntry: [{ target: 'production.food', op: 'pct', value: 0.03 }, { target: 'production.gold', op: 'pct', value: 0.03 }] },
  { id: 'dexRare', rarity: 'rare', modifiersPerEntry: [{ target: 'production.gold', op: 'pct', value: 0.05 }] },
  { id: 'dexEpic', rarity: 'epic', modifiersPerEntry: [{ target: 'stat.atk', op: 'pct', value: 0.03 }, { target: 'stat.hp', op: 'pct', value: 0.03 }] },
  {
    id: 'dexLegendary', rarity: 'legendary', modifiersPerEntry: [{ target: 'production.essence', op: 'pct', value: 0.1 }],
    unlocksFeatures: [{ count: 1, features: ['legendaryHeritage'] }],
  },
  {
    id: 'dexMythic', rarity: 'mythic', modifiersPerEntry: [{ target: 'breeding.mutation', op: 'add', value: 0.01 }],
    unlocksFeatures: [{ count: 1, features: ['primordialChamber'] }],
  },
];

export const achievements: AchievementDef[] = [
  { id: 'firstSteps', name: 'Erste Schritte', description: '50-mal gesammelt.', condition: { type: 'statistic', statistic: 'clicks', amount: 50 }, modifiers: [{ target: 'collect.food', op: 'pct', value: 0.1 }] },
  { id: 'pantry', name: 'Volle Speisekammer', description: '1.000 Nahrung verdient.', condition: { type: 'resourceEarned', resource: 'food', amount: 1000 }, modifiers: [{ target: 'production.food', op: 'pct', value: 0.05 }] },
  { id: 'goldDigger', name: 'Goldgräber', description: '1.000 Gold verdient.', condition: { type: 'resourceEarned', resource: 'gold', amount: 1000 }, modifiers: [{ target: 'production.gold', op: 'pct', value: 0.05 }] },
  { id: 'firstHeir', name: 'Erbe angetreten', description: 'Erste Vererbung abgeschlossen.', condition: { type: 'prestigeCount', layer: 'inheritance', count: 1 }, modifiers: [{ target: 'offline.capHours', op: 'add', value: 1 }] },
];

export const prestigeLayers: PrestigeLayerDef[] = [
  {
    id: 'inheritance', name: 'Vererbung', currency: 'heritage', feature: 'inheritance',
    description: 'Setzt Kreaturen, Nahrung, Gold und laufende Vorgänge zurück. Forschung, Dex und Essenz bleiben.',
    gainFrom: ['food', 'gold'],
    modifiersPerPoint: [
      { target: 'production.food', op: 'pct', value: 0.02 },
      { target: 'production.gold', op: 'pct', value: 0.02 },
    ],
    resets: { resources: ['food', 'gold'], creatures: true, processes: true, buffs: true, upgradeCategories: [], dex: false, features: false },
  },
];

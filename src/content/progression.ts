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
  {
    id: 'breeding', name: 'Brutstation', tab: 'breeding', hint: 'Ein Sprössling ist zugelaufen! In der Brutstation können zwei Kreaturen Nachwuchs bekommen.',
    condition: { type: 'resourceEarned', resource: 'food', amount: 450 },
    grantsCreature: { species: 'sproutle', rarity: 'common' },
  },
  { id: 'mine', name: 'Mine', hint: 'Die Mine ist offen – Angriff bringt Gold.' },
  { id: 'expedition', name: 'Erkundung', tab: 'expedition', hint: 'Schicke Kreaturen auf Erkundung – vielleicht findest du wilde Artgenossen.', condition: { type: 'resourceEarned', resource: 'gold', amount: 40 } },
  { id: 'biolab', name: 'Bio-Labor', hint: 'Im Bio-Labor entsteht Essenz. Tempo erhöht den Ertrag.' },
  {
    id: 'infusion', name: 'Infusion', hint: 'Infusion freigeschaltet: Eine Kreatur kann Artgenossen aufnehmen und wird stärker (Detailansicht öffnen).',
    condition: { type: 'all', of: [{ type: 'feature', feature: 'biolab' }, { type: 'creatureCount', count: 12 }] },
  },
  { id: 'sequencing', name: 'Sequenzierlabor', tab: 'genetics', hint: 'Das Sequenzierlabor ist bereit: Entschlüssele Genome mit Essenz und plane gezielte Zuchten.', condition: { type: 'resourceEarned', resource: 'essence', amount: 5 } },
  { id: 'splicing', name: 'Gen-Splicing', hint: 'Gen-Splicing möglich: Übertrage Allele aus der Genbibliothek – mit Risiko.' },
  { id: 'market', name: 'Markt', tab: 'market', hint: 'Der Markt hat geöffnet: Tränke für deine Kreaturen.', condition: { type: 'resourceEarned', resource: 'essence', amount: 25 } },
  {
    id: 'recycler', name: 'Gen-Recycler', tab: 'recycler', hint: 'Der Gen-Recycler zerlegt überzählige Kreaturen in Fragmente – und aus Fragmenten werden Gen-Kapseln.',
    condition: { type: 'all', of: [{ type: 'feature', feature: 'market' }, { type: 'statistic', statistic: 'sold', amount: 10 }, { type: 'resourceEarned', resource: 'essence', amount: 60 }] },
  },
  { id: 'autoAssign', name: 'Arbeitsplaner', hint: 'Der Arbeitsplaner verteilt Kreaturen automatisch auf die Anlagen.' },
  { id: 'autoBreed', name: 'Zuchtautomat', hint: 'Der Zuchtautomat brütet nach deinen Regeln weiter.' },
  {
    id: 'hybrids', name: 'Hybride', hint: 'Hybride entdeckt! Bestimmte Artkombinationen können neue Arten hervorbringen. Hinweise gibt es durch Forschung und Erkundung.',
    condition: { type: 'all', of: [{ type: 'feature', feature: 'recycler' }, { type: 'statistic', statistic: 'hatched', amount: 45 }, { type: 'resourceEarned', resource: 'essence', amount: 130 }] },
  },
  { id: 'evolution', name: 'Evolution', hint: 'Ein Evolutionskristall! Manche Arten können sich damit weiterentwickeln.', condition: { type: 'resourceEarned', resource: 'catalyst', amount: 1 } },
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
  { id: 'firstEgg', name: 'Nestwärme', description: 'Erstes Ei ausgebrütet.', condition: { type: 'statistic', statistic: 'hatched', amount: 1 }, modifiers: [{ target: 'breeding.time', op: 'mult', value: 0.95 }] },
  { id: 'breeder', name: 'Züchter', description: '25 Kreaturen ausgebrütet.', condition: { type: 'statistic', statistic: 'hatched', amount: 25 }, modifiers: [{ target: 'breeding.mutation', op: 'add', value: 0.01 }] },
  { id: 'explorer', name: 'Entdecker', description: '10 Erkundungen abgeschlossen.', condition: { type: 'statistic', statistic: 'completed.mission', amount: 10 }, modifiers: [{ target: 'mission.reward', op: 'pct', value: 0.1 }] },
  { id: 'collector', name: 'Sammler', description: '10 Dex-Einträge.', condition: { type: 'dex', count: 10 }, modifiers: [{ target: 'rarity.weight.rare', op: 'pct', value: 0.1 }] },
  { id: 'firstSequence', name: 'Entschlüsselt', description: 'Erstes Genom sequenziert.', condition: { type: 'statistic', statistic: 'sequenced', amount: 1 }, modifiers: [{ target: 'sequencing.time', op: 'mult', value: 0.9 }] },
  { id: 'librarian', name: 'Bibliothekar', description: '12 Allele katalogisiert.', condition: { type: 'geneLibrary', count: 12 }, modifiers: [{ target: 'breeding.mutation', op: 'add', value: 0.01 }] },
  { id: 'archivist', name: 'Archivar', description: '20 Allele katalogisiert.', condition: { type: 'geneLibrary', count: 20 }, modifiers: [{ target: 'cost.sequencing', op: 'pct', value: -0.2 }] },
  { id: 'completeLibrary', name: 'Lebendes Archiv', description: 'Alle Allele katalogisiert.', condition: { type: 'geneLibrary', count: 26 }, modifiers: [{ target: 'splicing.instability', op: 'add', value: -0.05 }] },
  { id: 'firstHybrid', name: 'Kreuzung geglückt', description: 'Einen Hybriden entdeckt.', condition: { type: 'any', of: [
    { type: 'dex', species: 'steamling' }, { type: 'dex', species: 'magmole' }, { type: 'dex', species: 'stormhawk' }, { type: 'dex', species: 'mossgolem' },
    { type: 'dex', species: 'glacierfin' }, { type: 'dex', species: 'duskmoth' }, { type: 'dex', species: 'rustling' }, { type: 'dex', species: 'venomvine' },
    { type: 'dex', species: 'geodite' }, { type: 'dex', species: 'voltprism' },
  ] }, modifiers: [{ target: 'breeding.hybridChance', op: 'pct', value: 0.1 }] },
  { id: 'allElements', name: 'Elementarist', description: 'Alle zwölf Basisarten entdeckt.', condition: { type: 'all', of: [
    'emberpup', 'bubbloon', 'pebblit', 'zephyrix', 'voltmouse', 'sproutle', 'frostling', 'umbrat', 'lumifly', 'ferrox', 'toxling', 'prismin',
  ].map((species) => ({ type: 'dex' as const, species })) }, modifiers: [{ target: 'mission.wildChance', op: 'add', value: 0.05 }] },
  { id: 'firstEvolution', name: 'Metamorphose', description: 'Erste Evolution.', condition: { type: 'statistic', statistic: 'evolved', amount: 1 }, modifiers: [{ target: 'stat.hp', op: 'pct', value: 0.05 }] },
  { id: 'mythicForm', name: 'Mythos', description: 'Eine mythische Endform erreicht.', condition: { type: 'any', of: ['phoenix', 'leviathan', 'worldtree', 'chronodrake'].map((species) => ({ type: 'dex' as const, species })) }, modifiers: [{ target: 'production.essence', op: 'pct', value: 0.25 }] },
  { id: 'trader', name: 'Händler', description: '50 Kreaturen verkauft.', condition: { type: 'statistic', statistic: 'sold', amount: 50 }, modifiers: [{ target: 'creature.sellValue', op: 'pct', value: 0.1 }] },
  { id: 'fullyInfused', name: 'Vollendet', description: 'Eine Kreatur auf Infusionsstufe +10 gebracht.', condition: { type: 'statistic', statistic: 'record.infusion', amount: 10 }, modifiers: [{ target: 'infusion.ep', op: 'pct', value: 0.1 }] },
  { id: 'breakthrough', name: 'Durchbruch', description: 'Eine Seltenheit per Durchbruch erhöht.', condition: { type: 'statistic', statistic: 'breakthroughs', amount: 1 }, modifiers: [{ target: 'stat.atk', op: 'pct', value: 0.05 }] },
  { id: 'capsuleCollector', name: 'Kapselsammler', description: '50 Gen-Kapseln geöffnet.', condition: { type: 'statistic', statistic: 'capsulesOpened', amount: 50 }, modifiers: [{ target: 'capsule.fragmentYield', op: 'pct', value: 0.1 }] },
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

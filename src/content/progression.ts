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
  { id: 'sequencing', name: 'Sequenzierlabor', tab: 'genetics', hint: 'Das Sequenzierlabor ist bereit: Entschlüssele Genome mit Essenz und plane gezielte Zuchten.', condition: { type: 'all', of: [{ type: 'feature', feature: 'biolab' }, { type: 'resourceEarned', resource: 'essence', amount: 5 }] } },
  {
    id: 'daily', name: 'Tagesbelohnung', hint: 'Tagesbelohnung: Hol dir jeden Tag im Labor ein Geschenk ab. Eine Pause kostet nichts – der Kalender wartet auf dich.',
    condition: { type: 'feature', feature: 'breeding' },
  },
  {
    id: 'contracts', name: 'Gen-Aufträge', tab: 'contracts', hint: 'Gen-Aufträge: Züchter suchen Kreaturen mit bestimmten Genen. Jeden Tag gibt es neue Aufträge.',
    condition: { type: 'statistic', statistic: 'sequenced', amount: 1 },
  },
  { id: 'splicing', name: 'Gen-Splicing', hint: 'Gen-Splicing möglich: Übertrage Allele aus der Genbibliothek – mit Risiko.' },
  { id: 'market', name: 'Markt', tab: 'market', hint: 'Der Markt hat geöffnet: Tränke für deine Kreaturen.', condition: { type: 'resourceEarned', resource: 'essence', amount: 30 } },
  {
    id: 'recycler', name: 'Gen-Recycler', tab: 'recycler', hint: 'Der Gen-Recycler zerlegt überzählige Kreaturen in Fragmente – und aus Fragmenten werden Gen-Kapseln.',
    condition: { type: 'all', of: [{ type: 'feature', feature: 'market' }, { type: 'statistic', statistic: 'sold', amount: 10 }, { type: 'resourceEarned', resource: 'essence', amount: 60 }] },
  },
  { id: 'autoAssign', name: 'Arbeitsplaner', hint: 'Der Arbeitsplaner verteilt Kreaturen automatisch auf die Anlagen.' },
  { id: 'autoSequence', name: 'Sequenzier-Roboter', hint: 'Der Sequenzier-Roboter ist bereit: Im Genlabor einschalten, dann entschlüsselt er neue Genome von selbst.' },
  { id: 'autoBreed', name: 'Zuchtautomat', hint: 'Der Zuchtautomat brütet nach deinen Regeln weiter – in seinem eigenen Automatennest, etwas gemächlicher als du von Hand.' },
  { id: 'nestKeeper', name: 'Nestwärter', hint: 'Nestwärter: In der Brutstation kannst du eine Kreatur an die Nester setzen. Ihre Brut-Fähigkeiten wie Brutpfleger oder Mutagen gelten dann für jedes Ei.' },
  { id: 'abilityElixir', name: 'Fähigkeits-Elixier', hint: 'Fähigkeits-Elixier: Im Markt stärkst du jetzt eine Fähigkeit einer Kreatur um eine Stufe. Dafür brauchst du seltenes Keimöl – aus Brutritualen, Gen-Aufträgen ab 4★ und Wochenexpeditionen.' },
  { id: 'breedRepeat', name: 'Zuchtbuch', hint: 'Zuchtbuch: In der Brutstation wählt der Knopf ↻ zwischen den Eltern dein letztes Paar wieder aus.' },
  { id: 'breedSplit', name: 'Zwei Zuchtlisten', hint: 'Zwei Zuchtlisten: In der Brutstation hat jetzt jedes Elternteil seine eigene Kandidatenliste. Unter Optionen lässt sich wieder eine Liste einstellen.' },
  { id: 'autoRecycle', name: 'Recycling-Automat', hint: 'Der Recycling-Automat zerlegt überzählige Kreaturen nach deinen Regeln (Gen-Recycler).' },
  {
    id: 'hybrids', name: 'Hybride', hint: 'Hybride entdeckt! Bestimmte Artkombinationen können neue Arten hervorbringen. Hinweise gibt es durch Forschung und Erkundung.',
    condition: { type: 'all', of: [{ type: 'feature', feature: 'recycler' }, { type: 'statistic', statistic: 'hatched', amount: 45 }, { type: 'resourceEarned', resource: 'essence', amount: 130 }] },
  },
  { id: 'evolution', name: 'Evolution', hint: 'Ein Evolutionskristall! Manche Arten können sich damit weiterentwickeln.', condition: { type: 'resourceEarned', resource: 'catalyst', amount: 1 } },
  { id: 'dex', name: 'Monster-Dex', tab: 'dex', hint: 'Der Monster-Dex sammelt deine Entdeckungen.', condition: { type: 'creatureCount', count: 2 } },
  { id: 'legendaryHeritage', name: 'Legendäres Erbgut', hint: 'Legendäres Erbgut erforschbar.' },
  { id: 'primordialChamber', name: 'Ur-Gen-Kammer', hint: 'Die Ur-Gen-Kammer ist erwacht.' },
  { id: 'inheritance', name: 'Vererbung', tab: 'prestige', hint: 'Vererbung möglich: Tausche Fortschritt gegen dauerhaftes Erbgut.', condition: { type: 'resourceEarned', resource: 'gold', amount: 25_000 } },
  { id: 'tower', name: 'Genom-Turm', tab: 'tower', hint: 'Der Genom-Turm erhebt sich! Stelle ein Team zusammen und kämpfe Etage für Etage.', condition: { type: 'prestigeCount', layer: 'inheritance', count: 1 } },
  { id: 'towerAuto', name: 'Turm-Routine', hint: 'Dein Team startet nach einer Niederlage automatisch neu.' },
  { id: 'infiniteResearch', name: 'Unendliche Forschung', hint: 'Unendliche Forschung verfügbar – ohne Obergrenze, mit abnehmendem Ertrag.', condition: { type: 'prestigeCount', layer: 'inheritance', count: 1 } },
  { id: 'weekly', name: 'Wochen-Mutation', hint: 'Jede Woche verändert eine Mutation die Regeln. Schau oben in die Leiste!', condition: { type: 'prestigeCount', layer: 'inheritance', count: 1 } },
  {
    id: 'weeklyBoss', name: 'Wochen-Boss', hint: 'Ein Wochen-Boss erscheint im Genom-Turm! Greife ihn jeden Tag an – der Schaden sammelt sich über die ganze Woche.',
    condition: { type: 'towerFloor', floor: 30 },
  },
  {
    id: 'grandResearch', name: 'Großforschung', hint: 'Großforschung: Im Forschungs-Tab laufen jetzt Projekte über Stunden und Tage – mit großen Boni, die jede Vererbung überdauern.',
    condition: { type: 'prestigeCount', layer: 'inheritance', count: 1 },
  },
  {
    id: 'deepSequencing', name: 'Tiefensequenzierung', hint: 'Tiefensequenzierung: Manche Kreaturen tragen eine verborgene Erbanlage. Das Genlabor kann sie in acht Stunden aufdecken – und damit wecken.',
    condition: { type: 'all', of: [{ type: 'feature', feature: 'sequencing' }, { type: 'prestigeCount', layer: 'inheritance', count: 1 }] },
  },
  {
    id: 'dynasties', name: 'Stammbaum-Dynastien', hint: 'Stammbaum-Dynastien: Züchte reine Linien – beide Eltern und das Kind von derselben Art. Jede Generation in Folge macht die Linie stärker, und der Rekord jeder Art bleibt für immer (Brutstation).',
  },
  {
    id: 'specialBreeding', name: 'Besondere Brut', hint: 'Besondere Brut: Rituale in der Brutstation dauern Stunden, bringen aber seltenere Nachkommen und mehr Hybride.',
    condition: { type: 'prestigeCount', layer: 'inheritance', count: 1 },
  },
  {
    id: 'voyage', name: 'Wochenexpedition', hint: 'Wochenexpedition möglich: Schicke ein Team für sieben Tage auf große Fahrt (Erkundung).',
    condition: { type: 'prestigeCount', layer: 'inheritance', count: 2 },
  },
  { id: 'anomalies', name: 'Anomalien', tab: 'anomalies', hint: 'Anomalien entdeckt: Durchläufe mit besonderen Regeln und dauerhaften Belohnungen.', condition: { type: 'prestigeCount', layer: 'inheritance', count: 2 } },
  {
    id: 'aeon', name: 'Äon', tab: 'aeon', hint: 'Das Äon ruft: Ein tieferer Neustart für Äon-Splitter und einen eigenen Talentbaum.',
    condition: { type: 'all', of: [{ type: 'prestigeCount', layer: 'inheritance', count: 3 }, { type: 'towerFloor', floor: 45 }] },
  },
  {
    id: 'megaProjects', name: 'Großprojekte', hint: 'Großprojekt: Im Äon-Tab wartet das Äon-Observatorium. Zahle über mehrere Tage ein – es öffnet neue Stufen im Talentbaum. Einzahlungen gehen bei keinem Neustart verloren.',
    condition: { type: 'feature', feature: 'aeon' },
  },
  // GenLab RPG: a tower monster clears the first dungeon from about floor 20 on (tests/rpgBot.ts). The record
  // survives an Äon, so the RPG comes back at once.
  {
    id: 'rpg', name: 'GenLab RPG', tab: 'rpg', hint: 'GenLab RPG: Schicke ein einzelnes Monster in den Dungeon (Abenteuer) – rundenbasiert, du wählst jeden Zug. Jeder Lauf kostet eine Fackel 🔥.',
    condition: { type: 'towerFloor', floor: 20 },
  },
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
  { id: 'contractor', name: 'Auftragszüchter', description: '10 Gen-Aufträge erfüllt.', condition: { type: 'statistic', statistic: 'contracts', amount: 10 }, modifiers: [{ target: 'contracts.reward', op: 'pct', value: 0.1 }] },
  { id: 'geneBroker', name: 'Genmakler', description: '50 Gen-Aufträge erfüllt.', condition: { type: 'statistic', statistic: 'contracts', amount: 50 }, modifiers: [{ target: 'contracts.reward', op: 'pct', value: 0.25 }] },
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
  // Ids keep the floor numbers from before the finer floors (×3) – saves refer to them.
  { id: 'tower10', name: 'Turmläufer', description: 'Etage 30 im Genom-Turm.', condition: { type: 'towerFloor', floor: 30 }, modifiers: [{ target: 'tower.damage', op: 'pct', value: 0.05 }] },
  { id: 'tower50', name: 'Turmstürmer', description: 'Etage 150 im Genom-Turm.', condition: { type: 'towerFloor', floor: 150 }, modifiers: [{ target: 'tower.damage', op: 'pct', value: 0.1 }] },
  { id: 'tower100', name: 'Turmspitze?', description: 'Etage 300 im Genom-Turm.', condition: { type: 'towerFloor', floor: 300 }, modifiers: [{ target: 'stat.atk', op: 'pct', value: 0.1 }] },
  { id: 'perfectGenome', name: 'Makellos', description: 'Ein perfektes Genom entdeckt.', condition: { type: 'statistic', statistic: 'perfectGenomes', amount: 1 }, modifiers: [{ target: 'breeding.mutation', op: 'add', value: 0.01 }] },
  { id: 'shinyFound', name: 'Schillernd!', description: 'Eine schillernde Kreatur gefunden.', condition: { type: 'statistic', statistic: 'shinies', amount: 1 }, modifiers: [{ target: 'creature.shinyChance', op: 'pct', value: 0.25 }] },
  // Perfection hunt: both statistics count species (the first perfect / shiny one of each), 33 at most.
  { id: 'perfectGenome5', name: 'Feinschliff', description: 'Perfekte Genome von 5 Arten.', condition: { type: 'statistic', statistic: 'perfectGenomes', amount: 5 }, modifiers: [{ target: 'breeding.mutation', op: 'add', value: 0.01 }] },
  { id: 'perfectGenome15', name: 'Genmeister', description: 'Perfekte Genome von 15 Arten.', condition: { type: 'statistic', statistic: 'perfectGenomes', amount: 15 }, modifiers: [{ target: 'splicing.instability', op: 'add', value: -0.03 }] },
  { id: 'perfectGenomeAll', name: 'Vollkommenheit', description: 'Perfekte Genome aller 33 Arten.', condition: { type: 'statistic', statistic: 'perfectGenomes', amount: 33 }, modifiers: [{ target: 'production.essence', op: 'pct', value: 0.5 }] },
  { id: 'shiny3', name: 'Glanzsammler', description: 'Schillernde Kreaturen von 3 Arten.', condition: { type: 'statistic', statistic: 'shinies', amount: 3 }, modifiers: [{ target: 'creature.shinyChance', op: 'pct', value: 0.25 }] },
  { id: 'shiny10', name: 'Schimmerzucht', description: 'Schillernde Kreaturen von 10 Arten.', condition: { type: 'statistic', statistic: 'shinies', amount: 10 }, modifiers: [{ target: 'creature.shinyChance', op: 'pct', value: 0.5 }] },
  { id: 'shinyAll', name: 'Regenbogenchronik', description: 'Schillernde Kreaturen aller 33 Arten.', condition: { type: 'statistic', statistic: 'shinies', amount: 33 }, modifiers: [
    { target: 'stat.hp', op: 'pct', value: 0.05 }, { target: 'stat.atk', op: 'pct', value: 0.05 }, { target: 'stat.def', op: 'pct', value: 0.05 }, { target: 'stat.spd', op: 'pct', value: 0.05 },
  ] },
  { id: 'anomalist', name: 'Anomalist', description: 'Alle Anomalien gemeistert.', condition: { type: 'all', of: [
    { type: 'anomaly', anomaly: 'broodFever' }, { type: 'anomaly', anomaly: 'ascetic' }, { type: 'anomaly', anomaly: 'famine' }, { type: 'anomaly', anomaly: 'cramped' },
  ] }, modifiers: [{ target: 'prestige.inheritance.gain', op: 'pct', value: 0.25 }] },
  { id: 'firstAeon', name: 'Zeitenwende', description: 'Erstes Äon abgeschlossen.', condition: { type: 'prestigeCount', layer: 'aeon', count: 1 }, modifiers: [{ target: 'offline.capHours', op: 'add', value: 4 }] },
  { id: 'firstHeir', name: 'Erbe angetreten', description: 'Erste Vererbung abgeschlossen.', condition: { type: 'prestigeCount', layer: 'inheritance', count: 1 }, modifiers: [{ target: 'offline.capHours', op: 'add', value: 1 }] },
];

export const prestigeLayers: PrestigeLayerDef[] = [
  {
    id: 'inheritance', name: 'Vererbung', currency: 'heritage', feature: 'inheritance',
    description: 'Setzt Kreaturen, Nahrung, Gold und laufende Vorgänge zurück. Forschung, Dex und Essenz bleiben.',
    gainFrom: ['food', 'gold'],
    modifiersPerPoint: [
      { target: 'production.food', op: 'pct', value: 0.1 },
      { target: 'production.gold', op: 'pct', value: 0.1 },
      { target: 'production.essence', op: 'pct', value: 0.05 },
    ],
    resets: { resources: ['food', 'gold'], creatures: true, processes: true, buffs: true, upgradeCategories: [], dex: false, features: false },
  },
  {
    id: 'aeon', name: 'Äon', currency: 'aeonShards', feature: 'aeon', gainSource: 'owned',
    description: 'Setzt zusätzlich Forschung, Erbgut, Essenz, Kristalle und Fragmente zurück. Dex, Genbibliothek, Talente, Turm-Rekorde und Anomalie-Belohnungen bleiben.',
    gainFrom: ['heritage'],
    modifiersPerPoint: [],
    resets: {
      resources: ['food', 'gold', 'essence', 'catalyst', 'fragments', 'heritage'],
      creatures: true, processes: true, buffs: true, upgradeCategories: ['research', 'infinite'], dex: false, features: true,
    },
  },
];

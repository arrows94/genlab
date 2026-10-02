import type { VoyageDecisionDef, VoyageDestinationDef, VoyageEventDef } from '@core/content/types';

/**
 * Wochenexpedition: a 7-day voyage with a team of up to three creatures.
 * The destination changes every week and follows the element of the weekly
 * mutation when it has one (Eiszeit → an ice destination). Events on the way
 * change the loot; at the return the player makes one decision.
 */
export const voyageDestinations: VoyageDestinationDef[] = [
  {
    id: 'glacierSea', name: 'Gletschermeer', icon: '🧊', element: 'ice',
    description: 'Treibende Eisberge und Höhlen voller blauem Licht.',
    species: ['frostling', 'bubbloon', 'glacierfin', 'aurorafin'],
    rewards: { essence: [300, 700], catalyst: [4, 8], fragments: [60, 150] },
  },
  {
    id: 'emberWastes', name: 'Glutödnis', icon: '🌋', element: 'fire',
    description: 'Glühende Ebenen, in denen die Erde atmet.',
    species: ['emberpup', 'magmole', 'pebblit', 'volcanodrake'],
    rewards: { gold: [6000, 15000], catalyst: [5, 10], essence: [200, 500] },
  },
  {
    id: 'skyArchipelago', name: 'Himmelsinseln', icon: '🏝️', element: 'air',
    description: 'Schwebende Inseln, verbunden durch Blitze und Wind.',
    species: ['zephyrix', 'voltmouse', 'stormhawk', 'tempestlord'],
    rewards: { gold: [5000, 12000], essence: [250, 600], fragments: [40, 100] },
  },
  {
    id: 'verdantDeep', name: 'Tiefes Grün', icon: '🌿', element: 'nature',
    description: 'Ein Urwald, so alt wie die ersten Gene.',
    species: ['sproutle', 'pebblit', 'mossgolem', 'ancientgrove'],
    rewards: { essence: [350, 800], fragments: [60, 140], catalyst: [3, 6] },
  },
  {
    id: 'twilightMarsh', name: 'Dämmersumpf', icon: '🌒', element: 'shadow',
    description: 'Nebel, Gift und Schatten – und seltene Gene.',
    species: ['umbrat', 'toxling', 'duskmoth', 'venomvine', 'eclipsewing'],
    rewards: { essence: [300, 700], catalyst: [4, 9], fragments: [50, 120] },
  },
  {
    id: 'prismSpire', name: 'Prismenturm', icon: '🔮', element: 'crystal',
    description: 'Eine Spitze aus reinem Kristall, die Licht in Gene bricht.',
    species: ['prismin', 'lumifly', 'geodite', 'prismgolem'],
    rewards: { catalyst: [6, 12], fragments: [80, 180], gold: [4000, 10000] },
  },
];

export const voyageEvents: VoyageEventDef[] = [
  { id: 'storm', text: 'Ein Unwetter zwingt das Team, einen Tag in einer Höhle auszuharren.', weight: 3, effect: { lootPct: -0.1 } },
  { id: 'cache', text: 'Ein vergessenes Vorratslager! Das Team packt ein, was es tragen kann.', weight: 3, effect: { lootPct: 0.2 } },
  { id: 'shortcut', text: 'Ein Wildwechsel führt als Abkürzung durch unberührtes Land.', weight: 3, effect: { lootPct: 0.1 } },
  { id: 'predator', text: 'Ein Raubtier verfolgt das Team – ein Teil der Beute bleibt zurück.', weight: 2, effect: { lootPct: -0.15 } },
  { id: 'crystalVein', text: 'An einer Felswand glitzert eine Kristallader.', weight: 2, effect: { resources: { catalyst: 2 } } },
  { id: 'ruins', text: 'Alte Ruinen mit Zeichnungen seltsamer Kreuzungen.', weight: 2, effect: { hint: true } },
  { id: 'geneSpring', text: 'Eine Quelle, deren Wasser nach Genen schmeckt. Das Team nimmt Proben.', weight: 2, effect: { alleleSamples: 1 } },
  { id: 'nomads', text: 'Wandernde Züchter tauschen Essenz gegen Geschichten.', weight: 2, effect: { resources: { essence: 150 } } },
  { id: 'lost', text: 'Das Team verläuft sich im Nebel und findet erst spät den Weg zurück.', weight: 2, effect: { lootPct: -0.05 } },
  { id: 'feast', text: 'Eine reiche Ernte am Wegesrand – alle sind satt und guter Dinge.', weight: 2, effect: { lootPct: 0.05, resources: { food: 5000 } } },
  { id: 'campfire', text: 'Am Lagerfeuer erzählt sich das Team Geschichten von den ersten Züchtern.', weight: 2, effect: {} },
  { id: 'fieldLab', text: 'Ein verlassenes Feldlabor, die Petrischalen längst vertrocknet. Ein paar Notizen sind noch lesbar.', weight: 1, effect: { hint: true } },
  { id: 'tracks', text: 'Fremde Spuren im Schlamm – größer als die jeder bekannten Art. Das Team folgt ihnen lieber nicht.', weight: 2, effect: {} },
  { id: 'starNight', text: 'Eine klare Nacht. Die Sterne stehen so, wie sie auf alten Brutkalendern eingezeichnet sind.', weight: 2, effect: {} },
  { id: 'brokenBridge', text: 'Eine Hängebrücke ist eingestürzt. Der Umweg kostet Zeit und Proviant.', weight: 2, effect: { lootPct: -0.05 } },
  { id: 'caravan', text: 'Eine Karawane fahrender Händler. Für ein paar Lieder gibt es eine Handvoll Gold.', weight: 2, effect: { resources: { gold: 2000 } } },
  { id: 'molting', text: 'Ein Teammitglied häutet sich über Nacht. Die alte Haut steckt voller Genfragmente.', weight: 2, effect: { resources: { fragments: 30 } } },
  { id: 'lullaby', text: 'Aus einem hohlen Baum summt etwas eine Melodie, die alle Kreaturen schläfrig macht.', weight: 1, effect: {} },
  { id: 'germSpring', text: 'Aus einer Felsspalte perlt ein öliger Keimsaft. Das Team füllt vorsichtig eine Phiole ab.', weight: 1, effect: { resources: { germOil: 1 } } },
  { id: 'oldBreeder', text: 'Ein alter Züchter erkennt die Linie eines Teammitglieds wieder und erzählt von dessen Urahnen.', weight: 1, effect: {} },

  // Only on the way to one destination.
  { id: 'frozenEgg', destinations: ['glacierSea'], text: 'Im Eis eingeschlossen liegt ein Ei, älter als jede Aufzeichnung. Es lässt sich nicht befreien.', weight: 2, effect: {} },
  { id: 'aurora', destinations: ['glacierSea'], text: 'Polarlichter über dem Gletschermeer. Die Eis-Kreaturen leuchten mit ihnen um die Wette.', weight: 2, effect: { lootPct: 0.05 } },
  { id: 'ashRain', destinations: ['emberWastes'], text: 'Ascheregen. Das Team wickelt sich in nasse Tücher und wartet ab.', weight: 2, effect: { lootPct: -0.05 } },
  { id: 'obsidian', destinations: ['emberWastes'], text: 'Ein Feld aus Obsidian, glatt wie ein Spiegel. Darunter glimmen Kristalle in der Glut.', weight: 2, effect: { resources: { catalyst: 2 } } },
  { id: 'windRiver', destinations: ['skyArchipelago'], text: 'Ein Windstrom trägt das Team von Insel zu Insel – schneller als jeder Weg zu Fuß.', weight: 2, effect: { lootPct: 0.1 } },
  { id: 'stormNest', destinations: ['skyArchipelago'], text: 'Ein Nest auf einer Blitzklippe. Wer hier brütet, hat keine Angst vor Gewittern.', weight: 2, effect: {} },
  { id: 'ancientRoots', destinations: ['verdantDeep'], text: 'Wurzeln so dick wie Häuser. In ihren Ringen steht die Geschichte der ersten Gene.', weight: 2, effect: { alleleSamples: 1 } },
  { id: 'spores', destinations: ['verdantDeep'], text: 'Eine Sporenwolke lässt alle niesen. Danach ist der Pfad kaum wiederzufinden.', weight: 2, effect: { lootPct: -0.05 } },
  { id: 'wisps', destinations: ['twilightMarsh'], text: 'Irrlichter locken vom Pfad. Das Team bindet sich mit Seilen aneinander.', weight: 2, effect: { lootPct: -0.05 } },
  { id: 'stiltHut', destinations: ['twilightMarsh'], text: 'Eine Hütte auf Stelzen. Wer dort wohnt, hat einen Korb mit Essenz vor die Tür gestellt.', weight: 2, effect: { resources: { essence: 200 } } },
  { id: 'refraction', destinations: ['prismSpire'], text: 'Im Prismenturm bricht sich das Licht in hundert Farben – jede Farbe ein anderes Gen.', weight: 2, effect: { resources: { fragments: 40 } } },
  { id: 'echoHall', destinations: ['prismSpire'], text: 'Eine Halle, in der jedes Geräusch siebenfach zurückkommt. Das Team schweigt den ganzen Tag.', weight: 2, effect: {} },
];

export const voyageDecisions: VoyageDecisionDef[] = [
  {
    id: 'injuredBeast', weight: 3,
    text: 'Ein verletztes Wildtier ist dem Team gefolgt. Seine Pflege würde einen Teil der Beute kosten.',
    options: [
      { label: 'Mitnehmen', description: 'Eine Kreatur des Ziels (mindestens Episch) schließt sich an, dafür bleibt ein Drittel der Beute zurück.', lootFactor: 0.65, creature: { minRarity: 'epic' } },
      { label: 'Beute behalten', description: 'Die ganze Beute kommt mit.', lootFactor: 1 },
    ],
  },
  {
    id: 'strangeEgg', weight: 2,
    text: 'Im Gepäck liegt ein fremdes, schimmerndes Ei. Ein Händler bietet viel Essenz dafür.',
    options: [
      { label: 'Ausbrüten', description: 'Eine seltene Kreatur (mindestens Selten) des Ziels schlüpft.', lootFactor: 1, creature: { minRarity: 'rare' } },
      { label: 'Verkaufen', description: '+600 Essenz zusätzlich zur Beute.', lootFactor: 1, resources: { essence: 600 } },
    ],
  },
  {
    id: 'oldMap', weight: 2,
    text: 'Das Team hat eine alte Karte gefunden. Ein Sammler würde sie sofort kaufen.',
    options: [
      { label: 'Karte behalten', description: 'Die nächste Wochenexpedition bringt +50 % Beute.', lootFactor: 1, nextBonus: 0.5 },
      { label: 'Verkaufen', description: '+4 Evolutionskristalle sofort.', lootFactor: 1, resources: { catalyst: 4 } },
    ],
  },
  {
    id: 'mentor', weight: 2,
    text: 'Eine alte Kräuterkundige bietet dem Team eine Woche Unterricht an – gegen einen Teil der Beute.',
    options: [
      { label: 'Unterricht nehmen', description: 'Jedes Teammitglied bekommt dauerhaft +5 % auf alle Werte, dafür bleibt ein Viertel der Beute zurück.', lootFactor: 0.75, teamBoost: 0.05 },
      { label: 'Ablehnen', description: 'Die ganze Beute kommt mit.', lootFactor: 1 },
    ],
  },
];

import type { ResourceDef } from '@core/content/types';

export const resources: ResourceDef[] = [
  { id: 'food', name: 'Nahrung', icon: '🍖', color: '#8fd16a' },
  { id: 'gold', name: 'Gold', icon: '🪙', color: '#f2c14e', feature: 'mine' },
  { id: 'essence', name: 'Essenz', icon: '🧪', color: '#b38cff', feature: 'biolab' },
  { id: 'catalyst', name: 'Evolutionskristall', icon: '💎', color: '#ff7ad9', feature: 'evolution', description: 'Treibt Evolutionen an. Aus langen Reisen und fernen Regionen.' },
  { id: 'fragments', name: 'Gen-Fragmente', icon: '🧩', color: '#7fdbca', feature: 'recycler', description: 'Aus dem Gen-Recycler. Öffnet Gen-Kapseln.' },
  { id: 'towerTokens', name: 'Turm-Marken', icon: '🗼', color: '#ffb74d', feature: 'tower', description: 'Aus dem Genom-Turm. Für Turm-Forschung.' },
  { id: 'timeCrystals', name: 'Zeitkristall', icon: '⌛', color: '#8ecbff', feature: 'contracts', description: 'Verkürzt ein langes Projekt (ab 1 h) um 4 Stunden. Aus Gen-Aufträgen, der Tagesbelohnung, der Wochenexpedition und Turm-Meilensteinen.' },
  { id: 'aeonShards', name: 'Äon-Splitter', icon: '⏳', color: '#e1bee7', feature: 'aeon', description: 'Aus dem Äon-Reset. Für den Talentbaum.' },
  { id: 'torches', name: 'Fackeln', icon: '🔥', color: '#ff8a50', feature: 'rpg', description: 'Eintritt ins GenLab RPG: Jeder Lauf kostet eine Fackel. Alle 6 Stunden kommt eine neue dazu (bis 3), dazu welche aus Tagesbelohnung, Gen-Aufträgen und Wochenexpedition.' },
  { id: 'runes', name: 'Runen', icon: '🪬', color: '#c792ea', feature: 'rpg', description: 'Aus dem GenLab RPG: von Elite-Gegnern, Bossen und zerlegter Ausrüstung. Für dauerhaften Fortschritt im Dungeon.' },
  { id: 'germOil', name: 'Keimöl', icon: '🌰', color: '#c6ff6b', feature: 'abilityElixir', description: 'Selten: aus Brutritualen, Gen-Aufträgen ab 4★ und Wochenexpeditionen. Für das Fähigkeits-Elixier.' },
  { id: 'heritage', name: 'Erbgut', icon: '🧬', color: '#4fd6c8', feature: 'inheritance', description: 'Dauerhafter Produktionsbonus aus der Vererbung.' },
];

import type { SpeciesDef } from '@core/content/types';

/**
 * Species pool. Family tree: base → hybrid → rare hybrid → mythic end form.
 * Hybrids come from recipes (recipes.ts), mythic forms from rare recipes or
 * evolutions. `wild: true` = found on the standard expeditions; regional
 * species appear only in the missions that list them. Urzeitwesen (`primal`)
 * stand outside the tree: they only hatch from Urzeit-Eier (`eggWeight`).
 */
export const species: SpeciesDef[] = [
  // --- Base species (one per element) ---
  { id: 'emberpup', name: 'Glutwelpe', element: 'fire', tier: 'base', shape: 'blob', hue: 14, wild: true,
    description: 'Ein warmer kleiner Racker, der gern an Kohlen knabbert.', baseStats: { hp: 20, atk: 7, def: 4, spd: 5 } },
  { id: 'bubbloon', name: 'Blubbling', element: 'water', tier: 'base', shape: 'drop', hue: 205, wild: true,
    description: 'Schwebt in seiner eigenen Wasserblase.', baseStats: { hp: 24, atk: 5, def: 6, spd: 4 } },
  { id: 'pebblit', name: 'Kieselkauz', element: 'earth', tier: 'base', shape: 'round', hue: 30, wild: true,
    description: 'Hart wie Stein, sanft wie Moos.', baseStats: { hp: 28, atk: 5, def: 8, spd: 2 } },
  { id: 'zephyrix', name: 'Zephyrix', element: 'air', tier: 'base', shape: 'wing', hue: 190, wild: true,
    description: 'Flink, luftig und immer in Bewegung.', baseStats: { hp: 16, atk: 6, def: 3, spd: 9 } },
  { id: 'voltmouse', name: 'Voltmaus', element: 'electric', tier: 'base', shape: 'blob', hue: 52, wild: true,
    description: 'Lädt sich beim Rennen im Laufrad auf.', baseStats: { hp: 17, atk: 8, def: 3, spd: 8 } },
  { id: 'sproutle', name: 'Sprössling', element: 'nature', tier: 'base', shape: 'round', hue: 110, wild: true,
    description: 'Wächst, wenn man ihm Geschichten erzählt.', baseStats: { hp: 22, atk: 4, def: 6, spd: 4 } },
  { id: 'frostling', name: 'Frostling', element: 'ice', tier: 'base', shape: 'spiky', hue: 185, wild: false,
    description: 'Hinterlässt kleine Eisblumen, wo er schläft.', baseStats: { hp: 21, atk: 6, def: 7, spd: 4 } },
  { id: 'umbrat', name: 'Umbratte', element: 'shadow', tier: 'base', shape: 'blob', hue: 270, wild: false,
    description: 'Lebt im Schatten anderer Kreaturen.', baseStats: { hp: 18, atk: 8, def: 4, spd: 7 } },
  { id: 'lumifly', name: 'Lumifalter', element: 'light', tier: 'base', shape: 'wing', hue: 55, wild: false,
    description: 'Leuchtet heller, wenn er sich freut.', baseStats: { hp: 17, atk: 5, def: 4, spd: 8 } },
  { id: 'ferrox', name: 'Ferrox', element: 'metal', tier: 'base', shape: 'round', hue: 210, wild: false,
    description: 'Frisst Schrauben und klingt beim Laufen.', baseStats: { hp: 26, atk: 6, def: 10, spd: 2 } },
  { id: 'toxling', name: 'Giftling', element: 'poison', tier: 'base', shape: 'serpent', hue: 290, wild: false,
    description: 'Harmlos – solange man ihn nicht ableckt.', baseStats: { hp: 19, atk: 8, def: 5, spd: 6 } },
  { id: 'prismin', name: 'Prismin', element: 'crystal', tier: 'base', shape: 'spiky', hue: 320, wild: false,
    description: 'Bricht das Licht in tausend Farben.', baseStats: { hp: 20, atk: 6, def: 8, spd: 5 } },

  // --- Hybrids (base × base) ---
  { id: 'steamling', name: 'Dampfling', element: 'water', tier: 'hybrid', shape: 'drop', hue: 350, wild: false,
    description: 'Zischt vergnügt, wenn man ihn streichelt.', baseStats: { hp: 26, atk: 8, def: 6, spd: 6 } },
  { id: 'magmole', name: 'Magmaulwurf', element: 'fire', tier: 'hybrid', shape: 'round', hue: 20, wild: false,
    description: 'Gräbt Tunnel aus erstarrter Lava.', baseStats: { hp: 30, atk: 9, def: 9, spd: 3 } },
  { id: 'stormhawk', name: 'Sturmfalke', element: 'electric', tier: 'hybrid', shape: 'wing', hue: 60, wild: false,
    description: 'Reitet auf Gewitterfronten.', baseStats: { hp: 20, atk: 10, def: 4, spd: 12 } },
  { id: 'mossgolem', name: 'Moosgolem', element: 'nature', tier: 'hybrid', shape: 'round', hue: 95, wild: false,
    description: 'Ein wandelnder Hügel voller Blumen.', baseStats: { hp: 34, atk: 6, def: 10, spd: 3 } },
  { id: 'glacierfin', name: 'Gletscherflosse', element: 'ice', tier: 'hybrid', shape: 'serpent', hue: 195, wild: false,
    description: 'Gleitet unter dem Eis dahin.', baseStats: { hp: 28, atk: 7, def: 9, spd: 6 } },
  { id: 'duskmoth', name: 'Dämmerfalter', element: 'shadow', tier: 'hybrid', shape: 'wing', hue: 250, wild: false,
    description: 'Halb Licht, halb Schatten – nie ganz zu sehen.', baseStats: { hp: 21, atk: 8, def: 5, spd: 11 } },
  { id: 'rustling', name: 'Rostling', element: 'metal', tier: 'hybrid', shape: 'blob', hue: 25, wild: false,
    description: 'Quietscht bei Regen.', baseStats: { hp: 30, atk: 7, def: 11, spd: 3 } },
  { id: 'venomvine', name: 'Giftranke', element: 'poison', tier: 'hybrid', shape: 'serpent', hue: 130, wild: false,
    description: 'Wächst schneller, als man weglaufen kann.', baseStats: { hp: 25, atk: 10, def: 6, spd: 6 } },
  { id: 'geodite', name: 'Geodit', element: 'crystal', tier: 'hybrid', shape: 'spiky', hue: 300, wild: false,
    description: 'Außen Stein, innen funkelnd.', baseStats: { hp: 30, atk: 7, def: 12, spd: 3 } },
  { id: 'voltprism', name: 'Funkenprisma', element: 'electric', tier: 'hybrid', shape: 'spiky', hue: 45, wild: false,
    description: 'Speichert Blitze in seinem Kristallkörper.', baseStats: { hp: 22, atk: 10, def: 7, spd: 9 } },

  // --- Rare hybrids ---
  { id: 'volcanodrake', name: 'Vulkandrache', element: 'fire', tier: 'rareHybrid', shape: 'dragon', hue: 8, wild: false,
    description: 'Sein Atem schmilzt Felsen.', baseStats: { hp: 40, atk: 15, def: 11, spd: 7 } },
  { id: 'tempestlord', name: 'Sturmfürst', element: 'air', tier: 'rareHybrid', shape: 'wing', hue: 200, wild: false,
    description: 'Wo er fliegt, tobt der Wind.', baseStats: { hp: 30, atk: 13, def: 7, spd: 17 } },
  { id: 'ancientgrove', name: 'Urhain', element: 'nature', tier: 'rareHybrid', shape: 'round', hue: 120, wild: false,
    description: 'Ein ganzer Wald in einem Wesen.', baseStats: { hp: 48, atk: 9, def: 14, spd: 4 } },
  { id: 'eclipsewing', name: 'Eklipsenschwinge', element: 'shadow', tier: 'rareHybrid', shape: 'dragon', hue: 265, wild: false,
    description: 'Verdunkelt die Sonne mit einem Flügelschlag.', baseStats: { hp: 32, atk: 14, def: 8, spd: 14 } },
  { id: 'aurorafin', name: 'Polarlichtfisch', element: 'ice', tier: 'rareHybrid', shape: 'serpent', hue: 160, wild: false,
    description: 'Schwimmt durch die Nordlichter.', baseStats: { hp: 38, atk: 10, def: 12, spd: 10 } },
  { id: 'prismgolem', name: 'Prismagolem', element: 'crystal', tier: 'rareHybrid', shape: 'spiky', hue: 310, wild: false,
    description: 'Ein wandelnder Kristallpalast.', baseStats: { hp: 44, atk: 11, def: 17, spd: 4 } },
  { id: 'geysirus', name: 'Geysirus', element: 'water', tier: 'rareHybrid', shape: 'drop', hue: 185, wild: false,
    description: 'Entwickelter Dampfling – sprudelt vor Kraft.', baseStats: { hp: 38, atk: 12, def: 9, spd: 9 } },

  // --- Mythic end forms ---
  { id: 'phoenix', name: 'Phönix', element: 'fire', tier: 'mythic', shape: 'dragon', hue: 30, wild: false,
    description: 'Stirbt nie wirklich – er brütet sich selbst neu.', baseStats: { hp: 55, atk: 22, def: 14, spd: 18 } },
  { id: 'leviathan', name: 'Leviathan', element: 'water', tier: 'mythic', shape: 'serpent', hue: 215, wild: false,
    description: 'Die Legende aus den tiefsten Gletscherseen.', baseStats: { hp: 75, atk: 18, def: 20, spd: 10 } },
  { id: 'worldtree', name: 'Weltenbaum', element: 'nature', tier: 'mythic', shape: 'round', hue: 100, wild: false,
    description: 'Seine Wurzeln reichen durch alle Genome.', baseStats: { hp: 80, atk: 12, def: 24, spd: 6 } },
  { id: 'chronodrake', name: 'Chronosdrache', element: 'light', tier: 'mythic', shape: 'dragon', hue: 280, wild: false,
    description: 'Existiert gleichzeitig in Licht und Schatten.', baseStats: { hp: 60, atk: 24, def: 16, spd: 20 } },

  // --- Urzeitwesen: only from Urzeit-Eier ---
  { id: 'ammonix', name: 'Ammonix', element: 'water', tier: 'primal', shape: 'round', hue: 28, wild: false, eggWeight: 10,
    description: 'Trägt sein Spiralhaus seit dreihundert Millionen Jahren mit sich herum.', baseStats: { hp: 44, atk: 9, def: 18, spd: 5 } },
  { id: 'trilobix', name: 'Trilobix', element: 'earth', tier: 'primal', shape: 'blob', hue: 36, wild: false, eggWeight: 10,
    description: 'Krabbelte schon über den Meeresgrund, als es noch keine Fische gab.', baseStats: { hp: 40, atk: 10, def: 16, spd: 8 } },
  { id: 'amberwing', name: 'Bernsteinflügler', element: 'crystal', tier: 'primal', shape: 'wing', hue: 40, wild: false, eggWeight: 8,
    description: 'Erwachte nach Äonen aus einem Tropfen Bernstein – und summt noch immer dasselbe Lied.', baseStats: { hp: 32, atk: 14, def: 10, spd: 19 } },
  { id: 'mammuthling', name: 'Mammutling', element: 'ice', tier: 'primal', shape: 'round', hue: 22, wild: false, eggWeight: 6,
    description: 'Ein wolliger Koloss aus der Eiszeit, der jeden Sommer schmollt.', baseStats: { hp: 56, atk: 12, def: 15, spd: 4 } },
  { id: 'glutraptor', name: 'Glutraptor', element: 'fire', tier: 'primal', shape: 'dragon', hue: 16, wild: false, eggWeight: 6,
    description: 'Jagte durch Vulkanwälder, lange bevor es Drachen gab.', baseStats: { hp: 38, atk: 19, def: 9, spd: 16 } },
  { id: 'ursporling', name: 'Ursporling', element: 'poison', tier: 'primal', shape: 'blob', hue: 95, wild: false, eggWeight: 6,
    description: 'Die erste Spore, aus der alles Gift der Welt gekeimt ist.', baseStats: { hp: 40, atk: 15, def: 12, spd: 11 } },
  { id: 'starseed', name: 'Sternensaat', element: 'light', tier: 'primal', shape: 'spiky', hue: 48, wild: false, eggWeight: 1.5,
    description: 'Fiel als glühendes Ei vom Himmel. Niemand weiß, woher.', baseStats: { hp: 50, atk: 20, def: 18, spd: 17 } },
];

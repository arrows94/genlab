import type { ElementDef } from '@core/content/types';

/** `familyPrefixes`: first half of family names founded by a creature of this element („Funken“ + „stein“). */
export const elements: ElementDef[] = [
  { id: 'fire', name: 'Feuer', color: '#ff7043', strongAgainst: ['nature', 'ice', 'metal'], familyPrefixes: ['Glut', 'Funken', 'Asche', 'Flamm', 'Zunder', 'Brand'] },
  { id: 'water', name: 'Wasser', color: '#42a5f5', strongAgainst: ['fire', 'earth'], familyPrefixes: ['Tau', 'Perl', 'Wellen', 'Tropf', 'Gischt', 'Muschel'] },
  { id: 'earth', name: 'Erde', color: '#a1887f', strongAgainst: ['electric', 'poison', 'fire'], familyPrefixes: ['Kiesel', 'Lehm', 'Fels', 'Sand', 'Erz', 'Grotten'] },
  { id: 'air', name: 'Luft', color: '#b3e5fc', strongAgainst: ['nature', 'poison'], familyPrefixes: ['Wind', 'Wolken', 'Feder', 'Böen', 'Luft', 'Himmel'] },
  { id: 'electric', name: 'Elektro', color: '#ffee58', strongAgainst: ['water', 'air', 'metal'], familyPrefixes: ['Blitz', 'Donner', 'Volt', 'Strom', 'Zack', 'Surr'] },
  { id: 'nature', name: 'Natur', color: '#66bb6a', strongAgainst: ['water', 'earth'], familyPrefixes: ['Moos', 'Farn', 'Blüten', 'Eichen', 'Klee', 'Wurzel'] },
  { id: 'ice', name: 'Eis', color: '#80deea', strongAgainst: ['nature', 'air'], familyPrefixes: ['Frost', 'Eis', 'Reif', 'Schnee', 'Firn', 'Graupel'] },
  { id: 'shadow', name: 'Schatten', color: '#7e57c2', strongAgainst: ['light', 'crystal'], familyPrefixes: ['Schatten', 'Nacht', 'Dunkel', 'Nebel', 'Mond', 'Rauch'] },
  { id: 'light', name: 'Licht', color: '#fff59d', strongAgainst: ['shadow', 'poison'], familyPrefixes: ['Licht', 'Sonnen', 'Stern', 'Glanz', 'Morgen', 'Schein'] },
  { id: 'metal', name: 'Metall', color: '#b0bec5', strongAgainst: ['ice', 'crystal'], familyPrefixes: ['Eisen', 'Stahl', 'Kupfer', 'Zinn', 'Silber', 'Messing'] },
  { id: 'poison', name: 'Gift', color: '#ab47bc', strongAgainst: ['nature', 'water'], familyPrefixes: ['Gift', 'Dorn', 'Sumpf', 'Nessel', 'Moder', 'Pilz'] },
  { id: 'crystal', name: 'Kristall', color: '#f48fb1', strongAgainst: ['electric', 'light'], familyPrefixes: ['Kristall', 'Quarz', 'Prisma', 'Opal', 'Juwel', 'Glimmer'] },
];

import type { RpgEnemyDef, RpgSkillDef } from '@core/content/types';

/**
 * GenLab RPG: the hero's skills and the dungeon foes. A hero has four skills:
 * the basic attack, its element technique (from `techniques.ts`, converted to
 * rounds), a third skill from its Erbanlage, abilities or role, and the
 * special attack that charges up over hits and rounds.
 */
export const rpgSkills: RpgSkillDef[] = [
  { id: 'strike', slot: 'basic', name: 'Angriff', icon: '⚔️', target: 'enemy', hit: 1, cooldown: 0,
    description: 'Ein normaler Treffer.' },
  { id: 'primal', slot: 'special', name: 'Urkraft', icon: '🌟', target: 'enemy', hit: 3, cooldown: 0,
    description: 'Die ganze gesammelte Kraft in einem Schlag: dreifacher Schaden. Lädt sich über Treffer und Runden auf.' },

  // Third skill – Erbanlagen first (only after deep sequencing), then abilities, then the role.
  { id: 'bastion', slot: 'third', name: 'Titanenwall', icon: '🗿', target: 'self', hit: 0, cooldown: 4, from: { latent: 'titanBlood' },
    status: { id: 'shield', rounds: 2, value: 0.5 }, description: 'Ein Schild fängt 2 Runden lang Schaden bis 50 % der KP ab.' },
  { id: 'hunt', slot: 'third', name: 'Jagdinstinkt', icon: '🐾', target: 'enemy', hit: 2, cooldown: 4, from: { latent: 'hunter' },
    description: 'Ein gezielter Sprung mit doppeltem Schaden.' },
  { id: 'thorns', slot: 'third', name: 'Dornenpanzer', icon: '🌵', target: 'self', hit: 0, cooldown: 4, from: { latent: 'thornSkin' },
    status: { id: 'reflect', rounds: 3, value: 0.5 }, description: '3 Runden lang gehen 50 % des erlittenen Schadens an den Angreifer zurück.' },
  { id: 'mend', slot: 'third', name: 'Zähe Erholung', icon: '💚', target: 'self', hit: 0, heal: 0.3, cleanse: true, cooldown: 4, from: { ability: 'tough' },
    description: 'Heilt 30 % der KP und löst Brand, Gift, Betäubung und Verlangsamung.' },
  { id: 'flurry', slot: 'third', name: 'Wirbelhieb', icon: '💨', target: 'enemy', hit: 0.7, hits: 3, cooldown: 3, from: { ability: 'swift' },
    description: 'Drei schnelle Treffer mit je 70 % Schaden.' },
  { id: 'guard', slot: 'third', name: 'Schutzhaltung', icon: '🛡️', target: 'self', hit: 0, cooldown: 3, from: { role: 'tank' },
    status: { id: 'armor', rounds: 2, value: 1 }, description: '2 Runden lang doppelte Verteidigung.' },
  { id: 'heavyBlow', slot: 'third', name: 'Wuchtschlag', icon: '💥', target: 'enemy', hit: 1.8, cooldown: 3, from: { role: 'attacker' },
    description: 'Ein schwerer Schlag mit 180 % Schaden.' },
  { id: 'feint', slot: 'third', name: 'Finte', icon: '🌀', target: 'enemy', hit: 0.8, cooldown: 3, from: { role: 'fast' },
    status: { id: 'stun', rounds: 1, value: 1 }, description: 'Trifft (80 %) und bringt den Gegner aus dem Tritt: Er setzt einen Zug aus.' },
];

export const rpgEnemies: RpgEnemyDef[] = [
  { id: 'brawler', name: 'Wilder', kind: 'normal', pattern: ['attack', 'attack', 'charge', 'heavy'], hp: 1, atk: 1, def: 1, spd: 1 },
  { id: 'guardian', name: 'Gepanzerter', kind: 'normal', pattern: ['guard', 'attack', 'attack'], hp: 1.2, atk: 0.9, def: 1.4, spd: 0.8 },
  { id: 'adept', name: 'Kundiger', kind: 'normal', pattern: ['tech', 'attack', 'attack'], hp: 0.9, atk: 1, def: 0.9, spd: 1.1 },
  { id: 'champion', name: 'Rasender', kind: 'elite', pattern: ['attack', 'charge', 'heavy', 'tech'], hp: 1.8, atk: 1.25, def: 1.2, spd: 1.1 },
  { id: 'warden', name: 'Hüter', kind: 'boss', pattern: ['tech', 'attack', 'guard', 'charge', 'heavy', 'heal'], hp: 3, atk: 1.35, def: 1.3, spd: 1 },
];

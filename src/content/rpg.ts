import type { RpgDungeonDef, RpgEnemyDef, RpgEventDef, RpgSkillDef } from '@core/content/types';

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

/** Dungeons in unlock order: each one opens after the previous is cleared. */
export const rpgDungeons: RpgDungeonDef[] = [
  { id: 'rootMaze', name: 'Wurzellabyrinth', icon: '🌳', elements: ['nature', 'earth'], floor: 0, floorsPerRoom: 1, rooms: 8, loot: 1,
    description: 'Verschlungene Gänge unter einem uralten Baum. Hier fängt jeder an.' },
  { id: 'emberCaves', name: 'Glutgrotten', icon: '🌋', elements: ['fire'], floor: 12, floorsPerRoom: 1.5, rooms: 9, loot: 1.6, requires: 'rootMaze',
    description: 'Heiße Höhlen voller Lava – Wassermonster sind hier im Vorteil.' },
  { id: 'tidalHalls', name: 'Flutgewölbe', icon: '🌊', elements: ['water', 'ice'], floor: 28, floorsPerRoom: 2, rooms: 10, loot: 2.5, requires: 'emberCaves',
    description: 'Überflutete Hallen, in denen das Eis nie schmilzt.' },
  { id: 'stormSpire', name: 'Sturmspitze', icon: '🌩️', elements: ['air', 'electric'], floor: 50, floorsPerRoom: 2.5, rooms: 11, loot: 4, requires: 'tidalHalls',
    description: 'Ein Turm im Gewitter. Blitze zucken zwischen den Stockwerken.' },
  { id: 'shadowCrypt', name: 'Schattengruft', icon: '🕯️', elements: ['shadow', 'poison'], floor: 80, floorsPerRoom: 3, rooms: 12, loot: 6, requires: 'stormSpire',
    description: 'Giftige Nebel und Schatten, die sich bewegen, wenn niemand hinsieht.' },
  { id: 'crystalCore', name: 'Kristallkern', icon: '💠', elements: ['crystal', 'light', 'metal'], floor: 120, floorsPerRoom: 4, rooms: 12, loot: 9, requires: 'shadowCrypt',
    description: 'Das funkelnde Herz der Welt. Nur die stärksten Monster kommen bis zum Grund.' },
];

/** Event rooms: a short scene, two choices. */
export const rpgEvents: RpgEventDef[] = [
  { id: 'shrine', name: 'Verlassener Schrein', icon: '⛩️', weight: 3,
    text: 'Ein moosbewachsener Schrein. In der Schale liegen alte Opfergaben.',
    options: [
      { label: 'Beten', hp: 0.3, result: 'Eine warme Kraft durchströmt dein Monster.' },
      { label: 'Opfergaben nehmen', loot: 1.5, hp: -0.15, result: 'Die Gaben gehören jetzt dir – aber der Schrein grollt.' },
    ] },
  { id: 'chest', name: 'Verdächtige Truhe', icon: '🧰', weight: 3,
    text: 'Eine Truhe mitten im Gang – fast zu einladend.',
    options: [
      { label: 'Öffnen', chance: 0.6, loot: 2, result: 'Sie ist randvoll!',
        fail: { hp: -0.25, result: 'Eine Falle! Spitze Stacheln schnellen hervor.' } },
      { label: 'Liegen lassen', result: 'Sicher ist sicher. Du gehst weiter.' },
    ] },
  { id: 'spring', name: 'Klare Quelle', icon: '⛲', weight: 2,
    text: 'Klares Wasser sprudelt aus dem Fels. Ein ruhiger Ort.',
    options: [
      { label: 'Trinken', hp: 0.5, result: 'Das Wasser heilt alle Schrammen.' },
      { label: 'Beute verstecken', secure: true, hp: 0.15, result: 'Hinter dem Wasserfall ist deine Beute sicher.' },
    ] },
  { id: 'rubble', name: 'Eingestürzter Gang', icon: '🪨', weight: 2,
    text: 'Geröll versperrt einen Seitengang. Dahinter glitzert etwas.',
    options: [
      { label: 'Freigraben', hp: -0.1, loot: 1, result: 'Mühsam, aber es hat sich gelohnt.' },
      { label: 'Weitergehen', result: 'Das Glitzern bleibt, wo es ist.' },
    ] },
];

import type { RpgDungeonDef, RpgEnemyDef, RpgEventDef, RpgGearDef, RpgMetaDef, RpgSkillDef, RpgUpgradeDef } from '@core/content/types';

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
  { id: 'warden', name: 'Hüter', kind: 'boss', pattern: ['tech', 'attack', 'guard', 'charge', 'heavy', 'heal'], hp: 2.2, atk: 1.2, def: 1.2, spd: 1 },
];

/** Dungeons in unlock order: each one opens after the previous is cleared. */
export const rpgDungeons: RpgDungeonDef[] = [
  { id: 'rootMaze', name: 'Wurzellabyrinth', icon: '🌳', elements: ['nature', 'earth'], level: 1, levelsPerRoom: 0.4, rooms: 12, loot: 0.8,
    description: 'Verschlungene Gänge unter einem uralten Baum. Hier fängt jeder an.' },
  { id: 'emberCaves', name: 'Glutgrotten', icon: '🌋', elements: ['fire'], level: 8, levelsPerRoom: 0.58, rooms: 14, loot: 1.3, requires: 'rootMaze',
    description: 'Heiße Höhlen voller Lava – Wassermonster sind hier im Vorteil.' },
  { id: 'tidalHalls', name: 'Flutgewölbe', icon: '🌊', elements: ['water', 'ice'], level: 17, levelsPerRoom: 0.67, rooms: 15, loot: 2, requires: 'emberCaves',
    description: 'Überflutete Hallen, in denen das Eis nie schmilzt.' },
  { id: 'stormSpire', name: 'Sturmspitze', icon: '🌩️', elements: ['air', 'electric'], level: 26, levelsPerRoom: 0.71, rooms: 17, loot: 3.2, requires: 'tidalHalls',
    description: 'Ein Turm im Gewitter. Blitze zucken zwischen den Stockwerken.' },
  { id: 'shadowCrypt', name: 'Schattengruft', icon: '🕯️', elements: ['shadow', 'poison'], level: 34, levelsPerRoom: 0.73, rooms: 18, loot: 4.8, requires: 'stormSpire',
    description: 'Giftige Nebel und Schatten, die sich bewegen, wenn niemand hinsieht.' },
  { id: 'crystalCore', name: 'Kristallkern', icon: '💠', elements: ['crystal', 'light', 'metal'], level: 56, levelsPerRoom: 0.8, rooms: 18, loot: 7.2, requires: 'shadowCrypt',
    description: 'Das funkelnde Herz der Welt. Nur die stärksten Monster kommen bis zum Grund.' },
];

/** Event rooms: a short scene, two choices. */
export const rpgEvents: RpgEventDef[] = [
  { id: 'shrine', name: 'Verlassener Schrein', icon: '⛩️', weight: 3,
    text: 'Ein moosbewachsener Schrein. In der Schale liegen alte Opfergaben.',
    options: [
      { label: 'Beten', hp: 0.15, result: 'Eine schwache Wärme durchströmt dein Monster.' },
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
      { label: 'Trinken', hp: 0.25, result: 'Das kalte Wasser lindert die schlimmsten Schrammen.' },
      { label: 'Beute verstecken', secure: true, result: 'Hinter dem Wasserfall ist deine Beute sicher.' },
    ] },
  { id: 'rubble', name: 'Eingestürzter Gang', icon: '🪨', weight: 2,
    text: 'Geröll versperrt einen Seitengang. Dahinter glitzert etwas.',
    options: [
      { label: 'Freigraben', hp: -0.1, loot: 1, result: 'Mühsam, aber es hat sich gelohnt.' },
      { label: 'Weitergehen', result: 'Das Glitzern bleibt, wo es ist.' },
    ] },
];

/** Level-up choices: three are offered per level, they only last for the run. */
export const rpgUpgrades: RpgUpgradeDef[] = [
  { id: 'vigor', name: 'Lebenskraft', icon: '❤️', weight: 10, stats: { hp: 0.15 }, description: '+15 % KP.' },
  { id: 'might', name: 'Kraft', icon: '💪', weight: 10, stats: { atk: 0.12 }, description: '+12 % Angriff.' },
  { id: 'hide', name: 'Dickhaut', icon: '🐢', weight: 8, stats: { def: 0.2 }, description: '+20 % Verteidigung.' },
  { id: 'haste', name: 'Schnelligkeit', icon: '👟', weight: 8, stats: { spd: 0.15 }, description: '+15 % Tempo.' },
  { id: 'focus', name: 'Fokus', icon: '🎯', weight: 5, perks: { specialPower: 0.5 }, description: 'Der Spezialangriff macht 50 % mehr Schaden.' },
  { id: 'battery', name: 'Kraftspeicher', icon: '🔋', weight: 5, max: 3, perks: { chargePerRound: 0.05 }, description: 'Der Spezialangriff lädt sich jede Runde 5 % schneller auf.' },
  { id: 'leech', name: 'Lebensraub', icon: '🩸', weight: 4, max: 3, perks: { lifesteal: 0.1 }, description: 'Heilt 10 % des ausgeteilten Schadens.' },
  { id: 'keen', name: 'Scharfer Blick', icon: '👁️', weight: 5, max: 3, perks: { crit: 0.1 }, description: '10 % Chance auf kritische Treffer.' },
  { id: 'secondWind', name: 'Zweite Luft', icon: '🌬️', weight: 4, max: 2, perks: { regen: 0.03 }, description: 'Heilt am Ende jeder Runde 3 % der KP.' },
  { id: 'drill', name: 'Drill', icon: '⏱️', weight: 3, max: 1, perks: { cooldown: 1 }, description: 'Element-Technik und dritte Fähigkeit sind eine Runde früher wieder bereit.' },
];

/** Equipment: values of a common piece, rarer ones are stronger. One weapon, armour and talisman at a time. */
export const rpgGear: RpgGearDef[] = [
  { id: 'fang', name: 'Reißzahn', icon: '🦷', slot: 'weapon', stats: { atk: 0.1 } },
  { id: 'claw', name: 'Klingenkralle', icon: '🗡️', slot: 'weapon', stats: { atk: 0.06 }, perks: { crit: 0.04 } },
  { id: 'thornWhip', name: 'Dornenpeitsche', icon: '🌿', slot: 'weapon', stats: { atk: 0.06 }, perks: { lifesteal: 0.04 } },
  { id: 'shell', name: 'Panzerschale', icon: '🐚', slot: 'armor', stats: { def: 0.12, hp: 0.04 } },
  { id: 'mossCoat', name: 'Moosmantel', icon: '🧥', slot: 'armor', stats: { hp: 0.12 } },
  { id: 'feather', name: 'Federkleid', icon: '🪶', slot: 'armor', stats: { spd: 0.1, def: 0.04 } },
  { id: 'emberStone', name: 'Glutstein', icon: '🔴', slot: 'charm', perks: { specialPower: 0.15 } },
  { id: 'hourglass', name: 'Sanduhr', icon: '⏳', slot: 'charm', perks: { chargePerRound: 0.02 } },
  { id: 'totem', name: 'Heiltotem', icon: '🗿', slot: 'charm', perks: { regen: 0.01 } },
];

/** Lasting progress between runs, bought with Runen (bosses, elites, taking equipment apart). */
export const rpgMeta: RpgMetaDef[] = [
  { id: 'hardened', name: 'Abgehärtet', icon: '🛡️', cost: 20, costGrowth: 1.6, maxLevel: 5, effect: { stats: { hp: 0.04, def: 0.04 } },
    description: 'Je Stufe +4 % KP und Verteidigung im Dungeon.' },
  { id: 'fighting', name: 'Kampfgeist', icon: '⚔️', cost: 20, costGrowth: 1.6, maxLevel: 5, effect: { stats: { atk: 0.04 } },
    description: 'Je Stufe +4 % Angriff im Dungeon.' },
  { id: 'prepared', name: 'Vorbereitung', icon: '🌟', cost: 40, costGrowth: 2, maxLevel: 2, effect: { startCharge: 0.25 },
    description: 'Je Stufe startet der Spezialangriff jeden Kampf zu 25 % geladen.' },
  { id: 'medic', name: 'Feldsanitäter', icon: '🏕️', cost: 30, costGrowth: 1.8, maxLevel: 3, effect: { restHeal: 0.1 },
    description: 'Je Stufe heilt eine Rast 10 % mehr.' },
  { id: 'torchBag', name: 'Fackelhalter', icon: '🔥', cost: 60, costGrowth: 2.5, maxLevel: 2, effect: { torches: 1 },
    description: 'Je Stufe eine Fackel mehr im Vorrat.' },
  { id: 'versatile', name: 'Vielseitig', icon: '🎴', cost: 150, costGrowth: 1, maxLevel: 1, effect: { roleSkill: true },
    description: 'Ein Monster, dessen dritte Fähigkeit aus Erbanlage oder Fähigkeit stammt, bekommt seine Rollen-Fähigkeit als vierte dazu.' },
];

import type { GameContext } from '../context';
import type { Creature, RpgBattle, RpgCombatant, RpgEvent, RpgFoe, RpgItem, RpgStatus } from '../state';
import type { RpgIntent, RpgPerks, RpgSkillDef, StatusId, TechniqueDef } from '../content/types';
import { damage, elementMultiplier, evadeChance, roleOf, techniqueFor, type Fighter } from './tower';

/**
 * GenLab RPG combat: turn-based, one hero against one foe. No DOM, all
 * randomness from the game RNG, so fights are reproducible and testable.
 */

/** The element technique of the tower, converted to rounds for the dungeon. */
export function techniqueSkill(ctx: GameContext, tech: TechniqueDef): RpgSkillDef {
  const cfg = ctx.balance.rpg;
  const perRound = (id: string) => ['burn', 'poison', 'regen'].includes(id);
  return {
    id: tech.id,
    slot: 'technique',
    name: tech.name,
    icon: tech.icon,
    description: tech.description,
    target: tech.target === 'enemy' ? 'enemy' : 'self',
    hit: tech.hit,
    ...(tech.heal !== undefined ? { heal: tech.heal } : {}),
    ...(tech.cleanse ? { cleanse: true } : {}),
    ...(tech.status
      ? {
          status: {
            id: tech.status.id,
            rounds: Math.max(1, Math.ceil(tech.status.duration / cfg.secondsPerRound)),
            value: perRound(tech.status.id) ? tech.status.value * cfg.secondsPerRound : tech.status.value,
          },
        }
      : {}),
    cooldown: cfg.techniqueCooldown,
  };
}

/** The skill of a monster's role (from its species' base stats – breeding does not count in the other world). */
export function roleSkill(ctx: GameContext, c: Creature): RpgSkillDef {
  const role = roleOf(ctx, ctx.content.species.get(c.speciesId).baseStats);
  return ctx.content.rpgSkills.list.find((k) => k.slot === 'third' && k.from?.role === role)!;
}

/** Third skill: a revealed Erbanlage wins, then the first matching ability, then the role. */
export function thirdSkill(ctx: GameContext, c: Creature): RpgSkillDef {
  const thirds = ctx.content.rpgSkills.list.filter((k) => k.slot === 'third');
  if (c.latent && c.deepSequenced) {
    const byLatent = thirds.find((k) => k.from?.latent === c.latent);
    if (byLatent) return byLatent;
  }
  for (const a of c.abilities) {
    const byAbility = thirds.find((k) => k.from?.ability === a);
    if (byAbility) return byAbility;
  }
  return roleSkill(ctx, c);
}

/** The hero's skills in button order: basic, technique, third (and the role skill with „Vielseitig“), special. */
export function rpgSkillsFor(ctx: GameContext, c: Creature): RpgSkillDef[] {
  const skills = ctx.content.rpgSkills.list;
  const tech = techniqueFor(ctx, ctx.content.species.get(c.speciesId).element);
  const third = thirdSkill(ctx, c);
  const role = roleSkill(ctx, c);
  return [
    skills.find((k) => k.slot === 'basic')!,
    ...(tech ? [techniqueSkill(ctx, tech)] : []),
    third,
    ...(role.id !== third.id && metaEffects(ctx).roleSkill ? [role] : []),
    skills.find((k) => k.slot === 'special')!,
  ];
}

// ---- Kampf ------------------------------------------------------------------

const HARMFUL: StatusId[] = ['burn', 'poison', 'stun', 'slow'];

/** Stat bonus shares of the run's upgrades. */
export function upgradeStats(ctx: GameContext, upgrades: readonly string[]): Record<'hp' | 'atk' | 'def' | 'spd', number> {
  const out = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (const id of upgrades) {
    if (!ctx.content.rpgUpgrades.has(id)) continue;
    for (const [k, v] of Object.entries(ctx.content.rpgUpgrades.get(id).stats ?? {})) out[k as keyof typeof out] += v;
  }
  return out;
}

/** Passive effects of the run's upgrades, added up. */
export function upgradePerks(ctx: GameContext, upgrades: readonly string[]): Required<RpgPerks> {
  const out: Required<RpgPerks> = { specialPower: 0, chargePerRound: 0, lifesteal: 0, crit: 0, regen: 0, cooldown: 0 };
  for (const id of upgrades) {
    if (!ctx.content.rpgUpgrades.has(id)) continue;
    for (const [k, v] of Object.entries(ctx.content.rpgUpgrades.get(id).perks ?? {})) out[k as keyof RpgPerks] += v;
  }
  return out;
}

/** Lasting effects bought with Runen, added up over their levels. */
export function metaEffects(ctx: GameContext): { stats: Record<'hp' | 'atk' | 'def' | 'spd', number>; torches: number; startCharge: number; restHeal: number; roleSkill: boolean } {
  const out = { stats: { hp: 0, atk: 0, def: 0, spd: 0 }, torches: 0, startCharge: 0, restHeal: 0, roleSkill: false };
  for (const [id, level] of Object.entries(ctx.state.rpg.meta)) {
    if (level <= 0 || !ctx.content.rpgMeta.has(id)) continue;
    const e = ctx.content.rpgMeta.get(id).effect;
    for (const [k, v] of Object.entries(e.stats ?? {})) out.stats[k as keyof typeof out.stats] += v * level;
    out.torches += (e.torches ?? 0) * level;
    out.startCharge += (e.startCharge ?? 0) * level;
    out.restHeal += (e.restHeal ?? 0) * level;
    if (e.roleSkill) out.roleSkill = true;
  }
  return out;
}

/** Values of a piece of equipment: the common values × its rarity. */
export function itemValues(ctx: GameContext, item: RpgItem): { stats: Partial<Record<'hp' | 'atk' | 'def' | 'spd', number>>; perks: RpgPerks } {
  const def = ctx.content.rpgGear.get(item.gear);
  const mult = ctx.balance.rpg.gearRarityMult[item.rarity] ?? 1;
  const scale = <T extends Record<string, number | undefined>>(o: T | undefined) =>
    Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, (v ?? 0) * mult])) as T;
  return { stats: scale(def.stats), perks: scale(def.perks) };
}

/** Equipment worn right now (by whichever monster goes into the dungeon). */
export function equippedItems(ctx: GameContext): RpgItem[] {
  const r = ctx.state.rpg;
  return Object.values(r.equipped)
    .map((id) => r.items.find((i) => i.id === id))
    .filter((i): i is RpgItem => !!i && ctx.content.rpgGear.has(i.gear));
}

/** Passive effects of the hero in the dungeon: the run's upgrades plus the equipment. */
export function heroPerks(ctx: GameContext, upgrades: readonly string[]): Required<RpgPerks> {
  const out = upgradePerks(ctx, upgrades);
  for (const item of equippedItems(ctx)) {
    for (const [k, v] of Object.entries(itemValues(ctx, item).perks)) out[k as keyof RpgPerks] += v ?? 0;
  }
  return out;
}

/** XP from `level` to the next. */
export function xpToNext(ctx: GameContext, level: number): number {
  const cfg = ctx.balance.rpg;
  return Math.round(cfg.xpBase * Math.pow(cfg.xpGrowth, level - 1));
}

/** Level of a monster in the other world from its collected XP: level, XP into it and needed for the next (0 at the top). */
export function rpgLevel(ctx: GameContext, creatureId: number): { level: number; into: number; need: number } {
  const cfg = ctx.balance.rpg;
  let xp = ctx.state.rpg.ranks[String(creatureId)] ?? 0;
  let level = 1;
  while (level < cfg.maxLevel) {
    const need = xpToNext(ctx, level);
    if (xp < need) return { level, into: xp, need };
    xp -= need;
    level++;
  }
  return { level, into: 0, need: 0 };
}

/** Total XP a monster needs to reach `level` (for tests and previews). */
export function xpForLevel(ctx: GameContext, level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNext(ctx, l);
  return total;
}

/**
 * The hero's stats in the other world: its species' base stats, grown by its level there, × (the run's
 * upgrades + equipment + Runen progress). Rarity, genome, infusion and potions do not count – it starts over.
 */
export function heroStats(ctx: GameContext, c: Creature, upgrades: readonly string[] = []): { hp: number; atk: number; def: number; spd: number } {
  const base = ctx.content.species.get(c.speciesId).baseStats;
  const grown = 1 + (rpgLevel(ctx, c.id).level - 1) * ctx.balance.rpg.statsPerLevel;
  const s: Record<string, number> = Object.fromEntries(Object.entries(base).map(([k, v]) => [k, v * grown]));
  const up = upgradeStats(ctx, upgrades);
  for (const item of equippedItems(ctx)) {
    for (const [k, v] of Object.entries(itemValues(ctx, item).stats)) up[k as keyof typeof up] += v ?? 0;
  }
  for (const [k, v] of Object.entries(metaEffects(ctx).stats)) up[k as keyof typeof up] += v;
  const stat = (k: 'hp' | 'atk' | 'def' | 'spd', min: number) => Math.max(min, Math.round((s[k] ?? 0) * (1 + up[k])));
  return { hp: stat('hp', 1), atk: stat('atk', 1), def: stat('def', 0), spd: stat('spd', 1) };
}

/** The hero as a combatant (stats from `heroStats`). */
export function heroCombatant(ctx: GameContext, c: Creature, hp: number, upgrades: readonly string[] = []): RpgCombatant {
  const s = heroStats(ctx, c, upgrades);
  return {
    name: c.name,
    speciesId: c.speciesId,
    element: ctx.content.species.get(c.speciesId).element,
    hp: Math.min(s.hp, Math.max(1, hp)),
    maxHp: s.hp,
    atk: s.atk,
    def: s.def,
    spd: s.spd,
    statuses: [],
  };
}

/** A foe of the given kind on a floor (tower strength scale), with the species' element. */
export function makeFoe(ctx: GameContext, enemyId: string, speciesId: string, floor: number): RpgFoe {
  const def = ctx.content.rpgEnemies.get(enemyId);
  const sp = ctx.content.species.get(speciesId);
  const t = ctx.balance.tower;
  const m = ctx.balance.rpg.enemyMult;
  const scale = Math.pow(t.enemyGrowth, Math.max(0, floor));
  const stat = (k: 'hp' | 'atk' | 'def' | 'spd', grow: number) => Math.max(1, Math.round((t.enemyBase[k] ?? 1) * grow * m[k] * def[k]));
  const hp = stat('hp', scale);
  return {
    name: `${def.name} ${sp.name}`,
    speciesId: sp.id,
    element: sp.element,
    hp,
    maxHp: hp,
    atk: stat('atk', scale),
    def: stat('def', scale),
    spd: stat('spd', Math.sqrt(scale)),
    statuses: [],
    enemy: def.id,
    kind: def.kind,
    step: 0,
  };
}

export function newBattle(hero: RpgCombatant, foe: RpgFoe): RpgBattle {
  return { hero, foe, round: 1, cooldowns: {}, charge: 0, log: [] };
}

/** The foe's next move (shown before the hero chooses). */
export function foeIntent(ctx: GameContext, foe: RpgFoe): RpgIntent {
  const pattern = ctx.content.rpgEnemies.get(foe.enemy).pattern;
  return pattern[foe.step % pattern.length]!;
}

export function statusOf(c: RpgCombatant, id: StatusId): RpgStatus | undefined {
  return c.statuses.find((s) => s.id === id);
}

/** Why a skill cannot be used now (null = ready). */
export function skillBlocker(battle: RpgBattle, skill: RpgSkillDef): string | null {
  if (skill.slot === 'special' && battle.charge < 1) return `${skill.name} lädt sich noch auf.`;
  const cd = battle.cooldowns[skill.id] ?? 0;
  if (cd > 0) return `${skill.name} ist erst in ${cd === 1 ? 'einer Runde' : `${cd} Runden`} wieder bereit.`;
  return null;
}

/** Does the hero act before the foe this round? Speed decides; a slowed side always acts last. */
export function heroActsFirst(battle: RpgBattle): boolean {
  const heroSlow = !!statusOf(battle.hero, 'slow');
  const foeSlow = !!statusOf(battle.foe, 'slow');
  if (heroSlow !== foeSlow) return foeSlow;
  return battle.hero.spd >= battle.foe.spd;
}

function asFighter(c: RpgCombatant, team: boolean, power: number): Fighter {
  const armor = statusOf(c, 'armor');
  return {
    name: c.name, speciesId: c.speciesId, element: c.element, hp: c.hp, maxHp: c.maxHp,
    atk: c.atk, def: Math.round(c.def * (1 + (armor?.value ?? 0))), spd: c.spd,
    power, elementPower: 1, team,
  };
}

function addStatus(target: RpgCombatant, status: RpgStatus): void {
  const old = statusOf(target, status.id);
  if (!old) target.statuses.push({ ...status });
  else {
    old.rounds = Math.max(old.rounds, status.rounds);
    old.value = Math.max(old.value, status.value);
  }
}

interface Side {
  self: RpgCombatant;
  other: RpgCombatant;
  isHero: boolean;
  /** The hero's run upgrades (none for the foe). */
  perks: Required<RpgPerks>;
}

const NO_PERKS: Required<RpgPerks> = { specialPower: 0, chargePerRound: 0, lifesteal: 0, crit: 0, regen: 0, cooldown: 0 };

/** Cooldown of a hero skill after the run's upgrades (skills with a cooldown keep at least 1). */
export function effectiveCooldown(skill: RpgSkillDef, perks: RpgPerks = {}): number {
  if (skill.cooldown <= 0) return 0;
  return Math.max(1, skill.cooldown - (perks.cooldown ?? 0));
}

/**
 * Applies a skill of `user` against `other`. Returns how many hits landed.
 * Damage runs through shields; reflect sends a share back.
 */
function useSkill(ctx: GameContext, battle: RpgBattle, side: Side, skill: RpgSkillDef, mult = 1): number {
  const { self, other } = side;
  const cfg = ctx.balance.rpg;
  const log = (line: string) => battle.log.push(line);
  const event = (e: Omit<RpgEvent, 'by'>) => (battle.last ??= []).push({ by: side.isHero ? 'hero' : 'foe', ...e });
  const special = skill.slot !== 'basic';
  let landed = 0;
  if (skill.hit > 0) {
    for (let i = 0; i < (skill.hits ?? 1); i++) {
      if (other.hp <= 0) break;
      const power = side.isHero && skill.slot === 'special' ? 1 + side.perks.specialPower : 1;
      const att = asFighter(self, side.isHero, skill.hit * mult * power);
      const def = asFighter(other, !side.isHero, 1);
      const evade = Math.min(0.9, evadeChance(ctx, att, def) + (statusOf(other, 'evade')?.value ?? 0));
      if (ctx.rng.chance(evade)) {
        log(`${other.name} weicht aus.`);
        event({ kind: 'miss', special });
        continue;
      }
      let dmg = damage(ctx, att, def, ctx.rng);
      const crit = side.perks.crit > 0 && ctx.rng.chance(side.perks.crit);
      if (crit) dmg = Math.round(dmg * ctx.balance.tower.critMult);
      const shield = statusOf(other, 'shield');
      if (shield) {
        const absorbed = Math.min(shield.value, dmg);
        shield.value -= absorbed;
        dmg -= absorbed;
        if (shield.value <= 0) other.statuses = other.statuses.filter((s) => s !== shield);
      }
      other.hp = Math.max(0, other.hp - dmg);
      landed++;
      const m = elementMultiplier(ctx, self.element, other.element);
      event({ kind: 'hit', dmg, m, special, ...(crit ? { crit: true } : {}) });
      log(`${self.name}: ${skill.name} trifft${crit ? ' kritisch' : ''} für ${dmg}${m > 1 ? ' – sehr effektiv!' : m < 1 ? ' – wenig effektiv.' : '.'}`);
      if (side.perks.lifesteal > 0 && dmg > 0) self.hp = Math.min(self.maxHp, self.hp + Math.round(dmg * side.perks.lifesteal));
      if (side.isHero) battle.charge = Math.min(1, battle.charge + cfg.chargePerHit);
      else battle.charge = Math.min(1, battle.charge + cfg.chargeWhenHit);
      const reflect = statusOf(other, 'reflect');
      if (reflect && dmg > 0) {
        const back = Math.max(1, Math.round(dmg * reflect.value));
        self.hp = Math.max(0, self.hp - back);
        log(`${other.name} wirft ${back} Schaden zurück.`);
      }
    }
  }
  if (skill.heal) {
    const healed = Math.min(self.maxHp - self.hp, Math.round(self.maxHp * skill.heal));
    self.hp += healed;
    log(`${self.name} heilt ${healed} KP.`);
    event({ kind: 'heal', special });
  }
  if (skill.cleanse) self.statuses = self.statuses.filter((s) => !HARMFUL.includes(s.id));
  if (skill.status && (skill.hit === 0 || landed > 0) && other.hp > 0) {
    const target = skill.target === 'enemy' ? other : self;
    const st = skill.status;
    const value = st.id === 'burn' || st.id === 'poison' ? Math.max(1, Math.round(self.atk * st.value))
      : st.id === 'shield' ? Math.round(target.maxHp * st.value)
      : st.id === 'regen' ? Math.max(1, Math.round(target.maxHp * st.value))
      : st.value;
    addStatus(target, { id: st.id, rounds: st.rounds, value });
  }
  if (skill.hit === 0 && !skill.heal) {
    log(`${self.name}: ${skill.name}.`);
    event({ kind: 'skill', special });
  }
  return landed;
}

/** Wut: the foe's damage factor in this round (1 before `enrageAfter`). */
export function enrageFactor(ctx: GameContext, round: number): number {
  const cfg = ctx.balance.rpg;
  return 1 + Math.max(0, round - cfg.enrageAfter) * cfg.enrageGrowth;
}

/** The foe's move for this round. */
function foeAct(ctx: GameContext, battle: RpgBattle, intent: RpgIntent): void {
  const foe = battle.foe;
  const side: Side = { self: foe, other: battle.hero, isHero: false, perks: NO_PERKS };
  const cfg = ctx.balance.rpg;
  const basic = ctx.content.rpgSkills.list.find((k) => k.slot === 'basic')!;
  const rage = enrageFactor(ctx, battle.round);
  if (battle.round === cfg.enrageAfter + 1) battle.log.push(`${foe.name} gerät in Wut!`);
  switch (intent) {
    case 'attack':
      useSkill(ctx, battle, side, { ...basic, name: 'Angriff' }, rage);
      break;
    case 'heavy':
      useSkill(ctx, battle, side, { ...basic, name: 'Schwerer Schlag' }, cfg.heavyMult * rage);
      break;
    case 'charge':
      battle.log.push(`${foe.name} sammelt Kraft …`);
      break;
    case 'guard':
      // The shield went up at the start of the round.
      break;
    case 'heal': {
      const healed = Math.min(foe.maxHp - foe.hp, Math.round(foe.maxHp * cfg.healShare));
      foe.hp += healed;
      battle.log.push(`${foe.name} heilt ${healed} KP.`);
      break;
    }
    case 'tech': {
      const tech = techniqueFor(ctx, foe.element);
      if (tech) useSkill(ctx, battle, side, techniqueSkill(ctx, tech), rage);
      break;
    }
  }
}

/** Burn, poison and regeneration tick; statuses and cooldowns run down. */
function endRound(ctx: GameContext, battle: RpgBattle, perks: Required<RpgPerks>): void {
  if (perks.regen > 0) battle.hero.hp = Math.min(battle.hero.maxHp, battle.hero.hp + Math.round(battle.hero.maxHp * perks.regen));
  for (const c of [battle.hero, battle.foe]) {
    if (c.hp <= 0) continue;
    for (const st of c.statuses) {
      if (st.id === 'burn' || st.id === 'poison') {
        c.hp = Math.max(0, c.hp - st.value);
        battle.log.push(`${c.name} erleidet ${st.value} durch ${st.id === 'burn' ? 'Brand' : 'Gift'}.`);
      } else if (st.id === 'regen') c.hp = Math.min(c.maxHp, c.hp + st.value);
    }
    for (const st of c.statuses) st.rounds--;
    c.statuses = c.statuses.filter((st) => st.rounds > 0);
  }
  for (const id of Object.keys(battle.cooldowns)) {
    battle.cooldowns[id] = Math.max(0, battle.cooldowns[id]! - 1);
    if (battle.cooldowns[id] === 0) delete battle.cooldowns[id];
  }
  battle.charge = Math.min(1, battle.charge + ctx.balance.rpg.chargePerRound + perks.chargePerRound);
  battle.foe.step++;
  battle.round++;
}

/**
 * One round: the hero uses `skill`, the foe its shown move, faster side first.
 * A stunned side loses its action. Returns the outcome (null = fight goes on).
 * The skill must be ready (see `skillBlocker`).
 */
export function playRound(ctx: GameContext, battle: RpgBattle, skill: RpgSkillDef, perks: RpgPerks = {}): 'win' | 'lose' | null {
  const all: Required<RpgPerks> = { ...NO_PERKS, ...perks };
  battle.last = [];
  const intent = foeIntent(ctx, battle.foe);
  if (intent === 'guard') {
    addStatus(battle.foe, { id: 'shield', rounds: 1, value: Math.round(battle.foe.maxHp * ctx.balance.rpg.guardShare) });
    battle.log.push(`${battle.foe.name} geht in Deckung.`);
  }
  const heroTurn = () => {
    if (skill.slot === 'special') battle.charge = 0;
    const cd = effectiveCooldown(skill, all);
    if (cd > 0) battle.cooldowns[skill.id] = cd + 1;
    useSkill(ctx, battle, { self: battle.hero, other: battle.foe, isHero: true, perks: all }, skill);
  };
  const turns: [RpgCombatant, () => void][] = [[battle.hero, heroTurn], [battle.foe, () => foeAct(ctx, battle, intent)]];
  if (!heroActsFirst(battle)) turns.reverse();
  for (const [who, act] of turns) {
    if (battle.hero.hp <= 0 || battle.foe.hp <= 0) break;
    const stun = statusOf(who, 'stun');
    if (stun) {
      who.statuses = who.statuses.filter((s) => s !== stun);
      battle.log.push(`${who.name} ist betäubt und setzt aus.`);
      continue;
    }
    act();
  }
  if (battle.hero.hp > 0 && battle.foe.hp > 0) endRound(ctx, battle, all);
  battle.log = battle.log.slice(-ctx.balance.rpg.logSize);
  if (battle.foe.hp <= 0 && battle.hero.hp > 0) return 'win';
  if (battle.hero.hp <= 0) return 'lose';
  if (battle.foe.hp <= 0) return 'win';
  return null;
}

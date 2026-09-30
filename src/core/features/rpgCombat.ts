import type { GameContext } from '../context';
import type { Creature, RpgBattle, RpgCombatant, RpgFoe, RpgStatus } from '../state';
import type { RpgIntent, RpgPerks, RpgSkillDef, StatusId, TechniqueDef } from '../content/types';
import { effectiveStats } from '../creatures';
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
  const role = roleOf(ctx, effectiveStats(ctx, c));
  return thirds.find((k) => k.from?.role === role)!;
}

/** The hero's skills in button order: basic, technique, third, special. */
export function rpgSkillsFor(ctx: GameContext, c: Creature): RpgSkillDef[] {
  const skills = ctx.content.rpgSkills.list;
  const tech = techniqueFor(ctx, ctx.content.species.get(c.speciesId).element);
  return [
    skills.find((k) => k.slot === 'basic')!,
    ...(tech ? [techniqueSkill(ctx, tech)] : []),
    thirdSkill(ctx, c),
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

/** Erfahrungsrang of a creature from its collected dungeon XP: rank, XP into it and needed for the next. */
export function rpgRank(ctx: GameContext, creatureId: number): { rank: number; into: number; need: number } {
  const cfg = ctx.balance.rpg;
  let xp = ctx.state.rpg.ranks[String(creatureId)] ?? 0;
  let rank = 0;
  while (rank < cfg.maxRank) {
    const need = Math.round(cfg.rankXpBase * Math.pow(cfg.rankXpGrowth, rank));
    if (xp < need) return { rank, into: xp, need };
    xp -= need;
    rank++;
  }
  return { rank, into: 0, need: 0 };
}

/** The hero's stats in the dungeon: bred stats × Erfahrungsrang × the run's upgrades. */
export function heroStats(ctx: GameContext, c: Creature, upgrades: readonly string[] = []): { hp: number; atk: number; def: number; spd: number } {
  const s = effectiveStats(ctx, c);
  const up = upgradeStats(ctx, upgrades);
  const rank = 1 + rpgRank(ctx, c.id).rank * ctx.balance.rpg.rankStats;
  const stat = (k: 'hp' | 'atk' | 'def' | 'spd', min: number) => Math.max(min, Math.round((s[k] ?? 0) * rank * (1 + up[k])));
  return { hp: stat('hp', 1), atk: stat('atk', 1), def: stat('def', 0), spd: stat('spd', 1) };
}

/** The hero as a combatant, from its bred stats and the run's upgrades. */
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
  let landed = 0;
  if (skill.hit > 0) {
    for (let i = 0; i < (skill.hits ?? 1); i++) {
      if (other.hp <= 0) break;
      const special = side.isHero && skill.slot === 'special' ? 1 + side.perks.specialPower : 1;
      const att = asFighter(self, side.isHero, skill.hit * mult * special);
      const def = asFighter(other, !side.isHero, 1);
      const evade = Math.min(0.9, evadeChance(ctx, att, def) + (statusOf(other, 'evade')?.value ?? 0));
      if (ctx.rng.chance(evade)) {
        log(`${other.name} weicht ${skill.name} aus.`);
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
  if (skill.hit === 0 && !skill.heal) log(`${self.name}: ${skill.name}.`);
  return landed;
}

/** The foe's move for this round. */
function foeAct(ctx: GameContext, battle: RpgBattle, intent: RpgIntent): void {
  const foe = battle.foe;
  const side: Side = { self: foe, other: battle.hero, isHero: false, perks: NO_PERKS };
  const cfg = ctx.balance.rpg;
  const basic = ctx.content.rpgSkills.list.find((k) => k.slot === 'basic')!;
  switch (intent) {
    case 'attack':
      useSkill(ctx, battle, side, { ...basic, name: 'Angriff' });
      break;
    case 'heavy':
      useSkill(ctx, battle, side, { ...basic, name: 'Schwerer Schlag' }, cfg.heavyMult);
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
      if (tech) useSkill(ctx, battle, side, techniqueSkill(ctx, tech));
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

import { D } from '../num';
import { creaturePower, findCreature } from '../creatures';
import { unlockFeature } from '../systems/unlocks';
import { grant } from '../resources';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature, RpgItem, RpgRun } from '../state';
import type { RpgEventOutcome, RpgGearSlot, RpgIntent, RpgRoomKind, RpgSkillDef } from '../content/types';
import type { System } from '../systems/types';
import { isBeingSequenced } from './sequencing';
import { weekIndex } from './weekly';
import { catalogueSamples } from '../genetics';
import { heroCombatant, heroPerks, heroStats, makeFoe, metaEffects, newBattle, playRound, rpgRank, rpgSkillsFor, skillBlocker } from './rpgCombat';

/**
 * GenLab RPG: a single monster goes into a dungeon alone. Unlike the rest of
 * the game it is played actively and turn by turn. Runs cost a Fackel; the
 * Fackeln come back by the real clock up to a small stock, so the dungeon
 * cannot be spammed and a day off costs nothing.
 */

const HOUR = 3_600_000;

export function torches(ctx: GameContext): number {
  return Math.floor((ctx.state.resources['torches'] ?? D(0)).toNumber());
}

/** Fackeln stored at most by refilling (more with „Fackelhalter“). */
export function maxTorches(ctx: GameContext): number {
  return ctx.balance.rpg.maxTorches + metaEffects(ctx).torches;
}

/** Wall clock of the next Fackel (null while the stock is full or the RPG is locked). */
export function nextTorchAt(ctx: GameContext): number | null {
  const at = ctx.state.rpg.torchAt;
  if (!ctx.state.features['rpg'] || at <= 0) return null;
  return at + ctx.balance.rpg.torchHours * HOUR;
}

/**
 * Refills Fackeln by the real clock: one every `torchHours` below the stock
 * limit. The first call after the unlock fills the stock once.
 */
export function refreshTorches(ctx: GameContext, nowMs = ctx.state.lastTickAt): void {
  if (!ctx.state.features['rpg']) return;
  const r = ctx.state.rpg;
  const cfg = ctx.balance.rpg;
  const have = torches(ctx);
  const max = maxTorches(ctx);
  if (r.torchAt < 0) {
    grant(ctx, 'torches', Math.max(0, max - have), 'rpg:torch');
    r.torchAt = 0;
    return;
  }
  if (have >= max) {
    r.torchAt = 0;
    return;
  }
  if (r.torchAt === 0) {
    r.torchAt = nowMs;
    return;
  }
  const interval = cfg.torchHours * HOUR;
  const ready = Math.floor((nowMs - r.torchAt) / interval);
  if (ready <= 0) return;
  const add = Math.min(ready, max - have);
  grant(ctx, 'torches', add, 'rpg:torch');
  r.torchAt = have + add >= max ? 0 : r.torchAt + ready * interval;
}

export const rpgSystem: System = {
  id: 'rpg',
  update(ctx) {
    refreshTorches(ctx);
  },
};

// ---- Lauf ---------------------------------------------------------------------

export function rpgRun(ctx: GameContext): RpgRun | null {
  return ctx.state.rpg.run;
}

/** The monster of the running run. */
export function rpgHero(ctx: GameContext): Creature | null {
  const run = ctx.state.rpg.run;
  return run ? findCreature(ctx, run.creatureId) ?? null : null;
}

/** Max HP of a monster in the dungeon (from its bred stats and the run's upgrades). */
export function rpgMaxHp(ctx: GameContext, c: Creature, upgrades: readonly string[] = []): number {
  return heroStats(ctx, c, upgrades).hp;
}

/** Why a monster cannot enter the dungeon (null = it can). */
export function rpgStartBlocker(ctx: GameContext, c: Creature): string | null {
  if (c.job && c.job.kind !== 'building') return `${c.name} ist beschäftigt.`;
  if (isBeingSequenced(ctx, c.id)) return `${c.name} wird gerade sequenziert.`;
  return null;
}

/** The Erfahrungsrang goes with its creature: ranks of creatures that are gone are dropped. */
function pruneRanks(ctx: GameContext): void {
  const ids = new Set(ctx.state.creatures.map((c) => String(c.id)));
  for (const id of Object.keys(ctx.state.rpg.ranks)) if (!ids.has(id)) delete ctx.state.rpg.ranks[id];
}

function addRankXp(ctx: GameContext, creatureId: number, amount: number): void {
  const key = String(creatureId);
  ctx.state.rpg.ranks[key] = (ctx.state.rpg.ranks[key] ?? 0) + amount;
}

/** A dungeon is open once the one before it was cleared. */
export function dungeonUnlocked(ctx: GameContext, dungeonId: string): boolean {
  if (!ctx.content.rpgDungeons.has(dungeonId)) return false;
  const req = ctx.content.rpgDungeons.get(dungeonId).requires;
  return !req || (ctx.state.rpg.cleared[req] ?? 0) > 0;
}

/** Starts a run with one monster for one Fackel. A monster at work leaves its building. */
export function startRpgRun(ctx: GameContext, creatureId: number, dungeonId: string): ActionResult {
  if (!ctx.state.features['rpg']) return { ok: false, reason: 'Das GenLab RPG ist noch nicht freigeschaltet.' };
  const r = ctx.state.rpg;
  if (r.run) return { ok: false, reason: 'Es läuft bereits ein Lauf.' };
  if (!ctx.content.rpgDungeons.has(dungeonId)) return { ok: false, reason: 'Diesen Dungeon gibt es nicht.' };
  if (!dungeonUnlocked(ctx, dungeonId)) return { ok: false, reason: 'Dieser Dungeon ist noch verschlossen – besiege zuerst den vorigen.' };
  const c = findCreature(ctx, creatureId);
  if (!c) return { ok: false, reason: 'Kreatur nicht gefunden.' };
  const blocker = rpgStartBlocker(ctx, c);
  if (blocker) return { ok: false, reason: blocker };
  if (torches(ctx) < 1) return { ok: false, reason: 'Keine Fackel mehr – die nächste kommt bald.' };
  ctx.state.resources['torches'] = (ctx.state.resources['torches'] ?? D(0)).sub(1);
  if (r.torchAt === 0) r.torchAt = ctx.state.lastTickAt;
  c.job = { kind: 'rpg', target: 'run' };
  ctx.invalidate();
  r.run = {
    creatureId: c.id, dungeon: dungeonId, choices: [], room: null, event: null, eventResult: null, hp: rpgMaxHp(ctx, c), level: 1, xp: 0, upgrades: [], offer: [], pendingLevels: 0, depth: 0,
    loot: {}, secured: {}, gear: [], securedGear: [], startedAt: ctx.state.lastTickAt, battle: null,
  };
  r.runs++;
  pruneRanks(ctx);
  offerRooms(ctx, r.run);
  // Erfahrungsrang: every rankUpgradeEvery-th rank one upgrade to choose right away.
  const starts = Math.floor(rpgRank(ctx, c.id).rank / ctx.balance.rpg.rankUpgradeEvery);
  if (starts > 0) {
    r.run.pendingLevels = starts - 1;
    offerUpgrades(ctx, r.run);
  }
  return { ok: true };
}

function addLoot(into: Record<string, number>, from: Record<string, number>, share = 1): void {
  for (const [res, amount] of Object.entries(from)) {
    const v = Math.floor(amount * share);
    if (v > 0) into[res] = (into[res] ?? 0) + v;
  }
}

/** Loot key that is no resource: each sample catalogues an allele missing in the gene library. */
export const ALLELE_SAMPLES = 'alleleSamples';

/** This week's record of capped loot (a new week starts empty). */
function weekly(ctx: GameContext): { week: number; got: Record<string, number> } {
  const w = ctx.state.rpg.weekly;
  const week = weekIndex(ctx.balance.weekly.epoch, ctx.state.lastTickAt);
  if (w.week !== week) {
    w.week = week;
    w.got = {};
  }
  return w;
}

/** How much more of a capped loot the dungeon may still give this week (Infinity = no cap). */
export function weeklyRoom(ctx: GameContext, res: string): number {
  const cap = ctx.balance.rpg.weeklyCap[res];
  if (cap === undefined) return Infinity;
  const carried = ctx.state.rpg.run?.loot[res] ?? 0;
  return Math.max(0, cap - (weekly(ctx).got[res] ?? 0) - carried);
}

function payOut(ctx: GameContext, loot: Record<string, number>): void {
  const w = weekly(ctx);
  for (const [res, amount] of Object.entries(loot)) {
    if (res === ALLELE_SAMPLES) catalogueSamples(ctx, amount);
    else grant(ctx, res, amount, 'rpg');
    if (ctx.balance.rpg.weeklyCap[res] !== undefined) w.got[res] = (w.got[res] ?? 0) + amount;
  }
}

/** Puts found equipment into the player's collection; pieces beyond its limit are taken apart for Runen. Returns what fit. */
function keepGear(ctx: GameContext, items: RpgItem[]): RpgItem[] {
  const r = ctx.state.rpg;
  const fit = items.slice(0, Math.max(0, ctx.balance.rpg.maxItems - r.items.length));
  r.items.push(...fit);
  for (const item of items.slice(fit.length)) grant(ctx, 'runes', salvageValue(ctx, item), 'rpg:salvage');
  return fit;
}

/** Runen for taking a piece apart. */
export function salvageValue(ctx: GameContext, item: RpgItem): number {
  return ctx.balance.rpg.salvage[item.rarity] ?? 1;
}

/** Takes a piece of equipment apart for Runen (not while it is worn). */
export function salvageItem(ctx: GameContext, itemId: number): ActionResult {
  const r = ctx.state.rpg;
  const item = r.items.find((i) => i.id === itemId);
  if (!item) return { ok: false, reason: 'Diese Ausrüstung besitzt du nicht.' };
  if (Object.values(r.equipped).includes(itemId)) return { ok: false, reason: 'Lege sie zuerst ab.' };
  r.items = r.items.filter((i) => i !== item);
  grant(ctx, 'runes', salvageValue(ctx, item), 'rpg:salvage');
  return { ok: true };
}

// ---- Runen-Fortschritt --------------------------------------------------------

/** Runen for the next level (null at the maximum). */
export function metaCost(ctx: GameContext, id: string): number | null {
  const def = ctx.content.rpgMeta.get(id);
  const level = ctx.state.rpg.meta[id] ?? 0;
  return level >= def.maxLevel ? null : Math.ceil(def.cost * Math.pow(def.costGrowth, level));
}

export function buyMeta(ctx: GameContext, id: string): ActionResult {
  if (!ctx.state.features['rpg']) return { ok: false, reason: 'Das GenLab RPG ist noch nicht freigeschaltet.' };
  if (!ctx.content.rpgMeta.has(id)) return { ok: false, reason: 'Das gibt es nicht.' };
  const cost = metaCost(ctx, id);
  if (cost === null) return { ok: false, reason: 'Schon auf der höchsten Stufe.' };
  const owned = ctx.state.resources['runes'] ?? D(0);
  if (owned.lt(cost)) return { ok: false, reason: 'Nicht genug Runen.' };
  ctx.state.resources['runes'] = owned.sub(cost);
  ctx.state.rpg.meta[id] = (ctx.state.rpg.meta[id] ?? 0) + 1;
  refreshTorches(ctx);
  return { ok: true };
}

/** Makes the carried loot safe (rest points): it is paid out at once. */
export function secureLoot(ctx: GameContext): void {
  const run = ctx.state.rpg.run;
  if (!run) return;
  payOut(ctx, run.loot);
  addLoot(run.secured, run.loot);
  run.loot = {};
  run.securedGear.push(...keepGear(ctx, run.gear));
  run.gear = [];
}

/**
 * Ends the run. Leaving (win) brings all carried loot home, a defeat keeps
 * `defeatKeep` of it. Secured loot was paid out already.
 */
export function finishRpgRun(ctx: GameContext, win: boolean, cleared = false): void {
  const r = ctx.state.rpg;
  const run = r.run;
  if (!run) return;
  const kept: Record<string, number> = {};
  addLoot(kept, run.loot, win ? 1 : ctx.balance.rpg.defeatKeep);
  payOut(ctx, kept);
  const total: Record<string, number> = { ...run.secured };
  addLoot(total, kept);
  // Carried equipment only comes home when the hero walks out.
  const gear = [...run.securedGear, ...(win ? keepGear(ctx, run.gear) : [])];
  const c = findCreature(ctx, run.creatureId);
  if (c?.job?.kind === 'rpg') c.job = null;
  r.best[run.dungeon] = Math.max(r.best[run.dungeon] ?? 0, run.depth);
  if (cleared) r.cleared[run.dungeon] = (r.cleared[run.dungeon] ?? 0) + 1;
  r.lastResult = { win, dungeon: run.dungeon, cleared, depth: run.depth, level: run.level, loot: total, gear, at: ctx.state.lastTickAt };
  r.run = null;
  pruneRanks(ctx);
  ctx.invalidate();
  ctx.bus.emit('rpgRunEnded', { win, cleared });
}

/** The player leaves the dungeon with everything carried. */
export function leaveRpgRun(ctx: GameContext): ActionResult {
  if (!ctx.state.rpg.run) return { ok: false, reason: 'Es läuft kein Lauf.' };
  if (ctx.state.rpg.run.battle) return { ok: false, reason: 'Mitten im Kampf kannst du nicht fliehen.' };
  finishRpgRun(ctx, true);
  return { ok: true };
}

// ---- Kampf ------------------------------------------------------------------

/** Starts a fight of the running run against a foe (the dungeon picks kind, species and floor). */
export function startRpgBattle(ctx: GameContext, enemyId: string, speciesId: string, floor: number): ActionResult {
  const run = ctx.state.rpg.run;
  const hero = rpgHero(ctx);
  if (!run || !hero) return { ok: false, reason: 'Es läuft kein Lauf.' };
  if (run.battle) return { ok: false, reason: 'Es läuft bereits ein Kampf.' };
  run.battle = newBattle(heroCombatant(ctx, hero, run.hp, run.upgrades), makeFoe(ctx, enemyId, speciesId, floor));
  run.battle.charge = Math.min(1, metaEffects(ctx).startCharge);
  return { ok: true };
}

/** The hero's skills in the running run (button order). */
export function rpgSkills(ctx: GameContext): RpgSkillDef[] {
  const hero = rpgHero(ctx);
  return hero ? rpgSkillsFor(ctx, hero) : [];
}

/** The player uses a skill: one round of the fight. A won fight hands back to the dungeon, a lost one ends the run. */
export function useRpgSkill(ctx: GameContext, skillId: string): ActionResult {
  const run = ctx.state.rpg.run;
  const battle = run?.battle;
  if (!run || !battle) return { ok: false, reason: 'Gerade läuft kein Kampf.' };
  const skill = rpgSkills(ctx).find((k) => k.id === skillId);
  if (!skill) return { ok: false, reason: 'Diese Fähigkeit hat dein Monster nicht.' };
  const blocker = skillBlocker(battle, skill);
  if (blocker) return { ok: false, reason: blocker };
  const outcome = playRound(ctx, battle, skill, heroPerks(ctx, run.upgrades));
  run.hp = battle.hero.hp;
  ctx.bus.emit('rpgRound', { events: battle.last ?? [], outcome, boss: battle.foe.kind === 'boss' });
  if (outcome === 'lose') finishRpgRun(ctx, false);
  else if (outcome === 'win') winBattle(ctx, run);
  return { ok: true };
}

function winBattle(ctx: GameContext, run: RpgRun): void {
  const kind = run.room === 'boss' ? 'boss' : run.room === 'elite' ? 'elite' : 'fight';
  run.battle = null;
  rollLoot(ctx, run, kind);
  if (kind === 'boss') {
    addRankXp(ctx, run.creatureId, ctx.balance.rpg.rankXpBoss);
    finishRpgRun(ctx, true, true);
    return;
  }
  gainXp(ctx, run, ctx.balance.rpg.xp[kind]);
  roomDone(ctx, run);
}

// ---- Stufen -------------------------------------------------------------------

/** XP from `level` to the next. */
export function xpToNext(ctx: GameContext, level: number): number {
  const cfg = ctx.balance.rpg;
  return Math.round(cfg.xpBase * Math.pow(cfg.xpGrowth, level - 1));
}

/** Adds XP; every level-up heals a little and offers upgrades (one offer at a time, the rest wait). */
export function gainXp(ctx: GameContext, run: RpgRun, amount: number): void {
  const hero = findCreature(ctx, run.creatureId);
  if (!hero) return;
  run.xp += amount;
  addRankXp(ctx, run.creatureId, amount);
  while (run.xp >= xpToNext(ctx, run.level)) {
    run.xp -= xpToNext(ctx, run.level);
    run.level++;
    ctx.bus.emit('rpgLevelUp', { level: run.level });
    const maxHp = rpgMaxHp(ctx, hero, run.upgrades);
    run.hp = Math.min(maxHp, run.hp + Math.round(maxHp * ctx.balance.rpg.levelHeal));
    if (run.offer.length === 0) offerUpgrades(ctx, run);
    else run.pendingLevels++;
  }
}

/** Draws the upgrades for a level-up: different ones, none that is already at its limit. */
function offerUpgrades(ctx: GameContext, run: RpgRun): void {
  const weights: Record<string, number> = {};
  for (const u of ctx.content.rpgUpgrades.list) {
    const taken = run.upgrades.filter((id) => id === u.id).length;
    if (u.max === undefined || taken < u.max) weights[u.id] = u.weight;
  }
  const out: string[] = [];
  while (out.length < ctx.balance.rpg.upgradeChoices && Object.values(weights).some((w) => w > 0)) {
    const id = ctx.rng.weighted(weights);
    out.push(id);
    weights[id] = 0;
  }
  run.offer = out;
}

/** Takes one of the offered upgrades. More KP also raise the current KP. */
export function chooseUpgrade(ctx: GameContext, index: number): ActionResult {
  const run = ctx.state.rpg.run;
  if (!run || run.offer.length === 0) return { ok: false, reason: 'Gerade gibt es nichts zu wählen.' };
  const id = run.offer[index];
  if (!id) return { ok: false, reason: 'Diese Wahl gibt es nicht.' };
  const hero = rpgHero(ctx)!;
  const before = rpgMaxHp(ctx, hero, run.upgrades);
  run.upgrades.push(id);
  run.hp += Math.max(0, rpgMaxHp(ctx, hero, run.upgrades) - before);
  run.offer = [];
  if (run.pendingLevels > 0) {
    run.pendingLevels--;
    offerUpgrades(ctx, run);
  }
  return { ok: true };
}

// ---- Dungeon ------------------------------------------------------------------

/** Strength of the current room on the tower scale. */
export function roomFloor(ctx: GameContext, run: RpgRun): number {
  const d = ctx.content.rpgDungeons.get(run.dungeon);
  return Math.round(d.floor + Math.max(0, run.depth - 1) * d.floorsPerRoom);
}

/** Fixed loot of a room kind in this dungeon (before chances and the weekly cap). */
export function roomLoot(ctx: GameContext, run: RpgRun, kind: 'fight' | 'elite' | 'treasure' | 'boss'): Record<string, number> {
  const mult = ctx.content.rpgDungeons.get(run.dungeon).loot;
  const out: Record<string, number> = {};
  for (const [res, amount] of Object.entries(ctx.balance.rpg.loot[kind]?.fixed ?? {})) {
    const v = Math.round(amount * mult);
    if (v > 0) out[res] = v;
  }
  return out;
}

/** Chance of one piece of `res` from a room kind in this dungeon. */
export function lootChance(ctx: GameContext, run: RpgRun, kind: 'fight' | 'elite' | 'treasure' | 'boss', res: string): number {
  const p = ctx.balance.rpg.loot[kind]?.chance?.[res] ?? 0;
  return Math.min(1, p * ctx.content.rpgDungeons.get(run.dungeon).loot);
}

/** Rolls a room's loot (fixed amounts and chances) into the carried loot, within the weekly cap. */
function rollLoot(ctx: GameContext, run: RpgRun, kind: 'fight' | 'elite' | 'treasure' | 'boss', times = 1): void {
  const found: Record<string, number> = {};
  addLoot(found, roomLoot(ctx, run, kind), times);
  for (const res of Object.keys(ctx.balance.rpg.loot[kind]?.chance ?? {})) {
    if (ctx.rng.chance(Math.min(1, lootChance(ctx, run, kind, res) * times))) found[res] = (found[res] ?? 0) + 1;
  }
  for (const [res, amount] of Object.entries(found)) {
    const v = Math.min(amount, weeklyRoom(ctx, res));
    if (v > 0) run.loot[res] = (run.loot[res] ?? 0) + v;
  }
  const gearChance = Math.min(1, (ctx.balance.rpg.gearChance[kind] ?? 0) * ctx.content.rpgDungeons.get(run.dungeon).loot * times);
  if (ctx.rng.chance(gearChance)) run.gear.push(rollItem(ctx, run.dungeon));
}

/** A new piece of equipment from a dungeon: deeper dungeons give rarer pieces more often. */
export function rollItem(ctx: GameContext, dungeonId: string): RpgItem {
  const cfg = ctx.balance.rpg;
  const loot = ctx.content.rpgDungeons.get(dungeonId).loot;
  const weights: Record<string, number> = {};
  for (const [rarity, w] of Object.entries(cfg.gearRarityWeights)) {
    const order = ctx.content.rarities.has(rarity) ? ctx.content.rarities.get(rarity).order : 0;
    weights[rarity] = w * (1 + (loot - 1) * cfg.gearRarityShift * order);
  }
  const gear = ctx.rng.pick(ctx.content.rpgGear.list).id;
  return { id: ctx.state.rpg.nextItemId++, gear, rarity: ctx.rng.weighted(weights) };
}

// ---- Ausrüstung ---------------------------------------------------------------

/** Wears a piece in its slot (or takes the slot off with null). Not during a run. */
export function equipItem(ctx: GameContext, slot: RpgGearSlot, itemId: number | null): ActionResult {
  const r = ctx.state.rpg;
  if (!ctx.state.features['rpg']) return { ok: false, reason: 'Das GenLab RPG ist noch nicht freigeschaltet.' };
  if (r.run) return { ok: false, reason: 'Während eines Laufs nicht änderbar.' };
  if (itemId !== null) {
    const item = r.items.find((i) => i.id === itemId);
    if (!item) return { ok: false, reason: 'Diese Ausrüstung besitzt du nicht.' };
    if (ctx.content.rpgGear.get(item.gear).slot !== slot) return { ok: false, reason: 'Das passt nicht in diesen Platz.' };
  }
  r.equipped[slot] = itemId;
  return { ok: true };
}

/** Offers the next ways: 2–3 different rooms, or the boss after the last room. */
function offerRooms(ctx: GameContext, run: RpgRun): void {
  const d = ctx.content.rpgDungeons.get(run.dungeon);
  if (run.depth >= d.rooms) {
    run.choices = ['boss'];
    return;
  }
  const [min, max] = ctx.balance.rpg.choices;
  const weights: Record<string, number> = { ...ctx.balance.rpg.roomWeights };
  const out: RpgRoomKind[] = [];
  const count = ctx.rng.int(min, max);
  while (out.length < count && Object.values(weights).some((w) => w > 0)) {
    const kind = ctx.rng.weighted(weights) as RpgRoomKind;
    out.push(kind);
    weights[kind] = 0;
  }
  run.choices = out;
}

function roomDone(ctx: GameContext, run: RpgRun): void {
  run.room = null;
  offerRooms(ctx, run);
}

/** Species a foe of this dungeon can be: bosses take the strongest form of the dungeon's elements. */
function foeSpecies(ctx: GameContext, run: RpgRun, boss: boolean): string {
  const d = ctx.content.rpgDungeons.get(run.dungeon);
  const pool = ctx.content.species.list.filter((sp) => d.elements.includes(sp.element));
  if (!boss) {
    const plain = pool.filter((sp) => sp.tier === 'base' || sp.tier === 'hybrid');
    return ctx.rng.pick(plain.length ? plain : pool).id;
  }
  const order: Record<string, number> = { base: 0, hybrid: 1, rareHybrid: 2, mythic: 3 };
  const top = Math.max(...pool.map((sp) => order[sp.tier] ?? 0));
  return ctx.rng.pick(pool.filter((sp) => (order[sp.tier] ?? 0) === top)).id;
}

/** Goes into one of the offered rooms. Fights start at once; treasure and rest take effect right away. */
export function enterRoom(ctx: GameContext, index: number): ActionResult {
  const run = ctx.state.rpg.run;
  if (!run) return { ok: false, reason: 'Es läuft kein Lauf.' };
  if (run.battle || run.event) return { ok: false, reason: 'Erst diesen Raum abschließen.' };
  if (run.offer.length > 0) return { ok: false, reason: 'Wähle zuerst eine Verbesserung.' };
  const kind = run.choices[index];
  if (!kind) return { ok: false, reason: 'Diesen Weg gibt es nicht.' };
  run.choices = [];
  run.depth++;
  run.room = kind;
  run.eventResult = null;
  const hero = rpgHero(ctx)!;
  switch (kind) {
    case 'fight':
    case 'elite':
    case 'boss': {
      const enemyKind = kind === 'fight' ? 'normal' : kind;
      const enemy = ctx.rng.pick(ctx.content.rpgEnemies.list.filter((e) => e.kind === enemyKind));
      return startRpgBattle(ctx, enemy.id, foeSpecies(ctx, run, kind === 'boss'), roomFloor(ctx, run));
    }
    case 'treasure':
      rollLoot(ctx, run, 'treasure');
      break;
    case 'event': {
      const events = ctx.content.rpgEvents.list;
      run.event = ctx.rng.weighted(Object.fromEntries(events.map((e) => [e.id, e.weight])));
      return { ok: true };
    }
    case 'rest':
      run.hp = Math.min(rpgMaxHp(ctx, hero, run.upgrades), run.hp + Math.round(rpgMaxHp(ctx, hero, run.upgrades) * (ctx.balance.rpg.restHeal + metaEffects(ctx).restHeal)));
      secureLoot(ctx);
      break;
  }
  roomDone(ctx, run);
  return { ok: true };
}

/** The player decides an event: the option's outcome (or its failure) happens, then the ways ahead open. */
export function chooseEventOption(ctx: GameContext, index: number): ActionResult {
  const run = ctx.state.rpg.run;
  if (!run?.event) return { ok: false, reason: 'Gerade wartet kein Ereignis.' };
  const option = ctx.content.rpgEvents.get(run.event).options[index];
  if (!option) return { ok: false, reason: 'Diese Wahl gibt es nicht.' };
  const works = option.chance === undefined || ctx.rng.chance(option.chance);
  const outcome: RpgEventOutcome = works ? option : option.fail!;
  const maxHp = rpgMaxHp(ctx, rpgHero(ctx)!, run.upgrades);
  if (outcome.hp) run.hp = Math.min(maxHp, Math.max(1, run.hp + Math.round(maxHp * outcome.hp)));
  if (outcome.loot) rollLoot(ctx, run, 'treasure', outcome.loot);
  if (outcome.secure) secureLoot(ctx);
  run.event = null;
  run.eventResult = outcome.result;
  roomDone(ctx, run);
  return { ok: true };
}

// ---- Vorschau und Anzeige ---------------------------------------------------

/** The RPG is still a preview apart from the normal game: switched on and off by hand (options). */
export function setRpgPreview(ctx: GameContext, on: boolean): ActionResult {
  if (on) {
    if (!ctx.state.features['rpg']) unlockFeature(ctx, 'rpg');
    refreshTorches(ctx);
    return { ok: true };
  }
  if (ctx.state.rpg.run) return { ok: false, reason: 'Beende zuerst den laufenden Lauf.' };
  ctx.state.features['rpg'] = false;
  ctx.invalidate();
  return { ok: true };
}

/** Monsters that could enter the dungeon now, strongest first. */
export function rpgCandidates(ctx: GameContext): Creature[] {
  const power = new Map(ctx.state.creatures.map((c) => [c.id, creaturePower(ctx, c)]));
  return ctx.state.creatures.filter((c) => rpgStartBlocker(ctx, c) === null).sort((a, b) => power.get(b.id)! - power.get(a.id)!);
}

export const ROOM_INFO: Record<RpgRoomKind, { name: string; icon: string; hint: string }> = {
  fight: { name: 'Kampf', icon: '⚔️', hint: 'Ein Gegner – Beute und Erfahrung.' },
  elite: { name: 'Elite', icon: '💀', hint: 'Ein starker Gegner – mehr Beute und Erfahrung.' },
  treasure: { name: 'Schatz', icon: '💰', hint: 'Beute ohne Kampf.' },
  rest: { name: 'Rast', icon: '🏕️', hint: 'Heilen und die Beute sichern.' },
  event: { name: 'Ereignis', icon: '❔', hint: 'Etwas Unerwartetes – du entscheidest.' },
  boss: { name: 'Boss', icon: '👑', hint: 'Der Herr des Dungeons. Sieg = Dungeon geschafft.' },
};

export const INTENT_INFO: Record<RpgIntent, { name: string; icon: string; hint: string }> = {
  attack: { name: 'Angriff', icon: '🗡️', hint: 'Greift normal an.' },
  charge: { name: 'Lädt auf', icon: '⚡', hint: 'Sammelt Kraft – danach kommt ein schwerer Schlag.' },
  heavy: { name: 'Schwerer Schlag', icon: '💢', hint: 'Ein sehr starker Treffer. Schild, Deckung oder Betäubung helfen.' },
  guard: { name: 'Deckung', icon: '🛡️', hint: 'Ein Schild fängt in dieser Runde Schaden ab.' },
  heal: { name: 'Heilung', icon: '💚', hint: 'Heilt sich.' },
  tech: { name: 'Element-Technik', icon: '✨', hint: 'Setzt seine Element-Technik ein.' },
};

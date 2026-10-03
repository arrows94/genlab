import type { Rng } from '../rng';
import type { GameContext } from '../context';
import type { FightStats } from '../state';
import type { BossTraitDef, StatusId, TargetingMode, TechniqueDef } from '../content/types';

/**
 * Fight engine of the Genom-Turm (the Wochen-Boss uses it too): fighters, the
 * damage rules and `simulateFight` on the Aktionsleiste. It reads no game state
 * besides content and balance and changes only the fighters passed in and the
 * RNG. `tower.ts` re-exports everything public here.
 */

export interface Fighter {
  name: string;
  /** Species (for the arena artwork). */
  speciesId: string;
  element: string;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  /** Damage multiplier (tower.damage). */
  power: number;
  /** Extra multiplier on super-effective hits (tower.elementDamage). */
  elementPower: number;
  team: boolean;
  /** Boss trait id (`bossTraits`), enemies only. */
  trait?: string;
  /** Team row: the front row takes most enemy attacks. */
  row?: Row;
  /** Element-Technik id (used every `techniqueEvery`-th action). */
  technique?: string;
  /** Chance of a critical hit (tower.crit). */
  crit?: number;
  /** Share of the damage taken that goes back to the attacker (tower.thorns, „Dornenhaut“). */
  thorns?: number;
  /** Acts almost at once in a fight (tower.firstStrike ≥ 1). */
  firstStrike?: boolean;
  /** Extra chance that its own attacks miss (darkness in the Genom-Keller). */
  miss?: number;
  /** Multiplier on the healing it receives (Schatten-Aura: 0.5). */
  healing?: number;
  /** Colour cast in the arena (foes of the Genom-Keller). */
  tint?: string;
  /** „Schatten deiner Dynastie“: drawn as a dark copy in the arena. */
  shadow?: boolean;
  /** Boss of its floor (crown in the arena). */
  boss?: boolean;
  /** Wächter of its floor (a stronger single enemy between the bosses). */
  guard?: boolean;
  /** Second boss trait that wakes below half HP (Phase 2). */
  phaseTrait?: string;
}

export type Row = 'front' | 'back';

export interface Synergy {
  kind: 'pair' | 'diversity';
  /** Elements involved. */
  elements: string[];
  /** Bonus share (ANG for pairs, damage against the Wandler for diversity). */
  value: number;
  /** Only against a shifting boss. */
  active: boolean;
}

/**
 * Team synergies: every element with two or more members gives those
 * members +pairBonus ANG; three or more different elements give the whole
 * team +diversityBonus damage against the Wandler.
 */
export function teamSynergies(ctx: GameContext, elements: string[], enemyTrait?: string): Synergy[] {
  const t = ctx.balance.tower;
  const counts = new Map<string, number>();
  for (const e of elements) counts.set(e, (counts.get(e) ?? 0) + 1);
  const out: Synergy[] = [...counts.entries()].filter(([, n]) => n >= 2).map(([e]) => ({ kind: 'pair' as const, elements: [e], value: t.pairBonus, active: true }));
  if (counts.size >= 3) {
    const trait = enemyTrait && ctx.content.bossTraits.has(enemyTrait) ? ctx.content.bossTraits.get(enemyTrait) : null;
    out.push({ kind: 'diversity', elements: [...counts.keys()], value: t.diversityBonus, active: trait?.kind === 'shift' });
  }
  return out;
}

/** Wut factor on enemy damage after `seconds` of fighting (1 before `enrageAfterSec`). */
export function enrageFactor(ctx: GameContext, seconds: number): number {
  const t = ctx.balance.tower;
  return seconds > t.enrageAfterSec ? 1 + t.enrageGrowth * (seconds - t.enrageAfterSec) : 1;
}

export function elementMultiplier(ctx: GameContext, attacker: string, defender: string): number {
  if (ctx.content.elements.get(attacker).strongAgainst.includes(defender)) return ctx.balance.tower.strongMult;
  if (ctx.content.elements.get(defender).strongAgainst.includes(attacker)) return ctx.balance.tower.weakMult;
  return 1;
}

/**
 * First step of the defence: the share of a hit that gets through, 1 / (1 + defWeight × VER / ANG).
 * Only the ratio counts, so a fight lasts about as long on every floor – with a fixed scale fights
 * high up grew longer and longer (VER grows with the floor, the damage per hit did not).
 */
export function defFactor(ctx: GameContext, def: number, atk: number): number {
  return 1 / (1 + (ctx.balance.tower.defWeight * def) / Math.max(1, atk));
}

/**
 * Damage of one hit: attack × multipliers, reduced by defence in two steps –
 * `defFactor` and then a share that depends on VER against the attacker's ANG
 * (up to `defRatio` when VER ≫ ANG). Both only look at ratios, so they work
 * the same on every floor. A hit always does at least 1.
 */

export function damage(ctx: GameContext, att: Fighter, def: Fighter, rng: Rng): number {
  const t = ctx.balance.tower;
  const mult = elementMultiplier(ctx, att.element, def.element);
  const elem = mult > 1 ? mult * att.elementPower : mult;
  const raw = att.atk * att.power * elem * rng.range(0.9, 1.1);
  const guard = 1 - t.defRatio * (def.def / Math.max(1, def.def + att.atk));
  const reduced = raw * defFactor(ctx, def.def, att.atk * att.power) * guard;
  return Math.max(1, Math.round(reduced));
}

/**
 * Target of an enemy attack. rows: the front row with `frontShare` (if both
 * rows stand), back: the same for the back row, weakest: least HP left.
 */
export function pickTarget(ctx: GameContext, mode: TargetingMode, alive: Fighter[], rng: Rng): Fighter {
  if (mode === 'weakest') return alive.reduce((a, b) => (b.hp < a.hp ? b : a));
  const front = alive.filter((f) => f.row !== 'back');
  const back = alive.filter((f) => f.row === 'back');
  if (front.length === 0 || back.length === 0) return rng.pick(alive);
  const preferred = mode === 'back' ? back : front;
  const other = mode === 'back' ? front : back;
  return rng.pick(rng.chance(ctx.balance.tower.frontShare) ? preferred : other);
}

/**
 * One moment of a fight for the replay: attacker/target are indices into
 * `[...team, enemy]`. `kind` is missing for a normal hit.
 */
export interface FightEvent {
  /** Fight time in seconds. */
  at: number;
  a: number;
  t: number;
  dmg: number;
  /** Target HP after the event. */
  hp: number;
  /** Element multiplier of the hit (>1 super effective, <1 resisted). */
  m: number;
  /**
   * (none): normal hit · miss: dodged (dmg 0) · heal: HP healed (dmg = amount) ·
   * shift: the boss changes its element (a = t) · tech: a technique is used (dmg = its hit) ·
   * status: a status lands on t · dot: burn/poison tick (a = t) · reflect: damage thrown back at t ·
   * enrage: the enemies' Wut begins (a = t = the first enemy standing).
   */
  kind?: 'miss' | 'heal' | 'shift' | 'tech' | 'status' | 'dot' | 'reflect' | 'phase' | 'sweep' | 'enrage';
  /** New element after a shift. */
  element?: string;
  /** Technique id (tech events). */
  tech?: string;
  /** Status id and until when it lasts (status, dot events). */
  status?: StatusId;
  until?: number;
  /** A critical hit. */
  crit?: boolean;
  /** Damage a shield caught. */
  absorbed?: number;
  /** Boss trait that woke up (phase events). */
  trait?: string;
}

/** Snapshot of a fighter for replaying a fight in the UI. */
export interface FighterSnapshot {
  name: string;
  speciesId: string;
  element: string;
  maxHp: number;
  team: boolean;
  /** Seconds between two actions (Aktionsleiste). */
  interval: number;
  /** Row (team; enemies: companions in front of their boss). */
  row?: Row;
  /** Boss of the floor. */
  boss?: boolean;
  /** Wächter of the floor. */
  guard?: boolean;
  /** Colour cast in the arena. */
  tint?: string;
  shadow?: boolean;
}

export interface FightResult {
  win: boolean;
  /** All damage the enemy took (hits, techniques, burn, thorns) – the weekly boss counts this. */
  dealt: number;
  /** Fight time in seconds when it ended. */
  seconds: number;
  log: string[];
  fighters: FighterSnapshot[];
  events: FightEvent[];
  /** Totals per fighter (for the defeat analysis). */
  stats: FightStats;
}

// Enough for a long group fight (three foes, five fighters, about 40 s) to replay to the end.
export const MAX_FIGHT_EVENTS = 400;
const maxLog = 24;

/** Seconds between two actions of each fighter: relative to the mean speed of everyone in the fight. */
export function actionIntervals(ctx: GameContext, fighters: Fighter[]): number[] {
  const speeds = fighters.map((f) => Math.max(1, f.spd));
  const mean = speeds.reduce((a, b) => a + b, 0) / Math.max(1, speeds.length);
  return speeds.map((spd) => Math.round(Math.pow(mean / spd, ctx.balance.tower.speedExponent) * 1000) / 1000);
}

/** Chance that `defender` dodges a hit of `attacker`: grows with its speed lead. */
export function evadeChance(ctx: GameContext, attacker: Fighter, defender: Fighter): number {
  const t = ctx.balance.tower;
  const lead = Math.max(1, defender.spd) / Math.max(1, attacker.spd) - 1;
  return Math.min(t.maxEvade, Math.max(0, lead * t.evadePerSpeedLead));
}

/** Statuses that hurt; Läuterung removes them. */
const HARMFUL: StatusId[] = ['burn', 'poison', 'stun', 'slow'];

// ---- Fight state ------------------------------------------------------------

/** A status on a combatant: until when, strength, the source's attack (damage over time) and who put it on. */
interface ActiveStatus {
  until: number;
  value: number;
  src: number;
  by: Combatant;
}

/** One fighter during a fight, with everything the engine tracks for it. */
interface Combatant {
  f: Fighter;
  /** Index in `[...team, ...foes]` – what events and stats refer to. */
  i: number;
  /** On the enemy side (by position, like the indices). */
  foe: boolean;
  /** Seconds between two actions. */
  interval: number;
  /** Fight time of the next action. */
  next: number;
  actions: number;
  /** Damage taken since the last tick (Regeneration). */
  taken: number;
  /** Boss traits; a phase trait joins below half HP. */
  traits: BossTraitDef[];
  /** The phase trait was already checked in. */
  woke: boolean;
  statuses: Map<StatusId, ActiveStatus>;
  technique: TechniqueDef | null;
}

/** Everything one `simulateFight` call shares between its steps. */
interface Fight {
  ctx: GameContext;
  cfg: GameContext['balance']['tower'];
  rng: Rng;
  team: Fighter[];
  foes: Fighter[];
  /** All combatants in `[...team, ...foes]` order. */
  all: Combatant[];
  /** The first combatant of every fighter object (like `indexOf` on the fighter list). */
  byFighter: Map<Fighter, Combatant>;
  leader: Fighter;
  replay: boolean;
  log: string[];
  events: FightEvent[];
  fighters: FighterSnapshot[];
  stats: FightStats;
  dealt: number;
  limit: number;
  enrageOn: boolean;
  enraged: boolean;
  /** The next full second of fight time to tick. */
  tick: number;
  elements: string[];
}

const fmt = (sec: number) => `${sec.toFixed(1).replace('.', ',')} s`;

// Without replay (fights nobody watches, e.g. offline) the events and the protocol stay empty; the outcome is the same.
function note(fight: Fight, line: string): void {
  if (fight.replay && fight.log.length < maxLog) fight.log.push(line);
}

function record(fight: Fight, e: FightEvent): void {
  if (fight.replay && fight.events.length < MAX_FIGHT_EVENTS) fight.events.push({ ...e, at: Math.round(e.at * 100) / 100 });
}

/** Adds `value` to the per-fighter total at `i`. */
function bump(list: number[], i: number, value: number): void {
  list[i] = (list[i] ?? 0) + value;
}

function traitDef(ctx: GameContext, id: string | undefined): BossTraitDef | null {
  return id && ctx.content.bossTraits.has(id) ? ctx.content.bossTraits.get(id) : null;
}

function hasTrait(c: Combatant, kind: BossTraitDef['kind']): BossTraitDef | undefined {
  return c.traits.find((t) => t.kind === kind);
}

/** The status `id` on `c` if it still lasts at `at`. */
function statusOf(c: Combatant, id: StatusId, at: number): ActiveStatus | undefined {
  const st = c.statuses.get(id);
  return st && st.until > at ? st : undefined;
}

function combatantOf(fight: Fight, f: Fighter): Combatant {
  const c = fight.byFighter.get(f);
  if (!c) throw new Error(`Fighter ${f.name} is not part of the fight`);
  return c;
}

const alive = (list: Fighter[]) => list.filter((x) => x.hp > 0);
const weakestShare = (list: Fighter[]) => list.reduce((a, b) => (b.hp / b.maxHp < a.hp / a.maxHp ? b : a));
const foesDown = (fight: Fight) => fight.foes.every((f) => f.hp <= 0);
const teamDown = (fight: Fight) => fight.team.every((t) => t.hp <= 0);
const over = (fight: Fight) => foesDown(fight) || teamDown(fight);
// Wut: enemies hit harder with every second after enrageAfterSec (no hard time limit in the tower).
const wut = (fight: Fight, at: number) => (fight.enrageOn ? enrageFactor(fight.ctx, at) : 1);

function done(fight: Fight, win: boolean, seconds: number, timeout = false): FightResult {
  const secs = Math.round(seconds * 10) / 10;
  const { stats } = fight;
  Object.assign(stats, { hpLeft: fight.all.map((c) => Math.max(0, c.f.hp)), timeout, seconds: secs });
  return { win, dealt: fight.dealt, seconds: secs, log: fight.log, fighters: fight.fighters, events: fight.events, stats };
}

function finish(fight: Fight, at: number): FightResult | null {
  if (foesDown(fight)) {
    fight.log.push(`${fight.foes.length > 1 ? 'Alle Gegner' : fight.leader.name} besiegt nach ${fmt(at)}`);
    return done(fight, true, at);
  }
  if (teamDown(fight)) {
    fight.log.push(`Team besiegt nach ${fmt(at)}`);
    return done(fight, false, at);
  }
  return null;
}

// ---- Damage, healing, statuses ------------------------------------------------

function hurt(fight: Fight, target: Combatant, dmg: number, by: Combatant, at: number): void {
  const wasUp = target.f.hp > 0;
  target.f.hp -= dmg;
  target.taken += dmg;
  if (target.foe) fight.dealt += dmg;
  bump(fight.stats.taken, target.i, dmg);
  bump(fight.stats.dealt, by.i, dmg);
  if (wasUp && target.f.hp <= 0) fight.stats.downAt[target.i] = Math.round(at * 100) / 100;
}

/** Phase 2: a boss gets its second trait once it drops below half HP. */
function checkPhase(fight: Fight, c: Combatant, at: number): void {
  const f = c.f;
  if (c.woke || !f.phaseTrait || f.hp <= 0 || f.hp > f.maxHp * fight.cfg.phaseAt) return;
  const t = traitDef(fight.ctx, f.phaseTrait);
  c.woke = true;
  if (!t) return;
  c.traits.push(t);
  record(fight, { at, a: c.i, t: c.i, dmg: 0, hp: f.hp, m: 1, kind: 'phase', trait: t.id });
  note(fight, `${fmt(at)} · ${f.name} erwacht: ${t.icon} ${t.name}`);
}

/** Damage lands on `target` (after dodging): shield, reflect/thorns. */
function land(fight: Fight, att: Combatant, target: Combatant, dmg: number, at: number, extra: Partial<FightEvent>): void {
  const shield = statusOf(target, 'shield', at);
  let absorbed = 0;
  if (shield) {
    absorbed = Math.min(shield.value, dmg);
    shield.value -= absorbed;
    if (shield.value <= 0) target.statuses.delete('shield');
  }
  const hpDmg = dmg - absorbed;
  hurt(fight, target, hpDmg, att, at);
  record(fight, { at, a: att.i, t: target.i, dmg: hpDmg, hp: Math.max(0, target.f.hp), m: elementMultiplier(fight.ctx, att.f.element, target.f.element), ...(absorbed ? { absorbed } : {}), ...extra });
  // Lebensraub: the boss drinks a share of what it dealt.
  const drain = hasTrait(att, 'drain');
  if (drain && hpDmg > 0 && att.f.hp > 0) heal(fight, att, att, hpDmg * drain.value, at);
  // Dornenhaut and Prisma: a share of the damage goes back to the attacker.
  const back = Math.round(dmg * ((target.f.thorns ?? 0) + (statusOf(target, 'reflect', at)?.value ?? 0)));
  if (back > 0 && att.f.hp > 0 && target.f !== att.f) {
    hurt(fight, att, back, target, at);
    record(fight, { at, a: target.i, t: att.i, dmg: back, hp: Math.max(0, att.f.hp), m: 1, kind: 'reflect' });
    checkPhase(fight, att, at);
  }
  checkPhase(fight, target, at);
}

/** Heals `target` by `amount` (capped at max HP). */
function heal(fight: Fight, by: Combatant, target: Combatant, amount: number, at: number): void {
  const f = target.f;
  const healed = Math.min(f.maxHp - f.hp, Math.round(amount * (f.healing ?? 1)));
  if (healed <= 0 || f.hp <= 0) return;
  f.hp += healed;
  bump(fight.stats.healed, target.i, healed);
  record(fight, { at, a: by.i, t: target.i, dmg: healed, hp: f.hp, m: 1, kind: 'heal' });
}

function addStatus(fight: Fight, by: Combatant, target: Combatant, id: StatusId, duration: number, value: number, at: number): void {
  const f = target.f;
  let until = at + duration;
  let v = value;
  if (id === 'stun') {
    // Betäubung: the next action slips back by `value` own intervals.
    target.next = target.next + target.interval * value;
    until = target.next;
  }
  if (id === 'shield') v = Math.round(value * f.maxHp);
  target.statuses.set(id, { until, value: v, src: by.f.atk * by.f.power, by });
  record(fight, { at, a: by.i, t: target.i, dmg: 0, hp: Math.max(0, f.hp), m: 1, kind: 'status', status: id, until: Math.round(until * 100) / 100 });
}

/** Schrecken: the strongest terror of a standing foe makes the team's attacks miss more often. */
function terrorOf(fight: Fight): number {
  let v = 0;
  for (const c of fight.all) if (c.foe && c.f.hp > 0) v = Math.max(v, hasTrait(c, 'terror')?.value ?? 0);
  return v;
}

/** Element-Schild: damage from the team without element advantage is cut to `shield.value` (at least 1). */
function shieldCut(fight: Fight, shield: BossTraitDef, dmg: number): number {
  const kept = Math.max(1, Math.round(dmg * shield.value));
  fight.stats.shielded += dmg - kept;
  return kept;
}

/** Whom an attacker hits: the team focuses the weakest foe of the front row, foes follow their targeting. */
function targetFor(fight: Fight, att: Combatant): Combatant {
  if (att.f.team) {
    const up = alive(fight.foes);
    const front = up.filter((f) => f.row !== 'back');
    return combatantOf(fight, weakestShare(front.length ? front : up));
  }
  const mode = att.traits[0]?.targeting ?? 'rows';
  return combatantOf(fight, pickTarget(fight.ctx, mode, alive(fight.team), fight.rng));
}

/** One hit (or technique hit) from `a` on `t`; returns false if it was dodged. */
function strike(fight: Fight, a: Combatant, t: Combatant, at: number, mult: number, extra: Partial<FightEvent>): boolean {
  const { ctx, cfg, rng, stats } = fight;
  const att = a.f;
  const target = t.f;
  const m = elementMultiplier(ctx, att.element, target.element);
  const evade = Math.min(0.6, evadeChance(ctx, att, target) + (statusOf(t, 'evade', at)?.value ?? 0)) + (att.miss ?? 0) + (att.team ? terrorOf(fight) : 0);
  if (rng.chance(evade)) {
    bump(stats.missed, a.i, 1);
    bump(stats.dodged, t.i, 1);
    record(fight, { at, a: a.i, t: t.i, dmg: 0, hp: target.hp, m, kind: 'miss', ...(extra.tech ? { tech: extra.tech } : {}) });
    return false;
  }
  const armor = statusOf(t, 'armor', at);
  let dmg = damage(ctx, att, armor ? { ...target, def: target.def * (1 + armor.value) } : target, rng);
  const critChance = att.crit ?? 0;
  const crit = critChance > 0 && rng.chance(critChance);
  if (crit) dmg = Math.round(dmg * cfg.critMult);
  if (mult !== 1) dmg = Math.max(mult > 0 ? 1 : 0, Math.round(dmg * mult));
  // Element-Schild: only hits with element advantage get through in full.
  const shield = hasTrait(t, 'shield');
  if (att.team && shield && m <= 1 && dmg > 0) dmg = shieldCut(fight, shield, dmg);
  if (!att.team && dmg > 0) dmg = Math.round(dmg * wut(fight, at));
  bump(stats.hits, a.i, 1);
  if (m > 1) bump(stats.strong, a.i, 1);
  if (m < 1) bump(stats.weak, a.i, 1);
  land(fight, a, t, dmg, at, { ...extra, ...(crit ? { crit: true } : {}) });
  return true;
}

// ---- Ticks (once per second of fight time) -------------------------------------

/** The enemies' Wut begins (once, on the first tick after `enrageAfterSec`). */
function checkEnrage(fight: Fight): void {
  const { cfg } = fight;
  if (!fight.enrageOn || fight.enraged || fight.tick <= cfg.enrageAfterSec) return;
  fight.enraged = true;
  const first = fight.all.find((c) => c.foe && c.f.hp > 0);
  if (first) record(fight, { at: cfg.enrageAfterSec, a: first.i, t: first.i, dmg: 0, hp: first.f.hp, m: 1, kind: 'enrage' });
  note(fight, `${fmt(cfg.enrageAfterSec)} · Die Gegner werden wütend`);
}

/** Wandler: the enemy steps on to the next element. */
function shiftElements(fight: Fight): void {
  const { elements, tick } = fight;
  for (const c of fight.all) {
    if (!c.foe) continue;
    const f = c.f;
    if (f.hp > 0 && hasTrait(c, 'shift')) {
      f.element = elements[(elements.indexOf(f.element) + 1) % elements.length]!;
      record(fight, { at: tick, a: c.i, t: c.i, dmg: 0, hp: f.hp, m: 1, kind: 'shift', element: f.element });
      note(fight, `${fmt(tick)} · ${f.name} wechselt zu ${fight.ctx.content.elements.get(f.element).name}`);
    }
  }
}

/** Burn, poison and regen tick on `c`; statuses that ran out go away. */
function tickStatuses(fight: Fight, c: Combatant): void {
  const { ctx, tick } = fight;
  const f = c.f;
  if (f.hp <= 0) return;
  for (const [id, st] of c.statuses) {
    if (id === 'burn' || id === 'poison') {
      const by = st.by.f;
      // Damage over time, reduced like a hit by the percentage part of the defence.
      let dmg = Math.max(1, Math.round(st.src * st.value * defFactor(ctx, f.def, st.src) * (by.team ? 1 : wut(fight, tick))));
      // The Element-Schild also dampens burn and poison from a source without element advantage.
      const shield = hasTrait(c, 'shield');
      if (shield && by.team && elementMultiplier(ctx, by.element, f.element) <= 1) dmg = shieldCut(fight, shield, dmg);
      hurt(fight, c, dmg, st.by, tick);
      record(fight, { at: tick, a: c.i, t: c.i, dmg, hp: Math.max(0, f.hp), m: 1, kind: 'dot', status: id });
      checkPhase(fight, c, tick);
    }
    if (id === 'regen') heal(fight, c, c, st.value * f.maxHp, tick);
    if (st.until <= tick) c.statuses.delete(id);
  }
}

/**
 * Regeneration heals a share of the damage taken since the last tick. Scaling with
 * the team's damage (not the boss's max HP) keeps it equally hard on every floor.
 */
function regenerate(fight: Fight): void {
  const { tick } = fight;
  for (const c of fight.all) {
    if (!c.foe) continue;
    const f = c.f;
    const regen = hasTrait(c, 'regen');
    if (!regen || f.hp <= 0) continue;
    const healed = Math.min(f.maxHp - f.hp, Math.round(c.taken * regen.value));
    if (healed > 0) {
      f.hp += healed;
      bump(fight.stats.healed, c.i, healed);
      record(fight, { at: tick, a: c.i, t: c.i, dmg: healed, hp: f.hp, m: 1, kind: 'heal' });
      note(fight, `${fmt(tick)} · ${f.name} heilt ${healed}`);
    }
  }
}

/** Boss traits and statuses tick every full second of fight time up to `now` (stops once a side is down). */
function runTicks(fight: Fight, now: number): void {
  while (fight.tick <= now && fight.tick <= fight.limit) {
    checkEnrage(fight);
    shiftElements(fight);
    for (const c of fight.all) tickStatuses(fight, c);
    regenerate(fight);
    for (const c of fight.all) c.taken = 0;
    if (over(fight)) break;
    fight.tick++;
  }
}

// ---- Actions -------------------------------------------------------------------

/** The next actor: earliest full bar, ties to the faster one, then team before enemies. */
function nextActor(fight: Fight): Combatant | undefined {
  let who: Combatant | undefined;
  for (const c of fight.all) {
    if (c.f.hp <= 0) continue;
    if (!who || c.next < who.next - 1e-9 || (Math.abs(c.next - who.next) < 1e-9 && c.f.spd > who.f.spd)) who = c;
  }
  return who;
}

/** Flächenangriff: the boss hits the whole back row (or everyone, if nobody stands back). */
function sweepAttack(fight: Fight, actor: Combatant, sweep: BossTraitDef, now: number): void {
  const up = alive(fight.team);
  const back = up.filter((f) => f.row === 'back');
  const targets = back.length ? back : up;
  const lead = targets[0]!;
  record(fight, { at: now, a: actor.i, t: combatantOf(fight, lead).i, dmg: 0, hp: lead.hp, m: 1, kind: 'sweep' });
  note(fight, `${fmt(now)} · ${actor.f.name}: ${sweep.icon} ${sweep.name}`);
  for (const tgt of targets) strike(fight, actor, combatantOf(fight, tgt), now, sweep.value, {});
}

/** Support techniques (self, team, weakest ally): no dice for dodging. */
function supportTechnique(fight: Fight, actor: Combatant, tech: TechniqueDef, now: number): void {
  const att = actor.f;
  const own = alive(att.team ? fight.team : fight.foes);
  const targets = tech.target === 'self' ? [att] : tech.target === 'team' ? own : [weakestShare(own)];
  const lead = targets[0]!;
  record(fight, { at: now, a: actor.i, t: combatantOf(fight, lead).i, dmg: 0, hp: Math.max(0, lead.hp), m: 1, kind: 'tech', tech: tech.id });
  note(fight, `${fmt(now)} · ${att.name}: ${tech.icon} ${tech.name}`);
  for (const tgt of targets) {
    const t = combatantOf(fight, tgt);
    if (tech.cleanse) for (const id of HARMFUL) t.statuses.delete(id);
    if (tech.heal) heal(fight, actor, t, tech.heal * tgt.maxHp, now);
    if (tech.status) addStatus(fight, actor, t, tech.status.id, tech.status.duration, tech.status.value, now);
  }
}

/** A normal attack or an attacking technique on the actor's target. */
function attack(fight: Fight, actor: Combatant, tech: TechniqueDef | null, now: number): void {
  const att = actor.f;
  const t = targetFor(fight, actor);
  const target = t.f;
  const hit = strike(fight, actor, t, now, tech ? tech.hit : 1, tech ? { kind: 'tech', tech: tech.id } : {});
  if (!hit) note(fight, `${fmt(now)} · ${target.name} weicht ${tech ? `${tech.name} von ` : ''}${att.name} aus`);
  else {
    if (tech?.status && target.hp > 0) addStatus(fight, actor, t, tech.status.id, tech.status.duration, tech.status.value, now);
    note(fight, `${fmt(now)} · ${att.name} ${tech ? `${tech.icon} ${tech.name}` : 'trifft'}${att.team && fight.foes.length === 1 ? '' : ` ${target.name}`}`);
  }
}

/** One action of `actor` at `now`; returns the result if the fight ends with it. */
function act(fight: Fight, actor: Combatant, now: number): FightResult | null {
  const { cfg } = fight;
  // Verlangsamt: this turn takes longer.
  actor.next = now + actor.interval * (1 + (statusOf(actor, 'slow', now)?.value ?? 0));
  actor.actions++;

  // Flächenangriff: every sweepEvery-th action.
  const sweep = hasTrait(actor, 'sweep');
  if (sweep && actor.actions % cfg.sweepEvery === 0) {
    sweepAttack(fight, actor, sweep, now);
    return finish(fight, now);
  }

  const tech = actor.technique && actor.actions % (actor.f.team ? cfg.techniqueEvery : cfg.enemyTechniqueEvery) === 0 ? actor.technique : null;
  if (tech && tech.target !== 'enemy') {
    supportTechnique(fight, actor, tech, now);
    return null;
  }
  attack(fight, actor, tech, now);
  return finish(fight, now);
}

/**
 * Simulates one floor on a time line (Aktionsleiste): every fighter acts when
 * its bar is full, faster ones more often; faster defenders may dodge. Every
 * `techniqueEvery`-th action is the fighter's Element-Technik (enemies every
 * `enemyTechniqueEvery`-th). Statuses and boss traits tick once per second of
 * fight time; a boss with a `phaseTrait` gains it below half HP. The team
 * focuses the weakest foe of the front row (companions shield their boss).
 * Team synergies apply at the start. Team HP is full at the start of every
 * floor. Deterministic for a given RNG state.
 */
export function simulateFight(ctx: GameContext, team: Fighter[], enemies: Fighter | Fighter[], rng: Rng, opts: { limitSec?: number; replay?: boolean; enrage?: boolean } = {}): FightResult {
  const cfg = ctx.balance.tower;
  const foes = Array.isArray(enemies) ? enemies : [enemies];
  const order = [...team, ...foes];
  const intervals = actionIntervals(ctx, order);
  const fighters: FighterSnapshot[] = order.map((f, i) => ({
    name: f.name, speciesId: f.speciesId, element: f.element, maxHp: f.maxHp, team: f.team, interval: intervals[i] ?? 0,
    ...(f.team ? { row: f.row ?? 'front' } : f.row ? { row: f.row } : {}), ...(f.boss ? { boss: true } : {}), ...(f.guard ? { guard: true } : {}),
    ...(f.tint ? { tint: f.tint } : {}), ...(f.shadow ? { shadow: true } : {}),
  }));
  const zeros = () => order.map(() => 0);
  const stats: FightStats = {
    dealt: zeros(), taken: zeros(), healed: zeros(), hits: zeros(), strong: zeros(), weak: zeros(), missed: zeros(), dodged: zeros(),
    hpLeft: zeros(), downAt: order.map(() => -1), shielded: 0, timeout: false, seconds: 0,
  };
  const leader = foes.find((f) => f.boss) ?? foes[foes.length - 1]!;

  // Synergies: pairs of one element hit harder; a colourful team against the Wandler.
  for (const syn of teamSynergies(ctx, team.map((f) => f.element), leader.trait)) {
    if (!syn.active) continue;
    if (syn.kind === 'pair') for (const f of team) if (f.element === syn.elements[0]) f.atk = Math.round(f.atk * (1 + syn.value));
    if (syn.kind === 'diversity') for (const f of team) f.power *= 1 + syn.value;
  }

  const all = order.map((f, i): Combatant => {
    const interval = intervals[i] ?? 0;
    const trait = traitDef(ctx, f.trait);
    return {
      f, i, foe: i >= team.length, interval,
      // Everyone starts with an empty bar (Erstschlag: acts right away).
      next: f.firstStrike ? Math.min(interval, 0.05) : interval,
      actions: 0, taken: 0, traits: trait ? [trait] : [], woke: false, statuses: new Map(),
      technique: f.technique && (f.team || (!f.boss && cfg.enemyTechniqueEvery > 0)) && ctx.content.techniques.has(f.technique) ? ctx.content.techniques.get(f.technique) : null,
    };
  });
  const byFighter = new Map<Fighter, Combatant>();
  for (const c of all) if (!byFighter.has(c.f)) byFighter.set(c.f, c);

  const fight: Fight = {
    ctx, cfg, rng, team, foes, all, byFighter, leader,
    replay: opts.replay ?? true, log: [], events: [], fighters, stats, dealt: 0,
    limit: opts.limitSec ?? cfg.maxFightSec, enrageOn: opts.enrage ?? true, enraged: false, tick: 1,
    elements: ctx.content.elements.list.map((e) => e.id),
  };

  for (;;) {
    const actor = nextActor(fight);
    // Nobody standing at all: `over` below ends the fight before the actor is needed.
    const now = actor ? actor.next : NaN;
    runTicks(fight, now);
    const ended = over(fight) ? finish(fight, fight.tick) : null;
    if (ended) return ended;
    if (now > fight.limit) {
      fight.log.push('Zeit abgelaufen');
      return done(fight, false, fight.limit, true);
    }
    // Burn or poison may have finished the actor off during the ticks.
    if (!actor || actor.f.hp <= 0) continue;
    const res = act(fight, actor, now);
    if (res) return res;
  }
}

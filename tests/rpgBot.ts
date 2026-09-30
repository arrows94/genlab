import { createCreature } from '@core/creatures';
import { chooseEventOption, chooseUpgrade, enterRoom, leaveRpgRun, rpgSkills, startRpgRun, useRpgSkill } from '@core/features/rpg';
import { foeIntent, heroStats, skillBlocker } from '@core/features/rpgCombat';
import { needed } from './towerCurve';
import type { Game } from '@core/game';
import type { RpgRoomKind } from '@core/content/types';
import type { Creature } from '@core/state';
import { D } from '@core/num';

/**
 * GenLab RPG balancing bot. The hero is one member of a mixed tower team
 * that just holds a floor (see towerCurve.ts), so the dungeon is measured on
 * the tower scale. Strategy: special when ready, heal when low, protect
 * against a shown heavy blow, otherwise the strongest ready move.
 */

const MIXED = ['fire', 'water', 'earth', 'air'];

/** Stats of one member of a mixed team that wins `floor` in half of the fights. */
export function towerMember(g: Game, floor: number): Record<string, number> {
  const k = needed(g, Math.max(1, floor), MIXED);
  return { hp: 3000 * k, atk: 300 * k, def: 150 * k, spd: 60 * Math.sqrt(k) };
}

/** A hero with exactly these dungeon stats (rarity and genome bonuses taken out). */
export function makeHero(g: Game, stats: Record<string, number>, speciesId = 'emberpup'): Creature {
  const c = createCreature(g, { speciesId, rarity: 'common', source: 'other' });
  c.abilities = [];
  c.latent = null;
  c.stats = { hp: 1000, atk: 1000, def: 1000, spd: 1000 };
  const probe = heroStats(g, c);
  c.stats = Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, (v * 1000) / Math.max(1, probe[k as 'hp'] ?? 1000)]));
  return c;
}

const ROOM_PREF: RpgRoomKind[] = ['boss', 'elite', 'fight', 'event', 'treasure', 'rest'];

function pickRoom(g: Game): number {
  const run = g.state.rpg.run!;
  const max = heroStats(g, g.state.creatures.find((c) => c.id === run.creatureId)!, run.upgrades).hp;
  const share = run.hp / max;
  const order: RpgRoomKind[] = share < 0.5 ? ['boss', 'rest', 'treasure', 'event', 'fight', 'elite'] : share < 0.8 ? ['boss', 'fight', 'event', 'treasure', 'rest', 'elite'] : ROOM_PREF;
  const idx = order.map((k) => run.choices.indexOf(k)).find((i) => i >= 0);
  return idx ?? 0;
}

function pickSkill(g: Game): string {
  const b = g.state.rpg.run!.battle!;
  const ready = rpgSkills(g).filter((k) => !skillBlocker(b, k));
  const special = ready.find((k) => k.slot === 'special');
  if (special) return special.id;
  const low = b.hero.hp < b.hero.maxHp * 0.35;
  const heal = ready.find((k) => (k.heal ?? 0) > 0);
  if (low && heal) return heal.id;
  if (foeIntent(g, b.foe) === 'heavy') {
    const guard = ready.find((k) => k.status && ['shield', 'armor', 'stun', 'evade'].includes(k.status.id));
    if (guard) return guard.id;
  }
  const score = (k: (typeof ready)[number]) => k.hit * (k.hits ?? 1) + (k.status && ['burn', 'poison'].includes(k.status.id) ? k.status.value * k.status.rounds : 0);
  return [...ready].sort((a, b) => score(b) - score(a))[0]!.id;
}

export interface RunReport {
  cleared: boolean;
  depth: number;
  level: number;
  rounds: number;
  loot: Record<string, number>;
}

/** Plays one run to its end (boss beaten or hero down). */
export function playRun(g: Game, hero: Creature, dungeon: string): RunReport {
  g.state.resources['torches'] = D(99);
  const ok = startRpgRun(g, hero.id, dungeon);
  if (!ok.ok) throw new Error(ok.reason);
  let rounds = 0;
  for (let guard = 0; guard < 5000 && g.state.rpg.run; guard++) {
    const run = g.state.rpg.run;
    if (run.battle) {
      useRpgSkill(g, pickSkill(g));
      rounds++;
    } else if (run.offer.length > 0) chooseUpgrade(g, 0);
    else if (run.event) chooseEventOption(g, run.hp < 0.3 * heroStats(g, hero, run.upgrades).hp ? 1 : 0);
    else if (run.choices.length > 0) enterRoom(g, pickRoom(g));
    else leaveRpgRun(g);
  }
  const res = g.state.rpg.lastResult!;
  return { cleared: res.cleared, depth: res.depth, level: res.level, rounds, loot: res.loot };
}

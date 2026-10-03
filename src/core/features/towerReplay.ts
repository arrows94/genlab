import type { GameContext } from '../context';
import type { TowerState } from '../state';

/**
 * Fight replay in the tower arena, as pure functions: the tab only draws and
 * plays sounds. `clock` runs in fight seconds; events fire when the clock
 * passes them.
 */

export type LastResult = NonNullable<TowerState['lastResult']>;
export type ReplayEvent = NonNullable<LastResult['events']>[number] & { at: number };

/** Where the replay stands: hit points, current elements, the next event and who acts on whom. */
export interface ReplayState {
  hp: number[];
  elements: string[];
  clock: number;
  idx: number;
  attacker: number;
  target: number;
  /** Active statuses per fighter: status id → until (fight seconds). */
  marks: Record<number, Record<string, number>>;
}

/** Events with their fight time (older saves have no times: spread evenly). */
export function timedEvents(lr: LastResult): ReplayEvent[] {
  return (lr.events ?? []).map((e, i) => ({ ...e, at: e.at ?? (i + 1) * 0.6 }));
}

/** Action interval of every fighter (seconds between two actions). */
export function intervalsOf(lr: LastResult): number[] {
  return (lr.fighters ?? []).map((f) => f.interval ?? 1);
}

/** Start of the replay: everyone at full health and with their own element. */
export function replayStart(lr: LastResult): ReplayState {
  const fighters = lr.fighters ?? [];
  return { hp: fighters.map((f, i) => lr.startHp?.[i] ?? f.maxHp), elements: fighters.map((f) => f.element), clock: 0, idx: 0, attacker: -1, target: -1, marks: {} };
}

/** Hit points and elements after the fight; events are capped, so the outcome decides who is down. */
export function finalState(lr: LastResult): { hp: number[]; elements: string[] } {
  const fighters = lr.fighters ?? [];
  const hp = fighters.map((f, i) => lr.startHp?.[i] ?? f.maxHp);
  const elements = fighters.map((f) => f.element);
  for (const e of lr.events ?? []) {
    hp[e.t] = e.hp;
    if (e.kind === 'shift' && e.element) elements[e.t] = e.element;
  }
  const timeout = lr.stats?.timeout ?? lr.log.at(-1) === 'Zeit abgelaufen';
  fighters.forEach((f, i) => {
    if (lr.win && !f.team) hp[i] = 0;
    if (!lr.win && f.team && !timeout) hp[i] = 0;
  });
  return { hp, elements };
}

/** Seconds the fight lasted (from the fight stats or the log line, else the last event). */
export function fightSeconds(ctx: GameContext, lr: LastResult, events: ReplayEvent[] = timedEvents(lr)): number {
  if (lr.stats) return lr.stats.seconds;
  const m = lr.log.at(-1)?.match(/([\d,]+) s$/);
  if (m) return Number(m[1]!.replace(',', '.'));
  if (lr.log.at(-1) === 'Zeit abgelaufen') return ctx.balance.tower.maxFightSec;
  return events.at(-1)?.at ?? 1;
}

/**
 * Moves the replay to `clock` and returns the new state plus the events that
 * fired on the way (for popups and sounds). The input state is not changed.
 */
export function advanceReplay(state: ReplayState, events: ReplayEvent[], clock: number): { state: ReplayState; fired: { e: ReplayEvent; attackerElement: string }[] } {
  let { idx, attacker, target, marks } = state;
  const hp = [...state.hp];
  const elements = [...state.elements];
  const fired: { e: ReplayEvent; attackerElement: string }[] = [];
  while (idx < events.length && events[idx]!.at <= clock) {
    const e = events[idx]!;
    if (e.kind === 'shift' && e.element) elements[e.t] = e.element;
    else hp[e.t] = e.hp;
    if (e.kind === 'status' && e.status) marks = { ...marks, [e.t]: { ...marks[e.t], [e.status]: e.until ?? e.at } };
    if (!e.kind || e.kind === 'miss' || (e.kind === 'tech' && e.dmg > 0)) {
      attacker = e.a;
      target = e.t;
    }
    fired.push({ e, attackerElement: elements[e.a] ?? 'fire' });
    idx++;
  }
  return { state: { hp, elements, clock, idx, attacker, target, marks }, fired };
}

/** Fill (0…1) of a fighter's action gauge at fight time `clock`. */
export function gauge(clock: number, interval: number): number {
  return interval > 0 ? (clock % interval) / interval : 0;
}

/** The next `count` actions from `clock` on: fighter indices in order (the turn-order strip). */
export function upcomingActions(intervals: number[], alive: boolean[], clock: number, count: number): { i: number; at: number }[] {
  const out: { i: number; at: number }[] = [];
  intervals.forEach((iv, i) => {
    if (!alive[i] || iv <= 0) return;
    for (let k = Math.floor(clock / iv) + 1; out.length < count * intervals.length && k * iv <= clock + count * 2; k++) out.push({ i, at: k * iv });
  });
  return out.sort((a, b) => a.at - b.at).slice(0, count);
}

import type { Balance } from './content/balance';
import type { ContentDB } from './content/types';
import type { GameContext } from './context';
import { EventBus } from './events';
import type { GameEvents } from './gameEvents';
import { ModifierSet } from './modifiers';
import { D } from './num';
import { DEFAULT_PROVIDERS, type ModifierProvider } from './providers';
import { Rng } from './rng';
import { createEmptyState, type GameState } from './state';
import { attachStatistics } from './statistics';
import { DEFAULT_SYSTEMS, type System } from './systems';
import { checkUnlocks } from './systems/unlocks';
import { createCreature, ensureLatentTraits } from './creatures';
import { productionRates } from './systems/production';
import { advanceTimers, offlineCapMs } from './systems/timers';
import { ensureGenomes } from './genetics';
import './features';

export interface GameOptions {
  content: ContentDB;
  balance: Balance;
  /** Existing (loaded) state; a new game is created otherwise. */
  state?: GameState;
  now?: number;
  seed?: number;
  systems?: System[];
  providers?: ModifierProvider[];
}

export interface OfflineReport {
  requestedMs: number;
  /** Fully simulated time (production, automation, tower …), capped. */
  simulatedMs: number;
  capMs: number;
  gained: Record<string, string>;
  /** Finished processes by kind (expeditions, eggs …) – they follow the real clock, not the cap. */
  completed: Record<string, number>;
}

/** A catch-up in progress (see `Game.update` with a budget). */
interface CatchUp {
  requestedMs: number;
  simulatedMs: number;
  capMs: number;
  /** Capped time still to simulate. */
  remainingMs: number;
  before: Record<string, ReturnType<typeof D>>;
  completed: Record<string, number>;
  off: () => void;
}

export class Game implements GameContext {
  readonly content: ContentDB;
  readonly balance: Balance;
  readonly bus = new EventBus<GameEvents>();
  readonly systems: System[];
  readonly providers: ModifierProvider[];
  private _state!: GameState;
  private _rng!: Rng;
  private modCache: ModifierSet | null = null;
  private accumulatorMs = 0;
  private catchUp: CatchUp | null = null;

  constructor(opts: GameOptions) {
    this.content = opts.content;
    this.balance = opts.balance;
    this.systems = opts.systems ?? DEFAULT_SYSTEMS;
    this.providers = opts.providers ?? DEFAULT_PROVIDERS;
    attachStatistics(this.bus, () => this);
    if (opts.state) {
      this.setState(opts.state);
      ensureGenomes(this);
      ensureLatentTraits(this);
    } else this.setState(newGameState(this, opts.now ?? Date.now(), opts.seed ?? Math.floor(Math.random() * 2 ** 32)));
  }

  get state(): GameState {
    return this._state;
  }

  get rng(): Rng {
    return this._rng;
  }

  /** Replaces the state (load, import, prestige tests). */
  setState(state: GameState): void {
    this.cancelCatchUp();
    this._state = state;
    this._rng = new Rng(state.rng);
    this.accumulatorMs = 0;
    this.invalidate();
  }

  /** Load/import: replaces the state and repairs content-dependent data (new gene loci …). */
  loadState(state: GameState): void {
    this.setState(state);
    ensureGenomes(this);
    ensureLatentTraits(this);
  }

  mods(): ModifierSet {
    if (!this.modCache) {
      const set = new ModifierSet();
      for (const provider of this.providers) provider(this, set);
      this.modCache = set;
    }
    return this.modCache;
  }

  invalidate(): void {
    this.modCache = null;
  }

  /** One fixed simulation step. Live play and offline progress both use this. */
  step(dtMs: number): void {
    for (const system of this.systems) system.update(this, dtMs);
    this._state.simTimeMs += dtMs;
  }

  /** Advances by real elapsed time using fixed `tickMs` steps. */
  advance(elapsedMs: number): void {
    const tick = this.balance.sim.tickMs;
    this.accumulatorMs += Math.max(0, elapsedMs);
    while (this.accumulatorMs >= tick) {
      this.step(tick);
      this.accumulatorMs -= tick;
    }
  }

  /**
   * Called from the UI loop with the current wall clock. Long gaps (sleeping
   * tab, closed game) become offline progress. `budgetMs` limits how long one
   * call may compute: a longer catch-up then continues on the next calls (see
   * `catchingUp`) and returns its report when done. The real time those calls
   * take is simulated afterwards like any other gap.
   */
  update(now: number, budgetMs = Infinity): OfflineReport | null {
    if (this.catchUp) return this.continueCatchUp(budgetMs);
    const elapsed = now - this._state.lastTickAt;
    this._state.lastTickAt = now;
    if (elapsed <= 0) return null;
    if (elapsed > this.balance.sim.catchUpThresholdMs) {
      this.beginCatchUp(elapsed);
      return this.continueCatchUp(budgetMs);
    }
    this.advance(elapsed);
    return null;
  }

  offlineCapMs(): number {
    return offlineCapMs(this);
  }

  /** A running catch-up: share already computed (0–1) and the time away it covers; null when none runs. */
  get catchingUp(): { done: number; requestedMs: number } | null {
    const c = this.catchUp;
    if (!c) return null;
    return { done: c.simulatedMs === 0 ? 1 : 1 - c.remainingMs / c.simulatedMs, requestedMs: c.requestedMs };
  }

  /**
   * Offline progress: same `step` logic with coarser steps, capped. Time
   * beyond the cap only advances running timers, so long projects still
   * finish by the real clock while production stays capped.
   */
  simulateOffline(elapsedMs: number): OfflineReport {
    this.cancelCatchUp();
    this.beginCatchUp(elapsedMs);
    return this.continueCatchUp(Infinity)!;
  }

  private beginCatchUp(elapsedMs: number): void {
    const capMs = this.offlineCapMs();
    const simulatedMs = Math.min(elapsedMs, capMs);
    const before: Record<string, ReturnType<typeof D>> = {};
    for (const [k, v] of Object.entries(this._state.resources)) before[k] = v;
    const completed: Record<string, number> = {};
    const off = this.bus.on('processCompleted', ({ kind }) => (completed[kind] = (completed[kind] ?? 0) + 1));
    this.catchUp = { requestedMs: elapsedMs, simulatedMs, capMs, remainingMs: simulatedMs, before, completed, off };
  }

  /** Computes for at most `budgetMs` (at least one step); the report once the catch-up is complete. */
  private continueCatchUp(budgetMs: number): OfflineReport | null {
    const c = this.catchUp!;
    const stepMs = this.balance.sim.offlineStepMs;
    const until = budgetMs === Infinity ? Infinity : performance.now() + budgetMs;
    while (c.remainingMs > 0) {
      const dt = Math.min(stepMs, c.remainingMs);
      this.step(dt);
      c.remainingMs -= dt;
      if (until !== Infinity && performance.now() >= until) break;
    }
    if (c.remainingMs > 0) return null;
    advanceTimers(this, c.requestedMs - c.simulatedMs);
    this.cancelCatchUp();

    const gained: Record<string, string> = {};
    for (const [k, v] of Object.entries(this._state.resources)) {
      const diff = v.sub(c.before[k] ?? D(0));
      if (diff.gt(0)) gained[k] = diff.toString();
    }
    this.bus.emit('offlineProgress', { requestedMs: c.requestedMs, simulatedMs: c.simulatedMs });
    return { requestedMs: c.requestedMs, simulatedMs: c.simulatedMs, capMs: c.capMs, gained, completed: c.completed };
  }

  /** Drops an unfinished catch-up (the state is being replaced). */
  private cancelCatchUp(): void {
    this.catchUp?.off();
    this.catchUp = null;
  }

  productionRates() {
    return productionRates(this);
  }
}

/** Fresh state for a new game: start resources, starter creature, initial unlocks. */
export function newGameState(ctx: Game, now: number, seed: number): GameState {
  const state = createEmptyState(now, seed);
  ctx.setState(state);
  for (const [res, amount] of Object.entries(ctx.balance.start.resources)) state.resources[res] = D(amount);
  createCreature(ctx, { speciesId: ctx.balance.start.species, rarity: ctx.balance.start.rarity, source: 'start' });
  checkUnlocks(ctx);
  return state;
}

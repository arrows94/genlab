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
   * tab, closed game) become offline progress.
   */
  update(now: number): OfflineReport | null {
    const elapsed = now - this._state.lastTickAt;
    this._state.lastTickAt = now;
    if (elapsed <= 0) return null;
    if (elapsed > this.balance.sim.catchUpThresholdMs) return this.simulateOffline(elapsed);
    this.advance(elapsed);
    return null;
  }

  offlineCapMs(): number {
    return offlineCapMs(this);
  }

  /**
   * Offline progress: same `step` logic with coarser steps, capped. Time
   * beyond the cap only advances running timers, so long projects still
   * finish by the real clock while production stays capped.
   */
  simulateOffline(elapsedMs: number): OfflineReport {
    const capMs = this.offlineCapMs();
    const simulatedMs = Math.min(elapsedMs, capMs);
    const before: Record<string, ReturnType<typeof D>> = {};
    for (const [k, v] of Object.entries(this._state.resources)) before[k] = v;
    const completed: Record<string, number> = {};
    const off = this.bus.on('processCompleted', ({ kind }) => (completed[kind] = (completed[kind] ?? 0) + 1));

    const stepMs = this.balance.sim.offlineStepMs;
    let remaining = simulatedMs;
    while (remaining > 0) {
      const dt = Math.min(stepMs, remaining);
      this.step(dt);
      remaining -= dt;
    }
    advanceTimers(this, elapsedMs - simulatedMs);
    off();

    const gained: Record<string, string> = {};
    for (const [k, v] of Object.entries(this._state.resources)) {
      const diff = v.sub(before[k] ?? D(0));
      if (diff.gt(0)) gained[k] = diff.toString();
    }
    this.bus.emit('offlineProgress', { requestedMs: elapsedMs, simulatedMs });
    return { requestedMs: elapsedMs, simulatedMs, capMs, gained, completed };
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

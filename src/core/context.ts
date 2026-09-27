import type { Balance } from './content/balance';
import type { ContentDB } from './content/types';
import type { EventBus } from './events';
import type { GameEvents } from './gameEvents';
import type { ModifierSet } from './modifiers';
import type { Rng } from './rng';
import type { GameState } from './state';

/** Everything a system/action needs. Implemented by `Game`. */
export interface GameContext {
  readonly state: GameState;
  readonly content: ContentDB;
  readonly balance: Balance;
  readonly bus: EventBus<GameEvents>;
  readonly rng: Rng;
  mods(): ModifierSet;
  invalidate(): void;
}

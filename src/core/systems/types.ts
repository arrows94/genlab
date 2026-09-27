import type { GameContext } from '../context';

/** A simulation system, run once per fixed step (live and offline alike). */
export interface System {
  id: string;
  update(ctx: GameContext, dtMs: number): void;
}

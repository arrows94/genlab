import { content, balance } from '@content/index';
import { Game } from '@core/game';
import type { Balance } from '@core/content/balance';

export const NOW = 1_700_000_000_000;

export function makeGame(seed = 42, overrides: Partial<Balance> = {}): Game {
  return new Game({ content, balance: { ...balance, ...overrides }, now: NOW, seed });
}

export { content, balance };

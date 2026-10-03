import type { GameContext } from './context';
import { EGG } from './features/breeding';
import { MISSION } from './features/expedition';
import { VOYAGE } from './features/voyage';
import { DEEP_SEQUENCE, SEQUENCE } from './features/sequencing';
import { GRAND_RESEARCH } from './features/grandResearch';
import { MEGA_PROJECT } from './features/megaProjects';
import { CONTRACT_LOAN } from './features/contracts';
import { PRIMAL_EGG } from './features/primalEggs';
import { recyclingNow } from './features/automation';
import { fightIntervalMs } from './features/tower';
import { cellarIntervalMs } from './features/cellar';
import { isWaiting, processRemainingMs } from './systems/processes';

/** Which tab shows a running process of this kind. New timed systems add their kind here. */
const PROCESS_TABS: Record<string, string> = {
  [EGG]: 'breeding',
  [MISSION]: 'expedition',
  [VOYAGE]: 'expedition',
  [SEQUENCE]: 'genetics',
  [DEEP_SEQUENCE]: 'genetics',
  [GRAND_RESEARCH]: 'research',
  [MEGA_PROJECT]: 'aeon',
  [CONTRACT_LOAN]: 'contracts',
  [PRIMAL_EGG]: 'breeding',
};

/** What a tab is working on: the task that finishes next. */
export interface TabActivity {
  /** Progress of that task, 0…1. */
  progress: number;
  remainingMs: number;
  /** Running tasks in this tab. */
  count: number;
  /** Endless work (a tower run): the bar repeats instead of filling once. */
  loop: boolean;
}

/**
 * Running work per tab for the tab bar (a filling bar under the tab):
 * processes by kind, the Zerlege-Kammer, a running tower run and a descent into the Genom-Keller. Finished
 * processes waiting for the player (ritual eggs) count as news, not work.
 */
export function tabActivity(ctx: GameContext): Record<string, TabActivity> {
  const out: Record<string, TabActivity> = {};
  const add = (tab: string, progress: number, remainingMs: number, loop = false) => {
    const cur = out[tab];
    if (!cur) out[tab] = { progress, remainingMs, count: 1, loop };
    else {
      cur.count++;
      if (remainingMs < cur.remainingMs) Object.assign(cur, { progress, remainingMs, loop });
    }
  };
  for (const p of ctx.state.processes) {
    const tab = PROCESS_TABS[p.kind];
    if (!tab || isWaiting(ctx, p)) continue;
    add(tab, Math.min(1, p.elapsedMs / Math.max(1, p.durationMs)), processRemainingMs(ctx, p));
  }
  const recycling = recyclingNow(ctx);
  if (recycling) add('recycler', recycling.progress, recycling.remainingMs);
  const run = ctx.state.tower.run;
  if (run) {
    const interval = fightIntervalMs(ctx);
    add('tower', Math.min(1, run.elapsedMs / interval), Math.max(0, interval - run.elapsedMs), true);
  }
  // A descent into the Genom-Keller lives in the tower tab too.
  const descent = ctx.state.cellar.run;
  if (descent) {
    const interval = cellarIntervalMs(ctx);
    add('tower', Math.min(1, descent.elapsedMs / interval), Math.max(0, interval - descent.elapsedMs), true);
  }
  return out;
}

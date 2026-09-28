import { checkPerfection, findCreature } from '../creatures';
import { catalogueGenome } from '../genetics';
import { trySpend } from '../resources';
import { registerProcessHandler, startProcess } from '../systems/processes';
import { toCost, type Cost } from '../costs';
import type { GameContext } from '../context';
import type { ActionResult } from '../actions';
import type { Creature } from '../state';
import { DEEP_SEQUENCE, isBeingSequenced, sequencerSlots, sequencerUsed, type SequenceData } from './sequencing';

/**
 * Tiefensequenzierung: eight hours in a sequencer slot for an already
 * sequenced creature. It reveals – and thereby activates – the creature's
 * Erbanlage (if it carries one). With the Urgen talent it may also awaken a
 * sleeping Urgen allele. The creature keeps working meanwhile.
 */
const PRIMAL = { locus: 'primal', allele: 'U' };

export function deepSequencingCost(ctx: GameContext): Cost {
  return toCost(ctx.balance.deepSequencing.cost);
}

export function deepSequencingTimeMs(ctx: GameContext): number {
  return ctx.balance.deepSequencing.hours * 3_600_000;
}

/** Why a creature cannot be deep-sequenced right now (null = it can). */
export function deepSequencingBlocker(ctx: GameContext, c: Creature): string | null {
  if (!c.sequenced) return 'Erst das Genom normal sequenzieren.';
  if (c.deepSequenced) return 'Bereits tiefensequenziert.';
  if (isBeingSequenced(ctx, c.id)) return 'Wird gerade sequenziert.';
  return null;
}

export function startDeepSequencing(ctx: GameContext, creatureId: number): ActionResult {
  if (!ctx.state.features['deepSequencing']) return { ok: false, reason: 'Die Tiefensequenzierung ist noch nicht freigeschaltet.' };
  const c = findCreature(ctx, creatureId);
  if (!c) return { ok: false, reason: 'Kreatur nicht gefunden.' };
  const blocker = deepSequencingBlocker(ctx, c);
  if (blocker) return { ok: false, reason: blocker };
  if (sequencerUsed(ctx) >= sequencerSlots(ctx)) return { ok: false, reason: 'Alle Sequenzierer sind belegt.' };
  if (!trySpend(ctx, deepSequencingCost(ctx))) return { ok: false, reason: 'Nicht genug Essenz.' };
  const data: SequenceData = { creatureId };
  startProcess(ctx, DEEP_SEQUENCE, deepSequencingTimeMs(ctx), data);
  return { ok: true };
}

registerProcessHandler(DEEP_SEQUENCE, {
  complete(ctx, proc) {
    const c = findCreature(ctx, (proc.data as SequenceData).creatureId);
    if (!c || c.deepSequenced) return;
    c.deepSequenced = true;
    let awakened = false;
    const pair = c.genome[PRIMAL.locus];
    if (ctx.state.talents['ancientGenes'] && pair && !pair.includes(PRIMAL.allele) && ctx.rng.chance(ctx.balance.deepSequencing.primalAwaken)) {
      pair[ctx.rng.chance(0.5) ? 0 : 1] = PRIMAL.allele;
      catalogueGenome(ctx, { [PRIMAL.locus]: [PRIMAL.allele, PRIMAL.allele] });
      checkPerfection(ctx, c);
      awakened = true;
    }
    ctx.invalidate();
    ctx.bus.emit('deepSequenced', { creatureId: c.id, latent: c.latent, awakened });
  },
});

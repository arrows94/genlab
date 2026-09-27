import { D, type Decimal, type NumLike } from './num';

/**
 * Unified modifier system. Every bonus in the game (research, dex, potions,
 * prestige, abilities, genes, achievements ...) is expressed as a list of
 * modifiers on a string target such as `production.gold` or `breeding.time`.
 *
 * Evaluation order for a target:
 *   (base + Σ add) × (1 + Σ pct) × Π mult
 *
 * - `add`  flat amount
 * - `pct`  additive percentage (0.1 = +10 %), summed before applying
 * - `mult` multiplicative factor (1.5 = ×1.5), stacks multiplicatively
 */
export type ModifierOp = 'add' | 'pct' | 'mult';

export interface ModifierDef {
  target: string;
  op: ModifierOp;
  value: number;
}

/** A modifier together with where it came from (for bonus breakdowns). */
export interface SourcedModifier extends ModifierDef {
  source: string;
}

/**
 * Known root namespaces for modifier targets. Adding a new bonus kind is
 * normally only a new target string; a new *root* is added here once.
 */
export const MODIFIER_ROOTS = [
  'production', // production.<resource>
  'collect', // collect.<resource>   (manual clicking)
  'cost', // cost.upgrade, cost.upgrade.<id>, cost.breeding ...
  'slots', // slots.<building>, slots.nest, slots.camp, slots.stable
  'breeding', // breeding.time, breeding.mutation
  'mission', // mission.time, mission.reward, mission.wildChance
  'process', // process.<kind>.speed
  'rarity', // rarity.weight.<rarity>
  'stat', // stat.<statId> (global creature stat bonus)
  'offline', // offline.capHours
  'prestige', // prestige.<layer>.gain
  'sequencing', // sequencing.time
  'splicing', // splicing.instability, splicing.cost
  'infusion',
  'capsule',
  'tower',
  'creature',
] as const;

const TARGET_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9_*-]+)*$/;

export function isValidTarget(target: string): boolean {
  if (!TARGET_PATTERN.test(target)) return false;
  const root = target.split('.')[0];
  return (MODIFIER_ROOTS as readonly string[]).includes(root ?? '');
}

export interface TargetTotals {
  add: number;
  pct: number;
  mult: number;
}

export class ModifierSet {
  private byTarget = new Map<string, SourcedModifier[]>();

  constructor(mods: Iterable<SourcedModifier> = []) {
    for (const m of mods) this.push(m);
  }

  push(mod: SourcedModifier): void {
    const list = this.byTarget.get(mod.target);
    if (list) list.push(mod);
    else this.byTarget.set(mod.target, [mod]);
  }

  addAll(source: string, mods: readonly ModifierDef[], scale = 1): void {
    for (const m of mods) this.push({ ...m, value: scaleValue(m, scale), source });
  }

  list(target: string): readonly SourcedModifier[] {
    return this.byTarget.get(target) ?? [];
  }

  totals(target: string): TargetTotals {
    const t: TargetTotals = { add: 0, pct: 0, mult: 1 };
    for (const m of this.list(target)) {
      if (m.op === 'add') t.add += m.value;
      else if (m.op === 'pct') t.pct += m.value;
      else t.mult *= m.value;
    }
    return t;
  }

  /** Applies all modifiers for `target` to a plain number. */
  apply(target: string, base: number): number {
    const t = this.totals(target);
    return (base + t.add) * (1 + t.pct) * t.mult;
  }

  /** Same as `apply` but for big numbers. */
  applyD(target: string, base: NumLike): Decimal {
    const t = this.totals(target);
    return D(base).add(t.add).mul(1 + t.pct).mul(t.mult);
  }

  /** Multiplier only (base 1), handy for "speed" style targets. */
  factor(target: string): number {
    return this.apply(target, 1);
  }

  /** Per-source breakdown for the UI ("Boni-Aufschlüsselung"). */
  breakdown(target: string): SourcedModifier[] {
    return [...this.list(target)];
  }

  targets(): string[] {
    return [...this.byTarget.keys()];
  }
}

/**
 * When a modifier is granted N times (e.g. upgrade level N), `add` and `pct`
 * scale linearly and `mult` compounds.
 */
function scaleValue(m: ModifierDef, scale: number): number {
  if (scale === 1) return m.value;
  return m.op === 'mult' ? Math.pow(m.value, scale) : m.value * scale;
}

import { D } from './num';
import { nextUpgradeCost, upgradeAvailable } from './actions';
import { canAfford, type Cost } from './costs';
import { checkCondition } from './conditions';
import { productionRates } from './systems/production';
import type { Condition, ResearchThemeDef, UpgradeDef } from './content/types';
import type { GameContext } from './context';

/**
 * The research tree for the UI: research grouped by theme, each node with
 * its parent (the research that unlocks what it needs), readable missing
 * requirements and how long until it is affordable. Research one step
 * ahead is shown locked; further steps stay hidden.
 */
export interface ResearchNode {
  def: UpgradeDef;
  level: number;
  status: 'open' | 'locked' | 'maxed';
  cost: Cost | null;
  affordable: boolean;
  /** Research that unlocks a feature this one needs. */
  parent: UpgradeDef | null;
  /** Depth in its theme's tree (children of a parent in the same theme). */
  depth: number;
  /** Unmet requirements as text, with progress (locked nodes). */
  missing: string[];
  /** Estimated ms until affordable from production alone (null: affordable, maxed or no income). */
  etaMs: number | null;
}

export interface ResearchBranch {
  theme: ResearchThemeDef;
  nodes: ResearchNode[];
}

const STATISTIC_LABELS: Record<string, string> = {
  hatched: 'Eier ausgebrütet',
  sequenced: 'Genome sequenziert',
  recycled: 'Kreaturen recycelt',
  sold: 'Kreaturen verkauft',
  clicks: 'Mal gesammelt',
  contracts: 'Gen-Aufträge erfüllt',
};

/** The research whose level 1 unlocks this feature, if any. */
export function unlockingUpgrade(ctx: GameContext, feature: string): UpgradeDef | null {
  return ctx.content.upgrades.list.find((u) => u.unlocksFeatures?.includes(feature)) ?? null;
}

function featureConditions(c: Condition | undefined): string[] {
  if (!c) return [];
  if (c.type === 'feature') return [c.feature];
  if (c.type === 'all' || c.type === 'any') return c.of.flatMap(featureConditions);
  return [];
}

/** Parent research: the first research that unlocks a feature this one requires. */
export function researchParent(ctx: GameContext, def: UpgradeDef): UpgradeDef | null {
  for (const f of featureConditions(def.requires)) {
    const u = unlockingUpgrade(ctx, f);
    if (u && u.id !== def.id) return u;
  }
  return null;
}

const n = (v: number) => Math.floor(v).toLocaleString('de-DE');

/**
 * Unmet parts of a condition as text. `reachable` is false when a part can
 * only be met by something the player cannot see coming yet.
 */
export function missingRequirements(ctx: GameContext, c: Condition | undefined): { texts: string[]; reachable: boolean } {
  const texts: string[] = [];
  let reachable = true;
  const walk = (x: Condition) => {
    if (checkCondition(ctx.state, x)) return;
    switch (x.type) {
      case 'all':
        return x.of.forEach(walk);
      case 'feature': {
        const u = unlockingUpgrade(ctx, x.feature);
        if (u) {
          texts.push(`„${u.name}“ erforschen`);
          if (!upgradeAvailable(ctx, u.id)) reachable = false;
        } else {
          texts.push(`${ctx.content.features.has(x.feature) ? ctx.content.features.get(x.feature).name : x.feature} freischalten`);
          reachable = false;
        }
        return;
      }
      case 'statistic':
        texts.push(`${n(x.amount)} ${STATISTIC_LABELS[x.statistic] ?? x.statistic} (${n(ctx.state.statistics[x.statistic] ?? 0)}/${n(x.amount)})`);
        return;
      case 'geneLibrary':
        texts.push(`${x.count} Allele in der Genbibliothek (${Object.keys(ctx.state.geneLibrary).length}/${x.count})`);
        return;
      case 'resourceEarned': {
        const r = ctx.content.resources.get(x.resource);
        texts.push(`${n(x.amount)} ${r.icon} verdienen (${n((ctx.state.earned[x.resource] ?? D(0)).toNumber())}/${n(x.amount)})`);
        return;
      }
      case 'upgradeLevel':
        texts.push(`„${ctx.content.upgrades.get(x.upgrade).name}“ Stufe ${x.level}`);
        return;
      case 'creatureCount':
        texts.push(`${x.count} Kreaturen (${ctx.state.creatures.length}/${x.count})`);
        return;
      default:
        reachable = false;
    }
  };
  if (c) walk(c);
  return { texts, reachable };
}

/** Rough time until `cost` is affordable from current production (null: no income for a missing part). */
export function timeToAfford(ctx: GameContext, cost: Cost): number | null {
  const rates = productionRates(ctx);
  let worst = 0;
  for (const [res, amount] of Object.entries(cost)) {
    const missing = amount.sub(ctx.state.resources[res] ?? D(0));
    if (missing.lte(0)) continue;
    const rate = rates[res];
    if (!rate || rate.lte(0)) return null;
    worst = Math.max(worst, missing.div(rate).toNumber() * 1000);
  }
  return worst;
}

function node(ctx: GameContext, def: UpgradeDef, parent: UpgradeDef | null, depth: number): ResearchNode | null {
  const level = ctx.state.upgrades[def.id] ?? 0;
  const open = upgradeAvailable(ctx, def.id);
  if (!open) {
    const { texts, reachable } = missingRequirements(ctx, def.requires);
    if (!reachable || level > 0) return null;
    return { def, level, status: 'locked', cost: null, affordable: false, parent, depth, missing: texts, etaMs: null };
  }
  const cost = nextUpgradeCost(ctx, def.id);
  const affordable = cost !== null && canAfford(ctx.state, cost);
  return {
    def, level, status: cost === null ? 'maxed' : 'open', cost, affordable, parent, depth, missing: [],
    etaMs: cost && !affordable ? timeToAfford(ctx, cost) : null,
  };
}

/** Research of one category grouped by theme; children follow their parent. */
export function researchTree(ctx: GameContext, category: UpgradeDef['category'] = 'research'): ResearchBranch[] {
  const defs = ctx.content.upgrades.list.filter((u) => u.category === category);
  const parents = new Map(defs.map((d) => [d.id, researchParent(ctx, d)]));
  const themes: ResearchThemeDef[] = [...ctx.content.researchThemes.list];
  if (defs.some((d) => !d.theme)) themes.push({ id: '', name: category === 'infinite' ? 'Unendlich' : 'Weitere', icon: '📜' });

  return themes
    .map((theme) => {
      const inTheme = defs.filter((d) => (d.theme ?? '') === theme.id);
      const ids = new Set(inTheme.map((d) => d.id));
      const nodes: ResearchNode[] = [];
      const add = (d: UpgradeDef, depth: number) => {
        const parent = parents.get(d.id) ?? null;
        const x = node(ctx, d, parent, depth);
        if (!x) return;
        nodes.push(x);
        for (const child of inTheme) if (parents.get(child.id)?.id === d.id) add(child, depth + 1);
      };
      // Roots: no parent in this theme.
      for (const d of inTheme) {
        const p = parents.get(d.id);
        if (!p || !ids.has(p.id)) add(d, 0);
      }
      return { theme, nodes };
    })
    .filter((b) => b.nodes.length > 0);
}

/**
 * Current total effect of the first modifier (for "Jetzt ×2,07"): add/pct
 * scale with level^levelPower, mult compounds.
 */
export function researchEffect(def: UpgradeDef, level: number): { op: 'add' | 'pct' | 'mult'; value: number } | null {
  const m = def.modifiers[0];
  if (!m || level <= 0) return null;
  const scale = Math.pow(level, def.levelPower ?? 1);
  return { op: m.op, value: m.op === 'mult' ? Math.pow(m.value, scale) : m.value * scale };
}

import { isValidTarget, type ModifierDef } from '../modifiers';
import type { Condition, ContentData, ResourceAmounts } from './types';

export type Kind = keyof ContentData;

/**
 * Shared state and helpers for the per-kind content validators. Every helper
 * appends human readable (German) issues to `issues` instead of throwing.
 */
export interface ContentChecks {
  readonly data: ContentData;
  /** Valid ids per kind (only kinds present in `data`). */
  readonly ids: Partial<Record<Kind, Set<string>>>;
  readonly issues: string[];
  readonly statIds: ReadonlySet<string>;
  /** Readable path of an entry, e.g. `species[emberpup]`. */
  at(kind: Kind, id: string): string;
  /** Reports an unknown id of `kind`; `undefined` (optional field) is fine. */
  ref(where: string, kind: Kind, id: string | undefined): void;
  text(where: string, value: unknown): void;
  num(where: string, value: unknown, min?: number, max?: number): void;
  amounts(where: string, value: ResourceAmounts | undefined): void;
  mods(where: string, list: readonly ModifierDef[] | undefined): void;
  cond(where: string, c: Condition | undefined): void;
  alleleRef(where: string, a: { locus: string; allele: string } | undefined): void;
}

/**
 * Collects the ids of every kind (reporting non-lists, missing and duplicate
 * ids) and returns the helpers that the per-kind validators share.
 */
export function createChecks(data: ContentData): ContentChecks {
  const issues: string[] = [];
  const ids: Partial<Record<Kind, Set<string>>> = {};

  for (const kind of Object.keys(data) as Kind[]) {
    const list = data[kind] as { id?: unknown }[];
    const seen = new Set<string>();
    ids[kind] = seen;
    if (!Array.isArray(list)) {
      issues.push(`${kind}: muss eine Liste sein`);
      continue;
    }
    list.forEach((entry, i) => {
      if (typeof entry?.id !== 'string' || entry.id.length === 0) {
        issues.push(`${kind}[${i}]: fehlende oder leere id`);
      } else if (seen.has(entry.id)) {
        issues.push(`${kind}[${entry.id}]: doppelte id`);
      } else {
        seen.add(entry.id);
      }
    });
  }

  const at = (kind: Kind, id: string) => `${kind}[${id}]`;
  const ref = (where: string, kind: Kind, id: string | undefined) => {
    if (id === undefined) return;
    if (!ids[kind]?.has(id)) issues.push(`${where}: unbekannte ${kind}-id "${id}"`);
  };
  const text = (where: string, value: unknown) => {
    if (typeof value !== 'string' || value.trim() === '') issues.push(`${where}: Text fehlt`);
  };
  const num = (where: string, value: unknown, min = -Infinity, max = Infinity) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) issues.push(`${where}: muss eine Zahl sein`);
    else if (value < min || value > max) issues.push(`${where}: ${value} liegt nicht in [${min}, ${max}]`);
  };
  const amounts = (where: string, value: ResourceAmounts | undefined) => {
    if (!value) return;
    for (const [res, amount] of Object.entries(value)) {
      ref(`${where}.${res}`, 'resources', res);
      num(`${where}.${res}`, amount, 0);
    }
  };
  const mods = (where: string, list: readonly ModifierDef[] | undefined) => {
    if (list === undefined) return;
    if (!Array.isArray(list)) {
      issues.push(`${where}: muss eine Liste sein`);
      return;
    }
    list.forEach((m, i) => {
      const w = `${where}[${i}]`;
      if (!isValidTarget(m.target)) issues.push(`${w}: ungültiges Modifier-Ziel "${m.target}"`);
      if (!['add', 'pct', 'mult'].includes(m.op)) issues.push(`${w}: ungültige Operation "${m.op}"`);
      num(`${w}.value`, m.value);
      if (m.op === 'mult' && m.value <= 0) issues.push(`${w}: mult muss > 0 sein`);
    });
  };
  const cond = (where: string, c: Condition | undefined): void => {
    if (!c) return;
    switch (c.type) {
      case 'always':
        return;
      case 'resourceEarned':
      case 'resourceOwned':
        ref(where, 'resources', c.resource);
        return num(`${where}.amount`, c.amount, 0);
      case 'upgradeLevel':
        ref(where, 'upgrades', c.upgrade);
        return num(`${where}.level`, c.level, 0);
      case 'feature':
        return ref(where, 'features', c.feature);
      case 'creatureCount':
        return num(`${where}.count`, c.count, 0);
      case 'statistic':
        text(`${where}.statistic`, c.statistic);
        return num(`${where}.amount`, c.amount, 0);
      case 'dex':
        ref(where, 'species', c.species);
        ref(where, 'rarities', c.rarity);
        return;
      case 'prestigeCount':
        return ref(where, 'prestigeLayers', c.layer);
      case 'talent':
        return ref(where, 'talents', c.talent);
      case 'towerFloor':
        return num(`${where}.floor`, c.floor, 1);
      case 'anomaly':
        return ref(where, 'anomalies', c.anomaly);
      case 'megaProject': {
        ref(where, 'megaProjects', c.project);
        const project = data.megaProjects.find((m) => m.id === c.project);
        return num(`${where}.stage`, c.stage, 1, project?.stages.length ?? Infinity);
      }
      case 'geneLibrary': {
        const total = data.genes.reduce((n, g) => n + g.alleles.length, 0);
        return num(`${where}.count`, c.count, 0, total);
      }
      case 'all':
      case 'any':
        return c.of.forEach((sub, i) => cond(`${where}.${c.type}[${i}]`, sub));
      default:
        issues.push(`${where}: unbekannter Bedingungstyp "${(c as { type: string }).type}"`);
    }
  };
  const alleleRef = (where: string, a: { locus: string; allele: string } | undefined) => {
    if (!a) return;
    const locus = data.genes.find((g) => g.id === a.locus);
    if (!locus) issues.push(`${where}: unbekannter Gen-Locus "${a.locus}"`);
    else if (!locus.alleles.some((x) => x.id === a.allele)) issues.push(`${where}: unbekanntes Allel "${a.allele}"`);
  };

  const statIds = ids.stats ?? new Set<string>();
  return { data, ids, issues, statIds, at, ref, text, num, amounts, mods, cond, alleleRef };
}

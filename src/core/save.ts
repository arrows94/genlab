import { D, isDecimal } from './num';
import { createEmptyState, type GameState } from './state';

/**
 * Versioned save format. Bump `SAVE_VERSION` and add a migration
 * `MIGRATIONS[oldVersion]` (old → old+1) whenever the state shape changes in
 * a way `mergeDefaults` cannot fix on its own (renames, restructures).
 */
export const SAVE_VERSION = 6;

export interface SaveEnvelope {
  saveVersion: number;
  savedAt: number;
  state: unknown;
}

export type Migration = (state: Record<string, unknown>) => Record<string, unknown>;

export const MIGRATIONS: Record<number, Migration> = {
  // v1 → v2: creatures gained permanent potion boosts (Kraftfutter).
  1: (s) => ({
    ...s,
    creatures: ((s.creatures as Record<string, unknown>[] | undefined) ?? []).map((c) => ({ boosts: {}, boostUses: 0, ...c })),
  }),
  // v2 → v3: genetics. Missing genomes are rolled on load by `ensureGenomes`.
  2: (s) => ({
    ...s,
    creatures: ((s.creatures as Record<string, unknown>[] | undefined) ?? []).map((c) => ({ splices: 0, ...c, genome: c.genome ?? {} })),
  }),
  // v3 → v4: infusion levels and pedigree snapshots.
  3: (s) => ({
    ...s,
    creatures: ((s.creatures as Record<string, unknown>[] | undefined) ?? []).map((c) => ({ infusion: { level: 0, ep: 0 }, ancestry: null, ...c })),
  }),
  // v4 → v5: endgame (shiny colour mutation on creatures).
  4: (s) => ({
    ...s,
    creatures: ((s.creatures as Record<string, unknown>[] | undefined) ?? []).map((c) => ({ shiny: false, ...c })),
  }),
  // v5 → v6: Erbanlagen (deep sequencing). Missing traits are rolled on load by `ensureLatentTraits`.
  5: (s) => ({
    ...s,
    creatures: ((s.creatures as Record<string, unknown>[] | undefined) ?? []).map((c) => ({ deepSequenced: false, ...c })),
  }),
};

export class SaveError extends Error {
  override name = 'SaveError';
}

/** Deep-converts Decimals to `{ $d: "1e300" }` so JSON keeps full precision. */
function toPlain(value: unknown): unknown {
  if (isDecimal(value)) return { $d: value.toString() };
  if (Array.isArray(value)) return value.map(toPlain);
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = toPlain(v);
    return out;
  }
  return value;
}

function reviveDecimals(_key: string, value: unknown): unknown {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const keys = Object.keys(value);
    if (keys.length === 1 && keys[0] === '$d') return D((value as { $d: string }).$d);
  }
  return value;
}

export function serialize(state: GameState, now = Date.now()): string {
  const envelope: SaveEnvelope = { saveVersion: SAVE_VERSION, savedAt: now, state: toPlain(state) };
  return JSON.stringify(envelope);
}

/** Runs migrations from `envelope.saveVersion` up to `target`. */
export function migrate(envelope: SaveEnvelope, migrations: Record<number, Migration> = MIGRATIONS, target = SAVE_VERSION): SaveEnvelope {
  if (typeof envelope.saveVersion !== 'number') throw new SaveError('Spielstand hat keine Versionsnummer.');
  if (envelope.saveVersion > target) throw new SaveError(`Spielstand ist von einer neueren Version (${envelope.saveVersion}).`);
  let state = envelope.state as Record<string, unknown>;
  for (let v = envelope.saveVersion; v < target; v++) {
    const step = migrations[v];
    if (!step) throw new SaveError(`Keine Migration von Version ${v} auf ${v + 1}.`);
    state = step(state);
  }
  return { ...envelope, saveVersion: target, state };
}

/**
 * Fills fields that did not exist when the save was written with defaults,
 * so additive changes need no migration.
 */
export function mergeDefaults<T>(defaults: T, loaded: unknown): T {
  if (loaded === undefined || loaded === null) return defaults;
  if (isDecimal(defaults) || Array.isArray(defaults) || typeof defaults !== 'object' || defaults === null) {
    return loaded as T;
  }
  if (typeof loaded !== 'object' || Array.isArray(loaded)) return defaults;
  const out: Record<string, unknown> = { ...(loaded as Record<string, unknown>) };
  for (const [k, v] of Object.entries(defaults as Record<string, unknown>)) {
    out[k] = mergeDefaults(v, (loaded as Record<string, unknown>)[k]);
  }
  return out as T;
}

/** Removes references to creatures that no longer exist (older saves could keep them). */
function repairReferences(state: GameState): void {
  const ids = new Set(state.creatures.map((c) => c.id));
  state.tower.team = state.tower.team.filter((id) => ids.has(id));
}

export function deserialize(json: string, migrations: Record<number, Migration> = MIGRATIONS, target = SAVE_VERSION): { state: GameState; savedAt: number } {
  let envelope: SaveEnvelope;
  try {
    envelope = JSON.parse(json, reviveDecimals) as SaveEnvelope;
  } catch {
    throw new SaveError('Spielstand ist beschädigt (kein gültiges JSON).');
  }
  if (!envelope || typeof envelope !== 'object' || !('state' in envelope)) throw new SaveError('Spielstand hat ein unbekanntes Format.');
  const migrated = migrate(envelope, migrations, target);
  const state = mergeDefaults(createEmptyState(migrated.savedAt, 1), migrated.state);
  repairReferences(state);
  return { state, savedAt: migrated.savedAt };
}

const EXPORT_PREFIX = 'GENLAB1:';

/** Backup string: prefix + base64(UTF-8 JSON). */
export function exportSave(state: GameState, now = Date.now()): string {
  const bytes = new TextEncoder().encode(serialize(state, now));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return EXPORT_PREFIX + btoa(binary);
}

export function importSave(text: string): { state: GameState; savedAt: number } {
  const trimmed = text.trim();
  if (!trimmed.startsWith(EXPORT_PREFIX)) throw new SaveError('Das ist kein Genlab-Export.');
  let json: string;
  try {
    const binary = atob(trimmed.slice(EXPORT_PREFIX.length));
    json = new TextDecoder().decode(Uint8Array.from(binary, (ch) => ch.charCodeAt(0)));
  } catch {
    throw new SaveError('Export-Text ist beschädigt.');
  }
  return deserialize(json);
}

/**
 * Storage abstraction so web (localStorage), Tauri or Capacitor can plug in.
 * Async because native key-value stores (Capacitor Preferences) are async.
 */
export interface SaveStorage {
  load(): Promise<string | null>;
  save(data: string): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryStorage implements SaveStorage {
  private data: string | null = null;
  async load() {
    return this.data;
  }
  async save(data: string) {
    this.data = data;
  }
  async clear() {
    this.data = null;
  }
}

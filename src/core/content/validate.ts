import { isValidTarget, type ModifierDef } from '../modifiers';
import type { Condition, ContentData, ContentDB, Registry, ResourceAmounts, RpgEventOutcome } from './types';

export class ContentValidationError extends Error {
  constructor(public readonly issues: string[]) {
    super(`Ungültige Spielinhalte (${issues.length} Fehler):\n  - ${issues.join('\n  - ')}`);
    this.name = 'ContentValidationError';
  }
}

type Kind = keyof ContentData;

/**
 * Validates all content (shape, unique ids, cross references, modifier
 * targets, conditions) and returns a list of human readable issues.
 */
export function validateContent(data: ContentData): string[] {
  const issues: string[] = [];
  const ids = {} as Record<Kind, Set<string>>;

  for (const kind of Object.keys(data) as Kind[]) {
    const list = data[kind] as { id?: unknown }[];
    ids[kind] = new Set();
    if (!Array.isArray(list)) {
      issues.push(`${kind}: muss eine Liste sein`);
      continue;
    }
    list.forEach((entry, i) => {
      if (typeof entry?.id !== 'string' || entry.id.length === 0) {
        issues.push(`${kind}[${i}]: fehlende oder leere id`);
      } else if (ids[kind].has(entry.id)) {
        issues.push(`${kind}[${entry.id}]: doppelte id`);
      } else {
        ids[kind].add(entry.id);
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
    if (!Array.isArray(list)) return issues.push(`${where}: muss eine Liste sein`);
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

  const statIds = ids.stats ?? new Set<string>();

  for (const r of data.resources) {
    text(`${at('resources', r.id)}.name`, r.name);
    ref(`${at('resources', r.id)}.feature`, 'features', r.feature);
  }
  for (const s of data.species) {
    const w = at('species', s.id);
    text(`${w}.name`, s.name);
    ref(`${w}.element`, 'elements', s.element);
    num(`${w}.hue`, s.hue, 0, 360);
    for (const stat of statIds) num(`${w}.baseStats.${stat}`, s.baseStats[stat], 0);
    for (const key of Object.keys(s.baseStats)) if (!statIds.has(key)) issues.push(`${w}.baseStats: unbekannter Stat "${key}"`);
  }
  for (const e of data.elements) {
    for (const other of e.strongAgainst) ref(`${at('elements', e.id)}.strongAgainst`, 'elements', other);
    if (!Array.isArray(e.familyPrefixes) || e.familyPrefixes.length === 0) issues.push(`${at('elements', e.id)}.familyPrefixes: mindestens ein Wort`);
    else e.familyPrefixes.forEach((wd, i) => text(`${at('elements', e.id)}.familyPrefixes[${i}]`, wd));
  }
  for (const id of ['given', 'givenStart', 'givenEnd', 'familySuffix', 'epithet.shiny', ...data.stats.map((s) => `epithet.${s.id}`)]) {
    if (!ids.nameLists.has(id)) issues.push(`nameLists: Liste "${id}" fehlt`);
  }
  for (const l of data.nameLists) {
    if (!Array.isArray(l.words) || l.words.length === 0) issues.push(`${at('nameLists', l.id)}.words: mindestens ein Wort`);
    else l.words.forEach((wd, i) => text(`${at('nameLists', l.id)}.words[${i}]`, wd));
  }
  for (const g of data.genes) {
    const w = at('genes', g.id);
    if (g.alleles.length < 2) issues.push(`${w}: braucht mindestens 2 Allele`);
    if (!g.alleles.some((a) => a.weight > 0)) issues.push(`${w}: mindestens ein Allel braucht weight > 0`);
    const alleleIds = new Set<string>();
    for (const a of g.alleles) {
      if (alleleIds.has(a.id)) issues.push(`${w}.alleles[${a.id}]: doppelte id`);
      alleleIds.add(a.id);
      num(`${w}.alleles[${a.id}].weight`, a.weight, 0);
      num(`${w}.alleles[${a.id}].dominance`, a.dominance);
      mods(`${w}.alleles[${a.id}].modifiers`, a.modifiers);
    }
  }
  const alleleRef = (where: string, a: { locus: string; allele: string } | undefined) => {
    if (!a) return;
    const locus = data.genes.find((g) => g.id === a.locus);
    if (!locus) issues.push(`${where}: unbekannter Gen-Locus "${a.locus}"`);
    else if (!locus.alleles.some((x) => x.id === a.allele)) issues.push(`${where}: unbekanntes Allel "${a.allele}"`);
  };
  for (const a of data.abilities) {
    ref(`${at('abilities', a.id)}.tier`, 'rarities', a.tier);
    mods(`${at('abilities', a.id)}.modifiers`, a.modifiers);
  }
  for (const r of data.recipes) {
    const w = at('recipes', r.id);
    r.parents.forEach((p) => ref(`${w}.parents`, 'species', p));
    ref(`${w}.result`, 'species', r.result);
    text(`${w}.hint`, r.hint);
    const result = data.species.find((s) => s.id === r.result);
    if (result?.tier === 'base') issues.push(`${w}.result: Hybrid-Ergebnis darf keine Basisart sein`);
    num(`${w}.chance`, r.chance, 0, 1);
    ref(`${w}.requires.minRarity`, 'rarities', r.requires?.minRarity);
    alleleRef(`${w}.requires.allele`, r.requires?.allele);
    cond(`${w}.requires.condition`, r.requires?.condition);
  }
  for (const e of data.evolutions) {
    const w = at('evolutions', e.id);
    ref(`${w}.from`, 'species', e.from);
    ref(`${w}.to`, 'species', e.to);
    if (e.from === e.to) issues.push(`${w}: from und to sind gleich`);
    ref(`${w}.requires.minRarity`, 'rarities', e.requires.minRarity);
    alleleRef(`${w}.requires.allele`, e.requires.allele);
    amounts(`${w}.requires.cost`, e.requires.cost);
  }
  for (const b of data.buildings) {
    const w = at('buildings', b.id);
    ref(`${w}.produces`, 'resources', b.produces);
    ref(`${w}.feature`, 'features', b.feature);
    if (!statIds.has(b.workStat)) issues.push(`${w}.workStat: unbekannter Stat "${b.workStat}"`);
    b.elements.forEach((e, i) => ref(`${w}.elements[${i}]`, 'elements', e));
    num(`${w}.baseRate`, b.baseRate, 0);
    num(`${w}.baseSlots`, b.baseSlots, 0);
  }
  for (const u of data.upgrades) {
    const w = at('upgrades', u.id);
    text(`${w}.name`, u.name);
    amounts(`${w}.cost`, u.cost);
    num(`${w}.costGrowth`, u.costGrowth, 1);
    if (u.maxLevel !== null) num(`${w}.maxLevel`, u.maxLevel, 1);
    mods(`${w}.modifiers`, u.modifiers);
    u.unlocksFeatures?.forEach((f) => ref(`${w}.unlocksFeatures`, 'features', f));
    cond(`${w}.requires`, u.requires);
    ref(`${w}.theme`, 'researchThemes', u.theme);
    if (u.grantsHints !== undefined) num(`${w}.grantsHints`, u.grantsHints, 0);
  }
  for (const p of data.potions) {
    const w = at('potions', p.id);
    amounts(`${w}.cost`, p.cost);
    mods(`${w}.modifiers`, p.modifiers);
    ref(`${w}.feature`, 'features', p.feature);
    if ((p.kind === 'creatureBuff' || p.kind === 'globalBuff') && !(p.durationSec! > 0)) issues.push(`${w}: Buff braucht durationSec > 0`);
    if (p.kind === 'timeSkip' && !(p.skipSec! > 0)) issues.push(`${w}: timeSkip braucht skipSec > 0`);
    if (p.kind === 'permanentStat' && !(p.statBonus! > 0)) issues.push(`${w}: permanentStat braucht statBonus > 0`);
  }
  for (const m of data.missions) {
    const w = at('missions', m.id);
    num(`${w}.durationSec`, m.durationSec, 1);
    amounts(`${w}.cost`, m.cost);
    num(`${w}.wildChance`, m.wildChance, 0, 1);
    m.species?.forEach((s) => ref(`${w}.species`, 'species', s));
    ref(`${w}.wildMinRarity`, 'rarities', m.wildMinRarity);
    if (m.maxConcurrent !== undefined) num(`${w}.maxConcurrent`, m.maxConcurrent, 1);
    cond(`${w}.requires`, m.requires);
    for (const [res, range] of Object.entries(m.rewards)) {
      ref(`${w}.rewards`, 'resources', res);
      if (!Array.isArray(range) || range.length !== 2 || range[0] > range[1]) issues.push(`${w}.rewards.${res}: [min, max] erwartet`);
    }
  }
  for (const d of data.dexRewards) {
    const w = at('dexRewards', d.id);
    ref(`${w}.rarity`, 'rarities', d.rarity);
    mods(`${w}.modifiersPerEntry`, d.modifiersPerEntry);
    d.unlocksFeatures?.forEach((u) => u.features.forEach((f) => ref(`${w}.unlocksFeatures`, 'features', f)));
  }
  for (const f of data.features) {
    text(`${at('features', f.id)}.hint`, f.hint);
    cond(`${at('features', f.id)}.condition`, f.condition);
    ref(`${at('features', f.id)}.grantsCreature.species`, 'species', f.grantsCreature?.species);
    ref(`${at('features', f.id)}.grantsCreature.rarity`, 'rarities', f.grantsCreature?.rarity);
  }
  for (const a of data.achievements) {
    cond(`${at('achievements', a.id)}.condition`, a.condition);
    mods(`${at('achievements', a.id)}.modifiers`, a.modifiers);
  }
  for (const l of data.prestigeLayers) {
    const w = at('prestigeLayers', l.id);
    ref(`${w}.currency`, 'resources', l.currency);
    ref(`${w}.feature`, 'features', l.feature);
    l.gainFrom.forEach((r) => ref(`${w}.gainFrom`, 'resources', r));
    l.resets.resources.forEach((r) => ref(`${w}.resets.resources`, 'resources', r));
    if (l.resets.resources.includes(l.currency)) issues.push(`${w}: darf die eigene Währung nicht zurücksetzen`);
    mods(`${w}.modifiersPerPoint`, l.modifiersPerPoint);
  }
  for (const c of data.capsules) {
    const w = at('capsules', c.id);
    amounts(`${w}.cost`, c.cost);
    ref(`${w}.feature`, 'features', c.feature);
    ref(`${w}.pity.minRarity`, 'rarities', c.pity.minRarity);
    num(`${w}.pity.threshold`, c.pity.threshold, 1);
    for (const [r, v] of Object.entries(c.rarityWeights)) {
      ref(`${w}.rarityWeights`, 'rarities', r);
      num(`${w}.rarityWeights.${r}`, v, 0);
    }
    if (!Object.values(c.rarityWeights).some((v) => v > 0)) issues.push(`${w}.rarityWeights: mindestens ein Gewicht > 0`);
    const pityOrder = data.rarities.find((r) => r.id === c.pity.minRarity)?.order ?? 0;
    if (!Object.entries(c.rarityWeights).some(([r, v]) => v > 0 && (data.rarities.find((x) => x.id === r)?.order ?? -1) >= pityOrder)) {
      issues.push(`${w}.pity: keine Seltenheit ≥ ${c.pity.minRarity} mit Gewicht > 0`);
    }
    for (const [tier, v] of Object.entries(c.tierWeights)) num(`${w}.tierWeights.${tier}`, v, 0);
  }
  for (const t of data.talents) {
    const w = at('talents', t.id);
    num(`${w}.cost`, t.cost, 0);
    t.requires.forEach((r) => ref(`${w}.requires`, 'talents', r));
    cond(`${w}.unlock`, t.unlock);
    mods(`${w}.modifiers`, t.modifiers);
    t.unlocksFeatures?.forEach((f) => ref(`${w}.unlocksFeatures`, 'features', f));
    amounts(`${w}.onReset`, t.onReset);
  }
  for (const a of data.anomalies) {
    const w = at('anomalies', a.id);
    mods(`${w}.modifiers`, a.modifiers);
    mods(`${w}.reward`, a.reward);
    mods(`${w}.perLevel`, a.perLevel);
    cond(`${w}.goal`, a.goal);
    cond(`${w}.requires`, a.requires);
  }
  for (const m of data.weeklyMutations) mods(`${at('weeklyMutations', m.id)}.modifiers`, m.modifiers);
  for (const g of data.genes) cond(`${at('genes', g.id)}.requires`, g.requires);
  for (const d of data.voyageDestinations) {
    const w = at('voyageDestinations', d.id);
    text(`${w}.name`, d.name);
    ref(`${w}.element`, 'elements', d.element);
    if (d.species.length === 0) issues.push(`${w}.species: mindestens eine Art`);
    d.species.forEach((s) => ref(`${w}.species`, 'species', s));
    for (const [res, range] of Object.entries(d.rewards)) {
      ref(`${w}.rewards`, 'resources', res);
      if (!Array.isArray(range) || range.length !== 2 || range[0] > range[1]) issues.push(`${w}.rewards.${res}: [min, max] erwartet`);
    }
  }
  for (const e of data.voyageEvents) {
    const w = at('voyageEvents', e.id);
    text(`${w}.text`, e.text);
    num(`${w}.weight`, e.weight, 0);
    amounts(`${w}.effect.resources`, e.effect.resources);
  }
  for (const d of data.voyageDecisions) {
    const w = at('voyageDecisions', d.id);
    text(`${w}.text`, d.text);
    num(`${w}.weight`, d.weight, 0);
    if (!Array.isArray(d.options) || d.options.length !== 2) issues.push(`${w}.options: genau zwei Optionen`);
    (d.options ?? []).forEach((o, i) => {
      const ow = `${w}.options[${i}]`;
      text(`${ow}.label`, o.label);
      num(`${ow}.lootFactor`, o.lootFactor, 0);
      ref(`${ow}.creature.minRarity`, 'rarities', o.creature?.minRarity);
      amounts(`${ow}.resources`, o.resources);
    });
  }
  for (const r of data.grandResearch) {
    const w = at('grandResearch', r.id);
    text(`${w}.name`, r.name);
    num(`${w}.hours`, r.hours, 0.01);
    num(`${w}.hoursGrowth`, r.hoursGrowth, 1);
    num(`${w}.maxLevel`, r.maxLevel, 1);
    num(`${w}.costGrowth`, r.costGrowth, 1);
    amounts(`${w}.cost`, r.cost);
    cond(`${w}.requires`, r.requires);
    mods(`${w}.modifiers`, r.modifiers);
  }
  for (const t of data.researchThemes) text(`${at('researchThemes', t.id)}.name`, t.name);
  for (const b of data.bossTraits) {
    const w = at('bossTraits', b.id);
    text(`${w}.name`, b.name);
    if (!['shield', 'shift', 'regen', 'sweep'].includes(b.kind)) issues.push(`${w}.kind: ungültig "${b.kind}"`);
    num(`${w}.value`, b.value, 0, 1);
    if (b.targeting !== undefined && !['rows', 'weakest', 'back'].includes(b.targeting)) issues.push(`${w}.targeting: ungültig "${b.targeting}"`);
  }
  const statusIds = ['burn', 'poison', 'stun', 'slow', 'shield', 'evade', 'regen', 'armor', 'reflect'];
  for (const t of data.techniques) {
    const w = at('techniques', t.id);
    text(`${w}.name`, t.name);
    ref(`${w}.element`, 'elements', t.element);
    if (!['enemy', 'self', 'weakestAlly', 'team'].includes(t.target)) issues.push(`${w}.target: ungültig "${t.target}"`);
    num(`${w}.hit`, t.hit, 0);
    if (t.hit > 0 && t.target !== 'enemy') issues.push(`${w}.hit: Schaden nur mit target "enemy"`);
    if (t.heal !== undefined) num(`${w}.heal`, t.heal, 0, 1);
    if (t.status) {
      if (!statusIds.includes(t.status.id)) issues.push(`${w}.status.id: unbekannt "${t.status.id}"`);
      num(`${w}.status.duration`, t.status.duration, 0);
      num(`${w}.status.value`, t.status.value, 0);
    }
  }
  for (const e of data.elements) {
    const n = data.techniques.filter((t) => t.element === e.id).length;
    if (n !== 1) issues.push(`techniques: Element "${e.id}" braucht genau eine Technik (hat ${n})`);
  }
  for (const r of data.relics) {
    const w = at('relics', r.id);
    text(`${w}.name`, r.name);
    num(`${w}.cost`, r.cost, 1);
    num(`${w}.costGrowth`, r.costGrowth, 1);
    num(`${w}.maxLevel`, r.maxLevel, 1);
    for (const [k, v] of Object.entries(r.bonus)) {
      if (!['hp', 'atk', 'def', 'spd', 'element'].includes(k)) issues.push(`${w}.bonus: unbekannter Wert "${k}"`);
      num(`${w}.bonus.${k}`, v, 0, 5);
    }
    if (Object.keys(r.bonus).length === 0) issues.push(`${w}.bonus: mindestens ein Wert`);
  }
  const skillSlots = { basic: 0, special: 0 } as Record<string, number>;
  const thirdRoles = new Set<string>();
  for (const k of data.rpgSkills) {
    const w = at('rpgSkills', k.id);
    text(`${w}.name`, k.name);
    text(`${w}.description`, k.description);
    if (!['basic', 'third', 'special'].includes(k.slot)) issues.push(`${w}.slot: ungültig "${k.slot}"`);
    else skillSlots[k.slot] = (skillSlots[k.slot] ?? 0) + 1;
    if (!['enemy', 'self'].includes(k.target)) issues.push(`${w}.target: ungültig "${k.target}"`);
    num(`${w}.hit`, k.hit, 0);
    if (k.hit > 0 && k.target !== 'enemy') issues.push(`${w}.hit: Schaden nur mit target "enemy"`);
    if (k.hits !== undefined) num(`${w}.hits`, k.hits, 1, 10);
    if (k.heal !== undefined) num(`${w}.heal`, k.heal, 0, 1);
    num(`${w}.cooldown`, k.cooldown, 0, 20);
    if (k.status) {
      if (!statusIds.includes(k.status.id)) issues.push(`${w}.status.id: unbekannt "${k.status.id}"`);
      num(`${w}.status.rounds`, k.status.rounds, 1, 20);
      num(`${w}.status.value`, k.status.value, 0);
    }
    if (k.slot === 'third') {
      const from = k.from ?? {};
      const n = [from.latent, from.ability, from.role].filter((v) => v !== undefined).length;
      if (n !== 1) issues.push(`${w}.from: genau eine Quelle (latent, ability oder role)`);
      ref(`${w}.from.latent`, 'latentTraits', from.latent);
      ref(`${w}.from.ability`, 'abilities', from.ability);
      if (from.role !== undefined) {
        if (!['tank', 'attacker', 'fast'].includes(from.role)) issues.push(`${w}.from.role: ungültig "${from.role}"`);
        else thirdRoles.add(from.role);
      }
    } else if (k.from) issues.push(`${w}.from: nur für die dritte Fähigkeit`);
  }
  if (skillSlots['basic'] !== 1) issues.push('rpgSkills: genau ein Grundangriff (slot "basic")');
  if (skillSlots['special'] !== 1) issues.push('rpgSkills: genau ein Spezialangriff (slot "special")');
  for (const role of ['tank', 'attacker', 'fast']) if (!thirdRoles.has(role)) issues.push(`rpgSkills: dritte Fähigkeit für die Rolle "${role}" fehlt`);
  const intents = ['attack', 'charge', 'heavy', 'guard', 'heal', 'tech'];
  for (const e of data.rpgEnemies) {
    const w = at('rpgEnemies', e.id);
    text(`${w}.name`, e.name);
    if (!['normal', 'elite', 'boss'].includes(e.kind)) issues.push(`${w}.kind: ungültig "${e.kind}"`);
    if (!Array.isArray(e.pattern) || e.pattern.length === 0) issues.push(`${w}.pattern: mindestens ein Zug`);
    (e.pattern ?? []).forEach((m, i) => {
      if (!intents.includes(m)) issues.push(`${w}.pattern[${i}]: unbekannter Zug "${m}"`);
      if (m === 'charge' && e.pattern[(i + 1) % e.pattern.length] !== 'heavy') issues.push(`${w}.pattern[${i}]: auf „charge“ muss „heavy“ folgen`);
    });
    for (const k of ['hp', 'atk', 'def', 'spd'] as const) num(`${w}.${k}`, e[k], 0.1, 20);
  }
  for (const kind of ['normal', 'elite', 'boss']) {
    if (!data.rpgEnemies.some((e) => e.kind === kind)) issues.push(`rpgEnemies: mindestens ein Gegner der Art "${kind}"`);
  }
  for (const d of data.rpgDungeons) {
    const w = at('rpgDungeons', d.id);
    text(`${w}.name`, d.name);
    text(`${w}.description`, d.description);
    if (!Array.isArray(d.elements) || d.elements.length === 0) issues.push(`${w}.elements: mindestens ein Element`);
    for (const e of d.elements ?? []) {
      ref(`${w}.elements`, 'elements', e);
      if (!data.species.some((sp) => sp.element === e)) issues.push(`${w}.elements: keine Art mit Element "${e}"`);
    }
    num(`${w}.floor`, d.floor, 0);
    num(`${w}.floorsPerRoom`, d.floorsPerRoom, 0);
    num(`${w}.rooms`, d.rooms, 1, 50);
    num(`${w}.loot`, d.loot, 0);
    ref(`${w}.requires`, 'rpgDungeons', d.requires);
  }
  for (const ev of data.rpgEvents) {
    const w = at('rpgEvents', ev.id);
    text(`${w}.name`, ev.name);
    text(`${w}.text`, ev.text);
    num(`${w}.weight`, ev.weight, 0);
    if (!Array.isArray(ev.options) || ev.options.length !== 2) issues.push(`${w}.options: genau zwei Wahlmöglichkeiten`);
    const outcome = (where: string, o: RpgEventOutcome) => {
      text(`${where}.result`, o.result);
      if (o.hp !== undefined) num(`${where}.hp`, o.hp, -1, 1);
      if (o.loot !== undefined) num(`${where}.loot`, o.loot, 0, 10);
    };
    (ev.options ?? []).forEach((o, i) => {
      text(`${w}.options[${i}].label`, o.label);
      outcome(`${w}.options[${i}]`, o);
      if (o.chance !== undefined) num(`${w}.options[${i}].chance`, o.chance, 0, 1);
      if ((o.chance ?? 1) < 1 && !o.fail) issues.push(`${w}.options[${i}].fail: fehlt bei chance < 1`);
      if (o.fail) outcome(`${w}.options[${i}].fail`, o.fail);
    });
  }
  for (const r of data.resonances) {
    const w = at('resonances', r.id);
    text(`${w}.name`, r.name);
    num(`${w}.cost`, r.cost, 1);
    num(`${w}.costGrowth`, r.costGrowth, 1);
    num(`${w}.levelPower`, r.levelPower, 0, 1);
    cond(`${w}.requires`, r.requires);
    mods(`${w}.modifiers`, r.modifiers);
  }
  for (const m of data.megaProjects) {
    const w = at('megaProjects', m.id);
    text(`${w}.name`, m.name);
    cond(`${w}.requires`, m.requires);
    if (!Array.isArray(m.stages) || m.stages.length === 0) issues.push(`${w}.stages: mindestens eine Bauphase`);
    (m.stages ?? []).forEach((st, i) => {
      text(`${w}.stages[${i}].name`, st.name);
      num(`${w}.stages[${i}].hours`, st.hours, 0.01);
      amounts(`${w}.stages[${i}].cost`, st.cost);
      if (Object.keys(st.cost).length === 0) issues.push(`${w}.stages[${i}].cost: mindestens eine Ressource`);
    });
  }
  for (const t of data.latentTraits) {
    const w = at('latentTraits', t.id);
    text(`${w}.name`, t.name);
    num(`${w}.weight`, t.weight, 0);
    if (!['self', 'job', 'global'].includes(t.scope)) issues.push(`${w}.scope: ungültig "${t.scope}"`);
    mods(`${w}.modifiers`, t.modifiers);
  }
  for (const r of data.breedingRituals) {
    const w = at('breedingRituals', r.id);
    text(`${w}.name`, r.name);
    num(`${w}.hours`, r.hours, 0.01);
    amounts(`${w}.cost`, r.cost);
    cond(`${w}.requires`, r.requires);
    ref(`${w}.minRarity`, 'rarities', r.minRarity);
    if (r.hybridMult !== undefined) num(`${w}.hybridMult`, r.hybridMult, 0);
    if (r.rarityBoost !== undefined) num(`${w}.rarityBoost`, r.rarityBoost, 0);
    if (r.mutationAdd !== undefined) num(`${w}.mutationAdd`, r.mutationAdd, 0, 1);
  }
  const tiers = ['base', 'hybrid', 'rareHybrid', 'mythic'];
  for (const t of data.contracts) {
    const w = at('contracts', t.id);
    text(`${w}.name`, t.name);
    text(`${w}.client`, t.client);
    num(`${w}.level`, t.level, 1);
    num(`${w}.weight`, t.weight, 0);
    cond(`${w}.requires`, t.requires);
    if (!Array.isArray(t.requirements) || t.requirements.length === 0) issues.push(`${w}.requirements: mindestens eine Anforderung`);
    (t.requirements ?? []).forEach((r, i) => {
      const rw = `${w}.requirements[${i}]`;
      switch (r.kind) {
        case 'expresses':
        case 'genotype': {
          ref(rw, 'genes', r.locus);
          const locus = r.locus ? data.genes.find((g) => g.id === r.locus) : undefined;
          if (r.allele && !r.locus) issues.push(`${rw}: allele nur zusammen mit locus`);
          if (locus && r.allele && !locus.alleles.some((a) => a.id === r.allele)) issues.push(`${rw}: unbekanntes Allel "${r.allele}" in ${locus.id}`);
          break;
        }
        case 'element':
          ref(rw, 'elements', r.element);
          break;
        case 'minTier':
          if (!tiers.includes(r.tier)) issues.push(`${rw}: unbekannte Stufe "${r.tier}"`);
          break;
        case 'topLoci':
          num(`${rw}.count`, r.count, 1, data.genes.filter((g) => g.alleles.some((a) => a.top)).length);
          break;
        case 'minRarity':
          ref(rw, 'rarities', r.rarity);
          break;
        case 'minGeneration':
          num(`${rw}.generation`, r.generation, 1);
          break;
        default:
          issues.push(`${rw}: unbekannte Anforderung "${(r as { kind: string }).kind}"`);
      }
    });
    amounts(`${w}.reward.resources`, t.reward.resources);
    if (t.reward.minutes !== undefined) num(`${w}.reward.minutes`, t.reward.minutes, 0);
    if (t.reward.alleleSamples !== undefined) num(`${w}.reward.alleleSamples`, t.reward.alleleSamples, 0);
  }
  if (data.rarities.length === 0) issues.push('rarities: mindestens eine Seltenheit nötig');

  return issues;
}

function makeRegistry<T extends { id: string }>(kind: string, list: readonly T[]): Registry<T> {
  const map = new Map(list.map((e) => [e.id, e]));
  return {
    list,
    has: (id) => map.has(id),
    get(id) {
      const found = map.get(id);
      if (!found) throw new Error(`Unbekannte ${kind}-id "${id}"`);
      return found;
    },
  };
}

/** Validates content and builds lookup registries. Throws on any issue. */
export function buildContentDB(data: ContentData): ContentDB {
  const issues = validateContent(data);
  if (issues.length > 0) throw new ContentValidationError(issues);
  const db = {} as Record<string, Registry<{ id: string }>>;
  for (const kind of Object.keys(data) as Kind[]) {
    const list = [...(data[kind] as { id: string }[])];
    if (kind === 'rarities') (list as unknown as { order: number }[]).sort((a, b) => a.order - b.order);
    db[kind] = makeRegistry(kind, list);
  }
  return db as unknown as ContentDB;
}

import type { ContentChecks } from './checks';
import type { CellarMatch, CellarRuleDef } from './types';

/**
 * Per-kind validators for the lab and endgame content. Each one reports its
 * issues through the shared `ContentChecks`; `CONTENT_VALIDATORS` in
 * `validate.ts` runs them in a fixed order (the order of the issue list).
 */

/** Status effects a tower technique or RPG skill may apply. */
export const statusIds = ['burn', 'poison', 'stun', 'slow', 'shield', 'evade', 'regen', 'armor', 'reflect'];
const tiers = ['base', 'hybrid', 'rareHybrid', 'mythic'];

export function validateResources({ data, at, text, ref }: ContentChecks): void {
  for (const r of data.resources) {
    text(`${at('resources', r.id)}.name`, r.name);
    ref(`${at('resources', r.id)}.feature`, 'features', r.feature);
  }
}

export function validateSpecies({ data, issues, statIds, at, text, ref, num }: ContentChecks): void {
  for (const s of data.species) {
    const w = at('species', s.id);
    text(`${w}.name`, s.name);
    ref(`${w}.element`, 'elements', s.element);
    num(`${w}.hue`, s.hue, 0, 360);
    for (const stat of statIds) num(`${w}.baseStats.${stat}`, s.baseStats[stat], 0);
    for (const key of Object.keys(s.baseStats)) if (!statIds.has(key)) issues.push(`${w}.baseStats: unbekannter Stat "${key}"`);
  }
}

export function validateElements({ data, issues, at, text, ref }: ContentChecks): void {
  for (const e of data.elements) {
    for (const other of e.strongAgainst) ref(`${at('elements', e.id)}.strongAgainst`, 'elements', other);
    if (!Array.isArray(e.familyPrefixes) || e.familyPrefixes.length === 0) issues.push(`${at('elements', e.id)}.familyPrefixes: mindestens ein Wort`);
    else e.familyPrefixes.forEach((wd, i) => text(`${at('elements', e.id)}.familyPrefixes[${i}]`, wd));
  }
}

/** The name generator needs these lists (one epithet list per stat). */
export function validateRequiredNameLists({ data, ids, issues }: ContentChecks): void {
  for (const id of ['given', 'givenStart', 'givenEnd', 'familySuffix', 'epithet.shiny', ...data.stats.map((s) => `epithet.${s.id}`)]) {
    if (!ids.nameLists!.has(id)) issues.push(`nameLists: Liste "${id}" fehlt`);
  }
}

export function validateNameLists({ data, issues, at, text }: ContentChecks): void {
  for (const l of data.nameLists) {
    if (!Array.isArray(l.words) || l.words.length === 0) issues.push(`${at('nameLists', l.id)}.words: mindestens ein Wort`);
    else l.words.forEach((wd, i) => text(`${at('nameLists', l.id)}.words[${i}]`, wd));
  }
}

export function validateGenes({ data, issues, at, num, mods }: ContentChecks): void {
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
}

/** Gene unlock conditions (reported after the endgame content). */
export function validateGeneConditions({ data, at, cond }: ContentChecks): void {
  for (const g of data.genes) cond(`${at('genes', g.id)}.requires`, g.requires);
}

export function validateAbilities({ data, at, ref, mods }: ContentChecks): void {
  for (const a of data.abilities) {
    ref(`${at('abilities', a.id)}.tier`, 'rarities', a.tier);
    mods(`${at('abilities', a.id)}.modifiers`, a.modifiers);
  }
}

export function validateRecipes({ data, issues, at, text, ref, num, cond, alleleRef }: ContentChecks): void {
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
}

export function validateEvolutions({ data, issues, at, ref, amounts, alleleRef }: ContentChecks): void {
  for (const e of data.evolutions) {
    const w = at('evolutions', e.id);
    ref(`${w}.from`, 'species', e.from);
    ref(`${w}.to`, 'species', e.to);
    if (e.from === e.to) issues.push(`${w}: from und to sind gleich`);
    ref(`${w}.requires.minRarity`, 'rarities', e.requires.minRarity);
    alleleRef(`${w}.requires.allele`, e.requires.allele);
    amounts(`${w}.requires.cost`, e.requires.cost);
  }
}

export function validateBuildings({ data, issues, statIds, at, ref, num }: ContentChecks): void {
  for (const b of data.buildings) {
    const w = at('buildings', b.id);
    ref(`${w}.produces`, 'resources', b.produces);
    ref(`${w}.feature`, 'features', b.feature);
    if (!statIds.has(b.workStat)) issues.push(`${w}.workStat: unbekannter Stat "${b.workStat}"`);
    b.elements.forEach((e, i) => ref(`${w}.elements[${i}]`, 'elements', e));
    num(`${w}.baseRate`, b.baseRate, 0);
    num(`${w}.baseSlots`, b.baseSlots, 0);
  }
}

export function validateUpgrades({ data, at, text, ref, num, amounts, mods, cond }: ContentChecks): void {
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
}

export function validatePotions({ data, issues, at, ref, amounts, mods }: ContentChecks): void {
  for (const p of data.potions) {
    const w = at('potions', p.id);
    amounts(`${w}.cost`, p.cost);
    mods(`${w}.modifiers`, p.modifiers);
    ref(`${w}.feature`, 'features', p.feature);
    if ((p.kind === 'creatureBuff' || p.kind === 'globalBuff') && !(p.durationSec! > 0)) issues.push(`${w}: Buff braucht durationSec > 0`);
    if (p.kind === 'timeSkip' && !(p.skipSec! > 0)) issues.push(`${w}: timeSkip braucht skipSec > 0`);
    if (p.kind === 'permanentStat' && !(p.statBonus! > 0)) issues.push(`${w}: permanentStat braucht statBonus > 0`);
    if (p.costMinutes !== undefined && !(p.costMinutes > 0)) issues.push(`${w}: costMinutes muss > 0 sein`);
  }
}

export function validateMissions({ data, issues, at, ref, num, amounts, cond }: ContentChecks): void {
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
}

export function validateDexRewards({ data, at, ref, mods }: ContentChecks): void {
  for (const d of data.dexRewards) {
    const w = at('dexRewards', d.id);
    ref(`${w}.rarity`, 'rarities', d.rarity);
    mods(`${w}.modifiersPerEntry`, d.modifiersPerEntry);
    d.unlocksFeatures?.forEach((u) => u.features.forEach((f) => ref(`${w}.unlocksFeatures`, 'features', f)));
  }
}

export function validateFeatures({ data, at, text, ref, cond }: ContentChecks): void {
  for (const f of data.features) {
    text(`${at('features', f.id)}.hint`, f.hint);
    cond(`${at('features', f.id)}.condition`, f.condition);
    ref(`${at('features', f.id)}.grantsCreature.species`, 'species', f.grantsCreature?.species);
    ref(`${at('features', f.id)}.grantsCreature.rarity`, 'rarities', f.grantsCreature?.rarity);
  }
}

export function validateAchievements({ data, at, mods, cond }: ContentChecks): void {
  for (const a of data.achievements) {
    cond(`${at('achievements', a.id)}.condition`, a.condition);
    mods(`${at('achievements', a.id)}.modifiers`, a.modifiers);
  }
}

export function validatePrestigeLayers({ data, issues, at, ref, mods }: ContentChecks): void {
  for (const l of data.prestigeLayers) {
    const w = at('prestigeLayers', l.id);
    ref(`${w}.currency`, 'resources', l.currency);
    ref(`${w}.feature`, 'features', l.feature);
    l.gainFrom.forEach((r) => ref(`${w}.gainFrom`, 'resources', r));
    l.resets.resources.forEach((r) => ref(`${w}.resets.resources`, 'resources', r));
    if (l.resets.resources.includes(l.currency)) issues.push(`${w}: darf die eigene Währung nicht zurücksetzen`);
    mods(`${w}.modifiersPerPoint`, l.modifiersPerPoint);
  }
}

export function validateCapsules({ data, issues, at, ref, num, amounts }: ContentChecks): void {
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
}

export function validateTalents({ data, at, ref, num, amounts, mods, cond }: ContentChecks): void {
  for (const t of data.talents) {
    const w = at('talents', t.id);
    num(`${w}.cost`, t.cost, 0);
    t.requires.forEach((r) => ref(`${w}.requires`, 'talents', r));
    cond(`${w}.unlock`, t.unlock);
    mods(`${w}.modifiers`, t.modifiers);
    t.unlocksFeatures?.forEach((f) => ref(`${w}.unlocksFeatures`, 'features', f));
    amounts(`${w}.onReset`, t.onReset);
  }
}

export function validateAnomalies({ data, at, mods, cond }: ContentChecks): void {
  for (const a of data.anomalies) {
    const w = at('anomalies', a.id);
    mods(`${w}.modifiers`, a.modifiers);
    mods(`${w}.reward`, a.reward);
    mods(`${w}.perLevel`, a.perLevel);
    cond(`${w}.goal`, a.goal);
    cond(`${w}.requires`, a.requires);
  }
}

export function validateWeeklyMutations(checks: ContentChecks): void {
  const { data, at, mods } = checks;
  for (const m of data.weeklyMutations) {
    mods(`${at('weeklyMutations', m.id)}.modifiers`, m.modifiers);
    if (m.cellar) checkCellarRule(checks, `${at('weeklyMutations', m.id)}.cellar`, m.cellar);
  }
}

function checkCellarMatches(checks: ContentChecks, where: string, list: readonly CellarMatch[] | undefined): void {
  const { issues, ref, alleleRef } = checks;
  if (list && list.length === 0) issues.push(`${where}: leere Liste (weglassen statt leer)`);
  (list ?? []).forEach((m, i) => {
    const w = `${where}[${i}]`;
    switch (m.kind) {
      case 'element':
        if (m.elements.length === 0) issues.push(`${w}.elements: mindestens ein Element`);
        m.elements.forEach((e) => ref(`${w}.elements`, 'elements', e));
        break;
      case 'allele':
        alleleRef(w, m);
        break;
      case 'latent':
        ref(`${w}.trait`, 'latentTraits', m.trait);
        break;
      case 'row':
        if (m.row !== 'front' && m.row !== 'back') issues.push(`${w}.row: "front" oder "back"`);
        break;
      case 'nightSight':
        if (!checks.data.genes.some((l) => l.alleles.some((a) => a.nightSight))) issues.push(`${w}: kein Allel hat nightSight`);
        break;
      case 'duplicate':
        break;
      default:
        issues.push(`${w}.kind: unbekannt "${(m as { kind: string }).kind}"`);
    }
  });
}

function checkCellarRule(checks: ContentChecks, where: string, rule: CellarRuleDef): void {
  const { issues, text, num } = checks;
  text(`${where}.text`, rule.text);
  checkCellarMatches(checks, `${where}.match`, rule.match);
  checkCellarMatches(checks, `${where}.except`, rule.except);
  const e = rule.effect;
  for (const [k, v] of Object.entries(e.stats ?? {})) {
    if (!['hp', 'atk', 'def', 'spd'].includes(k)) issues.push(`${where}.effect.stats: unbekannter Wert "${k}"`);
    num(`${where}.effect.stats.${k}`, v, -0.9, 5);
  }
  if (e.miss !== undefined) num(`${where}.effect.miss`, e.miss, 0, 0.9);
  if (e.heal !== undefined) num(`${where}.effect.heal`, e.heal, 0, 5);
  if (e.hazard !== undefined) num(`${where}.effect.hazard`, e.hazard, 0, 0.9);
  if (!e.stats && e.miss === undefined && e.heal === undefined && e.hazard === undefined) issues.push(`${where}.effect: mindestens eine Wirkung`);
}

export function validateCellarEnvironments(checks: ContentChecks): void {
  const { data, issues, at, text } = checks;
  for (const env of data.cellarEnvironments) {
    const w = at('cellarEnvironments', env.id);
    text(`${w}.name`, env.name);
    text(`${w}.description`, env.description);
    if (env.rules.length === 0) issues.push(`${w}.rules: mindestens eine Regel`);
    env.rules.forEach((r, i) => checkCellarRule(checks, `${w}.rules[${i}]`, r));
  }
  if (data.cellarEnvironments.length < 2) issues.push('cellarEnvironments: mindestens zwei Umgebungen (sonst wiederholt sich der Keller)');
}

export function validateVoyageDestinations({ data, issues, at, text, ref }: ContentChecks): void {
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
}

export function validateVoyageEvents({ data, at, text, ref, num, amounts }: ContentChecks): void {
  for (const e of data.voyageEvents) {
    const w = at('voyageEvents', e.id);
    text(`${w}.text`, e.text);
    num(`${w}.weight`, e.weight, 0);
    amounts(`${w}.effect.resources`, e.effect.resources);
    (e.destinations ?? []).forEach((d) => ref(`${w}.destinations`, 'voyageDestinations', d));
  }
}

export function validateVoyageDecisions({ data, issues, at, text, ref, num, amounts }: ContentChecks): void {
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
}

export function validateGrandResearch({ data, at, text, num, amounts, mods, cond }: ContentChecks): void {
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
}

export function validateResearchThemes({ data, at, text }: ContentChecks): void {
  for (const t of data.researchThemes) text(`${at('researchThemes', t.id)}.name`, t.name);
}

export function validateBossTraits({ data, issues, at, text, num }: ContentChecks): void {
  for (const b of data.bossTraits) {
    const w = at('bossTraits', b.id);
    text(`${w}.name`, b.name);
    if (!['shield', 'shift', 'regen', 'sweep', 'drain', 'terror', 'darken'].includes(b.kind)) issues.push(`${w}.kind: ungültig "${b.kind}"`);
    for (const c of b.courses ?? []) if (!data.courses.some((x) => x.id === c)) issues.push(`${w}.courses: unbekannte Strecke "${c}"`);
    num(`${w}.value`, b.value, 0, 1);
    if (b.targeting !== undefined && !['rows', 'weakest', 'back'].includes(b.targeting)) issues.push(`${w}.targeting: ungültig "${b.targeting}"`);
  }
}

/** Tower techniques, plus exactly one technique per element. */
export function validateTechniques({ data, issues, at, text, ref, num }: ContentChecks): void {
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
}

export function validateCourses({ data, issues, at, text }: ContentChecks): void {
  const dice = new Set<string>();
  for (const c of data.courses) {
    const w = at('courses', c.id);
    text(`${w}.name`, c.name);
    text(`${w}.unit`, c.unit);
    text(`${w}.dice`, c.dice);
    if (!['up', 'down'].includes(c.direction)) issues.push(`${w}.direction: "up" oder "down"`);
    if (dice.has(c.dice)) issues.push(`${w}.dice: "${c.dice}" doppelt – zwei Strecken hätten dieselben Gegner`);
    (c.foePrefixes ?? []).forEach((p, i) => text(`${w}.foePrefixes[${i}]`, p));
    if (c.foePrefixes && c.foePrefixes.length === 0) issues.push(`${w}.foePrefixes: leere Liste (weglassen statt leer)`);
    dice.add(c.dice);
  }
  for (const id of ['tower', 'cellar']) if (!data.courses.some((c) => c.id === id)) issues.push(`courses: Strecke "${id}" fehlt`);
}

export function validateRelics({ data, issues, at, text, num, ref }: ContentChecks): void {
  for (const kind of ['relics', 'darkRelics'] as const) {
    const dark = kind === 'darkRelics';
    for (const r of data[kind]) {
      const w = at(kind, r.id);
      text(`${w}.name`, r.name);
      num(`${w}.cost`, r.cost, 1);
      num(`${w}.costGrowth`, r.costGrowth, 1);
      num(`${w}.maxLevel`, r.maxLevel, 1);
      ref(`${w}.currency`, 'resources', r.currency);
      for (const [k, v] of Object.entries(r.bonus)) {
        if (!['hp', 'atk', 'def', 'spd', 'element'].includes(k)) issues.push(`${w}.bonus: unbekannter Wert "${k}"`);
        num(`${w}.bonus.${k}`, v, dark ? -0.5 : 0, 5);
        // A malus must leave something at the highest level.
        if (v < 0 && 1 + v * r.maxLevel < 0.1) issues.push(`${w}.bonus.${k}: auf Stufe ${r.maxLevel} bliebe weniger als 10 %`);
      }
      const values = Object.values(r.bonus);
      if (values.length === 0) issues.push(`${w}.bonus: mindestens ein Wert`);
      if (dark && !(values.some((v) => v > 0) && values.some((v) => v < 0))) issues.push(`${w}.bonus: ein dunkles Relikt hat einen Vorteil und einen Nachteil`);
    }
  }
  for (const r of data.darkRelics) if (data.relics.some((x) => x.id === r.id)) issues.push(`darkRelics[${r.id}]: dieselbe id wie ein Relikt (die Stufen teilen sich einen Speicher)`);
}

export function validateCellarMilestones({ data, issues, at, text, num, mods }: ContentChecks): void {
  let last = 0;
  for (const m of data.cellarMilestones) {
    const w = at('cellarMilestones', m.id);
    text(`${w}.name`, m.name);
    text(`${w}.description`, m.description);
    num(`${w}.level`, m.level, 1);
    if (m.level <= last) issues.push(`${w}.level: Meilensteine aufsteigend ohne Doppelte`);
    last = m.level;
    if (m.modifiers.length === 0) issues.push(`${w}.modifiers: mindestens ein Bonus`);
    mods(`${w}.modifiers`, m.modifiers);
  }
}

export function validateResonances({ data, at, text, num, mods, cond }: ContentChecks): void {
  for (const r of data.resonances) {
    const w = at('resonances', r.id);
    text(`${w}.name`, r.name);
    num(`${w}.cost`, r.cost, 1);
    num(`${w}.costGrowth`, r.costGrowth, 1);
    num(`${w}.levelPower`, r.levelPower, 0, 1);
    cond(`${w}.requires`, r.requires);
    mods(`${w}.modifiers`, r.modifiers);
  }
}

export function validateMegaProjects({ data, issues, at, text, num, amounts, cond }: ContentChecks): void {
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
}

export function validateLatentTraits({ data, issues, at, text, num, mods }: ContentChecks): void {
  for (const t of data.latentTraits) {
    const w = at('latentTraits', t.id);
    text(`${w}.name`, t.name);
    num(`${w}.weight`, t.weight, 0);
    if (!['self', 'job', 'global'].includes(t.scope)) issues.push(`${w}.scope: ungültig "${t.scope}"`);
    mods(`${w}.modifiers`, t.modifiers);
  }
}

export function validateBreedingRituals({ data, at, text, ref, num, amounts, cond }: ContentChecks): void {
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
}

export function validateContracts({ data, issues, at, text, ref, num, amounts, cond }: ContentChecks): void {
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
        case 'rpgLevel':
          num(`${rw}.level`, r.level, 1);
          break;
        case 'item':
          ref(rw, 'rarities', r.minRarity);
          if (r.slot && !data.rpgGear.some((g) => g.slot === r.slot)) issues.push(`${rw}: keine Ausrüstung für den Platz "${r.slot}"`);
          break;
        default:
          issues.push(`${rw}: unbekannte Anforderung "${(r as { kind: string }).kind}"`);
      }
    });
    // Equipment contracts ask for exactly one item and nothing about a creature; the others never for an item.
    const items = (t.requirements ?? []).filter((r) => r.kind === 'item').length;
    if (t.delivery === 'item' && (items !== 1 || t.requirements.length !== 1)) issues.push(`${w}.requirements: ein Ausrüstungsauftrag verlangt genau eine Ausrüstung`);
    if (t.delivery !== 'item' && items > 0) issues.push(`${w}.requirements: Ausrüstung nur mit delivery „item“`);
    if (t.delivery === 'loan') num(`${w}.loanHours`, t.loanHours, 0.1);
    else if (t.loanHours !== undefined) issues.push(`${w}.loanHours: nur mit delivery „loan“`);
    amounts(`${w}.reward.resources`, t.reward.resources);
    if (t.reward.minutes !== undefined) num(`${w}.reward.minutes`, t.reward.minutes, 0);
    if (t.reward.alleleSamples !== undefined) num(`${w}.reward.alleleSamples`, t.reward.alleleSamples, 0);
  }
}

export function validateRarities({ data, issues }: ContentChecks): void {
  if (data.rarities.length === 0) issues.push('rarities: mindestens eine Seltenheit nötig');
}

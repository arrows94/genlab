import type { ContentChecks } from './checks';
import type { RpgEventOutcome } from './types';
import { statusIds } from './validators';

/** Per-kind validators for the GenLab RPG content (see `CONTENT_VALIDATORS`). */

const intents = ['attack', 'combo', 'charge', 'heavy', 'guard', 'heal', 'tech'];

/** RPG skills, plus exactly one basic and one special skill and a third skill per role. */
export function validateRpgSkills({ data, issues, at, text, ref, num }: ContentChecks): void {
  const skillSlots = { basic: 0, special: 0, item: 0 } as Record<string, number>;
  const stances = new Set<string>();
  const thirdRoles = new Set<string>();
  for (const k of data.rpgSkills) {
    const w = at('rpgSkills', k.id);
    text(`${w}.name`, k.name);
    text(`${w}.description`, k.description);
    if (!['basic', 'third', 'special', 'defense', 'item'].includes(k.slot)) issues.push(`${w}.slot: ungültig "${k.slot}"`);
    else skillSlots[k.slot] = (skillSlots[k.slot] ?? 0) + 1;
    if (!['enemy', 'self'].includes(k.target)) issues.push(`${w}.target: ungültig "${k.target}"`);
    num(`${w}.hit`, k.hit, 0);
    if (k.hit > 0 && k.target !== 'enemy') issues.push(`${w}.hit: Schaden nur mit target "enemy"`);
    if (k.hits !== undefined) num(`${w}.hits`, k.hits, 1, 10);
    if (k.heal !== undefined) num(`${w}.heal`, k.heal, 0, 1);
    num(`${w}.cooldown`, k.cooldown, 0, 20);
    if (k.stamina !== undefined) num(`${w}.stamina`, k.stamina, 0, 100);
    if (k.slot === 'defense') {
      if (!k.stance || !['dodge', 'parry', 'breathe'].includes(k.stance)) issues.push(`${w}.stance: dodge, parry oder breathe`);
      else stances.add(k.stance);
    } else if (k.stance) issues.push(`${w}.stance: nur für Abwehr-Züge (slot "defense")`);
    if (k.slot === 'item' && !k.heal) issues.push(`${w}.heal: der Heiltrank muss heilen`);
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
  if (skillSlots['item'] !== 1) issues.push('rpgSkills: genau ein Heiltrank (slot "item")');
  for (const stance of ['dodge', 'parry', 'breathe']) if (!stances.has(stance)) issues.push(`rpgSkills: Abwehr-Zug "${stance}" fehlt`);
  for (const role of ['tank', 'attacker', 'fast']) if (!thirdRoles.has(role)) issues.push(`rpgSkills: dritte Fähigkeit für die Rolle "${role}" fehlt`);
}

/** RPG enemies, plus at least one enemy of every kind. */
export function validateRpgEnemies({ data, issues, at, text, num, ref }: ContentChecks): void {
  const checkPattern = (w: string, pattern: string[]) => {
    if (!Array.isArray(pattern) || pattern.length === 0) issues.push(`${w}: mindestens ein Zug`);
    (pattern ?? []).forEach((m, i) => {
      if (!intents.includes(m)) issues.push(`${w}[${i}]: unbekannter Zug "${m}"`);
      if (m === 'charge' && pattern[(i + 1) % pattern.length] !== 'heavy') issues.push(`${w}[${i}]: auf „charge“ muss „heavy“ folgen`);
    });
  };
  const bossOf = new Set<string>();
  for (const e of data.rpgEnemies) {
    const w = at('rpgEnemies', e.id);
    text(`${w}.name`, e.name);
    if (!['normal', 'elite', 'boss'].includes(e.kind)) issues.push(`${w}.kind: ungültig "${e.kind}"`);
    checkPattern(`${w}.pattern`, e.pattern);
    for (const k of ['hp', 'atk', 'def', 'spd'] as const) num(`${w}.${k}`, e[k], 0.1, 20);
    if (e.dungeon !== undefined) {
      if (e.kind !== 'boss') issues.push(`${w}.dungeon: nur für Bosse`);
      ref(`${w}.dungeon`, 'rpgDungeons', e.dungeon);
      if (bossOf.has(e.dungeon)) issues.push(`${w}.dungeon: "${e.dungeon}" hat schon einen Boss`);
      bossOf.add(e.dungeon);
    }
    ref(`${w}.species`, 'species', e.species);
    if (e.onHit) {
      if (!['burn', 'poison', 'slow', 'stun'].includes(e.onHit.id)) issues.push(`${w}.onHit.id: nur burn, poison, slow oder stun`);
      num(`${w}.onHit.rounds`, e.onHit.rounds, 1, 10);
      num(`${w}.onHit.value`, e.onHit.value, 0);
    }
    if (e.phase2) {
      if (e.kind !== 'boss') issues.push(`${w}.phase2: nur für Bosse`);
      checkPattern(`${w}.phase2.pattern`, e.phase2.pattern);
      if (e.phase2.atk !== undefined) num(`${w}.phase2.atk`, e.phase2.atk, 1, 5);
      if (e.phase2.spd !== undefined) num(`${w}.phase2.spd`, e.phase2.spd, 1, 5);
      text(`${w}.phase2.text`, e.phase2.text);
    }
  }
  for (const kind of ['normal', 'elite', 'boss']) {
    if (!data.rpgEnemies.some((e) => e.kind === kind)) issues.push(`rpgEnemies: mindestens ein Gegner der Art "${kind}"`);
  }
}

export function validateRpgDungeons({ data, issues, at, text, ref, num }: ContentChecks): void {
  for (const d of data.rpgDungeons) {
    const w = at('rpgDungeons', d.id);
    text(`${w}.name`, d.name);
    text(`${w}.description`, d.description);
    if (!Array.isArray(d.elements) || d.elements.length === 0) issues.push(`${w}.elements: mindestens ein Element`);
    for (const e of d.elements ?? []) {
      ref(`${w}.elements`, 'elements', e);
      if (!data.species.some((sp) => sp.element === e)) issues.push(`${w}.elements: keine Art mit Element "${e}"`);
    }
    num(`${w}.level`, d.level, 1, 200);
    num(`${w}.levelsPerRoom`, d.levelsPerRoom, 0, 20);
    num(`${w}.rooms`, d.rooms, 1, 50);
    num(`${w}.loot`, d.loot, 0);
    ref(`${w}.requires`, 'rpgDungeons', d.requires);
  }
}

export function validateRpgEvents({ data, issues, at, text, num }: ContentChecks): void {
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
}

/** Run upgrades, plus enough uncapped ones to always fill a choice. */
export function validateRpgUpgrades({ data, issues, at, text, num }: ContentChecks): void {
  for (const u of data.rpgUpgrades) {
    const w = at('rpgUpgrades', u.id);
    text(`${w}.name`, u.name);
    text(`${w}.description`, u.description);
    num(`${w}.weight`, u.weight, 0);
    if (u.max !== undefined) num(`${w}.max`, u.max, 1);
    for (const [k, v] of Object.entries(u.stats ?? {})) {
      if (!['hp', 'atk', 'def', 'spd'].includes(k)) issues.push(`${w}.stats: unbekannter Wert "${k}"`);
      num(`${w}.stats.${k}`, v, 0, 5);
    }
    for (const [k, v] of Object.entries(u.perks ?? {})) {
      if (!['specialPower', 'chargePerRound', 'lifesteal', 'crit', 'regen', 'cooldown'].includes(k)) issues.push(`${w}.perks: unbekannter Effekt "${k}"`);
      num(`${w}.perks.${k}`, v, 0, 5);
    }
    if (Object.keys(u.stats ?? {}).length + Object.keys(u.perks ?? {}).length === 0) issues.push(`${w}: mindestens ein Wert oder Effekt`);
  }
  if (data.rpgUpgrades.filter((u) => u.max === undefined).length < 3) issues.push('rpgUpgrades: mindestens drei ohne Obergrenze (immer genug Auswahl)');
}

/** Gear, plus at least one piece per slot. */
export function validateRpgGear({ data, issues, at, text, num }: ContentChecks): void {
  for (const gear of data.rpgGear) {
    const w = at('rpgGear', gear.id);
    text(`${w}.name`, gear.name);
    if (!['weapon', 'armor', 'charm'].includes(gear.slot)) issues.push(`${w}.slot: ungültig "${gear.slot}"`);
    for (const [k, v] of Object.entries(gear.stats ?? {})) {
      if (!['hp', 'atk', 'def', 'spd'].includes(k)) issues.push(`${w}.stats: unbekannter Wert "${k}"`);
      num(`${w}.stats.${k}`, v, 0, 2);
    }
    for (const [k, v] of Object.entries(gear.perks ?? {})) {
      if (!['specialPower', 'chargePerRound', 'lifesteal', 'crit', 'regen'].includes(k)) issues.push(`${w}.perks: unbekannter Effekt "${k}"`);
      num(`${w}.perks.${k}`, v, 0, 1);
    }
    if (Object.keys(gear.stats ?? {}).length + Object.keys(gear.perks ?? {}).length === 0) issues.push(`${w}: mindestens ein Wert oder Effekt`);
  }
  for (const slot of ['weapon', 'armor', 'charm']) if (!data.rpgGear.some((g) => g.slot === slot)) issues.push(`rpgGear: mindestens ein Teil für "${slot}"`);
}

export function validateRpgMeta({ data, issues, at, text, num }: ContentChecks): void {
  for (const m of data.rpgMeta) {
    const w = at('rpgMeta', m.id);
    text(`${w}.name`, m.name);
    text(`${w}.description`, m.description);
    num(`${w}.cost`, m.cost, 1);
    num(`${w}.costGrowth`, m.costGrowth, 1);
    num(`${w}.maxLevel`, m.maxLevel, 1, 50);
    const e = m.effect ?? {};
    for (const [k, v] of Object.entries(e.stats ?? {})) {
      if (!['hp', 'atk', 'def', 'spd'].includes(k)) issues.push(`${w}.effect.stats: unbekannter Wert "${k}"`);
      num(`${w}.effect.stats.${k}`, v, 0, 1);
    }
    if (e.torches !== undefined) num(`${w}.effect.torches`, e.torches, 1, 5);
    if (e.startCharge !== undefined) num(`${w}.effect.startCharge`, e.startCharge, 0, 1);
    if (e.restHeal !== undefined) num(`${w}.effect.restHeal`, e.restHeal, 0, 1);
    if (Object.keys(e).length === 0) issues.push(`${w}.effect: mindestens ein Effekt`);
  }
}

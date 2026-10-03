import { describe, expect, it } from 'vitest';
import { contentData } from '@content/index';
import { validateContent } from '@core/content/validate';
import type { ContentData } from '@core/content/types';
import { createCreature } from '@core/creatures';
import { Rng } from '@core/rng';
import { unlockFeature } from '@core/systems/unlocks';
import { simulateFight, enemyFor, type Fighter } from '@core/features/tower';
import { activeMutation } from '@core/features/weekly';
import {
  cellarCandidates, cellarFighter, cellarFit, cellarRules, combineEffects, environmentAt, environmentSection, fightNextCellarLevel, hasNightSight,
  refreshCellarAttempts, ruleFor, setCellarRow, setCellarTeam, startCellarRun, torchMiss,
} from '@core/features/cellar';
import type { Creature } from '@core/state';
import { balance, content, makeGame } from './helpers';

const DAY = 24 * 3_600_000;

function cellarGame(seed = 5) {
  const g = makeGame(seed);
  for (const f of ['farm', 'breeding', 'tower', 'cellar']) unlockFeature(g, f);
  refreshCellarAttempts(g);
  return g;
}
type G = ReturnType<typeof cellarGame>;

/** A plain creature: no night sight, no Aᵉ, no Pᵈ (and no Erbanlage) unless the test sets it. */
function plain(g: G, species = 'emberpup', power = 200): Creature {
  const c = createCreature(g, { speciesId: species, rarity: 'common', abilities: [], stats: { hp: power * 3, atk: power, def: power / 2, spd: power / 4 }, exactStats: true });
  c.genome['color'] = ['N', 'N'];
  c.genome['stamina'] = ['a', 'a'];
  c.genome['armor'] = ['p', 'p'];
  c.latent = null;
  return c;
}

/** First level whose section has this environment. */
function levelOf(g: G, id: string): number {
  for (let level = 1; level < 2000; level++) if (environmentAt(g, level)?.id === id) return level;
  throw new Error(`no level with ${id}`);
}

/** The fighter `c` becomes on `level` (team = the given order). */
function asFighter(g: G, c: Creature, level: number, team: Creature[] = [c], light = 1): Fighter {
  const hits = cellarRules(g, level).filter((r) => ruleFor(g, r, c, team, g.state.cellar.back.includes(c.id) ? 'back' : 'front') === 'hit');
  return cellarFighter(g, c, 1, combineEffects(hits.map((r) => r.effect)), light);
}

describe('environments', () => {
  it('the first levels are a plain vault, then every section of ten has one fixed environment', () => {
    const g = cellarGame();
    const cfg = balance.cellar;
    expect(environmentAt(g, cfg.environmentFrom - 1)).toBeNull();
    const first = environmentAt(g, cfg.environmentFrom)!;
    expect(first).not.toBeNull();
    for (let l = cfg.environmentFrom; l < cfg.environmentFrom + cfg.environmentEvery; l++) expect(environmentAt(g, l)).toBe(first);
    expect(environmentSection(g, cfg.environmentFrom + 3)).toEqual({ from: cfg.environmentFrom, to: cfg.environmentFrom + cfg.environmentEvery - 1 });
    // One full round shows every environment once; neighbours never repeat, also across rounds.
    const n = content.cellarEnvironments.list.length;
    const sections = Array.from({ length: 5 * n }, (_, i) => environmentAt(g, cfg.environmentFrom + i * cfg.environmentEvery)!.id);
    expect(new Set(sections.slice(0, n)).size).toBe(n);
    for (let i = 1; i < sections.length; i++) expect(sections[i]).not.toBe(sections[i - 1]);
    // Deterministic, independent of the game.
    expect(environmentAt(cellarGame(99), cfg.environmentFrom + 40)).toBe(environmentAt(g, cfg.environmentFrom + 40));
  });

  it('Finsternis: attacks miss without night sight; Dunkel and Albino see in the dark', () => {
    const g = cellarGame();
    const level = levelOf(g, 'darkness');
    const blind = plain(g);
    const dark = plain(g);
    dark.genome['color'] = ['N', 'D'];
    const albino = plain(g);
    albino.genome['color'] = ['al', 'al'];
    const carrier = plain(g);
    carrier.genome['color'] = ['N', 'al'];
    expect([blind, dark, albino, carrier].map((c) => hasNightSight(g, c))).toEqual([false, true, true, false]);
    expect(asFighter(g, blind, level).miss).toBeCloseTo(0.25);
    expect(asFighter(g, dark, level).miss).toBeUndefined();
    expect(asFighter(g, albino, level).miss).toBeUndefined();
  });

  it('Überflutet: water and ice stronger, fire weaker', () => {
    const g = cellarGame();
    const level = levelOf(g, 'flooded');
    const plainLevel = 1;
    const fire = plain(g, 'emberpup');
    const water = plain(g, content.species.list.find((s) => s.element === 'water')!.id);
    expect(asFighter(g, fire, level).atk).toBeLessThan(asFighter(g, fire, plainLevel).atk);
    expect(asFighter(g, water, level).atk).toBeGreaterThan(asFighter(g, water, plainLevel).atk);
    expect(asFighter(g, water, level).spd).toBeGreaterThan(asFighter(g, water, plainLevel).spd);
  });

  it('Sporennebel costs HP before every level, except pure Aᵉ and poison creatures', () => {
    const g = cellarGame();
    const level = levelOf(g, 'spores');
    // So strong that the foes fall before they act: every HP lost is the spores'.
    const weak = plain(g, 'emberpup', 5000);
    const pure = plain(g, 'pebblit', 5000);
    pure.genome['stamina'] = ['Ae', 'Ae'];
    const mixed = plain(g, 'steamling', 5000);
    mixed.genome['stamina'] = ['Ae', 'a'];
    const team = [weak, pure, mixed];
    const rule = cellarRules(g, level)[0]!;
    expect(team.map((c) => ruleFor(g, rule, c, team, 'front'))).toEqual(['hit', 'adapted', 'hit']);
    expect(setCellarTeam(g, team.map((c) => c.id)).ok).toBe(true);
    startCellarRun(g);
    const run = g.state.cellar.run!;
    run.level = level - 1;
    fightNextCellarLevel(g);
    expect(run.level).toBe(level);
    const hazard = rule.effect.hazard!;
    expect(run.hp[0]).toBeCloseTo(1 - hazard, 2);
    expect(run.hp[1]).toBe(1);
    expect(run.hp[2]).toBeCloseTo(1 - hazard, 2);
  });

  it('Einsturz hits only the back row, Diamanthaut protects', () => {
    const g = cellarGame();
    const level = levelOf(g, 'collapse');
    const front = plain(g);
    const back = plain(g);
    const armored = plain(g);
    armored.genome['armor'] = ['Pd', 'p'];
    setCellarTeam(g, [front.id, back.id, armored.id]);
    setCellarRow(g, back.id, 'back');
    setCellarRow(g, armored.id, 'back');
    const rule = cellarRules(g, level)[0]!;
    const team = [front, back, armored];
    expect([front, back, armored].map((c) => ruleFor(g, rule, c, team, g.state.cellar.back.includes(c.id) ? 'back' : 'front'))).toEqual(['none', 'hit', 'adapted']);
  });

  it('Schatten-Aura halves healing, Wurzelgewirr slows, Vielfalts-Siegel weakens repeats', () => {
    const g = cellarGame();
    const plainOne = plain(g);
    expect(asFighter(g, plainOne, levelOf(g, 'shadowAura')).healing).toBe(0.5);
    const shadow = plain(g, content.species.list.find((s) => s.element === 'shadow')!.id);
    expect(asFighter(g, shadow, levelOf(g, 'shadowAura')).healing).toBeUndefined();

    const roots = levelOf(g, 'roots');
    const titan = plain(g);
    titan.latent = 'titanBlood';
    titan.deepSequenced = true;
    expect(asFighter(g, plainOne, roots).spd).toBeLessThan(asFighter(g, plainOne, 1).spd);
    expect(asFighter(g, titan, roots).spd).toBe(asFighter(g, titan, 1).spd);
    // A hidden Erbanlage does not count.
    titan.deepSequenced = false;
    expect(asFighter(g, titan, roots).spd).toBeLessThan(asFighter(g, titan, 1).spd);

    const seal = levelOf(g, 'diversity');
    const a = plain(g, 'emberpup');
    const b = plain(g, 'emberpup');
    const other = plain(g, 'pebblit');
    const team = [a, b, other];
    expect(asFighter(g, a, seal, team).atk).toBe(asFighter(g, a, 1, team).atk);
    expect(asFighter(g, b, seal, team).atk).toBeLessThan(asFighter(g, b, 1, team).atk);
    expect(asFighter(g, other, seal, team).atk).toBe(asFighter(g, other, 1, team).atk);
  });

  it('the week’s mutation adds its rule on every level', () => {
    const g = cellarGame();
    unlockFeature(g, 'weekly');
    let now = g.state.lastTickAt;
    while (activeMutation(g, now)?.id !== 'iceAge') now += 7 * DAY;
    g.state.lastTickAt = now;
    const ice = plain(g, content.species.list.find((s) => s.element === 'ice')!.id);
    expect(cellarRules(g, 1).map((r) => r.text)).toEqual(['Eis: +20 % Angriff']);
    expect(cellarFit(g, ice, 1).good).toEqual(['Eis: +20 % Angriff']);
  });
});

describe('Fackellicht', () => {
  it('burns down level by level, a rest vault lights it again; night sight ignores the dark', () => {
    const g = cellarGame();
    const cfg = balance.cellar;
    expect(torchMiss(g, 1)).toBe(0);
    expect(torchMiss(g, 1 - 4 * cfg.lightPerLevel)).toBeGreaterThan(0);
    const blind = plain(g, 'emberpup', 2000);
    const dark = plain(g, 'pebblit', 2000);
    dark.genome['color'] = ['D', 'D'];
    expect(cellarFighter(g, blind, 1, combineEffects([]), 0.2).miss).toBeGreaterThan(0);
    expect(cellarFighter(g, dark, 1, combineEffects([]), 0.2).miss).toBeUndefined();
    setCellarTeam(g, [blind.id, dark.id]);
    startCellarRun(g);
    const run = g.state.cellar.run!;
    for (let i = 1; i < cfg.restEvery; i++) fightNextCellarLevel(g);
    expect(run.light).toBeCloseTo(1 - (cfg.restEvery - 1) * cfg.lightPerLevel);
    fightNextCellarLevel(g);
    expect(run.light).toBe(1);
  });
});

describe('fit and candidates', () => {
  it('sorts the stable by how well it fits the next level', () => {
    const g = cellarGame();
    const level = levelOf(g, 'spores');
    const weak = plain(g);
    const pure = plain(g);
    pure.genome['stamina'] = ['Ae', 'Ae'];
    expect(cellarFit(g, weak, level).bad).toHaveLength(1);
    expect(cellarFit(g, pure, level).good).toHaveLength(1);
    const list = cellarCandidates(g, level).map((x) => x.creature.id);
    expect(list.indexOf(pure.id)).toBeLessThan(list.indexOf(weak.id));
  });
});

describe('fight engine extras', () => {
  const g0 = () => cellarGame();
  it('`miss` makes attacks go wide, `healing` scales what a fighter is healed', () => {
    const g = g0();
    const c = plain(g, 'emberpup', 500);
    const base = cellarFighter(g, c);
    const foe = () => ({ ...enemyFor(g, 30), hp: 1e9, maxHp: 1e9 });
    const clean = simulateFight(g, [{ ...base }], foe(), Rng.fromSeed(1), { limitSec: 30 });
    const blind = simulateFight(g, [{ ...base, miss: 0.5 }], foe(), Rng.fromSeed(1), { limitSec: 30 });
    expect(blind.stats.missed[0]!).toBeGreaterThan(clean.stats.missed[0]! + 3);
    // The team's own Element-Technik heals less under the aura (if it heals at all).
    const healer = content.techniques.list.find((t) => t.heal && t.target !== 'enemy');
    if (healer) {
      const sp = content.species.list.find((s) => s.element === healer.element)!;
      const h = cellarFighter(g, plain(g, sp.id, 500));
      const hurt = { ...h, hp: Math.round(h.maxHp / 10) };
      // The first heal (far from full HP, so no cap): half as much under the aura.
      const firstHeal = (r: ReturnType<typeof simulateFight>) => r.events.find((e) => e.kind === 'heal' && e.t === 0)!.dmg;
      const full = simulateFight(g, [{ ...hurt }], foe(), Rng.fromSeed(2), { limitSec: 30, replay: true });
      const half = simulateFight(g, [{ ...hurt, healing: 0.5 }], foe(), Rng.fromSeed(2), { limitSec: 30, replay: true });
      expect(firstHeal(half)).toBeCloseTo(firstHeal(full) / 2, -1);
    }
  });
});

describe('content checks', () => {
  it('reports broken Keller rules', () => {
    const data: ContentData = structuredClone(contentData);
    data.cellarEnvironments[0]!.rules.push({ match: [{ kind: 'element', elements: ['lava'] }], effect: {}, text: '' });
    data.cellarEnvironments[1]!.rules.push({ except: [{ kind: 'allele', locus: 'color', allele: 'XX' }], effect: { miss: 2 }, text: 'x' });
    const issues = validateContent(data).join('\n');
    expect(issues).toMatch(/cellarEnvironments\[.*\]\.rules\[\d\]\.match\[0\]\.elements/);
    expect(issues).toMatch(/mindestens eine Wirkung/);
    expect(issues).toMatch(/effect\.miss/);
    expect(issues).toMatch(/XX/);
  });
});

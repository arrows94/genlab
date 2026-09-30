import { describe, expect, it } from 'vitest';
import { finishRpgRun, leaveRpgRun, nextTorchAt, refreshTorches, rpgHero, rpgMaxHp, secureLoot, startRpgRun, torches } from '@core/features/rpg';
import { canConsume, sell } from '@core/features/stable';
import { rpgSkillsFor, thirdSkill } from '@core/features/rpgCombat';
import { createCreature } from '@core/creatures';
import { performPrestige } from '@core/prestige';
import { deserialize, serialize } from '@core/save';
import { unlockFeature } from '@core/systems/unlocks';
import { D } from '@core/num';
import { NOW, balance, makeGame } from './helpers';

const HOUR = 3_600_000;

function rpgGame() {
  const g = makeGame();
  unlockFeature(g, 'rpg');
  refreshTorches(g, NOW);
  return g;
}

describe('GenLab RPG – Fackeln', () => {
  it('stays apart from the normal game: no condition unlocks it', () => {
    const g = makeGame();
    expect(g.content.features.get('rpg').condition).toBeUndefined();
    refreshTorches(g, NOW);
    expect(torches(g)).toBe(0);
    expect(nextTorchAt(g)).toBeNull();
  });

  it('fills the stock once on unlock', () => {
    const g = rpgGame();
    expect(torches(g)).toBe(balance.rpg.maxTorches);
    expect(nextTorchAt(g)).toBeNull();
  });

  it('refills one Fackel per interval up to the limit, also across long breaks', () => {
    const g = rpgGame();
    g.state.resources['torches'] = D(0);
    refreshTorches(g, NOW);
    expect(nextTorchAt(g)).toBe(NOW + balance.rpg.torchHours * HOUR);
    refreshTorches(g, NOW + balance.rpg.torchHours * HOUR - 1);
    expect(torches(g)).toBe(0);
    refreshTorches(g, NOW + balance.rpg.torchHours * HOUR);
    expect(torches(g)).toBe(1);
    // The next one counts from the planned time, not from the late check.
    expect(nextTorchAt(g)).toBe(NOW + 2 * balance.rpg.torchHours * HOUR);
    refreshTorches(g, NOW + 100 * HOUR);
    expect(torches(g)).toBe(balance.rpg.maxTorches);
    expect(nextTorchAt(g)).toBeNull();
  });

  it('keeps extra Fackeln from rewards above the limit', () => {
    const g = rpgGame();
    g.state.resources['torches'] = D(balance.rpg.maxTorches + 2);
    refreshTorches(g, NOW + 100 * HOUR);
    expect(torches(g)).toBe(balance.rpg.maxTorches + 2);
  });

  it('old saves get the new state with defaults', () => {
    const g = makeGame();
    const raw = JSON.parse(serialize(g.state, NOW));
    delete raw.state.rpg;
    const { state } = deserialize(JSON.stringify(raw));
    expect(state.rpg.torchAt).toBe(-1);
  });
});

describe('GenLab RPG – Lauf', () => {
  it('needs the feature and a Fackel', () => {
    const g = makeGame();
    const id = g.state.creatures[0]!.id;
    expect(startRpgRun(g, id).ok).toBe(false);
    unlockFeature(g, 'rpg');
    expect(startRpgRun(g, id).ok).toBe(false); // stock not filled yet
    refreshTorches(g, NOW);
    expect(startRpgRun(g, id).ok).toBe(true);
    expect(torches(g)).toBe(balance.rpg.maxTorches - 1);
    expect(g.state.rpg.runs).toBe(1);
    expect(startRpgRun(g, id).ok).toBe(false); // one run at a time
  });

  it('starts at level 1 with full HP; the monster is busy and protected', () => {
    const g = rpgGame();
    const c = g.state.creatures[0]!;
    createCreature(g, { speciesId: 'sproutle', rarity: 'common', source: 'other' });
    expect(startRpgRun(g, c.id).ok).toBe(true);
    const run = g.state.rpg.run!;
    expect(run.level).toBe(1);
    expect(run.depth).toBe(0);
    expect(run.hp).toBe(rpgMaxHp(g, c));
    expect(rpgHero(g)).toBe(c);
    expect(c.job).toEqual({ kind: 'rpg', target: 'run' });
    expect(canConsume(g, c)).toBe(false);
    expect(sell(g, [c.id]).ok).toBe(false);
  });

  it('refilling starts as soon as a Fackel is spent', () => {
    const g = rpgGame();
    expect(startRpgRun(g, g.state.creatures[0]!.id).ok).toBe(true);
    expect(nextTorchAt(g)).toBe(g.state.lastTickAt + balance.rpg.torchHours * HOUR);
  });

  it('leaving brings the carried loot home and frees the monster', () => {
    const g = rpgGame();
    const c = g.state.creatures[0]!;
    startRpgRun(g, c.id);
    g.state.rpg.run!.loot = { towerTokens: 10 };
    expect(leaveRpgRun(g).ok).toBe(true);
    expect(g.state.resources['towerTokens']!.toNumber()).toBe(10);
    expect(c.job).toBeNull();
    expect(g.state.rpg.run).toBeNull();
    expect(g.state.rpg.lastResult).toMatchObject({ win: true, loot: { towerTokens: 10 } });
    expect(leaveRpgRun(g).ok).toBe(false);
  });

  it('a defeat keeps secured loot and only a share of the carried loot', () => {
    const g = rpgGame();
    startRpgRun(g, g.state.creatures[0]!.id);
    const run = g.state.rpg.run!;
    run.loot = { towerTokens: 10 };
    secureLoot(g);
    expect(g.state.resources['towerTokens']!.toNumber()).toBe(10);
    run.loot = { towerTokens: 10 };
    finishRpgRun(g, false);
    const kept = Math.floor(10 * balance.rpg.defeatKeep);
    expect(g.state.resources['towerTokens']!.toNumber()).toBe(10 + kept);
    expect(g.state.rpg.lastResult).toMatchObject({ win: false, loot: { towerTokens: 10 + kept } });
  });

  it('survives save and load; a prestige ends the run', () => {
    const g = rpgGame();
    startRpgRun(g, g.state.creatures[0]!.id);
    g.state.rpg.run!.loot = { towerTokens: 5 };
    const { state } = deserialize(serialize(g.state, NOW));
    expect(state.rpg.run).toEqual(g.state.rpg.run);
    unlockFeature(g, 'inheritance');
    g.state.earned['gold'] = D(1e9);
    expect(performPrestige(g, 'inheritance').ok).toBe(true);
    expect(g.state.rpg.run).toBeNull();
    expect(g.state.resources['towerTokens']!.toNumber()).toBe(5);
  });
});

describe('GenLab RPG – Fähigkeiten', () => {
  it('derives four skills from the monster: basic, element technique, third, special', () => {
    const g = makeGame();
    const c = g.state.creatures[0]!; // Glutwelpe (fire)
    const skills = rpgSkillsFor(g, c);
    expect(skills.map((k) => k.slot)).toEqual(['basic', 'technique', 'third', 'special']);
    expect(skills[1]!.id).toBe('blaze');
    // 3 tower seconds of burn → 2 rounds, the per-second share doubles per round.
    expect(skills[1]!.status).toEqual({ id: 'burn', rounds: 2, value: 0.5 });
    expect(skills[1]!.cooldown).toBe(balance.rpg.techniqueCooldown);
  });

  it('third skill: revealed Erbanlage before ability before role', () => {
    const g = makeGame();
    const c = g.state.creatures[0]!;
    c.abilities = [];
    c.latent = null;
    expect(thirdSkill(g, c).from?.role).toBeDefined();
    c.abilities = ['diligent', 'tough'];
    expect(thirdSkill(g, c).id).toBe('mend');
    c.latent = 'hunter';
    c.deepSequenced = false;
    expect(thirdSkill(g, c).id).toBe('mend'); // hidden Erbanlage does not count
    c.deepSequenced = true;
    expect(thirdSkill(g, c).id).toBe('hunt');
  });
});

import type { GameContext } from '../context';
import type { Creature } from '../state';
import type { RpgSkillDef, TechniqueDef } from '../content/types';
import { effectiveStats } from '../creatures';
import { roleOf, techniqueFor } from './tower';

/**
 * GenLab RPG combat: turn-based, one hero against one foe. No DOM, all
 * randomness from the game RNG, so fights are reproducible and testable.
 */

/** The element technique of the tower, converted to rounds for the dungeon. */
export function techniqueSkill(ctx: GameContext, tech: TechniqueDef): RpgSkillDef {
  const cfg = ctx.balance.rpg;
  const perRound = (id: string) => ['burn', 'poison', 'regen'].includes(id);
  return {
    id: tech.id,
    slot: 'technique',
    name: tech.name,
    icon: tech.icon,
    description: tech.description,
    target: tech.target === 'enemy' ? 'enemy' : 'self',
    hit: tech.hit,
    ...(tech.heal !== undefined ? { heal: tech.heal } : {}),
    ...(tech.cleanse ? { cleanse: true } : {}),
    ...(tech.status
      ? {
          status: {
            id: tech.status.id,
            rounds: Math.max(1, Math.ceil(tech.status.duration / cfg.secondsPerRound)),
            value: perRound(tech.status.id) ? tech.status.value * cfg.secondsPerRound : tech.status.value,
          },
        }
      : {}),
    cooldown: cfg.techniqueCooldown,
  };
}

/** Third skill: a revealed Erbanlage wins, then the first matching ability, then the role. */
export function thirdSkill(ctx: GameContext, c: Creature): RpgSkillDef {
  const thirds = ctx.content.rpgSkills.list.filter((k) => k.slot === 'third');
  if (c.latent && c.deepSequenced) {
    const byLatent = thirds.find((k) => k.from?.latent === c.latent);
    if (byLatent) return byLatent;
  }
  for (const a of c.abilities) {
    const byAbility = thirds.find((k) => k.from?.ability === a);
    if (byAbility) return byAbility;
  }
  const role = roleOf(ctx, effectiveStats(ctx, c));
  return thirds.find((k) => k.from?.role === role)!;
}

/** The hero's skills in button order: basic, technique, third, special. */
export function rpgSkillsFor(ctx: GameContext, c: Creature): RpgSkillDef[] {
  const skills = ctx.content.rpgSkills.list;
  const tech = techniqueFor(ctx, ctx.content.species.get(c.speciesId).element);
  return [
    skills.find((k) => k.slot === 'basic')!,
    ...(tech ? [techniqueSkill(ctx, tech)] : []),
    thirdSkill(ctx, c),
    skills.find((k) => k.slot === 'special')!,
  ];
}

import { it } from 'vitest';
import { content } from '@content/index';
import { balance, makeGame } from './helpers';
import { walls } from './towerCurve';
const floors = [60, 90, 120, 150, 180, 210, 240, 270];
const D = { bossHpMult: 1.3, bossAtkMult: 1.05, companionHp: 0.2, companionAtk: 0.2 };
const configs: { name: string; tower?: Record<string, number>; traits?: Record<string, number> }[] = [
  { name: 'D + Limit 40 s, Schild 0,25', tower: { ...D, maxFightSec: 40 }, traits: { elementShield: 0.25, regenerator: 0.25 } },
  { name: 'D + Limit 60 s, Schild 0,25', tower: { ...D, maxFightSec: 60 }, traits: { elementShield: 0.25, regenerator: 0.25 } },
  { name: 'Boss 1,8/1,15 Begl 0,2 + Limit 60 s, Schild 0,3', tower: { bossHpMult: 1.8, bossAtkMult: 1.15, companionHp: 0.2, companionAtk: 0.2, maxFightSec: 60 }, traits: { elementShield: 0.3, regenerator: 0.25 } },
];
it('tune', () => {
  const orig = Object.fromEntries(content.bossTraits.list.map((t) => [t.id, t.value]));
  const out: string[] = [];
  for (const c of configs) {
    for (const t of content.bossTraits.list) (t as { value: number }).value = c.traits?.[t.id] ?? orig[t.id]!;
    const g = makeGame(1, { tower: { ...balance.tower, ...c.tower } });
    const mixed = walls(g, floors, 'mixed');
    const shieldFloors = mixed.filter((x) => x.trait === 'elementShield').map((x) => x.floor);
    const neutral = walls(g, shieldFloors, 'neutral');
    const adv = walls(g, shieldFloors, 'advantage');
    const avg = (w: typeof mixed) => (w.reduce((n, x) => n + x.floors, 0) / w.length).toFixed(1);
    out.push(`${c.name}\n   gemischt Ø ${avg(mixed)} [${mixed.map((x) => x.floors.toFixed(1)).join(' ')}]  Schild mit Vorteil ${adv.map((x) => x.floors.toFixed(1)).join('/')}  ohne ${neutral.map((x) => x.floors.toFixed(1)).join('/')}`);
  }
  for (const t of content.bossTraits.list) (t as { value: number }).value = orig[t.id]!;
  console.log('TUNE\n' + out.join('\n'));
}, 1_200_000);

import type { TechniqueDef } from '@core/content/types';

/**
 * Element-Techniken: one per element. A fighter uses its technique instead of
 * every `balance.tower.techniqueEvery`-th normal attack. Statuses tick once
 * per second of fight time (see `simulateFight`).
 */
export const techniques: TechniqueDef[] = [
  { id: 'blaze', element: 'fire', name: 'Brand', icon: '🔥', target: 'enemy', hit: 1, status: { id: 'burn', duration: 3, value: 0.35 },
    description: 'Trifft und setzt den Gegner 3 s in Brand (je Sekunde 35 % des Angriffs).' },
  { id: 'spring', element: 'water', name: 'Quellwasser', icon: '💧', target: 'weakestAlly', hit: 0, heal: 0.25,
    description: 'Heilt das angeschlagenste Teammitglied um 25 % seiner KP.' },
  { id: 'bulwark', element: 'earth', name: 'Steinwall', icon: '🪨', target: 'self', hit: 0, status: { id: 'shield', duration: 5, value: 0.3 },
    description: 'Ein Schild fängt 5 s lang Schaden bis 30 % der eigenen KP ab.' },
  { id: 'gust', element: 'air', name: 'Windhauch', icon: '🌬️', target: 'self', hit: 0, status: { id: 'evade', duration: 4, value: 0.4 },
    description: 'Wird vom Wind getragen: 4 s lang +40 % Ausweichen.' },
  { id: 'shock', element: 'electric', name: 'Schock', icon: '⚡', target: 'enemy', hit: 0.8, status: { id: 'stun', duration: 1, value: 1 },
    description: 'Trifft (80 %) und betäubt: Die nächste Aktion des Gegners verzögert sich um einen ganzen Zug.' },
  { id: 'bloom', element: 'nature', name: 'Blütenregen', icon: '🌿', target: 'team', hit: 0, status: { id: 'regen', duration: 4, value: 0.04 },
    description: 'Das ganze Team regeneriert 4 s lang je Sekunde 4 % seiner KP.' },
  { id: 'frost', element: 'ice', name: 'Frost', icon: '❄️', target: 'enemy', hit: 0.8, status: { id: 'slow', duration: 4, value: 0.5 },
    description: 'Trifft (80 %) und verlangsamt: 4 s lang braucht der Gegner 50 % länger für jeden Zug.' },
  { id: 'ambush', element: 'shadow', name: 'Hinterhalt', icon: '🌑', target: 'enemy', hit: 2.2,
    description: 'Ein kritischer Schlag aus dem Schatten mit 220 % Schaden.' },
  { id: 'purify', element: 'light', name: 'Läuterung', icon: '✨', target: 'team', hit: 0, heal: 0.1, cleanse: true,
    description: 'Befreit das Team von Brand, Gift, Betäubung und Verlangsamung und heilt alle um 10 %.' },
  { id: 'plating', element: 'metal', name: 'Panzerung', icon: '🛡️', target: 'self', hit: 0, status: { id: 'armor', duration: 5, value: 0.6 },
    description: '5 s lang +60 % Verteidigung.' },
  { id: 'venom', element: 'poison', name: 'Giftbiss', icon: '☠️', target: 'enemy', hit: 0.7, status: { id: 'poison', duration: 5, value: 0.25 },
    description: 'Trifft (70 %) und vergiftet 5 s lang (je Sekunde 25 % des Angriffs).' },
  { id: 'prism', element: 'crystal', name: 'Prisma', icon: '💎', target: 'self', hit: 0, status: { id: 'reflect', duration: 5, value: 0.4 },
    description: '5 s lang werden 40 % des erlittenen Schadens auf den Angreifer zurückgeworfen.' },
];

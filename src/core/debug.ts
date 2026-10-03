import { D } from './num';
import type { GameContext } from './context';
import type { ActionResult } from './actions';
import { refreshContracts } from './features/contracts';
import { bossAttempts, refreshWeeklyBoss } from './features/weeklyBoss';
import { finishRpgRun, maxTorches } from './features/rpg';
import { findPrimalEgg } from './features/primalEggs';

/**
 * Debug tools: reset single game mechanics for testing (options, only visible with `?debug=1`). They change the
 * save like normal actions do – nothing here is meant for regular play.
 */
export type DebugResetId =
  | 'processes'
  | 'collect'
  | 'daily'
  | 'contracts'
  | 'primalEgg'
  | 'weeklyBoss'
  | 'cellarAttempts'
  | 'cellarProgress'
  | 'rpgRun'
  | 'rpgTorches'
  | 'rpgOpenDungeons'
  | 'rpgDungeons'
  | 'rpgLevels'
  | 'rpgGear'
  | 'rpgMeta'
  | 'rpgWeekly'
  | 'rpgBloodstain';

export interface DebugResetDef {
  id: DebugResetId;
  group: string;
  name: string;
  description: string;
}

export const DEBUG_RESETS: DebugResetDef[] = [
  { id: 'processes', group: 'Allgemein', name: 'Alle Vorgänge fertig', description: 'Eier, Erkundungen, Sequenzierung, Reisen, Großforschung … sind beim nächsten Schritt fertig.' },
  { id: 'collect', group: 'Allgemein', name: 'Sammel-Ausdauer voll', description: 'Die Ausdauer beim Sammeln ist sofort wieder voll, die Wartezeit bis zum nächsten Fundstück ist vorbei.' },
  { id: 'daily', group: 'Allgemein', name: 'Tagesbelohnung wieder offen', description: 'Die heutige Tagesbelohnung kann noch einmal abgeholt werden.' },
  { id: 'contracts', group: 'Allgemein', name: 'Gen-Aufträge neu', description: 'Das heutige Auftragsbrett wird neu ausgelegt, erledigte Aufträge sind wieder offen, der Tausch ist wieder frei.' },
  { id: 'primalEgg', group: 'Allgemein', name: '+1 Urzeit-Ei', description: 'Ein Urzeit-Ei für die Brutkammer – solange noch keine Fundquelle feststeht, der einzige Weg zu einem.' },
  { id: 'weeklyBoss', group: 'Allgemein', name: 'Wochen-Boss neu', description: 'Ein frischer Wochen-Titan nach dem aktuellen Turm-Rekord, alle Angriffe voll.' },
  { id: 'cellarAttempts', group: 'Genom-Keller', name: 'Abstiege voll', description: 'Der Vorrat an Abstiegen in den Genom-Keller ist sofort voll.' },
  { id: 'cellarProgress', group: 'Genom-Keller', name: 'Keller-Fortschritt löschen', description: 'Rekord, Kontrollpunkt und Verlauf im Keller stehen wieder auf 0.' },
  { id: 'rpgRun', group: 'GenLab RPG', name: 'Lauf beenden', description: 'Der laufende Lauf endet wie beim Verlassen (Beute kommt mit).' },
  { id: 'rpgTorches', group: 'GenLab RPG', name: '+10 Fackeln', description: 'Zehn Fackeln mehr, das Nachfüllen beginnt von vorn.' },
  { id: 'rpgOpenDungeons', group: 'GenLab RPG', name: 'Alle Dungeons öffnen', description: 'Jeder Dungeon zählt als einmal geschafft.' },
  { id: 'rpgDungeons', group: 'GenLab RPG', name: 'Dungeon-Fortschritt löschen', description: 'Geschaffte Dungeons, Bestwerte und das letzte Ergebnis sind weg.' },
  { id: 'rpgLevels', group: 'GenLab RPG', name: 'Stufen zurücksetzen', description: 'Alle Monster sind in der anderen Welt wieder Stufe 1.' },
  { id: 'rpgGear', group: 'GenLab RPG', name: 'Ausrüstung löschen', description: 'Alle Ausrüstung ist weg.' },
  { id: 'rpgMeta', group: 'GenLab RPG', name: 'Runen-Wissen löschen', description: 'Runen-Wissen und Runen stehen wieder auf 0.' },
  { id: 'rpgWeekly', group: 'GenLab RPG', name: 'Wochen-Deckel zurücksetzen', description: 'Zeitkristalle und Äon-Splitter aus dem Dungeon zählen diese Woche wieder von 0.' },
  { id: 'rpgBloodstain', group: 'GenLab RPG', name: 'Blutfleck entfernen', description: 'Die Beute der letzten Niederlage verschwindet.' },
];

/** Resets that change the hero's power or the dungeon while a run is going – they wait for its end. */
const NOT_DURING_RUN: DebugResetId[] = ['rpgDungeons', 'rpgLevels', 'rpgGear', 'rpgMeta'];

export function debugReset(ctx: GameContext, id: DebugResetId): ActionResult {
  const s = ctx.state;
  if (NOT_DURING_RUN.includes(id) && s.rpg.run) return { ok: false, reason: 'Beende zuerst den laufenden RPG-Lauf.' };
  switch (id) {
    case 'processes':
      for (const p of s.processes) p.elapsedMs = Math.max(p.elapsedMs, p.durationMs);
      break;
    case 'collect':
      s.collect = { spent: 0, nextFindAt: 0 };
      break;
    case 'daily':
      s.daily.day = -1;
      break;
    case 'contracts':
      s.contracts.day = -1;
      refreshContracts(ctx);
      break;
    case 'primalEgg':
      findPrimalEgg(ctx, 'debug');
      break;
    case 'weeklyBoss':
      if (!s.features['weeklyBoss']) return { ok: false, reason: 'Der Wochen-Boss ist noch nicht freigeschaltet.' };
      s.weeklyBoss.week = -1;
      refreshWeeklyBoss(ctx);
      s.weeklyBoss.attempts = bossAttempts(ctx).max;
      break;
    case 'cellarAttempts':
      if (!s.features['cellar']) return { ok: false, reason: 'Der Genom-Keller ist noch nicht freigeschaltet.' };
      s.cellar.attempts = ctx.balance.cellar.maxAttempts;
      break;
    case 'cellarProgress':
      if (s.cellar.run) return { ok: false, reason: 'Beende zuerst den laufenden Abstieg.' };
      Object.assign(s.cellar, { best: 0, history: [], lastResult: null });
      break;
    case 'rpgRun':
      if (!s.rpg.run) return { ok: false, reason: 'Es läuft kein Lauf.' };
      finishRpgRun(ctx, true);
      break;
    case 'rpgTorches':
      s.resources['torches'] = (s.resources['torches'] ?? D(0)).add(10);
      s.rpg.torchAt = s.resources['torches'].toNumber() >= maxTorches(ctx) ? 0 : s.lastTickAt;
      break;
    case 'rpgOpenDungeons':
      for (const d of ctx.content.rpgDungeons.list) s.rpg.cleared[d.id] = Math.max(1, s.rpg.cleared[d.id] ?? 0);
      break;
    case 'rpgDungeons':
      s.rpg.cleared = {};
      s.rpg.best = {};
      s.rpg.lastResult = null;
      break;
    case 'rpgLevels':
      s.rpg.ranks = {};
      break;
    case 'rpgGear':
      s.rpg.items = [];
      s.rpg.equipped = { weapon: null, armor: null, charm: null };
      break;
    case 'rpgMeta':
      s.rpg.meta = {};
      s.resources['runes'] = D(0);
      break;
    case 'rpgWeekly':
      s.rpg.weekly = { week: -1, got: {} };
      break;
    case 'rpgBloodstain':
      s.rpg.bloodstain = null;
      break;
  }
  ctx.invalidate();
  return { ok: true };
}

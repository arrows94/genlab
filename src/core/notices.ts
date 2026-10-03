import type { GameContext } from './context';
import { findCreature } from './creatures';
import { EGG, type EggData } from './features/breeding';
import { MISSION, type MissionData } from './features/expedition';
import { DEEP_SEQUENCE, SEQUENCE, type SequenceData } from './features/sequencing';
import { VOYAGE, type VoyageData } from './features/voyage';
import { GRAND_RESEARCH, type GrandResearchData } from './features/grandResearch';
import { MEGA_PROJECT, type MegaProjectData } from './features/megaProjects';
import { PRIMAL_EGG } from './features/primalEggs';
import { formatDuration } from './format';
import type { Process } from './state';
import { processRemainingMs } from './systems/processes';
import { productionRates } from './systems/production';
import { offlineCapMs } from './systems/timers';

/**
 * Reminders for the time the player is away ("Deine Expedition ist zurück!").
 * Pure planning: the UI hands the result to the platform (local notifications
 * in the app, browser notifications in the PWA) when the game goes to the
 * background and cancels them when it comes back.
 */
export interface Notice {
  /** Wall-clock time (ms) when the notice is due. */
  at: number;
  /** Process kind, or `offlineCap` for the end of offline production. */
  kind: string;
  title: string;
  body: string;
}

interface NoticeText {
  title: string;
  /** Text for a single finished process. */
  one: (ctx: GameContext, p: Process) => string;
  /** Text for several finished processes of this kind. */
  many: (n: number) => string;
}

/** Notice key of ritual eggs (a process of kind `egg` with its own text). */
const RITUAL_EGG = 'ritualEgg';
const noticeKind = (p: Process) => (p.kind === EGG && (p.data as EggData).ritual ? RITUAL_EGG : p.kind);

/** Process kinds that announce their end; new long projects add an entry here. */
const TEXTS: Record<string, NoticeText> = {
  [MISSION]: {
    title: 'Expedition zurück 🧭',
    one: (ctx, p) => {
      const d = p.data as MissionData;
      const who = findCreature(ctx, d.creatureId)?.name ?? 'Deine Kreatur';
      return `${who} ist aus „${ctx.content.missions.get(d.missionId).name}“ zurückgekehrt.`;
    },
    many: (n) => `${n} Expeditionen sind zurückgekehrt.`,
  },
  [EGG]: {
    title: 'Ei geschlüpft 🥚',
    one: (ctx, p) => {
      const [a, b] = (p.data as EggData).parents.map((id) => findCreature(ctx, id)?.name ?? '?');
      return `Das Ei von ${a} und ${b} ist geschlüpft.`;
    },
    many: (n) => `${n} Eier sind geschlüpft.`,
  },
  // Ritual eggs do not hatch on their own – they wait to be opened.
  [RITUAL_EGG]: {
    title: 'Ritual-Ei bereit ✨',
    one: (ctx, p) => {
      const [a, b] = ((p.data as EggData).sample ?? []).map((c) => c.name);
      return `Das Ritual-Ei${a && b ? ` von ${a} und ${b}` : ''} ist bereit – öffne es in der Brutstation.`;
    },
    many: (n) => `${n} Ritual-Eier sind bereit – öffne sie in der Brutstation.`,
  },
  // Urzeit-Eier wait to be opened, too.
  [PRIMAL_EGG]: {
    title: 'Urzeit-Ei bereit 🥚',
    one: () => 'In der Brutkammer regt sich etwas – öffne das Urzeit-Ei in der Brutstation.',
    many: (n) => `${n} Urzeit-Eier sind bereit – öffne sie in der Brutstation.`,
  },
  [VOYAGE]: {
    title: 'Wochenexpedition zurück 🗺️',
    one: (ctx, p) => `Das Team ist aus „${ctx.content.voyageDestinations.get((p.data as VoyageData).destination).name}“ zurück – eine Entscheidung wartet.`,
    many: (n) => `${n} Wochenexpeditionen sind zurück.`,
  },
  [GRAND_RESEARCH]: {
    title: 'Großforschung abgeschlossen 📜',
    one: (ctx, p) => {
      const d = p.data as GrandResearchData;
      return `„${ctx.content.grandResearch.get(d.project).name}“ Stufe ${d.level} ist erforscht.`;
    },
    many: (n) => `${n} Großforschungen sind abgeschlossen.`,
  },
  [MEGA_PROJECT]: {
    title: 'Bauphase fertig 🏗️',
    one: (ctx, p) => {
      const d = p.data as MegaProjectData;
      const def = ctx.content.megaProjects.get(d.project);
      return `${def.name}: „${def.stages[d.stage - 1]?.name ?? 'Bauphase'}“ ist fertig gebaut.`;
    },
    many: (n) => `${n} Bauphasen sind fertig.`,
  },
  [DEEP_SEQUENCE]: {
    title: 'Tiefensequenzierung fertig 🔬',
    one: (ctx, p) => `Das Erbgut von ${findCreature(ctx, (p.data as SequenceData).creatureId)?.name ?? 'deiner Kreatur'} ist bis ins Letzte entschlüsselt.`,
    many: (n) => `${n} Tiefensequenzierungen sind fertig.`,
  },
  [SEQUENCE]: {
    title: 'Sequenzierung fertig 🧬',
    one: (ctx, p) => `Das Genom von ${findCreature(ctx, (p.data as SequenceData).creatureId)?.name ?? 'deiner Kreatur'} ist entschlüsselt.`,
    many: (n) => `${n} Genome sind entschlüsselt.`,
  },
};

/**
 * Notices due while the player is away, sorted by time. Short processes are
 * skipped, and completions of the same kind close together are merged into
 * one notice at the time the last of them finishes.
 */
export function plannedNotices(ctx: GameContext, now = ctx.state.lastTickAt): Notice[] {
  const cfg = ctx.balance.notifications;
  const due = ctx.state.processes
    .filter((p) => TEXTS[noticeKind(p)] && p.durationMs >= cfg.minDurationSec * 1000 && p.elapsedMs < p.durationMs)
    .map((p) => ({ p, kind: noticeKind(p), at: now + processRemainingMs(ctx, p) }))
    .sort((x, y) => x.at - y.at);

  const notices: Notice[] = [];
  const groups = new Map<string, { first: number; items: typeof due }>();
  const flush = (kind: string) => {
    const g = groups.get(kind);
    if (!g) return;
    const text = TEXTS[kind]!;
    const last = g.items[g.items.length - 1]!;
    notices.push({ at: last.at, kind, title: text.title, body: g.items.length === 1 ? text.one(ctx, last.p) : text.many(g.items.length) });
    groups.delete(kind);
  };
  for (const item of due) {
    const g = groups.get(item.kind);
    if (g && item.at - g.first > cfg.groupSec * 1000) flush(item.kind);
    const open = groups.get(item.kind);
    if (open) open.items.push(item);
    else groups.set(item.kind, { first: item.at, items: [item] });
  }
  for (const kind of [...groups.keys()]) flush(kind);

  const capMs = offlineCapMs(ctx);
  if (Object.values(productionRates(ctx)).some((r) => r.gt(0))) {
    notices.push({
      at: now + capMs,
      kind: 'offlineCap',
      title: 'Dein Labor ruht 💤',
      body: `Die Produktion hat ihr Offline-Maximum von ${formatDuration(capMs)} erreicht. Schau vorbei, damit es weitergeht.`,
    });
  }
  return notices.sort((x, y) => x.at - y.at);
}

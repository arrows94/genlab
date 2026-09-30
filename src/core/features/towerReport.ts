import { formatNumber, formatPercent } from '../format';
import type { GameContext } from '../context';
import type { FightFighterSnapshot, FightStats, TowerState } from '../state';
import type { StatusId } from '../content/types';
import { MAX_FIGHT_EVENTS, enemiesFor } from './tower';

/**
 * Read-only views of a finished tower fight: the defeat analysis („Warum
 * verloren?“) from the fight totals, and the icon protocol from the replay
 * events. Nothing here changes the game state.
 */

export const STATUS_INFO: Record<StatusId, { icon: string; name: string; harmful: boolean }> = {
  burn: { icon: '🔥', name: 'Brand', harmful: true },
  poison: { icon: '☠️', name: 'Gift', harmful: true },
  stun: { icon: '⚡', name: 'Betäubt', harmful: true },
  slow: { icon: '❄️', name: 'Verlangsamt', harmful: true },
  shield: { icon: '🪨', name: 'Schild', harmful: false },
  evade: { icon: '🌬️', name: 'Ausweichen', harmful: false },
  regen: { icon: '🌿', name: 'Regeneration', harmful: false },
  armor: { icon: '🛡️', name: 'Panzer', harmful: false },
  reflect: { icon: '💎', name: 'Rückstrahlung', harmful: false },
};

// ---- defeat analysis ------------------------------------------------------

export interface DefeatReason {
  id: 'timeout' | 'close' | 'outmatched' | 'shield' | 'heal' | 'element' | 'shifter' | 'speed' | 'fragile' | 'weak';
  icon: string;
  title: string;
  text: string;
  tip: string;
}

export interface DefeatReport {
  floor: number;
  seconds: number;
  timeout: boolean;
  /** Share of the foes' HP still standing at the end (0…1). */
  foeHpLeft: number;
  /** The most telling reasons first (at most three). */
  reasons: DefeatReason[];
  /** Team members: damage dealt and taken, and when they fell (-1 = standing). */
  members: { index: number; name: string; element: string; dealt: number; taken: number; downAt: number }[];
}

type FightForReport = { floor: number; fighters: FightFighterSnapshot[]; stats: FightStats };

const sec = (s: number) => `${formatNumber(s, { decimals: 1 })} s`;
const pct = (f: number) => formatPercent(Math.max(0, Math.min(1, f)), 0);

/**
 * Why a fight was lost, derived from its totals and the (deterministic)
 * enemies of the floor: each reason gets a weight, the strongest three are
 * shown, each with a concrete tip. Falls back to a general hint.
 */
export function analyzeDefeat(ctx: GameContext, fight: FightForReport): DefeatReport {
  const { fighters, stats, floor } = fight;
  const team = fighters.map((f, i) => ({ f, i })).filter((x) => x.f.team);
  const foes = fighters.map((f, i) => ({ f, i })).filter((x) => !x.f.team);
  const sum = (list: { i: number }[], arr: number[]) => list.reduce((s, x) => s + (arr[x.i] ?? 0), 0);
  const foeMax = Math.max(1, foes.reduce((s, x) => s + x.f.maxHp, 0));
  const foeHpLeft = sum(foes, stats.hpLeft) / foeMax;
  const leaderIndex = foes.find((x) => x.f.boss)?.i ?? foes.at(-1)?.i ?? -1;
  const leaderSnap = fighters[leaderIndex];
  const foeElement = leaderSnap?.element ?? '';
  // The floor's enemies are deterministic: their boss traits come from the content.
  const group = enemiesFor(ctx, floor);
  const leader = group.find((g) => g.boss) ?? group.at(-1);
  const traitIds = [leader?.trait, leader?.phaseTrait].filter((t): t is string => !!t && ctx.content.bossTraits.has(t));
  const traits = traitIds.map((id) => ctx.content.bossTraits.get(id));
  const hasKind = (kind: string) => traits.find((t) => t.kind === kind);
  const elName = (id: string) => (ctx.content.elements.has(id) ? ctx.content.elements.get(id).name : id);
  const counters = (id: string) => ctx.content.elements.list.filter((e) => e.strongAgainst.includes(id)).map((e) => e.name);
  const counterText = (id: string) => {
    const list = counters(id);
    return list.length ? `Gegen ${elName(id)} sind ${list.join(', ')} stark` : `Gegen ${elName(id)} hilft kein Element besonders`;
  };

  const scored: { score: number; reason: DefeatReason }[] = [];
  const add = (score: number, reason: DefeatReason) => scored.push({ score, reason });

  if (stats.timeout) {
    add(1, {
      id: 'timeout', icon: '⏱', title: 'Zeit abgelaufen',
      text: `Nach ${sec(stats.seconds)} standen die Gegner noch mit ${pct(foeHpLeft)} ihrer KP.`,
      tip: 'Dein Team hält durch, macht aber zu wenig Schaden: mehr Angriff (ANG), Kreaturen mit Element-Vorteil oder Techniken wie Brand und Hinterhalt.',
    });
  } else if (foeHpLeft <= 0.15) {
    add(0.9, {
      id: 'close', icon: '🤏', title: 'Knapp verloren',
      text: `Den Gegnern blieben nur noch ${pct(foeHpLeft)} ihrer KP.`,
      tip: 'Schon wenig mehr Stärke reicht – etwa eine Relikt-Stufe, eine Forschung oder eine stärkere Kreatur im Team.',
    });
  } else if (foeHpLeft >= 0.6) {
    add(0.5 + foeHpLeft * 0.3, {
      id: 'outmatched', icon: '💪', title: 'Deutlich zu schwach',
      text: `Dein Team schaffte nur ${pct(1 - foeHpLeft)} der gegnerischen KP, bevor es fiel.`,
      tip: 'Hier hilft vor allem mehr Stärke: Kreaturen mit besseren Werten züchten, Infusion, Relikte aufwerten, Turm-Forschung.',
    });
  }

  // Element-Schild: team hits without advantage lose most of their damage.
  const teamDealt = sum(team, stats.dealt);
  const shield = hasKind('shield');
  if (shield && stats.shielded > 0) {
    const share = stats.shielded / Math.max(1, stats.shielded + teamDealt);
    if (share >= 0.3) {
      add(0.6 + share, {
        id: 'shield', icon: shield.icon, title: `${shield.name} – Vorteil fehlt`,
        text: `Der Schild schluckte ${formatNumber(stats.shielded)} Schaden – ${pct(share)} von dem, was dein Team austeilte.`,
        tip: `Nur Treffer mit Element-Vorteil gehen voll durch. ${counterText(foeElement)}.`,
      });
    }
  }

  // Healing foes (Regeneration, Quellwasser, Blütenregen).
  const foeHealed = sum(foes, stats.healed);
  const healShare = foeHealed / foeMax;
  if (healShare >= 0.25) {
    const regen = hasKind('regen');
    add(0.5 + Math.min(0.5, healShare / 2), {
      id: 'heal', icon: regen?.icon ?? '💚', title: regen ? `${regen.name} des Bosses` : 'Gegner heilten sich',
      text: `Die Gegner heilten ${formatNumber(foeHealed)} KP – ${pct(healShare)} ihrer vollen KP.`,
      tip: regen
        ? 'Er holt jede Sekunde einen Teil des Schadens zurück: viel Schaden in kurzer Zeit (Angriff, Tempo, Hinterhalt) lässt ihm keine Zeit.'
        : 'Ein Heiler bei den Gegnern – schnell viel Schaden austeilen, bevor die Heilung wirkt.',
    });
  }

  // Elements: the Wandler has none for long; otherwise count strong and resisted hits.
  const shifter = hasKind('shift');
  const teamElements = new Set(team.map((x) => x.f.element));
  if (shifter) {
    if (teamElements.size < 3) {
      add(0.7, {
        id: 'shifter', icon: shifter.icon, title: `${shifter.name} – Team zu einseitig`,
        text: `Er wechselt jede Sekunde sein Element; dein Team hat nur ${teamElements.size === 1 ? 'ein Element' : `${teamElements.size} Elemente`}.`,
        tip: 'Drei verschiedene Elemente im Team geben die Synergie „Vielfalt“: mehr Schaden gegen den Wandler.',
      });
    }
  } else {
    const foeHits = sum(foes, stats.hits);
    const foeStrong = sum(foes, stats.strong);
    const teamHits = sum(team, stats.hits);
    const teamWeak = sum(team, stats.weak);
    const takenShare = foeHits ? foeStrong / foeHits : 0;
    const resistedShare = teamHits ? teamWeak / teamHits : 0;
    if (takenShare >= 0.4 || resistedShare >= 0.4) {
      const parts = [
        takenShare >= 0.4 ? `${foeStrong} von ${foeHits} gegnerischen Treffern waren sehr effektiv` : '',
        resistedShare >= 0.4 ? `${teamWeak} von ${teamHits} deiner Treffer wurden resistiert` : '',
      ].filter(Boolean);
      add(0.4 + Math.max(takenShare, resistedShare) * 0.6, {
        id: 'element', icon: '⚖️', title: `Element-Nachteil gegen ${elName(foeElement)}`,
        text: `${parts.join(', ')}.`,
        tip: `${counterText(foeElement)} – sortiere die Kandidaten nach „Vorteil vs. ${elName(foeElement)}“.`,
      });
    }
  }

  // Speed: seconds between actions (lower = faster) and dodged attacks.
  const meanIv = (list: { f: FightFighterSnapshot }[]) => list.reduce((s, x) => s + (x.f.interval ?? 1), 0) / Math.max(1, list.length);
  const ratio = meanIv(team) / Math.max(0.001, meanIv(foes));
  const teamMissed = sum(team, stats.missed);
  const missShare = teamMissed / Math.max(1, teamMissed + sum(team, stats.hits));
  if (ratio >= 1.25 || missShare >= 0.15) {
    const parts = [
      ratio >= 1.25 ? `handelte ${formatNumber(ratio, { decimals: 1 })}-mal so oft wie dein Team` : '',
      missShare >= 0.15 ? `wich ${teamMissed} deiner Angriffe aus` : '',
    ].filter(Boolean);
    add(0.3 + Math.min(0.6, ratio - 1) + missShare, {
      id: 'speed', icon: '💨', title: 'Gegner war zu schnell',
      text: `Der Gegner ${parts.join(' und ')}.`,
      tip: 'Mehr Tempo (TMP): Schnelle Kreaturen handeln öfter und weichen selbst aus – auch die Sturmfeder hilft.',
    });
  }

  // A team member that fell early.
  const early = team
    .filter((x) => (stats.downAt[x.i] ?? -1) >= 0 && stats.downAt[x.i]! <= stats.seconds * 0.3 && stats.seconds > 3)
    .sort((a, b) => stats.downAt[a.i]! - stats.downAt[b.i]!)[0];
  if (early) {
    const targeting = traits.find((t) => t.targeting)?.targeting ?? 'rows';
    const back = early.f.row === 'back';
    const tip =
      targeting === 'weakest' ? 'Dieser Gegner jagt das schwächste Teammitglied – tausche es gegen eine robustere Kreatur.'
      : back && (targeting === 'back' || hasKind('sweep')) ? 'Der Gegner zielt auf die hintere Reihe – stelle dort robuste Kreaturen auf oder alle nach vorne.'
      : back ? 'Auch hinten wird man getroffen – eine robustere Kreatur hält länger.'
      : 'Vorne braucht es KP und Verteidigung – ein Tank (🛡️) steht hier länger.';
    add(0.45, {
      id: 'fragile', icon: '💀', title: `${early.f.name} fiel früh`,
      text: `${early.f.name} fiel schon nach ${sec(stats.downAt[early.i]!)} (${formatNumber(stats.taken[early.i] ?? 0)} Schaden eingesteckt).`,
      tip,
    });
  }

  if (scored.length === 0) {
    add(0, {
      id: 'weak', icon: '💪', title: 'Etwas zu schwach',
      text: `Die Gegner hatten am Ende noch ${pct(foeHpLeft)} ihrer KP.`,
      tip: 'Mehr Stärke hilft immer: bessere Werte züchten, Relikte aufwerten, Turm-Forschung – oder das Team nach Vorteil gegen den Gegner wählen.',
    });
  }

  return {
    floor,
    seconds: stats.seconds,
    timeout: stats.timeout,
    foeHpLeft: Math.max(0, Math.min(1, foeHpLeft)),
    reasons: scored.sort((a, b) => b.score - a.score).slice(0, 3).map((x) => x.reason),
    members: team.map(({ f, i }) => ({ index: i, name: f.name, element: f.element, dealt: stats.dealt[i] ?? 0, taken: stats.taken[i] ?? 0, downAt: stats.downAt[i] ?? -1 })),
  };
}

/**
 * The defeat analysis while it still matters: the latest lost run, until a
 * later run gets past that floor.
 */
export function currentDefeat(ctx: GameContext): DefeatReport | null {
  const tw: TowerState = ctx.state.tower;
  const d = tw.lastDefeat;
  if (!d) return null;
  if (tw.run && tw.run.floor >= d.floor) return null;
  return analyzeDefeat(ctx, d);
}

// ---- icon protocol ----------------------------------------------------------

export interface ProtocolEntry {
  at: number;
  icon: string;
  /** Fighter indices (as in `fighters`); -1 = nobody. */
  a: number;
  t: number;
  text: string;
  /** From the team's point of view. */
  tone: 'good' | 'bad' | 'info';
  /** Techniques, critical hits, knock-outs, boss moments and the result. */
  important: boolean;
}

type LastResult = NonNullable<TowerState['lastResult']>;

/** Protocol of a fight from its replay events: one line per moment, with icons and tone. */
export function fightProtocol(ctx: GameContext, lr: LastResult): ProtocolEntry[] {
  const fighters = lr.fighters ?? [];
  const events = lr.events ?? [];
  const isTeam = (i: number) => fighters[i]?.team === true;
  const out: ProtocolEntry[] = [];
  const toneFor = (target: number, goodForTarget: boolean): ProtocolEntry['tone'] => (isTeam(target) === goodForTarget ? 'good' : 'bad');
  const techOf = (id?: string) => (id && ctx.content.techniques.has(id) ? ctx.content.techniques.get(id) : null);
  const n = (v: number) => formatNumber(v);

  events.forEach((e, k) => {
    const at = e.at ?? (k + 1) * 0.6;
    const tech = techOf(e.tech);
    switch (e.kind) {
      case 'miss':
        out.push({ at, icon: '💨', a: e.a, t: e.t, text: tech ? `${tech.name} verfehlt` : 'ausgewichen', tone: toneFor(e.t, true), important: false });
        break;
      case 'heal': {
        const regen = e.a === e.t && !isTeam(e.t) && !tech;
        out.push({ at, icon: '💚', a: e.a === e.t ? -1 : e.a, t: e.t, text: `+${n(e.dmg)}${regen ? ' Regeneration' : ''}`, tone: toneFor(e.t, true), important: false });
        break;
      }
      case 'shift':
        out.push({ at, icon: '🔄', a: e.a, t: -1, text: `wechselt zu ${e.element && ctx.content.elements.has(e.element) ? ctx.content.elements.get(e.element).name : '?'}`, tone: 'info', important: false });
        break;
      case 'status': {
        const st = e.status ? STATUS_INFO[e.status] : null;
        if (!st) break;
        const dur = e.until !== undefined ? ` · ${sec(Math.max(0, e.until - at))}` : '';
        out.push({ at, icon: st.icon, a: e.a === e.t ? -1 : e.a, t: e.t, text: `${st.name}${dur}`, tone: toneFor(e.t, !st.harmful), important: false });
        break;
      }
      case 'dot': {
        const st = STATUS_INFO[e.status ?? 'burn'];
        out.push({ at, icon: st.icon, a: -1, t: e.t, text: `−${n(e.dmg)} ${st.name}`, tone: toneFor(e.t, false), important: false });
        break;
      }
      case 'reflect':
        out.push({ at, icon: '↩️', a: e.a, t: e.t, text: `−${n(e.dmg)} Rückschaden`, tone: toneFor(e.t, false), important: false });
        break;
      case 'phase': {
        const tr = e.trait && ctx.content.bossTraits.has(e.trait) ? ctx.content.bossTraits.get(e.trait) : null;
        out.push({ at, icon: '⚠️', a: e.a, t: -1, text: `erwacht: ${tr ? `${tr.icon} ${tr.name}` : 'zweite Phase'}`, tone: 'bad', important: true });
        break;
      }
      case 'sweep':
        out.push({ at, icon: '🌊', a: e.a, t: -1, text: 'Flächenangriff', tone: 'bad', important: true });
        break;
      case 'tech':
        if (e.dmg > 0 || tech?.target === 'enemy') {
          out.push({ at, icon: tech?.icon ?? '✨', a: e.a, t: e.t, text: `${tech?.name ?? 'Technik'} −${n(e.dmg)}${hitTags(e)}`, tone: toneFor(e.t, false), important: true });
        } else {
          out.push({ at, icon: tech?.icon ?? '✨', a: e.a, t: -1, text: tech?.name ?? 'Technik', tone: isTeam(e.a) ? 'good' : 'bad', important: true });
        }
        break;
      default:
        out.push({ at, icon: e.crit ? '💥' : '⚔️', a: e.a, t: e.t, text: `−${n(e.dmg)}${hitTags(e)}`, tone: toneFor(e.t, false), important: !!e.crit });
    }
    const damaging = !e.kind || e.kind === 'dot' || e.kind === 'reflect' || (e.kind === 'tech' && e.dmg > 0);
    if (damaging && e.hp <= 0) out.push({ at, icon: '💀', a: -1, t: e.t, text: 'besiegt', tone: toneFor(e.t, false), important: true });
  });

  if (events.length >= MAX_FIGHT_EVENTS) out.push({ at: out.at(-1)?.at ?? 0, icon: '…', a: -1, t: -1, text: 'Protokoll gekürzt', tone: 'info', important: true });
  const seconds = lr.stats?.seconds ?? out.at(-1)?.at ?? 0;
  const timeout = lr.stats?.timeout ?? lr.log.at(-1) === 'Zeit abgelaufen';
  out.push(
    lr.win ? { at: seconds, icon: '🏆', a: -1, t: -1, text: `Sieg nach ${sec(seconds)}`, tone: 'good', important: true }
    : timeout ? { at: seconds, icon: '⏱', a: -1, t: -1, text: 'Zeit abgelaufen', tone: 'bad', important: true }
    : { at: seconds, icon: '💀', a: -1, t: -1, text: `Team besiegt nach ${sec(seconds)}`, tone: 'bad', important: true },
  );
  return out;
}

function hitTags(e: { m: number; crit?: boolean; absorbed?: number }): string {
  const tags = [e.crit ? 'kritisch' : '', e.m > 1 ? 'sehr effektiv' : e.m < 1 ? 'resistiert' : '', e.absorbed ? `🪨 ${formatNumber(e.absorbed)} abgefangen` : ''].filter(Boolean);
  return tags.length ? ` · ${tags.join(' · ')}` : '';
}

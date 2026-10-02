<script lang="ts">
  import { content } from '@content/index';
  import { expressedAppearance } from '@core/genetics';
  import type { BossTraitDef } from '@core/content/types';
  import type { Creature } from '@core/state';
  import { game } from '../store.svelte';
  import CreatureSvg from './CreatureSvg.svelte';

  /** The tower column: a few floors around the team, with their rewards and the record. */
  let { floors, aboveBest, best, team, boss, bossIn }: {
    floors: { f: number; boss: boolean; guard: boolean; milestone: boolean; checkpoint: boolean; catalyst: number; allele: boolean; trait: BossTraitDef | null; cleared: boolean; next: boolean; best: boolean }[];
    aboveBest: boolean;
    best: number;
    team: Creature[];
    boss: boolean;
    bossIn: number;
  } = $props();
</script>

<aside class="tower panel" aria-label="Etagen">
  <div class="roof"></div>
  {#if aboveBest}<div class="floor ghost"><span class="small muted">⋮ Rekord {best}</span></div>{/if}
  {#each floors as fl (fl.f)}
    <div class="floor" class:cleared={fl.cleared} class:next={fl.next} class:boss={fl.boss} class:guard={fl.guard} class:best={fl.best}>
      <span class="fnum num">{fl.f}</span>
      <span class="icons">
        {#if fl.boss}<span title="Boss{fl.trait ? `: ${fl.trait.name}` : ''}">👑</span>{/if}
        {#if fl.guard}<span title="Wächter: stärkere Gegner, etwa wie drei Etagen weiter oben">🛡️</span>{/if}
        {#if fl.trait}<span title="{fl.trait.name}: {fl.trait.description}">{fl.trait.icon}</span>{/if}
        {#if fl.milestone}<span title="Meilenstein">🏅</span>{/if}
        {#if fl.checkpoint}<span title="Checkpoint">🚩</span>{/if}
        {#if fl.catalyst}<span title="Evolutionskristall">💎</span>{/if}
        {#if fl.allele}<span title="Seltenes Allel">🧬</span>{/if}
      </span>
      {#if fl.next && team.length}
        <span class="squad">
          {#each team.slice(0, 3) as c (c.id)}
            {@const sp = content.species.get(c.speciesId)}
            <CreatureSvg appearance={expressedAppearance(game, c)} shape={sp.shape} tier={sp.tier} size={20} />
          {/each}
        </span>
      {:else if fl.cleared}
        <span class="check">✓</span>
      {/if}
      {#if fl.best}<span class="rec">Rekord</span>{/if}
    </div>
  {/each}
  <div class="base"></div>
  {#if !boss}<p class="bossin small muted" title="Boss-Etagen alle {game.balance.tower.bossEvery} Etagen, mit Checkpoint">👑 Boss in {bossIn} {bossIn === 1 ? 'Etage' : 'Etagen'}</p>{/if}
</aside>

<style>
  .small { font-size: 0.8rem; }



  /* Tower column */
  .tower { display: flex; flex-direction: column; align-items: stretch; gap: 3px; padding: 0.6rem 0.6rem 0; }
  .roof { height: 26px; margin: 0 10%; background: linear-gradient(180deg, var(--violet), var(--petrol)); clip-path: polygon(50% 0, 100% 100%, 0 100%); opacity: 0.85; }
  .floor {
    position: relative; display: flex; align-items: center; gap: 0.35rem; min-height: 32px; padding: 0 0.45rem;
    border: 1px solid var(--line); border-radius: 6px; background: repeating-linear-gradient(90deg, var(--bg-2) 0 18px, var(--panel-2) 18px 20px);
    color: var(--muted); font-size: 0.8rem;
  }
  .floor.ghost { background: none; border-style: dashed; justify-content: center; }
  .floor.cleared { color: var(--text); background: repeating-linear-gradient(90deg, color-mix(in srgb, var(--teal) 10%, var(--bg-2)) 0 18px, var(--panel-2) 18px 20px); }
  .floor.boss { border-color: color-mix(in srgb, var(--danger) 60%, var(--line)); }
  .floor.guard { border-color: color-mix(in srgb, var(--gold) 45%, var(--line)); }
  .bossin { margin: 0.35rem 0 0; text-align: center; }
  .floor.next { border: 2px solid var(--gold); color: var(--text); animation: glow 1.6s ease-in-out infinite; }
  .floor.best::after { content: ''; position: absolute; left: -4px; right: -4px; top: -3px; border-top: 2px dashed var(--gold); }
  .fnum { font-weight: 700; min-width: 1.8rem; }
  .icons { display: flex; gap: 1px; font-size: 0.8rem; }
  .check { margin-left: auto; color: var(--teal); font-weight: 800; }
  .squad { margin-left: auto; display: flex; }
  .squad :global(svg) { margin-left: -6px; }
  .rec { position: absolute; right: 4px; top: -10px; font-size: 0.6rem; color: var(--gold); background: var(--panel); padding: 0 3px; border-radius: 4px; }
  .base { height: 8px; margin: 0 -0.6rem; background: linear-gradient(90deg, transparent, var(--line), transparent); }
  @keyframes glow { 50% { box-shadow: 0 0 12px color-mix(in srgb, var(--gold) 53%, transparent); } }

  /* Arena */
  /* Arena floor in perspective behind the fighters. */






  /* Foes stand out even when they share species and element with the team. */


  /* Team */

  /* Leaderboard */

  @media (max-width: 760px) {
    .tower { order: 2; flex-direction: row; overflow-x: auto; padding: 0.5rem; gap: 4px; }
    .roof, .base, .floor.ghost { display: none; }
    .floor { flex-direction: column; justify-content: center; min-width: 3.4rem; min-height: 3.6rem; padding: 0.2rem; gap: 0.1rem; }
    .tower { flex-direction: row-reverse; justify-content: flex-end; }
    .check, .squad { margin-left: 0; }
    .floor.best::after { top: -4px; bottom: -4px; left: auto; right: -4px; border-top: 0; border-right: 2px dashed var(--gold); }
    .rec { top: auto; bottom: -2px; right: 2px; }
  }
</style>


<script lang="ts">
  import { formatDuration, formatNumber } from '@core/format';
  import { progressSummary, type ProgressRow } from '@core/queries';
  import type { GameState } from '@core/state';
  import { game } from '../store.svelte';

  /** Two saves side by side (import, device sync). The other save is highlighted where it is ahead or behind. */
  let { other, otherLabel, otherSavedAt }: { other: GameState; otherLabel: string; otherSavedAt: number } = $props();

  // A row missing on one side (not unlocked there yet) counts as 0.
  const rows = $derived.by(() => {
    const here = progressSummary(game.content, game.state);
    const there = progressSummary(game.content, other);
    const find = (list: ProgressRow[], label: string) => list.find((r) => r.label === label);
    return [...new Set([...here, ...there].map((r) => r.label))].map((label) => {
      const a = find(here, label);
      const b = find(there, label);
      return { label, kind: (a ?? b)!.kind, here: a?.value ?? 0, there: b?.value ?? 0 };
    });
  });
  const show = (kind: ProgressRow['kind'], v: number) => (kind === 'duration' ? formatDuration(v) : formatNumber(v));
</script>

<table>
  <thead><tr><th></th><th>Dieses Gerät</th><th>{otherLabel}</th></tr></thead>
  <tbody>
    <tr><td>Gespeichert</td><td class="num">jetzt</td><td class="num">vor {formatDuration(Math.max(0, Date.now() - otherSavedAt))}</td></tr>
    {#each rows as r (r.label)}
      <tr><td>{r.label}</td><td class="num">{show(r.kind, r.here)}</td><td class="num" class:less={r.there < r.here} class:more={r.there > r.here}>{show(r.kind, r.there)}</td></tr>
    {/each}
  </tbody>
</table>

<style>
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; margin-bottom: 0.6rem; }
  th { font-weight: 600; text-align: right; color: var(--muted); font-size: 0.8rem; }
  td { padding: 0.2rem 0; border-top: 1px solid var(--line); }
  td + td, th + th { text-align: right; padding-left: 0.8rem; }
  .less { color: var(--danger); }
  .more { color: var(--teal); }
</style>

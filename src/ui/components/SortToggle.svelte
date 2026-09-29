<script lang="ts">
  /** Flips the order of a sorted list (strongest ↔ weakest, rarest ↔ most common …). */
  let { inverted = $bindable(false) }: { inverted?: boolean } = $props();
</script>

<button
  type="button"
  class="sort-toggle"
  class:on={inverted}
  aria-pressed={inverted}
  aria-label="Reihenfolge umkehren"
  title={inverted ? 'Umgekehrte Reihenfolge – tippen für die normale' : 'Reihenfolge umkehren'}
  onclick={() => (inverted = !inverted)}>⇅</button
>

<style>
  .sort-toggle { flex: 0 0 auto; min-width: 2.2rem; padding-inline: 0.5rem; font-size: 1rem; line-height: 1; }
  .sort-toggle.on { background: var(--petrol); border-color: var(--petrol); color: #fff; }
</style>

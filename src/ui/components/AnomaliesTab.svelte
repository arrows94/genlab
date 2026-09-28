<script lang="ts">
  import { content } from '@content/index';
  import { abandonAnomaly, anomalyAvailable, startAnomaly } from '@core/features/anomalies';
  import { game, view, act, save, ask } from '../store.svelte';

  const data = $derived.by(() => {
    view.frame;
    return {
      active: game.state.anomaly?.id ?? null,
      list: content.anomalies.list.map((a) => ({ a, done: !!game.state.anomaliesCompleted[a.id], available: anomalyAvailable(game, a.id) })),
    };
  });

  async function start(id: string) {
    if ((await ask('Anomalie starten? Das setzt deinen Lauf wie eine Vererbung zurück – ohne Erbgut-Gewinn.', { ok: 'Starten', danger: true })) && act(startAnomaly(game, id))) save();
  }
  async function abandon() {
    if (await ask('Anomalie abbrechen? Es gibt keine Belohnung.', { ok: 'Abbrechen', danger: true })) act(abandonAnomaly(game));
  }
</script>

<h2>🌀 Anomalien</h2>
<p class="muted small">Durchläufe mit veränderten Regeln. Wer das Ziel erreicht, erhält eine dauerhafte Belohnung. Beim Start wird dein Lauf wie bei einer Vererbung zurückgesetzt (ohne Erbgut).</p>

<div class="grid">
  {#each data.list as { a, done, available } (a.id)}
    <article class="panel" class:active={data.active === a.id} class:done>
      <h3>{a.name} {#if done}<span class="badge">✓ gemeistert</span>{/if}</h3>
      <p class="small">{a.description}</p>
      <p class="small"><b>Ziel:</b> {a.goalText}</p>
      <p class="small reward"><b>Belohnung:</b> {a.rewardText}</p>
      {#if data.active === a.id}
        <p class="small live">▶ läuft gerade</p>
        <button onclick={abandon}>Abbrechen</button>
      {:else}
        <button class="primary" disabled={!!data.active || !available} onclick={() => start(a.id)}>{done ? 'Erneut spielen' : 'Starten'}</button>
      {/if}
    </article>
  {/each}
</div>

<style>
  .small { font-size: 0.82rem; margin: 0.3rem 0; }
  .reward { color: var(--gold); }
  .active { border-color: var(--violet); box-shadow: 0 0 14px color-mix(in srgb, var(--violet) 35%, transparent); }
  .done h3 { color: var(--gold); }
  .badge { font-size: 0.7rem; color: var(--gold); }
  .live { color: var(--violet); font-weight: 600; }
  button { width: 100%; }
</style>

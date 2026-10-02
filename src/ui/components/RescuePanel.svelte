<script lang="ts">
  import { formatNumber } from '@core/format';
  import { checkpoint, towerBestEver } from '@core/features/tower';
  import { lowerRecordAndBoss } from '@core/features/weeklyBoss';
  import { game, view, act, ask, toast } from '../store.svelte';

  /**
   * Options → help for stuck saves (e.g. a tower record from an older,
   * stronger save): lower the record so checkpoint and weekly boss fit the
   * team again. Only shown once the tower exists.
   */
  let open = $state(false);
  let floor = $state<number | null>(null);

  const data = $derived.by(() => {
    view.slowFrame;
    const tw = game.state.tower;
    const lastRun = tw.history[0]?.floor ?? 0;
    return {
      best: tw.best,
      ever: towerBestEver(game),
      cp: checkpoint(game),
      running: !!tw.run,
      // Suggestion: where the last run ended, else the checkpoint below the record.
      suggest: Math.max(0, Math.min(tw.best - 1, lastRun > 0 ? lastRun : checkpoint(game) - game.balance.tower.checkpointEvery)),
      boss: game.state.features['weeklyBoss'] ? game.state.weeklyBoss : null,
    };
  });
  const target = $derived(floor ?? data.suggest);

  async function lower() {
    const f = Math.floor(target);
    const boss = data.boss ? ' Der Wochen-Boss dieser Woche wird an den neuen Rekord angepasst, aber nie schwächer als die Etagen, die dein Team zuletzt erreicht hat (bisheriger Schaden bleibt anteilig erhalten).' : '';
    const ok = await ask(
      `Turm-Rekord von Etage ${data.best} auf Etage ${f} senken? Der Checkpoint sinkt mit.${boss} Meilenstein-Boni bleiben, einmalige Belohnungen gibt es nicht noch einmal.`,
      { ok: 'Rekord senken', danger: true },
    );
    if (ok && act(lowerRecordAndBoss(game, f))) {
      floor = null;
      toast(`🗼 Turm-Rekord auf Etage ${f} gesenkt.`, 'info');
    }
  }
</script>

{#if game.state.features['tower']}
  <article class="panel rescue">
    <button class="head" onclick={() => (open = !open)} aria-expanded={open}>
      <h3>🛠️ Hilfe bei festgefahrenen Spielständen</h3>
      <span class="chev" aria-hidden="true">{open ? '▾' : '▸'}</span>
    </button>
    {#if open}
      <p class="small muted">
        Für Spielstände, die aus einer älteren Version stammen oder anders nicht weiterkommen. Nichts davon ist nötig, wenn alles läuft.
      </p>
      <section class="tool">
        <h4>Turm-Rekord senken</h4>
        <p class="small">
          Der Turm-Rekord bestimmt den Checkpoint (Start ab Etage {data.cp + 1}) und die Stärke des Wochen-Bosses{#if data.boss}{' '}(diese Woche Etage {data.boss.floor}, {formatNumber(data.boss.maxHp)} KP){/if}.
          Ist er höher, als dein Team heute schafft, kannst du ihn hier senken.
        </p>
        <dl class="small">
          <dt>Aktueller Rekord</dt><dd class="num">Etage {data.best}</dd>
          {#if data.ever > data.best}<dt>Höchster je erreicht</dt><dd class="num">Etage {data.ever}</dd>{/if}
        </dl>
        <div class="row">
          <label>Neuer Rekord: Etage
            <input type="number" min="0" max={Math.max(0, data.best - 1)} step="1" value={target} oninput={(e) => (floor = Number(e.currentTarget.value))} />
          </label>
          <button class="danger" disabled={data.running || data.best === 0 || !(target >= 0 && target < data.best)} onclick={lower}>Rekord senken</button>
        </div>
        {#if data.running}<p class="small warn">Beende zuerst den laufenden Turm-Lauf.</p>{/if}
        <p class="small muted">Meilenstein-Boni behältst du; Zeitkristalle und Äon-Splitter für Rekorde gibt es erst jenseits von Etage {data.ever} wieder.</p>
      </section>
    {/if}
  </article>
{/if}

<style>
  .rescue { margin-bottom: 1rem; border-color: color-mix(in srgb, var(--gold) 30%, var(--line)); }
  .head { display: flex; align-items: center; justify-content: space-between; width: 100%; padding: 0; border: 0; background: none; color: inherit; text-align: left; }
  .head h3 { margin: 0; }
  .chev { color: var(--muted); }
  .small { font-size: 0.82rem; }
  .tool { margin-top: 0.6rem; padding: 0.6rem 0.7rem; border-radius: 10px; background: var(--bg-2); border: 1px solid var(--line); }
  h4 { margin: 0 0 0.3rem; }
  dl { display: grid; grid-template-columns: auto auto; justify-content: start; gap: 0.2rem 1rem; margin: 0.4rem 0; }
  dd { margin: 0; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin: 0.4rem 0; }
  .row input { width: 6rem; margin-left: 0.3rem; }
  .warn { color: var(--danger); margin: 0; }
</style>

<script lang="ts">
  import { exportText, importText, hardReset, save, toast, view } from '../store.svelte';

  let text = $state('');

  function doExport() {
    text = exportText();
    navigator.clipboard?.writeText(text).then(
      () => toast('Export in die Zwischenablage kopiert.'),
      () => toast('Export erstellt – bitte manuell kopieren.'),
    );
  }
  function doImport() {
    if (text.trim() && confirm('Aktuellen Spielstand durch den Import ersetzen?')) importText(text);
  }
  function doReset() {
    if (confirm('Wirklich ALLES löschen? Das kann nicht rückgängig gemacht werden.')) hardReset();
  }
</script>

<h2>Einstellungen</h2>
{#if view.loadError}
  <p class="panel error">Der letzte Spielstand konnte nicht geladen werden: {view.loadError}</p>
{/if}
<article class="panel">
  <h3>Spielstand</h3>
  <div class="row">
    <button onclick={() => { save(); toast('Gespeichert.'); }}>Jetzt speichern</button>
    <button onclick={doExport}>Exportieren</button>
    <button onclick={doImport} disabled={!text.trim()}>Importieren</button>
  </div>
  <textarea bind:value={text} rows="5" placeholder="Export-Text hier einfügen …" spellcheck="false"></textarea>
</article>
<article class="panel">
  <h3>Gefahrenzone</h3>
  <button class="danger" onclick={doReset}>Spielstand löschen</button>
</article>

<style>
  article { margin-bottom: 1rem; }
  .row { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
  textarea { width: 100%; font-family: var(--mono); font-size: 0.75rem; resize: vertical; }
  .error { color: var(--danger); }
</style>

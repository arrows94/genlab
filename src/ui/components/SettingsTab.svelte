<script lang="ts">
  import { SAVE_VERSION } from '@core/save';
  import { formatDuration, formatNumber } from '@core/format';
  import { exportText, importText, hardReset, save, toast, view, game, ask } from '../store.svelte';
  import { prefs, updatePrefs } from '../prefs.svelte';
  import { CHANGELOG, formatReleaseDate } from '../changelog';
  import { openAllNews } from '../news.svelte';
  import { cancelNotices, notificationsNeedOpenTab, notificationsSupported, requestNotifyPermission } from '../platform/notify';

  let text = $state('');
  let fileInput: HTMLInputElement | undefined = $state();

  const info = $derived.by(() => {
    view.frame;
    return {
      playTime: game.state.simTimeMs,
      lastSaved: view.lastSaved ? Math.round((Date.now() - view.lastSaved) / 1000) : null,
      sample: formatNumber(123_456_789),
    };
  });

  function doExport() {
    text = exportText();
    navigator.clipboard?.writeText(text).then(
      () => toast('Export in die Zwischenablage kopiert.'),
      () => toast('Export erstellt – bitte manuell kopieren.'),
    );
  }
  function download() {
    const blob = new Blob([exportText()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `genlab-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup-Datei heruntergeladen.');
  }
  async function fromFile(e: Event) {
    // currentTarget is null after the first await – keep a reference.
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    text = (await file.text()).trim();
    input.value = '';
    doImport();
  }
  async function doImport() {
    const t = text;
    if (t.trim() && (await ask('Aktuellen Spielstand durch den Import ersetzen?', { ok: 'Ersetzen', danger: true }))) importText(t);
  }
  async function toggleNotifications(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    if (!input.checked) {
      updatePrefs({ notifications: false });
      cancelNotices();
      return;
    }
    if (await requestNotifyPermission()) {
      updatePrefs({ notifications: true });
      toast('Benachrichtigungen aktiviert.');
    } else {
      input.checked = false;
      toast('Benachrichtigungen sind blockiert – bitte in den System- bzw. Browser-Einstellungen erlauben.', 'error', 6000);
    }
  }
  async function doReset() {
    if ((await ask('Wirklich ALLES löschen? Das kann nicht rückgängig gemacht werden.', { ok: 'Löschen', danger: true })) && (await ask('Ganz sicher? Exportiere vorher ein Backup!', { ok: 'Endgültig löschen', danger: true }))) hardReset();
  }
</script>

<header class="tab-head"><h2>⚙️ Optionen</h2></header>
{#if view.loadError}
  <p class="panel error">Der letzte Spielstand konnte nicht geladen werden: {view.loadError}. Eine Kopie liegt unter „genlab.save.broken“ im Browser-Speicher.</p>
{/if}

<div class="grid cols">
  <article class="panel">
    <h3>Darstellung</h3>
    <label class="opt">
      <span>Große Zahlen</span>
      <select value={prefs.notation} onchange={(e) => updatePrefs({ notation: e.currentTarget.value as 'short' | 'scientific' })}>
        <option value="short">Kürzel (Tsd., Mio., Mrd. …)</option>
        <option value="scientific">Wissenschaftlich (1,23e8)</option>
      </select>
    </label>
    <p class="small muted">Beispiel: <span class="num">{info.sample}</span></p>
    <label class="opt check">
      <input type="checkbox" checked={prefs.reduceMotion} onchange={(e) => updatePrefs({ reduceMotion: e.currentTarget.checked })} />
      <span>Weniger Animationen</span>
    </label>
  </article>

  <article class="panel">
    <h3>Benachrichtigungen</h3>
    {#if notificationsSupported()}
      <label class="opt check">
        <input type="checkbox" checked={prefs.notifications} onchange={toggleNotifications} />
        <span>Erinnern, wenn etwas fertig ist</span>
      </label>
      <p class="small muted">
        Expeditionen zurück, Eier geschlüpft, Sequenzierung fertig – und wenn die Offline-Produktion ihr Maximum erreicht hat.
        {#if notificationsNeedOpenTab()}Im Browser nur, solange der Tab im Hintergrund geöffnet bleibt.{/if}
      </p>
    {:else}
      <p class="small muted">Auf dieser Plattform nicht verfügbar.</p>
    {/if}
  </article>

  <article class="panel">
    <h3>Info</h3>
    <dl>
      <dt>Spielzeit</dt><dd class="num">{formatDuration(info.playTime)}</dd>
      <dt>Zuletzt gespeichert</dt><dd class="num">{info.lastSaved === null ? '–' : `vor ${formatDuration(info.lastSaved * 1000)}`}</dd>
      <dt>Autosave</dt><dd class="num">alle {game.balance.sim.autosaveSec} s</dd>
      <dt>Speicherformat</dt><dd class="num">v{SAVE_VERSION}</dd>
      {#if CHANGELOG[0]}<dt>Stand</dt><dd>{formatReleaseDate(CHANGELOG[0].date)}</dd>{/if}
    </dl>
    <button class="news" onclick={() => openAllNews((f) => game.state.features[f] === true)}>✨ Was ist neu?</button>
  </article>
</div>

<article class="panel">
  <h3>Spielstand sichern</h3>
  <p class="small muted">Der Export ist ein Text (GENLAB1:…), den du kopieren oder als Datei speichern kannst – z. B. um auf ein anderes Gerät umzuziehen.</p>
  <div class="row">
    <button onclick={() => { save(); toast('Gespeichert.'); }}>Jetzt speichern</button>
    <button onclick={doExport}>Export kopieren</button>
    <button onclick={download}>Als Datei herunterladen</button>
    <button onclick={() => fileInput?.click()}>Datei importieren …</button>
    <input bind:this={fileInput} type="file" accept=".txt,text/plain" hidden onchange={fromFile} />
  </div>
  <textarea bind:value={text} rows="4" placeholder="Export-Text hier einfügen …" spellcheck="false"></textarea>
  <button class="primary" onclick={doImport} disabled={!text.trim()}>Text importieren</button>
</article>

<article class="panel danger-zone">
  <h3>Gefahrenzone</h3>
  <button class="danger" onclick={doReset}>Spielstand löschen</button>
</article>

<style>
  article { margin-bottom: 1rem; }
  .cols { grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); margin-bottom: 1rem; }
  .cols article { margin-bottom: 0; }
  .row { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
  .opt { display: grid; gap: 0.3rem; margin-bottom: 0.5rem; }
  .opt.check { display: flex; align-items: center; gap: 0.5rem; }
  .small { font-size: 0.82rem; }
  dl { display: grid; grid-template-columns: 1fr auto; gap: 0.3rem 1rem; margin: 0; font-size: 0.9rem; }
  .news { margin-top: 0.7rem; font-size: 0.85rem; }
  dd { margin: 0; text-align: right; }
  textarea { width: 100%; font-family: var(--mono); font-size: 0.75rem; resize: vertical; margin-bottom: 0.5rem; }
  .error { color: var(--danger); }
  .danger-zone { border-color: color-mix(in srgb, var(--danger) 40%, var(--line)); }
</style>

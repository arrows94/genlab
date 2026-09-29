<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import { SAVE_VERSION } from '@core/save';
  import { formatDuration, formatNumber } from '@core/format';
  import type { GameState } from '@core/state';
  import { exportText, readImport, applyImport, hardReset, save, toast, view, game, ask, act } from '../store.svelte';
  import { setNameStyle } from '@core/actions';
  import { prefs, updatePrefs } from '../prefs.svelte';
  import { play } from '../sound';
  import { CHANGELOG, formatReleaseDate } from '../changelog';
  import { openAllNews } from '../news.svelte';
  import { cancelNotices, notificationsNeedOpenTab, notificationsSupported, requestNotifyPermission } from '../platform/notify';
  import { shareSupported, shareText } from '../platform/share';
  import SaveCompare from './SaveCompare.svelte';
  import SyncPanel from './SyncPanel.svelte';

  let text = $state('');
  /** Mirrors the save's naming option (game state itself is not reactive). */
  let nameStyle = $state(game.state.nameStyle);
  let fileInput: HTMLInputElement | undefined = $state();
  /** A read export waiting for the player to compare and confirm it. */
  let pending: { state: GameState; savedAt: number } | null = $state(null);
  const canShare = shareSupported();

  const info = $derived.by(() => {
    view.frame;
    return {
      playTime: game.state.simTimeMs,
      lastSaved: view.lastSaved ? Math.round((Date.now() - view.lastSaved) / 1000) : null,
      sample: formatNumber(123_456_789),
    };
  });

  const fileName = () => `genlab-${new Date().toISOString().slice(0, 10)}.txt`;

  /** Safari only allows clipboard writes inside the click; a ClipboardItem may resolve later. */
  async function copy(exported: Promise<string>): Promise<boolean> {
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': exported.then((t) => new Blob([t], { type: 'text/plain' })) })]);
        return true;
      }
    } catch {
      /* fall back to writeText */
    }
    try {
      await navigator.clipboard.writeText(await exported);
      return true;
    } catch {
      return false;
    }
  }
  async function doExport() {
    const exported = exportText();
    toast((await copy(exported)) ? 'Export in die Zwischenablage kopiert.' : 'Export erstellt – bitte manuell kopieren.');
    text = await exported;
  }
  async function download() {
    const blob = new Blob([await exportText()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName();
    a.click();
    URL.revokeObjectURL(url);
    toast('Backup-Datei heruntergeladen.');
  }
  async function share() {
    try {
      if (await shareText(await exportText(), 'Genlab-Spielstand', fileName())) toast('Spielstand geteilt.');
    } catch (err) {
      toast(`Teilen fehlgeschlagen: ${(err as Error).message}`, 'error');
    }
  }
  async function fromFile(e: Event) {
    // currentTarget is null after the first await – keep a reference.
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    text = (await file.text()).trim();
    input.value = '';
    await doImport();
  }
  async function doImport() {
    if (!text.trim()) return;
    pending = await readImport(text);
  }
  function confirmImport() {
    if (!pending) return;
    applyImport(pending.state);
    pending = null;
    text = '';
  }
  function onKey(e: KeyboardEvent) {
    if (pending && e.key === 'Escape') {
      e.preventDefault();
      pending = null;
    }
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
    <label class="opt check">
      <input type="checkbox" checked={prefs.sound} onchange={(e) => updatePrefs({ sound: e.currentTarget.checked })} />
      <span>Töne</span>
    </label>
    {#if prefs.sound}
      <div class="opt volume">
        <label for="volume">Lautstärke <span class="num muted">{Math.round(prefs.volume * 100)} %</span></label>
        <div class="vol-row">
          <input id="volume" type="range" min="0" max="100" step="5" value={Math.round(prefs.volume * 100)}
            oninput={(e) => updatePrefs({ volume: Number(e.currentTarget.value) / 100 })} onchange={() => play('test')} />
          <button onclick={() => play('test')}>▶ Probe</button>
        </div>
        <p class="small muted">Beim Nachholen der Offline-Zeit und im Hintergrund bleibt es still.</p>
      </div>
    {/if}
    <label class="opt check">
      <input type="checkbox" checked={prefs.music} onchange={(e) => updatePrefs({ music: e.currentTarget.checked })} />
      <span>Hintergrundmusik</span>
    </label>
    {#if prefs.music}
      <div class="opt volume">
        <label for="music-volume">Musik-Lautstärke <span class="num muted">{Math.round(prefs.musicVolume * 100)} %</span></label>
        <input id="music-volume" type="range" min="0" max="100" step="5" value={Math.round(prefs.musicVolume * 100)}
          oninput={(e) => updatePrefs({ musicVolume: Number(e.currentTarget.value) / 100 })} />
        <p class="small muted">Ruhige, live erzeugte Musik – im Turm treibender, im Äon schwebend. Auch über 🎵 oben schaltbar.</p>
      </div>
    {/if}
  </article>

  {#if game.state.features['breeding']}
    <article class="panel">
      <h3>Namen</h3>
      <label class="opt">
        <span>Namen für Nachwuchs</span>
        <select value={nameStyle} onchange={(e) => act(setNameStyle(game, e.currentTarget.value)) && (nameStyle = game.state.nameStyle)}>
          <option value="family">Rufname + Familie</option>
          <option value="classic">Klassisch (Elternnamen gemischt)</option>
        </select>
      </label>
      <p class="small muted">{nameStyle === 'classic' ? 'Zum Beispiel „Glussling“ aus Glutwelpe × Sprössling.' : 'Zum Beispiel „Wuselbert Funkenstein“ – Kinder mischen meist die Rufnamen der Eltern.'} Gilt für diesen Spielstand und neuen Nachwuchs; vorhandene Namen bleiben. Beinamen gibt es in beiden Varianten.</p>
    </article>
  {/if}

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
  <p class="small muted">Der Export ist ein Text (GENLAB2:…), den du kopieren, teilen oder als Datei speichern kannst – z. B. um auf ein anderes Gerät umzuziehen. Vor dem Einspielen siehst du beide Stände im Vergleich.</p>
  <div class="row">
    <button onclick={() => { save(); toast('Gespeichert.'); }}>Jetzt speichern</button>
    <button onclick={doExport}>Export kopieren</button>
    {#if canShare}<button onclick={share}>Teilen …</button>{/if}
    <button onclick={download}>Als Datei herunterladen</button>
    <button onclick={() => fileInput?.click()}>Datei importieren …</button>
    <input bind:this={fileInput} type="file" accept=".txt,text/plain" hidden onchange={fromFile} />
  </div>
  <textarea bind:value={text} rows="4" placeholder="Export-Text hier einfügen …" spellcheck="false"></textarea>
  <button class="primary" onclick={doImport} disabled={!text.trim()}>Text importieren …</button>
</article>

<svelte:window onkeydowncapture={onKey} />

{#if pending}
  <div class="backdrop" transition:fade={{ duration: 120 }} onclick={(e) => e.target === e.currentTarget && (pending = null)} role="presentation">
    <div class="dialog panel" role="alertdialog" aria-modal="true" aria-labelledby="import-title" transition:scale={{ duration: 150, start: 0.92 }}>
      <h3 id="import-title">Spielstand ersetzen?</h3>
      <SaveCompare other={pending.state} otherLabel="Import" otherSavedAt={pending.savedAt} />
      {#if pending.state.simTimeMs < game.state.simTimeMs}
        <p class="warn">⚠️ Der Import hat weniger Spielzeit als dieser Stand – du würdest Fortschritt verlieren.</p>
      {/if}
      <p class="small muted">Die Zeit seit dem Export wird nach dem Import als Offline-Fortschritt nachgeholt.</p>
      <div class="buttons">
        <button onclick={() => (pending = null)}>Abbrechen</button>
        <button class="danger" onclick={confirmImport}>Ersetzen</button>
      </div>
    </div>
  </div>
{/if}

<SyncPanel />

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
  .opt select { max-width: 100%; min-width: 0; }
  .opt.check { display: flex; align-items: center; gap: 0.5rem; }
  .vol-row { display: flex; align-items: center; gap: 0.5rem; }
  .vol-row input { flex: 1; min-width: 0; }
  .small { font-size: 0.82rem; }
  dl { display: grid; grid-template-columns: 1fr auto; gap: 0.3rem 1rem; margin: 0; font-size: 0.9rem; }
  .news { margin-top: 0.7rem; font-size: 0.85rem; }
  dd { margin: 0; text-align: right; }
  textarea { width: 100%; font-family: var(--mono); font-size: 0.75rem; resize: vertical; margin-bottom: 0.5rem; }
  .error { color: var(--danger); }
  .danger-zone { border-color: color-mix(in srgb, var(--danger) 40%, var(--line)); }
  .backdrop { position: fixed; inset: 0; z-index: 50; background: #000a; display: grid; place-items: center; padding: 1rem; }
  .dialog { max-width: 28rem; width: 100%; max-height: calc(100dvh - 2rem); overflow-y: auto; padding: 1.1rem 1.2rem 1rem; box-shadow: 0 12px 40px #000a; }
  .dialog h3 { margin-top: 0; }
  .warn { color: var(--danger); margin: 0 0 0.5rem; font-size: 0.9rem; }
  .buttons { display: flex; justify-content: flex-end; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.8rem; }
</style>

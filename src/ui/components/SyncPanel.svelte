<script lang="ts">
  import { errorText } from '../errors';
  import { formatDuration } from '@core/format';
  import { ask, toast, view } from '../store.svelte';
  import { createSync, joinSync, leaveSync, sync, syncNow } from '../sync.svelte';
  import { syncAvailable } from '../platform/sync';
  import { shareSupported, shareText } from '../platform/share';

  /** Options panel for device sync (see sync.svelte.ts). Hidden in builds without a sync server. */
  let codeInput = $state('');
  let reveal = $state(false);
  const canShare = shareSupported();

  const status = $derived.by(() => {
    view.frame;
    const link = sync.link;
    if (!link) return '';
    if (sync.busy) return 'Gleiche ab …';
    if (sync.error) return sync.error;
    const ago = link.syncedAt ? `Abgeglichen vor ${formatDuration(Math.max(0, Date.now() - link.syncedAt))}` : 'Noch nicht abgeglichen';
    return link.dirty ? `${ago} – neuer Fortschritt wird bald hochgeladen.` : `${ago}.`;
  });

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(sync.link!.code);
      toast('Sync-Code kopiert.');
    } catch {
      reveal = true;
      toast('Bitte den Code manuell abschreiben.');
    }
  }
  async function shareCode() {
    try {
      await shareText(sync.link!.code, 'Genlab-Sync-Code');
    } catch (err) {
      toast(`Teilen fehlgeschlagen: ${errorText(err)}`, 'error');
    }
  }
  async function setup() {
    if (await createSync()) {
      reveal = true;
      toast('☁️ Geräte-Sync eingerichtet.');
    }
  }
  async function join() {
    if (await joinSync(codeInput)) codeInput = '';
  }
  async function leave() {
    if (await ask('Geräte-Sync auf diesem Gerät beenden? Der Spielstand bleibt hier und in der Cloud erhalten.', { ok: 'Beenden' })) {
      if (await leaveSync(false)) toast('Geräte-Sync auf diesem Gerät beendet.');
    }
  }
  async function deleteCloud() {
    if (await ask('Cloud-Spielstand löschen? Alle verbundenen Geräte behalten ihren eigenen Stand, gleichen aber nicht mehr ab.', { ok: 'Löschen', danger: true })) {
      if (await leaveSync(true)) toast('Cloud-Spielstand gelöscht.');
    }
  }
</script>

{#if syncAvailable()}
  <article class="panel">
    <h3>☁️ Geräte-Sync</h3>
    {#if !sync.link}
      <p class="small muted">
        Spiele auf mehreren Geräten mit demselben Spielstand. Er wird beim Wechsel automatisch abgeglichen –
        verschlüsselt, der Server kann ihn nicht lesen. Ein Konto brauchst du nicht, nur einen Sync-Code.
      </p>
      <button class="primary" onclick={setup} disabled={sync.busy}>Sync einrichten</button>
      <p class="small muted join-hint">Schon auf einem anderen Gerät eingerichtet? Gib dessen Code ein:</p>
      <form class="row" onsubmit={(e) => { e.preventDefault(); void join(); }}>
        <input bind:value={codeInput} placeholder="ABCD-EFGH-…" autocomplete="off" autocapitalize="characters" spellcheck="false" aria-label="Sync-Code" />
        <button type="submit" disabled={sync.busy || !codeInput.trim()}>Verbinden</button>
      </form>
    {:else}
      <p class="status" class:error={!!sync.error && !sync.busy}>{status}</p>
      <div class="code-row">
        <span class="code num" aria-label="Sync-Code">{reveal ? sync.link.code : sync.link.code.replace(/[^-]/g, '•')}</span>
        <button onclick={() => (reveal = !reveal)}>{reveal ? 'Verbergen' : 'Anzeigen'}</button>
        <button onclick={copyCode}>Kopieren</button>
        {#if canShare}<button onclick={shareCode}>Teilen …</button>{/if}
      </div>
      <p class="small muted">
        Gib diesen Code auf deinem anderen Gerät unter „Optionen → Geräte-Sync“ ein. Wer ihn kennt, kann deinen Spielstand laden und
        überschreiben – gib ihn nicht weiter. Spiele immer nur auf einem Gerät gleichzeitig.
      </p>
      <div class="row">
        <button class="primary" onclick={() => syncNow()} disabled={sync.busy}>Jetzt abgleichen</button>
        <button onclick={leave} disabled={sync.busy}>Sync beenden</button>
        <button class="danger" onclick={deleteCloud} disabled={sync.busy}>Cloud-Stand löschen</button>
      </div>
    {/if}
  </article>
{/if}

<style>
  article { margin-bottom: 1rem; }
  .small { font-size: 0.82rem; }
  .row { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .join-hint { margin: 0.9rem 0 0.4rem; }
  form input { flex: 1 1 14rem; min-width: 0; font-family: var(--mono); letter-spacing: 0.05em; text-transform: uppercase; }
  .status { margin: 0 0 0.6rem; font-size: 0.9rem; }
  .status.error { color: var(--danger); }
  .code-row { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
  .code { font-family: var(--mono); font-size: 1rem; letter-spacing: 0.04em; padding: 0.35rem 0.6rem; border: 1px solid var(--line); border-radius: 6px; flex: 1 1 100%; text-align: center; white-space: nowrap; overflow-x: auto; }
  .code-row + p { margin-top: 0.7rem; }
</style>

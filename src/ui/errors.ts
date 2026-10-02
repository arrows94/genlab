import { SaveError } from '@core/save';
import { SyncError } from './platform/sync';

/**
 * Player-facing text for an error. Our own errors (save, sync) are already
 * German; browser and platform errors („Failed to fetch“, „NotAllowedError“)
 * are mapped to German instead of being shown raw.
 */
export function errorText(err: unknown): string {
  if (err instanceof SaveError || err instanceof SyncError) return err.message;
  const name = err instanceof Error ? err.name : '';
  const message = err instanceof Error ? err.message : String(err);
  if (name === 'NotAllowedError') return 'Der Browser hat das nicht erlaubt.';
  if (name === 'QuotaExceededError' || /quota/i.test(message)) return 'Der Speicher des Geräts ist voll.';
  if (name === 'SecurityError') return 'Der Browser blockiert den Zugriff (privates Fenster oder gesperrte Website-Daten?).';
  if (name === 'AbortError') return 'Abgebrochen.';
  if (name === 'TimeoutError') return 'Zeitüberschreitung – bitte später noch einmal versuchen.';
  if (/failed to fetch|networkerror|load failed|network request failed/i.test(message)) return 'Keine Verbindung zum Server.';
  return name && name !== 'Error' ? `Unerwarteter Fehler (${name}).` : 'Unerwarteter Fehler.';
}

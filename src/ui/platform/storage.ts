import { Capacitor } from '@capacitor/core';
import type { SaveStorage } from '@core/save';

const KEY = 'genlab.save.v1';

/** Browser and Tauri: localStorage (persistent in the Tauri WebView profile). */
export class LocalSaveStorage implements SaveStorage {
  async load(): Promise<string | null> {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  }
  async save(data: string): Promise<void> {
    // Synchronous inside the async function, so it completes even during `beforeunload`.
    localStorage.setItem(KEY, data);
  }
  async clear(): Promise<void> {
    localStorage.removeItem(KEY);
  }
}

/**
 * Android/iOS app: Capacitor Preferences (SharedPreferences / UserDefaults).
 * The OS may evict a WebView's localStorage under storage pressure; this
 * store survives. On first launch an existing localStorage save is migrated.
 */
export class CapacitorSaveStorage implements SaveStorage {
  private prefs = import('@capacitor/preferences').then((m) => m.Preferences);

  async load(): Promise<string | null> {
    const prefs = await this.prefs;
    const { value } = await prefs.get({ key: KEY });
    if (value) return value;
    const legacy = await new LocalSaveStorage().load();
    if (legacy) await prefs.set({ key: KEY, value: legacy });
    return legacy;
  }
  async save(data: string): Promise<void> {
    await (await this.prefs).set({ key: KEY, value: data });
  }
  async clear(): Promise<void> {
    await (await this.prefs).remove({ key: KEY });
    await new LocalSaveStorage().clear();
  }
}

/** Picks the storage for the current platform. */
export function createStorage(): SaveStorage {
  return Capacitor.isNativePlatform() ? new CapacitorSaveStorage() : new LocalSaveStorage();
}

/** "web" | "android" | "ios" – shown in the options for support questions. */
export function platformName(): string {
  if (Capacitor.isNativePlatform()) return Capacitor.getPlatform();
  return '__TAURI_INTERNALS__' in window ? 'desktop' : 'web';
}

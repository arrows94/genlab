import { Capacitor } from '@capacitor/core';
import type { SaveStorage } from '@core/save';

const SAVE_KEY = 'genlab.save.v1';

/** Browser and Tauri: localStorage (persistent in the Tauri WebView profile). */
export class LocalSaveStorage implements SaveStorage {
  constructor(private key = SAVE_KEY) {}
  async load(): Promise<string | null> {
    try {
      return localStorage.getItem(this.key);
    } catch {
      return null;
    }
  }
  async save(data: string): Promise<void> {
    // Synchronous inside the async function, so it completes even during `beforeunload`.
    localStorage.setItem(this.key, data);
  }
  async clear(): Promise<void> {
    localStorage.removeItem(this.key);
  }
}

/**
 * Android/iOS app: Capacitor Preferences (SharedPreferences / UserDefaults).
 * The OS may evict a WebView's localStorage under storage pressure; this
 * store survives. On first launch an existing localStorage save is migrated.
 */
export class CapacitorSaveStorage implements SaveStorage {
  private prefs = import('@capacitor/preferences').then((m) => m.Preferences);
  constructor(private key = SAVE_KEY) {}

  async load(): Promise<string | null> {
    const prefs = await this.prefs;
    const { value } = await prefs.get({ key: this.key });
    if (value) return value;
    const legacy = await new LocalSaveStorage(this.key).load();
    if (legacy) await prefs.set({ key: this.key, value: legacy });
    return legacy;
  }
  async save(data: string): Promise<void> {
    await (await this.prefs).set({ key: this.key, value: data });
  }
  async clear(): Promise<void> {
    await (await this.prefs).remove({ key: this.key });
    await new LocalSaveStorage(this.key).clear();
  }
}

/** Picks the storage for the current platform; `key` for other per-device data than the save (e.g. the sync link). */
export function createStorage(key = SAVE_KEY): SaveStorage {
  return Capacitor.isNativePlatform() ? new CapacitorSaveStorage(key) : new LocalSaveStorage(key);
}

/** Readable device label for the sync conflict dialog, e.g. "Android-App" or "Browser (Windows)". */
export function deviceLabel(): string {
  const platform = platformName();
  if (platform === 'android') return 'Android-App';
  if (platform === 'ios') return 'iOS-App';
  const ua = navigator.userAgent;
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad|iPod/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  const kind = platform === 'desktop' ? 'Desktop-App' : 'Browser';
  return os ? `${kind} (${os})` : kind;
}

/** "web" | "android" | "ios" – shown in the options for support questions. */
export function platformName(): string {
  if (Capacitor.isNativePlatform()) return Capacitor.getPlatform();
  return '__TAURI_INTERNALS__' in window ? 'desktop' : 'web';
}

import { Capacitor } from '@capacitor/core';

/**
 * Registers the service worker (offline play + install as app) – only in a
 * normal browser. Tauri and Capacitor ship the files locally anyway.
 * `onUpdate` receives a function that activates a downloaded new version.
 */
export async function registerPwa(onUpdate: (apply: () => void) => void): Promise<void> {
  const isBrowser = location.protocol === 'https:' || location.hostname === 'localhost';
  if (!('serviceWorker' in navigator) || !isBrowser || Capacitor.isNativePlatform() || '__TAURI_INTERNALS__' in window) return;
  const { registerSW } = await import('virtual:pwa-register');
  const updateSW = registerSW({
    onNeedRefresh() {
      onUpdate(() => void updateSW(true));
    },
  });
}

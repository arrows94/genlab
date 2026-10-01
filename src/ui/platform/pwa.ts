import { Capacitor } from '@capacitor/core';

type Apply = () => void;

/** Activates the downloaded new version (reloads the page); null while none is ready. */
let apply: Apply | null = null;
let registration: ServiceWorkerRegistration | null = null;
/** Callers of `lookForUpdate` waiting for a new version to finish installing. */
const listeners = new Set<(a: Apply | null) => void>();

/**
 * Registers the service worker (offline play + install as app) – only in a
 * normal browser. Tauri and Capacitor ship the files locally anyway.
 * `onUpdate` receives a function that activates a downloaded new version
 * whenever one is ready, also later during play.
 *
 * Resolves for the start: with that function if a new version is ready within
 * `waitMs`, otherwise null (no update, offline, no service worker, too slow).
 */
export async function registerPwa(onUpdate: (apply: Apply) => void, waitMs = 0): Promise<Apply | null> {
  const isBrowser = location.protocol === 'https:' || location.hostname === 'localhost';
  if (!('serviceWorker' in navigator) || !isBrowser || Capacitor.isNativePlatform() || '__TAURI_INTERNALS__' in window) return null;
  const { registerSW } = await import('virtual:pwa-register');
  return new Promise((resolve) => {
    setTimeout(() => resolve(apply), waitMs);
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        apply = () => void updateSW(true);
        onUpdate(apply);
        for (const listener of listeners) listener(apply);
      },
      onRegisteredSW(_url, reg) {
        registration = reg ?? null;
        void lookForUpdate(waitMs).then(resolve);
      },
      onRegisterError: () => resolve(null),
    });
  });
}

/**
 * Asks the server for a new version (e.g. when the app comes back after a long
 * time). Resolves with the function that activates it if it is ready within
 * `waitMs`, otherwise null.
 */
export function lookForUpdate(waitMs: number): Promise<Apply | null> {
  const reg = registration;
  if (apply || !reg) return Promise.resolve(apply);
  return new Promise((resolve) => {
    const done = (a: Apply | null) => {
      clearTimeout(timer);
      listeners.delete(done);
      resolve(a);
    };
    const timer = setTimeout(() => done(apply), waitMs);
    listeners.add(done);
    // A version that already waits reports itself right away; give that a moment.
    const settle = () => setTimeout(() => done(apply), 200);
    reg.update().then(
      () => {
        const sw = reg.installing;
        if (!sw) return settle();
        // Downloading: it reports itself (onNeedRefresh) once installed.
        sw.addEventListener('statechange', () => sw.state !== 'installing' && settle());
      },
      () => done(null), // offline: play the version we have
    );
  });
}

import { Capacitor } from '@capacitor/core';

/**
 * Native app lifecycle (Android/iOS via Capacitor):
 * - save when the app goes to the background, catch up when it returns
 * - Android back button closes open dialogs first, then minimises the app
 */
export async function setupNative(hooks: { save: () => void; resume: () => void; back: () => boolean }): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const { App } = await import('@capacitor/app');
  await App.addListener('pause', () => hooks.save());
  await App.addListener('resume', () => hooks.resume());
  await App.addListener('backButton', () => {
    if (!hooks.back()) void App.minimizeApp();
  });
}

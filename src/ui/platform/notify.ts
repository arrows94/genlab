import { Capacitor } from '@capacitor/core';
import type { Notice } from '@core/notices';

/**
 * Reminders while the game is in the background:
 * - Android/iOS: local notifications scheduled with the system (no server),
 *   so they arrive even when the app is closed
 * - browser/PWA: shown by a timer, so only while the tab is still open
 * - Tauri: not supported (the desktop window usually stays open anyway)
 */
const native = () => Capacitor.isNativePlatform();
const tauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

/** Browsers cap timer delays at ~24.8 days. */
const MAX_TIMER_MS = 2 ** 31 - 1;
/** Android/iOS limit the number of pending alarms per app; the earliest matter most. */
const MAX_NATIVE = 20;

export function notificationsSupported(): boolean {
  if (native()) return true;
  return !tauri() && typeof Notification !== 'undefined';
}

/** Only in the app do notices arrive after the game was closed. */
export function notificationsNeedOpenTab(): boolean {
  return !native();
}

/** Asks for permission; true if notifications may be shown. */
export async function requestNotifyPermission(): Promise<boolean> {
  try {
    if (native()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      return (await LocalNotifications.requestPermissions()).display === 'granted';
    }
    if (!notificationsSupported()) return false;
    return Notification.permission === 'granted' || (await Notification.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

let webTimers: ReturnType<typeof setTimeout>[] = [];
// Serialised, so a quick background/foreground switch never leaves stale notices behind.
let queue: Promise<void> = Promise.resolve();
const enqueue = (job: () => Promise<void>) => {
  queue = queue.then(job).catch(() => {
    /* notices are best effort */
  });
};

async function cancelAll(): Promise<void> {
  for (const t of webTimers) clearTimeout(t);
  webTimers = [];
  if (!native()) return;
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  const { notifications } = await LocalNotifications.getPending();
  if (notifications.length > 0) await LocalNotifications.cancel({ notifications: notifications.map((n) => ({ id: n.id })) });
}

async function showWeb(n: Notice): Promise<void> {
  if (Notification.permission !== 'granted') return;
  const options: NotificationOptions = { body: n.body, icon: 'icons/icon-192.png', tag: n.kind };
  // Mobile browsers only allow notifications through the service worker.
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) return reg.showNotification(n.title, options);
  const note = new Notification(n.title, options);
  note.onclick = () => {
    window.focus();
    note.close();
  };
}

/** Replaces all pending notices with these. */
export function scheduleNotices(notices: Notice[]): void {
  enqueue(async () => {
    await cancelAll();
    const now = Date.now();
    const upcoming = notices.filter((n) => n.at > now);
    if (upcoming.length === 0) return;
    if (native()) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      // schedule() would ask for a revoked permission itself – never while the app is being left.
      if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
      await LocalNotifications.schedule({
        notifications: upcoming.slice(0, MAX_NATIVE).map((n, i) => ({
          id: i + 1,
          title: n.title,
          body: n.body,
          group: n.kind,
          schedule: { at: new Date(n.at), allowWhileIdle: true },
          // Inexact is fine for a game and needs no "Alarms & reminders" permission.
          isExactNotification: false,
        })),
      });
      return;
    }
    if (!notificationsSupported()) return;
    for (const n of upcoming) {
      if (n.at - now > MAX_TIMER_MS) continue;
      webTimers.push(setTimeout(() => void showWeb(n).catch(() => {}), n.at - now));
    }
  });
}

/** Drops all pending notices (the player is back). */
export function cancelNotices(): void {
  enqueue(cancelAll);
}

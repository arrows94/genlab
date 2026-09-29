import { Capacitor } from '@capacitor/core';

/**
 * System share sheet (messenger, mail, AirDrop …) for moving a save to
 * another device. Android/iOS use the Capacitor plugin (the WebView has no
 * `navigator.share`), browsers the Web Share API. Tauri usually has neither.
 */
export function shareSupported(): boolean {
  return Capacitor.isNativePlatform() || typeof navigator.share === 'function';
}

/** False if the player closed the share sheet without picking a target. */
export async function shareText(text: string, fileName: string, title: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, dialogTitle: title });
      return true;
    }
    // A file survives messengers that shorten or reformat long texts.
    const file = new File([text], fileName, { type: 'text/plain' });
    await navigator.share(navigator.canShare?.({ files: [file] }) ? { title, files: [file] } : { title, text });
    return true;
  } catch (err) {
    // Closing the sheet rejects with AbortError (web) or "Share canceled" (native).
    if ((err as Error).name === 'AbortError' || /cancel/i.test((err as Error).message)) return false;
    throw err;
  }
}

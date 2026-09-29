import { Capacitor } from '@capacitor/core';

/**
 * System share sheet (messenger, mail, AirDrop …) for moving a save to
 * another device. Android/iOS use the Capacitor plugin (the WebView has no
 * `navigator.share`), browsers the Web Share API. Tauri usually has neither.
 */
export function shareSupported(): boolean {
  return Capacitor.isNativePlatform() || typeof navigator.share === 'function';
}

/** Shares `text`, in browsers as a file if `fileName` is given. False if the player closed the share sheet. */
export async function shareText(text: string, title: string, fileName?: string): Promise<boolean> {
  try {
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ title, text, dialogTitle: title });
      return true;
    }
    // A file survives messengers that shorten or reformat long texts.
    const file = fileName ? new File([text], fileName, { type: 'text/plain' }) : null;
    await navigator.share(file && navigator.canShare?.({ files: [file] }) ? { title, files: [file] } : { title, text });
    return true;
  } catch (err) {
    // Closing the sheet rejects with AbortError (web) or "Share canceled" (native).
    if ((err as Error).name === 'AbortError' || /cancel/i.test((err as Error).message)) return false;
    throw err;
  }
}

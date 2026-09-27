import type { SaveStorage } from '@core/save';

const KEY = 'genlab.save.v1';

/** Browser storage. Tauri/Capacitor can provide their own `SaveStorage`. */
export class LocalSaveStorage implements SaveStorage {
  load(): string | null {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  }
  save(data: string): void {
    localStorage.setItem(KEY, data);
  }
  clear(): void {
    localStorage.removeItem(KEY);
  }
}

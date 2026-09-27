/** Minimal typed event bus. UI toasts, statistics and achievements subscribe here. */
export type Listener<T> = (payload: T) => void;
export type AnyListener<M> = <K extends keyof M>(type: K, payload: M[K]) => void;

export class EventBus<M extends object> {
  private listeners = new Map<keyof M, Set<Listener<never>>>();
  private anyListeners = new Set<AnyListener<M>>();

  on<K extends keyof M>(type: K, fn: Listener<M[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(fn as Listener<never>);
    return () => set.delete(fn as Listener<never>);
  }

  onAny(fn: AnyListener<M>): () => void {
    this.anyListeners.add(fn);
    return () => this.anyListeners.delete(fn);
  }

  emit<K extends keyof M>(type: K, payload: M[K]): void {
    const set = this.listeners.get(type);
    if (set) for (const fn of [...set]) (fn as Listener<M[K]>)(payload);
    for (const fn of [...this.anyListeners]) fn(type, payload);
  }

  clear(): void {
    this.listeners.clear();
    this.anyListeners.clear();
  }
}

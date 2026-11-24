/**
 * The one subscription primitive the stores share. PURE: no timers, no DOM. A listener is told
 * "something changed"; it reads the store's snapshot itself.
 */
export type Listener = () => void;

export class Observable {
  #listeners = new Set<Listener>();

  /** Returns the unsubscribe. A listener added twice is called once. */
  subscribe(fn: Listener): () => void {
    this.#listeners.add(fn);
    return () => {
      this.#listeners.delete(fn);
    };
  }

  protected emit(): void {
    // a snapshot: a listener that subscribes another during the emit is not called this time
    for (const fn of Array.from(this.#listeners)) fn();
  }
}

/** One value with change notification: the small UI flags (sheet, pause sources, insets). */
export class Value<T> extends Observable {
  #v: T;
  constructor(initial: T) {
    super();
    this.#v = initial;
  }
  get(): T {
    return this.#v;
  }
  set(v: T): void {
    if (Object.is(v, this.#v)) return;
    this.#v = v;
    this.emit();
  }
}

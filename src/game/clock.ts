/**
 * Time as a port, so the stores stay PURE (no setTimeout under tsconfig.core.json) and the turn
 * loop is testable with a fake clock. The web adapter is platform/clock.ts.
 */
export interface ClockPort {
  /** Run `fn` once after `ms`; the returned function cancels it (a no-op once it has run). */
  after(ms: number, fn: () => void): () => void;
}

/** A clock the tests drive by hand: `tick(ms)` advances time and runs whatever fell due, in order. */
export function manualClock(): ClockPort & { now: number; tick(ms: number): void; pending(): number } {
  let now = 0;
  let seq = 0;
  const timers = new Map<number, { at: number; fn: () => void }>();
  return {
    get now() {
      return now;
    },
    after(ms, fn) {
      const id = ++seq;
      timers.set(id, { at: now + Math.max(0, ms), fn });
      return () => {
        timers.delete(id);
      };
    },
    tick(ms) {
      const end = now + ms;
      for (;;) {
        let next: [number, { at: number; fn: () => void }] | null = null;
        for (const e of timers) if (e[1].at <= end && (!next || e[1].at < next[1].at || (e[1].at === next[1].at && e[0] < next[0]))) next = e;
        if (!next) break;
        timers.delete(next[0]);
        now = next[1].at;
        next[1].fn();
      }
      now = end;
    },
    pending: () => timers.size,
  };
}

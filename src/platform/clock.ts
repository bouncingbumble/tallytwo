/**
 * The web ClockPorts.
 *
 * timerClock: setTimeout. A timer fires whenever the event loop gets to it — mid-frame, or just
 * after a frame was drawn — so the state change it makes waits for the next frame anyway, and
 * the tweens it starts begin on a frame boundary that is late by up to a frame and varies.
 *
 * frameClock: timers fire from the game loop (pump(), called at the start of every Phaser step,
 * drawn or not), so a timer's state change, the scene's re-render of it and the first frame of
 * any tween it starts all land in the same frame. A timer can only fire at a frame boundary: it
 * is late by at most one frame and never fires between a frame's update and its draw.
 *
 * If the loop is not running (before boot, a background tab where rAF stops), a fallback
 * setTimeout FALLBACK_MS after the due time fires it anyway, so nothing waits forever.
 */
import type { ClockPort } from "../game/clock";

export const timerClock: ClockPort = {
  after(ms, fn) {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
};

/** How late a frame-clock timer may run when no frame comes (the loop is asleep). */
const FALLBACK_MS = 250;

interface Pending {
  at: number;
  seq: number;
  fn: () => void;
  fallback: ReturnType<typeof setTimeout> | null;
}

export interface FrameClock extends ClockPort {
  /** Run every timer due by `now` (performance.now() ms), in due order. Call once per frame. */
  pump(now: number): void;
}

export function frameClock(): FrameClock {
  const pending = new Set<Pending>();
  let seq = 0;
  const fire = (p: Pending) => {
    if (!pending.delete(p)) return;
    if (p.fallback !== null) clearTimeout(p.fallback);
    p.fn();
  };
  return {
    after(ms, fn) {
      const p: Pending = { at: performance.now() + Math.max(0, ms), seq: ++seq, fn, fallback: null };
      p.fallback = setTimeout(() => fire(p), Math.max(0, ms) + FALLBACK_MS);
      pending.add(p);
      return () => {
        if (pending.delete(p) && p.fallback !== null) clearTimeout(p.fallback);
      };
    },
    pump(now) {
      if (!pending.size) return;
      // a timer a callback arms with ms 0 runs on the next frame, not this one
      const due = [...pending].filter((p) => p.at <= now).sort((a, b) => a.at - b.at || a.seq - b.seq);
      for (const p of due) fire(p);
    },
  };
}

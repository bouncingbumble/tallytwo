/** The web ClockPort: setTimeout. */
import type { ClockPort } from "../game/clock";

export const timerClock: ClockPort = {
  after(ms, fn) {
    const t = setTimeout(fn, ms);
    return () => clearTimeout(t);
  },
};

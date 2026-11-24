/**
 * Motion helpers. `prefers-reduced-motion: reduce` cuts every tween to nothing (what motion.css's
 * media query did); the bark and the banner then simply appear and are removed by the store's
 * timers. Durations here are the CSS ones; game timings stay in game/timing.ts.
 */
const reduced = typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A tween duration, or 0 under reduced motion. */
export const ms = (n: number): number => (reduced ? 0 : n);

export const reducedMotion = (): boolean => reduced;

/** The select lift and the hand's slide (table.css: transform 0.16s cubic-bezier(0.2, 0.9, 0.3, 1.2)). */
export const SLIDE_MS = 160;
/** After a play, the remaining cards close the gap 4x slower. */
export const SETTLE_MS = 640;
/** One card's fly-in at the deal (motion.css `deal`, 0.38s ease). */
export const DEAL_IN_MS = 380;
/** The bark bubble's fade (motion.css barkin 1.9s): in over the first 10 %, out over the last 15 %. */
export const BARK_ANIM_MS = 1900;
/** The final-round banner's run (motion.css announce 3.2s). */
export const ANNOUNCE_ANIM_MS = 3200;

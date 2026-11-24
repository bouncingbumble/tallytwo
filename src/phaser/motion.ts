/**
 * Motion helpers. Reduced motion cuts every presentation tween to nothing; the bark and the banner
 * then simply appear and are removed by the store's timers. It is decided live from Settings ›
 * Motion and, on "auto", the device's
 * `prefers-reduced-motion` (motionReduced in settings.ts), so a change applies to the next tween
 * without a reload. Every duration is a token from game/timing.ts MOTION.
 */
import { MOTION } from "../game/timing";
import { type MotionPref, motionReduced } from "../settings/settings";

const QUERY = "(prefers-reduced-motion: reduce)";
const media = typeof window !== "undefined" && typeof window.matchMedia === "function" ? window.matchMedia(QUERY) : null;

let pref: () => MotionPref = () => "auto";

/** Wire Settings › Motion in (main.ts, once). */
export function bindMotion(read: () => MotionPref): void {
  pref = read;
}

/** True while presentation motion is off. */
export const reducedMotion = (): boolean => motionReduced(pref(), media?.matches ?? false);

/** A tween duration, or 0 under reduced motion. */
export const ms = (n: number): number => (reducedMotion() ? 0 : n);

/** The select lift and the hand's slide. */
export const SLIDE_MS = MOTION.slide;
/** After a play, the remaining cards close the gap 4x slower. */
export const SETTLE_MS = MOTION.settle;
/** One card's fly-in at the deal. */
export const DEAL_IN_MS = MOTION.dealIn;
/** The bark bubble's run. */
export const BARK_ANIM_MS = MOTION.bark;
/** The final-round banner's run. */
export const ANNOUNCE_ANIM_MS = MOTION.announce;

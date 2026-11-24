/**
 * A sheet's drag, as pure functions (docs/MOBILE_UX_PLAN.md §7.2): the body scrolls with the
 * finger and stretches past its ends (a rubber band), keeps gliding after a flick (momentum), and
 * pulled down from the top the whole sheet follows the finger and goes away past DISMISS_PX or on
 * a downward flick. SheetScene only feeds pointer positions in, in logical px.
 */

/** A sheet pulled down this far (logical px) and let go is dismissed... */
export const DISMISS_PX = 90;
/** ...or let go moving down this fast (logical px per ms) once it has moved DISMISS_MIN. */
export const DISMISS_SPEED = 0.5;
export const DISMISS_MIN = 24;
/** Past an end the body stretches by at most this much (logical px), however far the finger goes. */
export const RUBBER_MAX = 60;
/** A release slower than this (logical px per ms) does not glide. */
export const MOMENTUM_MIN_SPEED = 0.15;
/** A flick at v px/ms glides about v * MOMENTUM_GAIN px further. */
export const MOMENTUM_GAIN = 260;

/** How far the body shows past an end when the finger has pulled it `over` px past it: resists more the further it goes. */
export function rubberBand(over: number, max: number = RUBBER_MAX): number {
  if (over <= 0) return 0;
  return (max * over) / (over + max);
}

export interface DragState {
  /** The body's scroll, logical px from its top (may sit past [0, maxScroll] while stretched). */
  scroll: number;
  /** How far the whole sheet is pulled down (>= 0). */
  pull: number;
}

/**
 * The body's scroll and the sheet's pull for a finger that has moved `dy` px (down positive) since
 * the press, which found the body at `startScroll` of `maxScroll`. Pulling down past the top moves
 * the sheet 1:1 (it is being dragged away); pushing up past the bottom stretches.
 */
export function dragTo(startScroll: number, dy: number, maxScroll: number): DragState {
  const raw = startScroll - dy;
  if (raw < 0) return { scroll: 0, pull: -raw };
  if (raw > maxScroll) return { scroll: maxScroll + rubberBand(raw - maxScroll), pull: 0 };
  return { scroll: raw, pull: 0 };
}

/** Let go with the sheet pulled `pull` px down, the finger moving `vy` px/ms (down positive): does it close? */
export function shouldDismiss(pull: number, vy: number): boolean {
  return pull >= DISMISS_PX || (pull >= DISMISS_MIN && vy >= DISMISS_SPEED);
}

/**
 * Where the body comes to rest after a release at `scroll`, the finger moving `vy` px/ms (down
 * positive, so the body scrolls up): back inside the ends if stretched, else a glide in the
 * flick's direction, stopped at the ends. Returns null when there is nothing to animate.
 */
export function settleScroll(scroll: number, vy: number, maxScroll: number): number | null {
  if (scroll < 0) return 0;
  if (scroll > maxScroll) return maxScroll;
  if (Math.abs(vy) < MOMENTUM_MIN_SPEED) return null;
  const to = Math.round(Math.min(maxScroll, Math.max(0, scroll - vy * MOMENTUM_GAIN)));
  return to === Math.round(scroll) ? null : to;
}

/** A pointer's speed: an exponential average over the moves so far (px/ms), so one jittery sample cannot fling. */
export function trackVelocity(prev: number, dPx: number, dMs: number): number {
  if (dMs <= 0) return prev;
  const v = dPx / dMs;
  return prev * 0.4 + v * 0.6;
}

/**
 * The hand's gestures, as pure functions. Every press on the hand becomes exactly one gesture;
 * HandView (phaser/table/Hand.ts) only feeds pointer positions and times in and acts on
 * the answer, so the arbitration is tested here without a renderer.
 *
 *   tap      released before it moved DRAG_THRESHOLD and before GESTURE.holdMs   toggles the card
 *   paint    moved, mostly sideways (or any way from an unselected card), first   swipe-to-select
 *   flick    moved, mostly upward, starting on a selected card                    drag the selection to play it
 *   hold     held still for GESTURE.holdMs                                        pick the card up to rearrange
 *
 * With Settings › Swipe to select off, a move that would paint is a rearrange drag instead; with
 * Flick to play off, a move that would flick paints. Positions are logical px.
 */
import type { Card } from "../engine/cards";
import type { FanLayout } from "./fanLayout";

/** A pointer that travels this far (logical px) is moving, not tapping or holding. */
export const DRAG_THRESHOLD = 6;
/** A selection dragged up at least this far (logical px) and released plays. */
export const FLICK_DISTANCE = 40;
/** ...or released this fast upward (logical px per ms) once it has moved FLICK_MIN. */
export const FLICK_SPEED = 0.6;
export const FLICK_MIN = 16;
/** How far the dragged selection may be pulled up (logical px): it never leaves the felt's lower half. */
export const FLICK_MAX = 140;

export type Gesture = "tap" | "paint" | "flick" | "hold";

export interface GestureOpts {
  swipe: boolean;
  flick: boolean;
  holdMs: number;
}

export interface Press {
  x: number;
  y: number;
  t: number;
  /** The pressed card was selected at the press. */
  onSelected: boolean;
}

/**
 * What a press has become by now, or null while it is still undecided. Call on every move and
 * once more at the hold time; the first non-null answer is final.
 */
export function resolveGesture(p: Press, x: number, y: number, t: number, o: GestureOpts): Gesture | null {
  // Undecided this long means it was held still (every earlier move fell inside DRAG_THRESHOLD,
  // or it would have been decided then): a hold, even if the first answer comes with a big move
  // because the hold timer's frame was late.
  if (t - p.t >= o.holdMs) return "hold";
  const dx = x - p.x;
  const dy = y - p.y;
  if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return null;
  const upward = -dy > Math.abs(dx);
  if (upward && p.onSelected && o.flick) return "flick";
  return o.swipe ? "paint" : "hold";
}

/** What a press that is released undecided was: a tap (a hold resolves before release). */
export const releasedAs = (decided: Gesture | null): Gesture => decided ?? "tap";

/**
 * The card index under fan-x `x`: each card owns its exposed strip (from its left edge to the
 * next card's), and the last card its whole width, so thin overlapped strips still register.
 * Clamped to the hand; -1 for an empty hand.
 */
export function cardIndexAt(x: number, f: FanLayout): number {
  const n = f.xs.length;
  if (n === 0) return -1;
  if (f.step <= 0) return 0;
  return Math.max(0, Math.min(n - 1, Math.floor((x - f.x0) / f.step)));
}

/**
 * The selection while a swipe paints: the press-time selection with every card from the first
 * card to the card under the finger (inclusive, either direction) set to `on`. Range-based, so
 * sliding back un-paints what the finger retreats from. Kept in press-time order, newly painted
 * cards appended in fan order.
 */
export function paintSelection(pressSel: readonly Card[], order: readonly Card[], from: number, to: number, on: boolean): Card[] {
  const lo = Math.max(0, Math.min(from, to));
  const hi = Math.min(order.length - 1, Math.max(from, to));
  const painted = order.slice(lo, hi + 1);
  if (!on) {
    const range = new Set(painted);
    return pressSel.filter((c) => !range.has(c));
  }
  const had = new Set(pressSel);
  return [...pressSel, ...painted.filter((c) => !had.has(c))];
}

/** A released flick plays when it was pulled far enough, or flung fast enough. dy < 0 is up; vy in px/ms. */
export const flickPlays = (dy: number, vy: number): boolean => -dy >= FLICK_DISTANCE || (-dy >= FLICK_MIN && -vy >= FLICK_SPEED);

/**
 * Show the one-time "swipe to pick several" coach mark: swiping is on, the player has Hints on
 * (the first-time default, so a newcomer sees it and a regular who turned hints off does not),
 * it has never been shown, and it is the player's turn with at least two cards to swipe across.
 */
export const shouldCoach = (o: { swipe: boolean; hints: boolean; swipeHintSeen: boolean }, yourTurn: boolean, cards: number): boolean =>
  o.swipe && o.hints && !o.swipeHintSeen && yourTurn && cards >= 2;

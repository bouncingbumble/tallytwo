/**
 * handGesture.ts: every press resolves to exactly one gesture, from synthetic pointer traces;
 * the fan hit-test gives each card its exposed strip; a swipe paints a range and un-paints on
 * the way back; a flick plays by distance or speed.
 */
import { expect, test } from "vitest";
import { GESTURE } from "../game/timing";
import { fanLayout } from "./fanLayout";
import { DRAG_THRESHOLD, FLICK_DISTANCE, type GestureOpts, type Press, cardIndexAt, flickPlays, paintSelection, releasedAs, resolveGesture, shouldCoach } from "./handGesture";

const ON: GestureOpts = { swipe: true, flick: true, holdMs: GESTURE.holdMs };
const press = (onSelected = false): Press => ({ x: 100, y: 50, t: 0, onSelected });

/** Feed a trace of [x, y, t] points; the first decided gesture wins, as in HandView. */
function run(p: Press, trace: [number, number, number][], o: GestureOpts = ON): string {
  for (const [x, y, t] of trace) {
    const g = resolveGesture(p, x, y, t, o);
    if (g) return g;
  }
  return releasedAs(null);
}

test("a quick press and release that never moved is a tap", () => {
  expect(run(press(), [[101, 51, 40], [102, 50, 90]])).toBe("tap");
  expect(run(press(), [[100 + DRAG_THRESHOLD - 1, 50, 100]])).toBe("tap");
});

test("held still for GESTURE.holdMs is a hold (pick up to rearrange), even if it moves afterwards", () => {
  expect(run(press(), [[101, 50, GESTURE.holdMs - 1], [101, 50, GESTURE.holdMs], [180, 50, 400]])).toBe("hold");
});

test("a hold whose timer frame came late is still a hold: the first answer is a big move after the hold time", () => {
  expect(run(press(), [[180, 50, GESTURE.holdMs + 170]])).toBe("hold");
  expect(run(press(true), [[100, -40, GESTURE.holdMs + 10]])).toBe("hold"); // not a flick either
});

test("moving sideways before the hold time paints", () => {
  expect(run(press(), [[103, 50, 30], [112, 51, 60]])).toBe("paint");
  expect(run(press(true), [[90, 52, 60]])).toBe("paint"); // from a selected card too: it deselects
});

test("moving up from a selected card flicks; from an unselected card it paints (a sloppy thumb never plays)", () => {
  expect(run(press(true), [[102, 40, 50]])).toBe("flick");
  expect(run(press(false), [[102, 40, 50]])).toBe("paint");
  expect(run(press(true), [[102, 62, 50]])).toBe("paint"); // down is never a flick
  expect(run(press(true), [[112, 42, 50]])).toBe("paint"); // more sideways than up
});

test("Swipe to select off: a move rearranges; Flick to play off: an upward move paints", () => {
  expect(run(press(), [[112, 50, 60]], { ...ON, swipe: false })).toBe("hold");
  expect(run(press(true), [[102, 40, 50]], { ...ON, flick: false })).toBe("paint");
  expect(run(press(true), [[102, 40, 50]], { ...ON, swipe: false })).toBe("flick");
});

test("cardIndexAt: each card owns its exposed strip, the last card its whole width, clamped", () => {
  const f = fanLayout(13, 504); // step 34, x0 0
  expect(f.step).toBe(34);
  expect(cardIndexAt(0, f)).toBe(0);
  expect(cardIndexAt(33, f)).toBe(0);
  expect(cardIndexAt(34, f)).toBe(1);
  expect(cardIndexAt(12 * 34 + 90, f)).toBe(12); // deep inside the last card's face
  expect(cardIndexAt(-50, f)).toBe(0);
  expect(cardIndexAt(9999, f)).toBe(12);
  expect(cardIndexAt(10, fanLayout(1, 504))).toBe(0);
  expect(cardIndexAt(10, fanLayout(0, 504))).toBe(-1);
});

test("paintSelection: a range set on or off, either direction, sliding back un-paints", () => {
  const order = [10, 11, 12, 13, 14, 15];
  expect(paintSelection([], order, 1, 3, true)).toEqual([11, 12, 13]);
  expect(paintSelection([], order, 3, 1, true)).toEqual([11, 12, 13]); // right to left
  expect(paintSelection([], order, 1, 2, true)).toEqual([11, 12]); // the finger came back one card
  expect(paintSelection([15], order, 0, 1, true)).toEqual([15, 10, 11]); // keeps what was selected
  expect(paintSelection([11, 12, 15], order, 1, 2, false)).toEqual([15]); // a swipe from a selected card deselects
  expect(paintSelection([11, 12], order, 1, 1, false)).toEqual([12]);
  expect(paintSelection([], order, 4, 99, true)).toEqual([14, 15]); // clamped to the hand
});

test("flickPlays: far enough, or fast enough past a minimum; never downward", () => {
  expect(flickPlays(-FLICK_DISTANCE, 0)).toBe(true);
  expect(flickPlays(-FLICK_DISTANCE + 1, 0)).toBe(false);
  expect(flickPlays(-20, -1)).toBe(true);
  expect(flickPlays(-10, -2)).toBe(false);
  expect(flickPlays(30, -2)).toBe(false);
});

test("shouldCoach: swipe on, hints on, never seen, your turn, two cards or more", () => {
  const o = { swipe: true, hints: true, swipeHintSeen: false };
  expect(shouldCoach(o, true, 13)).toBe(true);
  expect(shouldCoach({ ...o, swipe: false }, true, 13)).toBe(false);
  expect(shouldCoach({ ...o, hints: false }, true, 13)).toBe(false);
  expect(shouldCoach({ ...o, swipeHintSeen: true }, true, 13)).toBe(false);
  expect(shouldCoach(o, false, 13)).toBe(false);
  expect(shouldCoach(o, true, 1)).toBe(false);
});

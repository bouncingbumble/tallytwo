import { describe, expect, test } from "vitest";
import { DISMISS_MIN, DISMISS_PX, DISMISS_SPEED, MOMENTUM_GAIN, RUBBER_MAX, dragTo, rubberBand, settleScroll, shouldDismiss, trackVelocity } from "./sheetDrag";

describe("rubberBand", () => {
  test("nothing inside the ends, then a stretch that grows ever slower and never reaches RUBBER_MAX", () => {
    expect(rubberBand(0)).toBe(0);
    expect(rubberBand(-10)).toBe(0);
    const a = rubberBand(20);
    const b = rubberBand(40);
    const c = rubberBand(4000);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(20);
    expect(b - a).toBeLessThan(a);
    expect(c).toBeLessThan(RUBBER_MAX);
    expect(c).toBeGreaterThan(RUBBER_MAX * 0.95);
  });
});

describe("dragTo", () => {
  test("inside the body the scroll follows the finger 1:1", () => {
    expect(dragTo(100, 30, 400)).toEqual({ scroll: 70, pull: 0 });
    expect(dragTo(100, -30, 400)).toEqual({ scroll: 130, pull: 0 });
  });
  test("pulled down past the top, the sheet itself follows the finger", () => {
    expect(dragTo(20, 50, 400)).toEqual({ scroll: 0, pull: 30 });
    // a sheet with nothing to scroll is pulled straight away
    expect(dragTo(0, 80, 0)).toEqual({ scroll: 0, pull: 80 });
  });
  test("pushed up past the bottom, the body stretches", () => {
    const s = dragTo(390, -50, 400);
    expect(s.pull).toBe(0);
    expect(s.scroll).toBeGreaterThan(400);
    expect(s.scroll).toBeLessThan(440);
  });
});

describe("shouldDismiss", () => {
  test("far enough, or a downward flick once it has moved a little", () => {
    expect(shouldDismiss(DISMISS_PX, 0)).toBe(true);
    expect(shouldDismiss(DISMISS_PX - 1, 0)).toBe(false);
    expect(shouldDismiss(DISMISS_MIN, DISMISS_SPEED)).toBe(true);
    expect(shouldDismiss(DISMISS_MIN - 1, 5)).toBe(false);
    // flicked back up: stays
    expect(shouldDismiss(DISMISS_PX - 1, -1)).toBe(false);
  });
});

describe("settleScroll", () => {
  test("a stretched body snaps back to its end", () => {
    expect(settleScroll(-12, 0, 300)).toBe(0);
    expect(settleScroll(330, 2, 300)).toBe(300);
  });
  test("a slow release stays put; a flick glides the way the content was going, and stops at the ends", () => {
    expect(settleScroll(100, 0.05, 300)).toBeNull();
    // finger moving up (vy < 0): the body scrolls on down the content
    expect(settleScroll(100, -0.5, 300)).toBe(100 + 0.5 * MOMENTUM_GAIN);
    expect(settleScroll(100, -5, 300)).toBe(300);
    expect(settleScroll(100, 5, 300)).toBe(0);
    // already at the end it is flicked towards: nothing to do
    expect(settleScroll(300, -1, 300)).toBeNull();
  });
});

test("trackVelocity smooths samples and ignores a zero-time one", () => {
  const v = trackVelocity(0, 10, 10);
  expect(v).toBeCloseTo(0.6);
  expect(trackVelocity(v, 5, 0)).toBe(v);
  expect(trackVelocity(1, 10, 10)).toBeCloseTo(1);
});

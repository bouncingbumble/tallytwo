/** The logical canvas, the scale that fits it to a viewport, and the fan constants. */
import { describe, expect, test } from "vitest";
import { CARD_ART_H, CARD_ART_W, LOGICAL_H, PLAY_CARD_H, PLAY_CARD_W, PLAY_SLACK_PT, fanSpanArt, fanStepArt, fitScale } from "./scale";
import { CARD_H, CARD_W } from "./fanLayout";

describe("fitScale", () => {
  test("k is the viewport height over the 440-px canvas; the width follows", () => {
    expect(LOGICAL_H).toBe(440);
    const se = fitScale(667, 375); // iPhone SE sideways: everything shrinks
    expect(se.k).toBeCloseTo(375 / 440, 10);
    expect(se.logicalWidth).toBeCloseTo(667 / se.k, 10);
    expect(se.logicalWidth).toBeCloseTo(782.6, 1);
    const i15 = fitScale(852, 393);
    expect(i15.logicalWidth).toBeCloseTo(953.9, 1);
  });
  test("the scaled box is exactly the viewport, never letterboxed or capped", () => {
    for (const [w, h] of [
      [667, 375],
      [852, 393],
      [956, 440],
    ]) {
      const { k, logicalWidth } = fitScale(w, h);
      expect(LOGICAL_H * k).toBeCloseTo(h, 9);
      expect(logicalWidth * k).toBeCloseTo(w, 9);
    }
    expect(fitScale(956, 440)).toEqual({ k: 1, logicalWidth: 956 }); // the largest iPhone sideways is 1:1
    expect(fitScale(0, 0).k).toBe(1); // a hidden window never divides by zero
  });
});

describe("the card constants", () => {
  test("the hand's cards are the art size, the plays three quarters of it", () => {
    expect([CARD_ART_W, CARD_ART_H]).toEqual([CARD_W, CARD_H]);
    expect([PLAY_CARD_W, PLAY_CARD_H]).toEqual([72, 96]);
    expect(PLAY_SLACK_PT).toBe(2);
  });
  test("the fan constants agree", () => {
    expect(fanStepArt(96)).toBe(22);
    expect(fanSpanArt(96)).toBe(360);
    expect(fanSpanArt(48)).toBe(180);
  });
});

/** The logical canvas, the scale that fits it to a viewport, and the fan constants. */
import { describe, expect, test } from "vitest";
import { CARD_ART_H, CARD_ART_W, LOGICAL_H, PLAY_CARD_H, PLAY_CARD_W, PLAY_SLACK_PT, fanSpanArt, fanStepArt, fitScale } from "./scale";
import { CARD_H, CARD_W, fanLayout } from "./fanLayout";

describe("fitScale", () => {
  test("k is the viewport height over the 440-px canvas; the width follows", () => {
    expect(LOGICAL_H).toBe(440);
    const se = fitScale(667, 375); // iPhone SE sideways: everything shrinks
    expect(se.k).toBeCloseTo(375 / 440, 10);
    expect(se.logicalWidth).toBeCloseTo(667 / se.k, 10);
    expect(se.logicalWidth).toBeCloseTo(782.6, 1);
    const i15 = fitScale(852, 393);
    expect(i15.logicalWidth).toBeCloseTo(953.9, 1);
    const desktop = fitScale(1280, 800); // desktop Chrome: everything grows, the canvas gets narrower
    expect(desktop.k).toBeCloseTo(800 / 440, 10);
    expect(desktop.logicalWidth).toBeCloseTo(704, 0);
  });
  test("the scaled box is exactly the viewport, never letterboxed or capped", () => {
    for (const [w, h] of [
      [667, 375],
      [852, 393],
      [956, 440],
      [1280, 800],
      [1920, 1080],
    ]) {
      const { k, logicalWidth } = fitScale(w, h);
      expect(LOGICAL_H * k).toBeCloseTo(h, 9);
      expect(logicalWidth * k).toBeCloseTo(w, 9);
    }
    expect(fitScale(956, 440)).toEqual({ k: 1, logicalWidth: 956 }); // the largest iPhone sideways is 1:1
    expect(fitScale(0, 0).k).toBe(1); // a hidden window never divides by zero
  });
  test("a 13-card fan fits every target with a readable corner index", () => {
    // table.css: 6-px padding each side, the 124-px side column and its 6-px gap, 8 + 8 of hand gutter
    const availW = (viewportW: number, viewportH: number) => fitScale(viewportW, viewportH).logicalWidth - 12 - 130 - 16;
    expect(fanLayout(13, Math.floor(availW(667, 375))).step).toBe(44);
    expect(fanLayout(13, Math.floor(availW(852, 393))).step).toBe(58);
    expect(fanLayout(13, Math.floor(availW(1280, 800))).step).toBe(37);
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

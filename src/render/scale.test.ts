/** The iPhone scale matrix (the port of verify-scale.mjs) and the scale helpers. */
import { describe, expect, test } from "vitest";
import { DEVICES, cardScale, fanSpanArt, fanStepArt, fixedWidthScale, landsOnWholeDevicePixels, reportFor, scaleMatrix, smallCardScale } from "./scale";
import { FAN_STEP } from "./fanLayout";

describe("scale matrix", () => {
  test("every iPhone: whole device pixels, a 13-card fan that fits, a readable corner index", () => {
    expect(scaleMatrix()).toHaveLength(7);
    for (const d of DEVICES) {
      const r = reportFor(d);
      expect(r.wholePixels, d.name).toBe(true);
      expect(r.fits, d.name).toBe(true);
      expect(r.legible, d.name).toBe(true);
      expect(r.cardPt).toBe(96);
      expect(r.S).toBe(d.dpr);
      expect(r.step).toBe(d.widthPt === 375 ? 21 : 22);
      expect(r.span).toBe(d.widthPt === 375 ? 348 : 360);
    }
  });
  test("the fan constants agree", () => {
    expect(fanStepArt(96)).toBe(22);
    expect(fanStepArt(96)).toBe(FAN_STEP);
    expect(fanSpanArt(96)).toBe(360);
    expect(fanSpanArt(48)).toBe(180);
  });
  test("card scales per dpr", () => {
    expect(cardScale(2)).toMatchObject({ S: 2, pointW: 96, pointH: 128, deviceW: 192, deviceH: 256 });
    expect(cardScale(3)).toMatchObject({ S: 3, pointW: 96, pointH: 128, deviceW: 288, deviceH: 384 });
    expect(smallCardScale(2).pointW).toBe(48);
    expect(smallCardScale(3).pointW).toBe(64);
    expect(smallCardScale(1).pointW).toBe(96);
  });
  test("fixedWidthScale and whole-pixel checks", () => {
    expect(fixedWidthScale(375, 96, 2)).toBe(7);
    expect(fixedWidthScale(100, 96, 1)).toBe(1);
    expect(fixedWidthScale(50, 96, 1)).toBe(0);
    expect(fixedWidthScale(360, 96, 3)).toBe(11);
    expect(landsOnWholeDevicePixels(96, 3)).toBe(true);
    expect(landsOnWholeDevicePixels(32.5, 2)).toBe(true);
    expect(landsOnWholeDevicePixels(33.3, 3)).toBe(false);
  });
});

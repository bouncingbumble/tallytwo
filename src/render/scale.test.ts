/** The iPhone matrix, held sideways, and the scale helpers. */
import { describe, expect, test } from "vitest";
import { DEVICES, FAN_STEP_MAX_ART, cardScale, fanSpanArt, fanStepArt, fixedWidthScale, landsOnWholeDevicePixels, reportFor, scaleMatrix, smallCardScale } from "./scale";
import { FAN_STEP_MAX, fanLayout } from "./fanLayout";

describe("scale matrix", () => {
  test("every iPhone sideways: whole device pixels, a 13-card fan that fits, a readable corner index, a column that fits", () => {
    expect(scaleMatrix()).toHaveLength(7);
    for (const d of DEVICES) {
      const r = reportFor(d);
      expect(r.wholePixels, d.name).toBe(true);
      expect(r.fits, d.name).toBe(true);
      expect(r.legible, d.name).toBe(true);
      expect(r.fitsHeight, `${d.name}: needs ${r.neededPt} of ${r.tallPt}`).toBe(true);
      expect(r.cardPt).toBe(96);
      expect(r.S).toBe(d.dpr);
      expect(r.step).toBe(fanLayout(13, r.availPt).step); // the matrix and the layout agree
      expect(r.step).toBeGreaterThanOrEqual(34);
    }
  });
  test("the worst cases by name", () => {
    const se = reportFor(DEVICES[0]);
    expect(se).toMatchObject({ widePt: 667, tallPt: 375, availPt: 509, step: 34, span: 504, neededPt: 310, playsPt: 131 });
    const mini = reportFor(DEVICES[1]); // dpr 3: 64x85.33 plays on a 375-px-tall screen
    expect(mini.tallPt).toBe(375);
    expect(mini.neededPt).toBeCloseTo(331.33, 1);
    expect(mini.step).toBe(39);
    const i15 = reportFor(DEVICES[2]);
    expect(i15.availPt).toBe(852 - 2 * 59 - 130 - 16);
    expect(i15.step).toBe(41);
  });
  test("the three staggered play rows: apart in a 440-px frame at dpr 2, overlapping on the phones", () => {
    const frame = reportFor({ name: "desktop frame", widthPt: 440, heightPt: 956, dpr: 2, notchPt: 0 });
    expect(frame).toMatchObject({ playsPt: 196, playRowOverlapPt: 1, step: 58 }); // rows at 0, 65, 130 of 66
    const by = Object.fromEntries(DEVICES.map((d) => [d.name, reportFor(d).playRowOverlapPt]));
    expect(by["iPhone SE (3rd gen)"]).toBe(66 - 32); // rows at 0, 32, 65 of 66
    expect(by["iPhone 13 mini"]).toBeCloseTo(87.33 - 21, 1);
    expect(by["iPhone 15"]).toBeCloseTo(87.33 - 30, 1);
    expect(by["iPhone 16 Pro Max"]).toBeCloseTo(87.33 - 54, 1);
    for (const d of DEVICES) expect(reportFor(d).playRowOverlapPt).toBeLessThan(smallCardScale(d.dpr).pointH); // never a full card
  });
  test("the fan constants agree", () => {
    expect(fanStepArt(96)).toBe(22);
    expect(fanSpanArt(96)).toBe(360);
    expect(fanSpanArt(48)).toBe(180);
    expect(FAN_STEP_MAX_ART).toBe(FAN_STEP_MAX);
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

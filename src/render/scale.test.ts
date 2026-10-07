/** The iPhone matrix, held sideways, and the scale helpers. */
import { describe, expect, test } from "vitest";
import { DEVICES, FAN_STEP_MAX_ART, PLAY_CARD_H, PLAY_CARD_W, cardScale, fanSpanArt, fanStepArt, fixedWidthScale, landsOnWholeDevicePixels, reportFor, scaleMatrix } from "./scale";
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
    expect(se).toMatchObject({ widePt: 667, tallPt: 375, availPt: 509, step: 34, span: 504, neededPt: 326, playsPt: 147 });
    const mini = reportFor(DEVICES[1]); // the same budget: the trick's cards are a fixed 72x96 on every dpr
    expect(mini.tallPt).toBe(375);
    expect(mini.neededPt).toBe(326);
    expect(mini.step).toBe(39);
    const i15 = reportFor(DEVICES[2]);
    expect(i15.availPt).toBe(852 - 2 * 59 - 130 - 16);
    expect(i15.step).toBe(41);
  });
  test("the three staggered play rows overlap: by 41 px in a 440-px frame, more on the short phones", () => {
    expect([PLAY_CARD_W, PLAY_CARD_H]).toEqual([72, 96]);
    const frame = reportFor({ name: "desktop frame", widthPt: 440, heightPt: 956, dpr: 2, notchPt: 0 });
    expect(frame).toMatchObject({ playsPt: 212, playRowOverlapPt: 98 - 57, step: 58 }); // rows at 0, 57, 114 of 98
    const by = Object.fromEntries(DEVICES.map((d) => [d.name, reportFor(d).playRowOverlapPt]));
    expect(by["iPhone SE (3rd gen)"]).toBe(98 - 24); // rows at 0, 24, 49 of 98
    expect(by["iPhone 13 mini"]).toBe(98 - 24);
    expect(by["iPhone 15"]).toBe(98 - 33);
    expect(by["iPhone 16 Pro Max"]).toBe(98 - 57);
    for (const d of DEVICES) expect(reportFor(d).playRowOverlapPt).toBeLessThan(PLAY_CARD_H); // never a full card
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

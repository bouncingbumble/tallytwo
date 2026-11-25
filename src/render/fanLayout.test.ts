/** Integer fan positions: step 64 when the strip allows, shrinking to fit, never wider than the strip. */
import { describe, expect, test } from "vitest";
import { FAN_STEP_MAX, PILE_STEP, SELECT_LIFT, fanLayout } from "./fanLayout";
import { cardIndexAt } from "./handGesture";
import { CORNER_INDEX_ART, fitScale } from "./scale";
import { tableLayout } from "./tableLayout";

describe("fanLayout", () => {
  test("13 cards on a narrow strip overlap to fit and centre", () => {
    expect(fanLayout(13, 509)).toMatchObject({ step: 34, span: 504, x0: 2 });
    expect(fanLayout(13, 588)).toMatchObject({ step: 41, span: 588, x0: 0 });
    const se = fanLayout(13, 509);
    expect(se.xs).toEqual(Array.from({ length: 13 }, (_, i) => 2 + i * 34));
  });
  test("a wide strip spreads the fan to FAN_STEP_MAX and centres it", () => {
    const wide = fanLayout(13, 1000);
    expect(wide.step).toBe(FAN_STEP_MAX);
    expect(wide.span).toBe(96 + 12 * 64);
    expect(wide.x0).toBe(Math.floor((1000 - wide.span) / 2));
    expect(fanLayout(3, 360).step).toBe(FAN_STEP_MAX);
  });
  test("edge cases", () => {
    expect(fanLayout(1, 360)).toMatchObject({ step: 0, span: 96, x0: 132, xs: [132] });
    expect(fanLayout(0, 360).xs).toEqual([]);
    expect(fanLayout(2, 100).step).toBe(4);
    expect(fanLayout(13, 360).step).toBe(22); // the narrowest readable fan
  });
  test("every x is a non-negative integer and the span fits, across hand sizes and widths", () => {
    for (const availW of [320, 359, 360, 504, 576, 656, 864, 1200]) {
      for (let n = 1; n <= 13; n++) {
        const f = fanLayout(n, availW);
        expect(f.span).toBeLessThanOrEqual(availW);
        expect(f.xs).toHaveLength(n);
        for (const x of f.xs) {
          expect(Number.isInteger(x)).toBe(true);
          expect(x).toBeGreaterThanOrEqual(0);
          expect(x + 96).toBeLessThanOrEqual(availW);
        }
      }
    }
  });
  test("constants", () => {
    expect(PILE_STEP).toBe(30);
    expect(SELECT_LIFT).toBe(26);
    expect(FAN_STEP_MAX).toBe(64);
  });
});

describe("the index corners stay exposed on every device", () => {
  // the phones held sideways (the SE with Safari's toolbars too)
  const DEVICES: readonly [string, number, number][] = [
    ["iPhone SE", 667, 375],
    ["iPhone SE, toolbars showing", 667, 331],
    ["iPhone 15", 852, 393],
  ];
  test.each(DEVICES)("%s: a 13-card fan shows at least a corner index of every card", (_name, vw, vh) => {
    const { logicalWidth } = fitScale(vw, vh);
    const t = tableLayout({ width: logicalWidth, clear: 0, buttons: 1 });
    const f = fanLayout(13, t.fan.w);
    expect(f.step).toBeGreaterThanOrEqual(CORNER_INDEX_ART);
    expect(f.x0 + f.span).toBeLessThanOrEqual(t.fan.w);
    // and the card under the finger is found from its exposed strip (render/handGesture.ts cardIndexAt)
    for (let i = 0; i < 13; i++) expect(cardIndexAt(f.xs[i] + 1, f)).toBe(i);
  });
});

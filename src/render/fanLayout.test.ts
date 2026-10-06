/** Integer fan positions: step 64 when the strip allows, shrinking to fit, never wider than the strip. */
import { describe, expect, test } from "vitest";
import { FAN_STEP_MAX, PILE_STEP, SELECT_LIFT, fanLayout } from "./fanLayout";

describe("fanLayout", () => {
  test("13 cards on the phones held sideways", () => {
    expect(fanLayout(13, 509)).toMatchObject({ step: 34, span: 504, x0: 2 }); // iPhone SE
    expect(fanLayout(13, 588)).toMatchObject({ step: 41, span: 588, x0: 0 }); // iPhone 15
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
    expect(PILE_STEP).toBe(40);
    expect(SELECT_LIFT).toBe(14);
    expect(FAN_STEP_MAX).toBe(64);
  });
});

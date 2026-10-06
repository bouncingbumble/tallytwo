/** Integer fan positions: step 22 at 360, 21 at 359, never wider than the strip. */
import { describe, expect, test } from "vitest";
import { FAN_STEP, PILE_STEP, SELECT_LIFT, fanLayout } from "./fanLayout";

describe("fanLayout", () => {
  test("13 cards at 360 and 359", () => {
    const a = fanLayout(13, 360);
    expect(a).toMatchObject({ step: 22, span: 360, x0: 0 });
    expect(a.xs).toEqual(Array.from({ length: 13 }, (_, i) => i * 22));
    const b = fanLayout(13, 359);
    expect(b).toMatchObject({ step: 21, span: 348, x0: 5 });
    expect(b.xs[12]).toBe(5 + 12 * 21);
  });
  test("wider phones do not widen the fan past FAN_STEP", () => {
    expect(fanLayout(13, 377).step).toBe(FAN_STEP);
    expect(fanLayout(13, 424).span).toBe(360);
    expect(fanLayout(3, 360).step).toBe(FAN_STEP);
  });
  test("edge cases", () => {
    expect(fanLayout(1, 360)).toMatchObject({ step: 0, span: 96, x0: 132, xs: [132] });
    expect(fanLayout(0, 360).xs).toEqual([]);
    expect(fanLayout(2, 100).step).toBe(4);
  });
  test("every x is a non-negative integer and the span fits, across hand sizes and widths", () => {
    for (const availW of [320, 343, 359, 360, 375, 393, 430, 440]) {
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
    expect(FAN_STEP).toBe(22);
  });
});

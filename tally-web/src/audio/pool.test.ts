/**
 * pickVariant: a random index that is never the last one (WEB-PLAN §3.7, P:358-360).
 */
import { expect, test } from "vitest";
import { pickVariant } from "./pool";

test.each([2, 3, 9])("1000 draws from a pool of %i never return last", (n) => {
  let last = -1;
  for (let k = 0; k < 1000; k++) {
    const i = pickVariant(n, last, Math.random);
    expect(i).not.toBe(last);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(i).toBeLessThan(n);
    last = i;
  }
});

test("a pool of one always returns 0", () => {
  for (let k = 0; k < 100; k++) expect(pickVariant(1, 0, Math.random)).toBe(0);
  expect(pickVariant(1, -1, Math.random)).toBe(0);
});

test("an empty pool throws (play() guards it, never calls this)", () => {
  expect(() => pickVariant(0, -1, Math.random)).toThrow();
});

test("a draw at the top edge stays in range and the bump wraps", () => {
  expect(pickVariant(3, -1, () => 0.999999)).toBe(2);
  expect(pickVariant(3, 2, () => 0.999999)).toBe(0);
  expect(pickVariant(3, 1, () => 1)).toBe(2);
  expect(pickVariant(3, 2, () => 1)).toBe(0);
});

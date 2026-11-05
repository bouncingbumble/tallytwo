/**
 * timing.ts: the prototype's numbers (the original build plan §3.5 table), the single Game
 * speed setting.
 */
import { expect, test } from "vitest";
import {
  BARK_CHANCE,
  BARK_MS,
  DEAL_STAGGER_MS,
  DOORS_MS,
  FAST_SLOWDOWN,
  FAST_SPEED,
  FINAL_ROUND_MS,
  FIRST_STEP_MS,
  GAME_SPEEDS,
  ROUND_OVER_MS,
  SLAP_STAGGER_MS,
  SPEED,
  THINK,
  paced,
  thinkMs,
} from "./timing";

test("thinkMs spans each tier's range: r=0 is the floor, r=1 the ceiling", () => {
  expect(thinkMs("slow", 0)).toBe(650);
  expect(thinkMs("slow", 1)).toBe(1250);
  expect(thinkMs("normal", 0.5)).toBe(950);
  expect(thinkMs("fast", 0)).toBe(280);
  expect(thinkMs("fast", 1)).toBe(520);
});

test("thinkMs stays inside the range for any r in [0, 1)", () => {
  for (const speed of GAME_SPEEDS) {
    const [lo, hi] = SPEED[speed].think;
    for (let i = 0; i < 100; i++) {
      const ms = thinkMs(speed, i / 100);
      expect(ms).toBeGreaterThanOrEqual(lo);
      expect(ms).toBeLessThan(hi);
    }
  }
});

test("the constants are the prototype's numbers", () => {
  expect(THINK).toEqual({ normal: [650, 1250], fast: [280, 520] });
  expect(ROUND_OVER_MS).toEqual({ ai: 900, human: 800 });
  expect(FIRST_STEP_MS).toBe(700);
  expect(DOORS_MS).toBe(620);
  expect(DEAL_STAGGER_MS).toBe(32);
  expect(SLAP_STAGGER_MS).toBe(40);
  expect(BARK_MS).toBe(2000);
  expect(BARK_CHANCE).toBe(0.55);
  expect(FINAL_ROUND_MS).toBeGreaterThan(0);
});

test("one Game speed setting: slow is the old 1x table, normal 2x, fast the old fastest table at 30% less speed", () => {
  expect(GAME_SPEEDS).toEqual(["slow", "normal", "fast"]);
  expect(paced(FIRST_STEP_MS, "slow")).toBe(2800); // the old default (Normal pace, 1x)
  expect(paced(FIRST_STEP_MS, "normal")).toBe(1400);
  expect(paced(thinkMs("slow", 0), "slow")).toBe(2600);
  expect(FAST_SPEED).toBe(0.7);
  expect(FAST_SLOWDOWN).toBe(1.5);
  // the old fastest table was Fast pace at 4x: prototype ms × 1. Fast runs at 70% of that speed, then 1.5x slower again.
  expect(paced(thinkMs("fast", 0), "fast")).toBe(600);
  expect(paced(thinkMs("fast", 1), "fast")).toBe(1114);
  expect(paced(FIRST_STEP_MS, "fast")).toBe(1500);
  expect(paced(0, "slow")).toBe(0);
  // strictly faster tier by tier
  for (const ms of [FIRST_STEP_MS, ROUND_OVER_MS.ai, thinkMs("slow", 0.5)]) {
    expect(paced(ms, "slow")).toBeGreaterThan(paced(ms, "normal"));
  }
  expect(paced(thinkMs("normal", 0.5), "normal")).toBeGreaterThan(paced(thinkMs("fast", 0.5), "fast"));
});

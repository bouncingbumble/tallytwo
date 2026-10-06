/**
 * timing.ts: the prototype's numbers (WEB-PLAN §3.5 table), the think-delay ranges and the
 * reduce-motion cap.
 */
import { expect, test } from "vitest";
import {
  AUTO_PASS_MS,
  BARK_CHANCE,
  BARK_MS,
  DEAL_STAGGER_MS,
  DOORS_MS,
  FIRST_STEP_MS,
  NUDGE_MS,
  REDUCED_MOTION_MAX_MS,
  ROUND_OVER_MS,
  SLAP_STAGGER_MS,
  SPEED,
  clampMotion,
  thinkMs,
} from "./timing";

test("thinkMs spans each pace's range: r=0 is the floor, r=1 the ceiling", () => {
  expect(thinkMs("fast", 0)).toBe(280);
  expect(thinkMs("fast", 1)).toBe(520);
  expect(thinkMs("normal", 0)).toBe(650);
  expect(thinkMs("normal", 1)).toBe(1250);
  expect(thinkMs("slow", 0)).toBe(1100);
  expect(thinkMs("slow", 1)).toBe(1900);
  expect(thinkMs("normal", 0.5)).toBe(950);
});

test("thinkMs stays inside the range for any r in [0, 1)", () => {
  for (const speed of ["fast", "normal", "slow"] as const) {
    const [lo, hi] = SPEED[speed];
    for (let i = 0; i < 100; i++) {
      const ms = thinkMs(speed, i / 100);
      expect(ms).toBeGreaterThanOrEqual(lo);
      expect(ms).toBeLessThan(hi);
    }
  }
});

test("clampMotion caps at 260 ms with reduce motion on and is the identity otherwise", () => {
  expect(REDUCED_MOTION_MAX_MS).toBe(260);
  expect(clampMotion(1900, true)).toBe(260);
  expect(clampMotion(260, true)).toBe(260);
  expect(clampMotion(100, true)).toBe(100);
  expect(clampMotion(1900, false)).toBe(1900);
  expect(clampMotion(0, true)).toBe(0);
});

test("the constants are the prototype's numbers", () => {
  expect(SPEED).toEqual({ fast: [280, 520], normal: [650, 1250], slow: [1100, 1900] });
  expect(AUTO_PASS_MS).toBe(850);
  expect(ROUND_OVER_MS).toEqual({ ai: 900, human: 800 });
  expect(FIRST_STEP_MS).toBe(700);
  expect(DOORS_MS).toEqual({ normal: 620, reduced: 60 });
  expect(NUDGE_MS).toBe(170);
  expect(DEAL_STAGGER_MS).toBe(32);
  expect(SLAP_STAGGER_MS).toBe(40);
  expect(BARK_MS).toBe(2000);
  expect(BARK_CHANCE).toBe(0.55);
});

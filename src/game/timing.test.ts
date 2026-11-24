/**
 * timing.ts: the prototype's numbers (the original build plan §3.5 table), the single Game
 * speed setting.
 */
import { expect, test } from "vitest";
import {
  BARK_CHANCE,
  BARK_MS,
  DEAL,
  DOORS_MS,
  FAST_SLOWDOWN,
  FAST_SPEED,
  FAST_THINK_SCALE,
  FINAL_ROUND_MS,
  FIRST_STEP_MS,
  GAME_SPEEDS,
  ROUND_OVER_MS,
  PLAY_FLY_MS,
  PLAY_FLY_STAGGER_MS,
  SPEED,
  THINK,
  dealTotalMs,
  paced,
  pacedThink,
  playLandMs,
  thinkMs,
} from "./timing";

test("the deal is over before the earliest first AI move at every speed, and within 1.6 s", () => {
  expect(dealTotalMs()).toBeLessThanOrEqual(1600);
  expect(dealTotalMs()).toBe(51 * DEAL.staggerMs + DEAL.flyMs + 12 * DEAL.flipStaggerMs + DEAL.flipMs);
  for (const speed of GAME_SPEEDS) expect(dealTotalMs()).toBeLessThan(paced(FIRST_STEP_MS, speed) + pacedThink(speed, 0));
});

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
  expect(PLAY_FLY_MS).toBe(700); // the prototype's 280-ms slap, now a flight from the portrait and a spread
  expect(PLAY_FLY_STAGGER_MS).toBe(30);
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
  expect(paced(FIRST_STEP_MS, "fast")).toBe(1500);
  // the AI's think time is scaled on its own: x2.5 on Fast, the tier's scale elsewhere
  expect(FAST_THINK_SCALE).toBe(2.5);
  expect(pacedThink("fast", 0)).toBe(700);
  expect(pacedThink("fast", 1)).toBe(1300);
  expect(pacedThink("slow", 0)).toBe(2600);
  expect(pacedThink("normal", 1)).toBe(2500);
  expect(paced(0, "slow")).toBe(0);
  // strictly faster tier by tier
  for (const ms of [FIRST_STEP_MS, ROUND_OVER_MS.ai, thinkMs("slow", 0.5)]) {
    expect(paced(ms, "slow")).toBeGreaterThan(paced(ms, "normal"));
  }
  expect(pacedThink("normal", 0.5)).toBeGreaterThan(pacedThink("fast", 0.5));
});

test("a play lands when its last card has spread: the flight plus one stagger per extra card", () => {
  expect(playLandMs(1)).toBe(PLAY_FLY_MS);
  expect(playLandMs(5)).toBe(PLAY_FLY_MS + 4 * PLAY_FLY_STAGGER_MS);
  expect(playLandMs(0)).toBe(PLAY_FLY_MS);
});

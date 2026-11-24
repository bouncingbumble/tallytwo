/** timing.ts: the Game speed tiers, the deal's length, and the motion bands. */
import { expect, test } from "vitest";
import {
  DEAL,
  DOORS_MS,
  FAST_SLOWDOWN,
  FAST_SPEED,
  FAST_THINK_SCALE,
  FIRST_STEP_MS,
  GAME_SPEEDS,
  MOTION,
  ROUND_OVER_MS,
  SHEET,
  TITLE,
  TRANSITION,
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

test("Game speed: slow ×4, normal ×2, fast its own think range and wait scale", () => {
  expect(GAME_SPEEDS).toEqual(["slow", "normal", "fast"]);
  expect(paced(FIRST_STEP_MS, "slow")).toBe(2800);
  expect(paced(FIRST_STEP_MS, "normal")).toBe(1400);
  expect(paced(thinkMs("slow", 0), "slow")).toBe(2600);
  expect(paced(FIRST_STEP_MS, "fast")).toBe(Math.round((FIRST_STEP_MS * FAST_SLOWDOWN) / FAST_SPEED));
  // the AI's think time is scaled on its own: FAST_THINK_SCALE on Fast, the tier's scale elsewhere
  expect(pacedThink("fast", 0)).toBe(THINK.fast[0] * FAST_THINK_SCALE);
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

/* ---- presentation motion ---- */

test("MOTION: each token sits in its band, and the bands are in order", () => {
  // feedback 80-150 ms (a finger's answer), UI transitions 150-350 ms, emphasis 380-700 ms
  const feedback = [MOTION.press, MOTION.micro, MOTION.knob];
  const ui = [MOTION.slide, MOTION.uiOut, MOTION.uiIn, MOTION.shake, MOTION.trickHold];
  const emphasis = [MOTION.dealIn, MOTION.trickSweep, MOTION.emphasis, MOTION.doorsGlow, MOTION.settle];
  const within = (ds: readonly number[], lo: number, hi: number) => {
    for (const d of ds) {
      expect(d).toBeGreaterThanOrEqual(lo);
      expect(d).toBeLessThanOrEqual(hi);
    }
  };
  within(feedback, 80, 150);
  within(ui, 150, 350);
  within(emphasis, 380, 700);
  expect(Math.max(...feedback)).toBeLessThanOrEqual(Math.min(...ui));
  expect(Math.max(...ui)).toBeLessThan(Math.min(...emphasis));
  // within a family: a press is quicker than a pop, leaving quicker than arriving
  expect(MOTION.press).toBeLessThan(MOTION.micro);
  expect(MOTION.uiOut).toBeLessThan(MOTION.uiIn);
  expect(MOTION.uiIn).toBeLessThan(MOTION.emphasis);
  // the long runs are how long a thing stays on screen, not a move: they outlast every move
  expect(MOTION.bark).toBeGreaterThan(MOTION.settle);
  expect(MOTION.announce).toBeGreaterThan(MOTION.bark);
  expect(MOTION.pulse).toBeGreaterThan(MOTION.emphasis);
});

test("screens and sheets move inside the UI band; the title's idle life never flashes", () => {
  for (const d of [TRANSITION.throughDoorsMs, TRANSITION.fadeUpMs, SHEET.springBackMs]) {
    expect(d).toBeGreaterThanOrEqual(150);
    expect(d).toBeLessThanOrEqual(350);
  }
  // a flick's glide is emphasis-long: it is decelerating, not arriving
  expect(SHEET.momentumMs).toBeLessThanOrEqual(700);
  // under 3 flashes a second: the flicker's quickest step is at least 1/2 s apart
  expect(TITLE.flickerMs[0]).toBeGreaterThanOrEqual(500);
  expect(TITLE.flickerMs[1]).toBeGreaterThan(TITLE.flickerMs[0]);
  expect(TITLE.swayEveryMs).toBeGreaterThan(TITLE.swayMs);
  // the idle breathing rests at least as long as it breathed before it breathes again
  expect(TITLE.idlePulseMs).toBeGreaterThanOrEqual(MOTION.pulse * 2);
  // Deal me in leaves through the doors and the table is up within a second of the tap
  expect(DOORS_MS + TRANSITION.throughDoorsMs + TRANSITION.fadeUpMs).toBeLessThanOrEqual(1200);
});

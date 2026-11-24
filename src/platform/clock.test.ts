/** The frame clock: timers fire from pump() in due order, a cancel holds, and no frame still means it fires. */
import { expect, test } from "vitest";
import { frameClock } from "./clock";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("pump runs what is due, in due order, and nothing early", () => {
  const c = frameClock();
  const log: string[] = [];
  const now = performance.now();
  c.after(30, () => log.push("b"));
  c.after(10, () => log.push("a"));
  const cancel = c.after(20, () => log.push("x"));
  cancel();
  c.pump(now + 5);
  expect(log).toEqual([]);
  c.pump(now + 1000);
  expect(log).toEqual(["a", "b"]);
  c.pump(now + 2000);
  expect(log).toEqual(["a", "b"]); // each fires once
});

test("a timer armed by a firing timer waits for the next pump", () => {
  const c = frameClock();
  const log: string[] = [];
  c.after(0, () => {
    log.push("first");
    c.after(0, () => log.push("second"));
  });
  const now = performance.now() + 1;
  c.pump(now);
  expect(log).toEqual(["first"]);
  c.pump(now + 1);
  expect(log).toEqual(["first", "second"]);
});

test("with no frames (the loop asleep), the fallback still fires it, once", async () => {
  const c = frameClock();
  let n = 0;
  c.after(5, () => n++);
  await sleep(320);
  expect(n).toBe(1);
  c.pump(performance.now() + 1000);
  expect(n).toBe(1);
});

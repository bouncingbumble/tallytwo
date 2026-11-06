import { expect, test } from "vitest";
import { notchSideFor } from "./useNotchSide";

test("the island is on the edge the top of the phone is turned to", () => {
  expect(notchSideFor(90)).toBe("left"); // turned counter-clockwise (window.orientation 90)
  expect(notchSideFor(-90)).toBe("right"); // turned clockwise (window.orientation -90)
  expect(notchSideFor(270)).toBe("right"); // screen.orientation.angle for the same
  expect(notchSideFor(0)).toBeNull(); // upright, or a desktop
  expect(notchSideFor(180)).toBeNull();
});

/** The table's geometry on the three device targets. */
import { expect, test } from "vitest";
import { fanLayout } from "./fanLayout";
import { LOGICAL_H } from "./scale";
import { fitScale } from "./scale";
import { BADGE_H, EDGE, HAND_H, HAND_REACH, SLOT_H, TOP_LAYOUTS, type TopLayout, clearFor, controlsWidth, pileLayout, tableLayout } from "./tableLayout";

const at = (vw: number, vh: number, buttons = 1, top: TopLayout = "bar") => tableLayout({ width: fitScale(vw, vh).logicalWidth, clearL: 0, clearR: 0, buttons, top });

test("the fan strip and the 13-card fan step on SE and iPhone 15", () => {
  const se = at(667, 375);
  expect(se.fan.w).toBe(734);
  expect(fanLayout(13, se.fan.w).step).toBe(53);
  expect(fanLayout(13, at(852, 393).fan.w).step).toBe(64);
});

test("the vertical budget: felt + 2 + hand row fills the 440-px canvas inside the padding", () => {
  const t = at(852, 393);
  expect(t.felt.y).toBe(2);
  expect(t.handRow.y).toBe(t.felt.y + t.felt.h + 2);
  expect(t.handRow.y + HAND_H).toBe(LOGICAL_H - 2);
  // the felt runs edge to edge
  expect(t.felt.x).toBe(EDGE);
  expect(t.felt.x + t.felt.w).toBe(Math.floor(fitScale(852, 393).logicalWidth) - EDGE);
  // three slim chips along the felt's top edge, the trick beneath
  expect(t.badges[1].h).toBe(BADGE_H);
  expect(t.plays.y).toBe(t.badges[1].y + BADGE_H + 2);
  expect(t.plays.h).toBe(242);
});

test("the play rows: Dusty on top, Marshal and Lucky a step lower against the edges, the human flush with the bottom", () => {
  const t = at(852, 393);
  expect(t.slots[2].y).toBe(t.plays.y);
  expect(t.slots[0].y + SLOT_H).toBe(t.plays.y + t.plays.h);
  expect(t.slots[1].y).toBe(t.slots[3].y);
  expect(t.slots[1].y).toBeGreaterThan(t.slots[2].y);
  expect(t.slots[1].x).toBe(t.plays.x);
  expect(t.slots[3].x + t.slots[3].w).toBe(t.plays.x + t.plays.w);
});

test.each([
  ["iPhone SE", 667, 375],
  ["iPhone 15", 852, 393],
  ["iPhone 15 Pro Max", 932, 430],
] as const)("%s: the band above the hand clears a selected card, the side rows' plays, and has room for the player's play", (_n, vw, vh) => {
  for (const [n, top] of [1, 2, 3].flatMap((n) => TOP_LAYOUTS.map((top) => [n, top] as const))) {
    const t = at(vw, vh, n, top);
    // the band sits above where a lifted card reaches, and below Marshal's and Lucky's plays
    expect(t.controls.y + t.controls.h).toBeLessThanOrEqual(t.handRow.y - HAND_REACH);
    expect(t.info.y).toBe(t.controls.y);
    expect(t.slots[1].y + SLOT_H).toBeLessThanOrEqual(t.controls.y);
    // the buttons at the right edge, the panel at the left, the player's play between them
    expect(t.controls.w).toBe(controlsWidth(n));
    expect(t.controls.x + t.controls.w).toBe(t.menu.x + t.menu.w);
    expect(t.info.x).toBe(t.corner.x);
    expect(t.slots[0].x).toBeGreaterThan(t.info.x + t.info.w);
    expect(t.slots[0].x + t.slots[0].w).toBeLessThan(t.controls.x);
    expect(t.slots[0].w).toBeGreaterThanOrEqual(150);
    if (top === "bar") {
      // round and tally, the chips and the menu share the top row without overlapping
      expect(t.badges[1].x).toBeGreaterThanOrEqual(t.corner.x + t.corner.w);
      expect(t.badges[3].x + t.badges[3].w).toBeLessThanOrEqual(t.menu.x);
    } else {
      // the middle chip between the corner and the menu; the side chips at the edges, clear of the band
      expect(t.badges[2].x).toBeGreaterThanOrEqual(t.corner.x + t.corner.w);
      expect(t.badges[2].x + t.badges[2].w).toBeLessThanOrEqual(t.menu.x);
      expect(t.badges[1].x).toBe(t.corner.x);
      expect(t.badges[3].x + t.badges[3].w).toBe(t.menu.x + t.menu.w);
      for (const s of [1, 3]) {
        expect(t.badges[s].y).toBeGreaterThanOrEqual(t.corner.y + t.corner.h);
        expect(t.badges[s].y + t.badges[s].h).toBeLessThanOrEqual(t.info.y);
        expect(t.badges[s].h).toBeGreaterThan(t.badges[s].w);
      }
      // the trick between the side chips
      expect(t.plays.x).toBeGreaterThan(t.badges[1].x + t.badges[1].w);
      expect(t.plays.x + t.plays.w).toBeLessThan(t.badges[3].x);
    }
  }
});

test("the notch: only its own side is cleared, by the inset beyond EDGE", () => {
  expect(clearFor(59, 59, "left")).toEqual({ clearL: 59 - EDGE, clearR: 0 });
  expect(clearFor(59, 59, "right")).toEqual({ clearL: 0, clearR: 59 - EDGE });
  expect(clearFor(0, 0, null)).toEqual({ clearL: 0, clearR: 0 });
  const plain = at(852, 393);
  const notched = tableLayout({ width: fitScale(852, 393).logicalWidth, clearL: 0, clearR: 43, buttons: 1, top: "bar" });
  expect(notched.felt.w).toBe(plain.felt.w);
  expect(notched.menu.x).toBe(plain.menu.x - 43);
  expect(notched.controls.x).toBe(plain.controls.x - 43);
  expect(notched.fan.w).toBe(plain.fan.w - 43);
});

test("pileLayout: 30-px steps, squeezed to 12 at least, aligned under the badge", () => {
  expect(pileLayout(1, 300, "center").xs).toEqual([114]);
  expect(pileLayout(5, 400, "start").xs).toEqual([0, 30, 60, 90, 120]);
  expect(pileLayout(5, 120, "start").xs).toEqual([0, 12, 24, 36, 48]);
  const end = pileLayout(2, 300, "end");
  expect(end.xs.at(-1)! + 72).toBe(300);
  expect(end.cx).toBe(end.xs[0] + 15);
});

/** The table's geometry on the three device targets (what e2e/play.mjs used to measure in the DOM). */
import { expect, test } from "vitest";
import { fanLayout } from "./fanLayout";
import { LOGICAL_H } from "./scale";
import { fitScale } from "./scale";
import { BADGE_H, EDGE, HAND_H, SLOT_H, clearFor, pileLayout, tableLayout } from "./tableLayout";

const at = (vw: number, vh: number) => tableLayout({ width: fitScale(vw, vh).logicalWidth, clearL: 0, clearR: 0, insetBottom: 0 });

test("the fan strip and the 13-card fan step on SE, iPhone 15 and a desktop window", () => {
  const se = at(667, 375);
  expect(se.fan.w).toBe(592);
  expect(fanLayout(13, se.fan.w).step).toBe(41);
  expect(fanLayout(13, at(852, 393).fan.w).step).toBe(55);
  expect(fanLayout(13, at(1280, 800).fan.w).step).toBe(34);
});

test("the vertical budget: felt + 2 + hand row fills the 440-px canvas inside the padding", () => {
  const t = at(852, 393);
  expect(t.felt.y).toBe(2);
  expect(t.handRow.y).toBe(t.felt.y + t.felt.h + 2);
  expect(t.handRow.y + HAND_H).toBe(LOGICAL_H - 2);
  expect(t.side.h).toBe(LOGICAL_H - 4);
  // three badges along the felt's top edge, the trick beneath
  expect(t.badges[1].h).toBe(BADGE_H);
  expect(t.plays.y).toBe(t.badges[1].y + BADGE_H + 2);
  expect(t.plays.h).toBe(212);
});

test("the play rows: Dusty on top, Marshal and Lucky halfway against the edges, the human flush with the bottom; 41-px overlap", () => {
  const t = at(852, 393);
  expect(t.slots[2].y).toBe(t.plays.y);
  expect(t.slots[0].y + SLOT_H).toBe(t.plays.y + t.plays.h);
  expect(t.slots[1].y).toBe(t.slots[3].y);
  expect(SLOT_H - (t.slots[1].y - t.slots[2].y)).toBe(41);
  expect(t.slots[1].x).toBe(t.plays.x);
  expect(t.slots[3].x + t.slots[3].w).toBe(t.plays.x + t.plays.w);
});

test("the notch: only its own side is cleared, by the inset beyond EDGE", () => {
  expect(clearFor(59, 59, "left")).toEqual({ clearL: 59 - EDGE, clearR: 0 });
  expect(clearFor(59, 59, "right")).toEqual({ clearL: 0, clearR: 59 - EDGE });
  expect(clearFor(0, 0, null)).toEqual({ clearL: 0, clearR: 0 });
  const plain = at(852, 393);
  const notched = tableLayout({ width: fitScale(852, 393).logicalWidth, clearL: 0, clearR: 43, insetBottom: 0 });
  expect(notched.side.w).toBe(plain.side.w + 43);
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

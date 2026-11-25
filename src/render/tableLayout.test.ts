/** The table's geometry on the three device targets. */
import { expect, test } from "vitest";
import { fanLayout } from "./fanLayout";
import { LOGICAL_H } from "./scale";
import { fitScale } from "./scale";
import { BADGE_H, EDGE, HAND_H, HAND_REACH, MINE_W, SLOT_H, clearFor, controlsWidth, pileLayout, tableLayout } from "./tableLayout";

const at = (vw: number, vh: number, buttons = 1) => tableLayout({ width: fitScale(vw, vh).logicalWidth, clear: 0, buttons });

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
  // the three chips in a row across the top, the trick beneath
  for (const s of [1, 2, 3]) expect(t.badges[s]).toMatchObject({ y: t.corner.y, h: BADGE_H });
  expect(t.plays.y).toBe(t.badges[1].y + BADGE_H + 2);
  expect(t.plays.h).toBe(242);
});

test("the play rows: the middle opponent's on top, the outer two a step lower against the edges, the human flush with the bottom", () => {
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
  for (const n of [1, 2, 3]) {
    const t = at(vw, vh, n);
    // the band sits above where a lifted card reaches, and below Marshal's and Lucky's plays
    expect(t.controls.y + t.controls.h).toBeLessThanOrEqual(t.handRow.y - HAND_REACH);
    expect(t.slots[1].y + SLOT_H).toBeLessThanOrEqual(t.controls.y);
    // the buttons at the right edge; the player's play clear of them, room for five cards
    expect(t.controls.w).toBe(controlsWidth(n));
    expect(t.controls.x + t.controls.w).toBe(t.menu.x + t.menu.w);
    expect(t.slots[0].x + t.slots[0].w).toBeLessThan(t.controls.x);
    expect(t.slots[0].w).toBe(MINE_W);
    // and centred under the top opponent's when the buttons leave room (one or two of them)
    const mineC = t.slots[0].x + t.slots[0].w / 2;
    const topC = t.plays.x + t.plays.w / 2;
    if (n < 3) expect(Math.abs(mineC - topC)).toBeLessThanOrEqual(1);
    else expect(mineC).toBeLessThanOrEqual(topC + 1);
    // round and tally, the three chips and the menu share the top row without overlapping
    expect(t.badges[1].x).toBeGreaterThanOrEqual(t.corner.x + t.corner.w);
    expect(t.badges[2].x).toBeGreaterThan(t.badges[1].x + t.badges[1].w);
    expect(t.badges[3].x).toBeGreaterThan(t.badges[2].x + t.badges[2].w);
    expect(t.badges[3].x + t.badges[3].w).toBeLessThanOrEqual(t.menu.x);
  }
});

test("the notch: cleared by the inset beyond EDGE on both sides alike, so the table stays centred", () => {
  expect(clearFor(59, 0)).toBe(59 - EDGE);
  expect(clearFor(0, 59)).toBe(59 - EDGE);
  expect(clearFor(59, 59)).toBe(59 - EDGE);
  expect(clearFor(0, 0)).toBe(0);
  const W = Math.floor(fitScale(852, 393).logicalWidth);
  const plain = at(852, 393);
  const notched = tableLayout({ width: fitScale(852, 393).logicalWidth, clear: 43, buttons: 1 });
  expect(notched.felt.w).toBe(plain.felt.w);
  expect(notched.corner.x).toBe(plain.corner.x + 43);
  expect(notched.menu.x).toBe(plain.menu.x - 43);
  expect(notched.controls.x).toBe(plain.controls.x - 43);
  expect(notched.fan.w).toBe(plain.fan.w - 86);
  // every row is centred on the screen: the corner and menu, the chips, the trick, the fan, the player's play
  const mid = (x: number, w: number) => x + w / 2;
  expect(notched.corner.x).toBe(W - notched.menu.x - notched.menu.w);
  expect(Math.abs(mid(notched.badges[2].x, notched.badges[2].w) - W / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(mid(notched.plays.x, notched.plays.w) - W / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(mid(notched.fan.x, notched.fan.w) - W / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(mid(notched.slots[0].x, notched.slots[0].w) - W / 2)).toBeLessThanOrEqual(1);
});

test("pileLayout: 30-px steps, squeezed to 12 at least, aligned under the badge", () => {
  expect(pileLayout(1, 300, "center").xs).toEqual([114]);
  expect(pileLayout(5, 400, "start").xs).toEqual([0, 30, 60, 90, 120]);
  expect(pileLayout(5, 120, "start").xs).toEqual([0, 12, 24, 36, 48]);
  const end = pileLayout(2, 300, "end");
  expect(end.xs.at(-1)! + 72).toBe(300);
  expect(end.cx).toBe(end.xs[0] + 15);
});

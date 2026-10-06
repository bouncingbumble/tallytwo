/**
 * trickPlays: what the felt shows — each seat's latest play in the current trick, replaced
 * when that seat plays again, gone when the trick clears.
 */
import { expect, test } from "vitest";
import { deal, reduce } from "../engine/reducer";
import { DEFAULT_RULES } from "../engine/rules";
import { trickPlays } from "./selectors";

/** The first seed in 1..200 that deals the 3♦ to seat 0. */
const seed = (() => {
  for (let s = 1; s <= 200; s++) if (deal(s, DEFAULT_RULES).players[0].hand.includes(0)) return s;
  throw new Error("no seed");
})();

test("plays accumulate per seat within a trick and the latest one per seat wins", () => {
  let g = deal(seed, DEFAULT_RULES);
  expect(trickPlays(g)).toEqual([]);
  g = reduce(g, { type: "PLAY", player: 0, cards: [0] });
  expect(trickPlays(g)).toEqual([{ seat: 0, cards: [0], at: 0 }]);
  const hi1 = g.players[1].hand[12];
  g = reduce(g, { type: "PLAY", player: 1, cards: [hi1] });
  expect(trickPlays(g).map((p) => p.seat)).toEqual([0, 1]);
  g = reduce(g, { type: "PASS", player: 2 });
  g = reduce(g, { type: "PASS", player: 3 });
  expect(trickPlays(g).map((p) => p.seat)).toEqual([0, 1]); // passes add nothing
  // seat 0 beats seat 1 with its highest single: its earlier play is replaced, seat 1's stays
  const hi0 = Math.max(...g.players[0].hand);
  if (hi0 > hi1) {
    g = reduce(g, { type: "PLAY", player: 0, cards: [hi0] });
    const plays = trickPlays(g);
    expect(plays).toHaveLength(2);
    expect(plays[0]).toEqual({ seat: 0, cards: [hi0], at: 4 });
    expect(plays[1].seat).toBe(1);
  }
});

test("the trick clears after three passes and the felt is empty until the next play", () => {
  let g = deal(seed, DEFAULT_RULES);
  g = reduce(g, { type: "PLAY", player: 0, cards: [0] });
  g = reduce(g, { type: "PLAY", player: 1, cards: [g.players[1].hand[12]] });
  g = reduce(g, { type: "PASS", player: 2 });
  g = reduce(g, { type: "PASS", player: 3 });
  g = reduce(g, { type: "PASS", player: 0 });
  expect(g.lastPlay).toBeNull();
  expect(g.trickStart).toBe(g.history.length);
  expect(trickPlays(g)).toEqual([]);
  g = reduce(g, { type: "PLAY", player: 1, cards: [g.players[1].hand[0]] });
  expect(trickPlays(g)).toEqual([{ seat: 1, cards: [g.history[g.history.length - 1].cards[0]], at: g.history.length - 1 }]);
});

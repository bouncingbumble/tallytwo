/**
 * The pure helpers GameProvider relies on, tested without a renderer: what act() does with an
 * engine throw is decided by tryReduce(), and what toggleCard() ignores is decided by
 * canToggle(). The provider's own wiring (useReducer, useMemo deps) is React and is checked by
 * the M1b console gate, not here.
 */
import { expect, test } from "vitest";
import { THREE_OF_DIAMONDS } from "../engine/cards";
import { IllegalActionError } from "../engine/reducer";
import { DEFAULT_RULES } from "../engine/rules";
import { type AppState, INITIAL, appReduce, tryReduce } from "./appReducer";
import { HUMAN, canToggle, legalFor } from "./selectors";

/** A match where the human leads round 1 (seat 0 holds the 3♦). */
const humanLeadMatch = (): AppState => {
  for (let seed = 1; seed <= 200; seed++) {
    const s = appReduce(INITIAL, { type: "NEW_MATCH", seed, rules: DEFAULT_RULES });
    if (s.game!.turn === HUMAN) return s;
  }
  throw new Error("no seed in 1..200 gives seat 0 the 3♦");
};

/** The human leads the 3♦, the three AI seats pass, the trick clears: the human's lead again, with a history. */
const humanLeadAgain = (): AppState => {
  let s = humanLeadMatch();
  s = appReduce(s, { type: "PLAY", player: HUMAN, cards: [THREE_OF_DIAMONDS] });
  for (let i = 0; i < 3; i++) s = appReduce(s, { type: "PASS", player: s.game!.turn });
  expect(s.game!.turn).toBe(HUMAN);
  expect(s.game!.lastPlay).toBeNull();
  expect(s.game!.history.length).toBe(4);
  return s;
};

test("tryReduce: an illegal PLAY on your lead with a card not in hand -> crash with seed, action and history; state unchanged", () => {
  const s = humanLeadAgain();
  const g = s.game!;
  const snapshot = JSON.stringify(s);
  const notMine = g.players[1].hand[0];
  expect(g.players[HUMAN].hand.includes(notMine)).toBe(false);
  const bad = { type: "PLAY" as const, player: HUMAN, cards: [notMine] };
  const r = tryReduce(s, bad);
  expect(r.next).toBeUndefined();
  expect(r.crash).toBeDefined();
  const crash = r.crash!;
  expect(crash.error).toBeInstanceOf(IllegalActionError);
  expect(crash.error.message).toBe("illegal PLAY: cards not in hand");
  expect(crash.action).toBe(bad);
  expect(crash.seed).toBe(g.seed);
  expect(crash.rules).toBe(g.rules);
  expect(crash.round).toBe(1);
  expect(crash.leader).toBe(HUMAN);
  expect(crash.totals).toEqual([0, 0, 0, 0]);
  expect(crash.history).toBe(g.history);
  expect(crash.history.map((h) => h.by)).toEqual([0, 1, 2, 3]);
  expect(crash.final).toBe(g);
  expect(JSON.stringify(s)).toBe(snapshot);
  expect(s.game).toBe(g);
});

test("tryReduce: a move the engine refuses for any other reason is a crash too, never a throw", () => {
  const s = humanLeadMatch();
  expect(tryReduce(s, { type: "PASS", player: HUMAN }).crash!.error.message).toMatch(/cannot pass on an open lead/);
  expect(tryReduce(s, { type: "PLAY", player: 2, cards: [THREE_OF_DIAMONDS] }).crash!.error.message).toMatch(/not on turn/);
  const other = s.game!.players[HUMAN].hand.find((c) => c !== THREE_OF_DIAMONDS)!;
  expect(tryReduce(s, { type: "PLAY", player: HUMAN, cards: [other] }).crash!.error.message).toMatch(/must include the 3♦/);
});

test("tryReduce: a legal PLAY yields next, with the move in the history", () => {
  const s = humanLeadAgain();
  const move = legalFor(s.game)[0];
  const r = tryReduce(s, { type: "PLAY", player: HUMAN, cards: move.cards });
  expect(r.crash).toBeUndefined();
  expect(r.next!.game!.history.length).toBe(5);
  expect(r.next!.game!.history[4]).toEqual({ by: HUMAN, cards: move.cards });
  expect(r.next!.game!.lastBy).toBe(HUMAN);
  expect(r.next!.dealId).toBe(s.dealId);
});

test("toggleCard's guard: canToggle(null) false, on or off turn true (a play can be lined up early), after the round false", () => {
  expect(canToggle(null)).toBe(false);
  const s = humanLeadMatch();
  expect(canToggle(s.game)).toBe(true);
  const aiTurn = appReduce(s, { type: "PLAY", player: HUMAN, cards: [THREE_OF_DIAMONDS] });
  expect(aiTurn.game!.turn).not.toBe(HUMAN);
  expect(canToggle(aiTurn.game)).toBe(true);
  expect(legalFor(aiTurn.game)).toEqual([]); // ...but nothing is playable until the turn comes round
  expect(canToggle({ ...s.game!, phase: "roundover" })).toBe(false);
  expect(canToggle({ ...s.game!, phase: "scored" })).toBe(false);
  expect(canToggle(appReduce(s, { type: "QUIT" }).game)).toBe(false);
});

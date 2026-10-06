/**
 * appReduce / tryReduce: the app-level no-op guards (a double-tapped button must not unmount
 * the tree), the loud PLAY/PASS path, and the crash report act() stores instead of letting an
 * engine throw escape a click handler.
 */
import { expect, test } from "vitest";
import { THREE_OF_DIAMONDS } from "../engine/cards";
import { IllegalActionError } from "../engine/reducer";
import { DEFAULT_RULES } from "../engine/rules";
import { type AppState, INITIAL, appReduce, serializeLog, tryReduce } from "./appReducer";
import { gameLog } from "./selectors";

const newMatch = (s: AppState, seed: number): AppState => appReduce(s, { type: "NEW_MATCH", seed, rules: DEFAULT_RULES });

/** A card the seat on turn does not hold: the next seat's lowest card. */
const foreignCard = (s: AppState): number => {
  const g = s.game!;
  return g.players[(g.turn + 1) % g.players.length].hand[0];
};

/** The leader's hand shrunk to the 3♦, so the opening lead ends the round. */
const lastCard = (s: AppState): AppState => {
  const g = s.game!;
  return { ...s, game: { ...g, players: g.players.map((p, i) => (i === g.turn ? { ...p, hand: [THREE_OF_DIAMONDS] } : p)) } };
};

test("NEW_MATCH deals 4x13 at round 1 and bumps dealId", () => {
  const s = newMatch(INITIAL, 7);
  expect(s.game).not.toBeNull();
  expect(s.game!.players.map((p) => p.hand.length)).toEqual([13, 13, 13, 13]);
  expect(s.game!.seed).toBe(7);
  expect(s.game!.round).toBe(1);
  expect(s.game!.phase).toBe("playing");
  expect(s.game!.totals).toEqual([0, 0, 0, 0]);
  expect(s.dealId).toBe(1);
  const again = newMatch(s, 8);
  expect(again.game!.seed).toBe(8);
  expect(again.dealId).toBe(2);
});

test("NEW_MATCH deals with the rules it is given", () => {
  const s = appReduce(INITIAL, { type: "NEW_MATCH", seed: 7, rules: { ...DEFAULT_RULES, passLocksOut: true, laterRoundLead: "loser" } });
  expect(s.game!.rules).toEqual({ ...DEFAULT_RULES, passLocksOut: true, laterRoundLead: "loser" });
});

test("NEXT_ROUND before scored is a no-op", () => {
  const s = newMatch(INITIAL, 7);
  expect(appReduce(s, { type: "NEXT_ROUND", seed: 9 })).toBe(s);
  const over = appReduce(lastCard(s), { type: "PLAY", player: s.game!.turn, cards: [THREE_OF_DIAMONDS] });
  expect(over.game!.phase).toBe("roundover");
  expect(appReduce(over, { type: "NEXT_ROUND", seed: 9 })).toBe(over);
});

test("SCORE_ROUND before roundover is a no-op", () => {
  const s = newMatch(INITIAL, 7);
  expect(appReduce(s, { type: "SCORE_ROUND" })).toBe(s);
});

test("QUIT -> game null, dealId kept", () => {
  const s = newMatch(INITIAL, 7);
  const q = appReduce(s, { type: "QUIT" });
  expect(q.game).toBeNull();
  expect(q.dealId).toBe(1);
  expect(appReduce(INITIAL, { type: "QUIT" })).toEqual(INITIAL);
});

test("DEAL and every move are no-ops on the title screen", () => {
  expect(appReduce(INITIAL, { type: "DEAL", seed: 1 })).toBe(INITIAL);
  expect(appReduce(INITIAL, { type: "PLAY", player: 0, cards: [THREE_OF_DIAMONDS] })).toBe(INITIAL);
  expect(appReduce(INITIAL, { type: "PASS", player: 0 })).toBe(INITIAL);
  expect(appReduce(INITIAL, { type: "NEXT_ROUND", seed: 1 })).toBe(INITIAL);
  expect(appReduce(INITIAL, { type: "SCORE_ROUND" })).toBe(INITIAL);
});

test("PLAY of illegal cards throws from appReduce", () => {
  const s = newMatch(INITIAL, 7);
  expect(() => appReduce(s, { type: "PLAY", player: s.game!.turn, cards: [foreignCard(s)] })).toThrow(IllegalActionError);
  expect(() => appReduce(s, { type: "PLAY", player: s.game!.turn, cards: [] })).toThrow(/no cards/);
  expect(() => appReduce(s, { type: "PASS", player: s.game!.turn })).toThrow(/open lead/);
});

test("tryReduce: an illegal PLAY yields a crash report with seed, action and history, and leaves the state unchanged", () => {
  const s = newMatch(INITIAL, 7);
  const snapshot = JSON.stringify(s);
  const bad = { type: "PLAY" as const, player: s.game!.turn, cards: [foreignCard(s)] };
  const r = tryReduce(s, bad);
  expect(r.next).toBeUndefined();
  expect(r.crash).toBeDefined();
  expect(r.crash!.error).toBeInstanceOf(IllegalActionError);
  expect(r.crash!.error.message).toMatch(/cards not in hand/);
  expect(r.crash!.action).toBe(bad);
  expect(r.crash!.seed).toBe(7);
  expect(r.crash!.rules).toEqual(DEFAULT_RULES);
  expect(r.crash!.round).toBe(1);
  expect(r.crash!.leader).toBe(s.game!.turn);
  expect(r.crash!.totals).toEqual([0, 0, 0, 0]);
  expect(r.crash!.history).toEqual([]);
  expect(r.crash!.final).toBe(s.game);
  expect(JSON.stringify(s)).toBe(snapshot);
});

test("tryReduce: a legal PLAY yields next", () => {
  const s = newMatch(INITIAL, 7);
  const r = tryReduce(s, { type: "PLAY", player: s.game!.turn, cards: [THREE_OF_DIAMONDS] }); // the 3♦ single is always a legal opening lead
  expect(r.crash).toBeUndefined();
  expect(r.next!.game!.history).toEqual([{ by: s.game!.turn, cards: [THREE_OF_DIAMONDS] }]);
  expect(r.next!.game!.lastBy).toBe(s.game!.turn);
  expect(r.next!.dealId).toBe(1);
});

test("tryReduce never throws for the guarded app actions", () => {
  const s = newMatch(INITIAL, 7);
  expect(tryReduce(s, { type: "SCORE_ROUND" })).toEqual({ next: s });
  expect(tryReduce(s, { type: "NEXT_ROUND", seed: 2 })).toEqual({ next: s });
  expect(tryReduce(s, { type: "QUIT" }).next!.game).toBeNull();
});

test("roundover -> SCORE_ROUND -> NEXT_ROUND: totals move, the round and dealId bump", () => {
  const s = lastCard(newMatch(INITIAL, 7));
  const winner = s.game!.turn;
  const over = appReduce(s, { type: "PLAY", player: winner, cards: [THREE_OF_DIAMONDS] });
  expect(over.game!.phase).toBe("roundover");
  expect(over.game!.turn).toBe(winner);
  const scored = appReduce(over, { type: "SCORE_ROUND" });
  expect(scored.game!.phase).toBe("scored");
  expect(scored.dealId).toBe(1);
  expect(scored.game!.totals[winner]).toBeGreaterThan(0);
  expect(scored.game!.totals.reduce((a, b) => a + b, 0)).toBe(0);
  expect(appReduce(scored, { type: "SCORE_ROUND" })).toBe(scored); // a double tap
  const next = appReduce(scored, { type: "NEXT_ROUND", seed: 9 });
  expect(next.game!.round).toBe(2);
  expect(next.game!.seed).toBe(9);
  expect(next.game!.phase).toBe("playing");
  expect(next.game!.totals).toEqual(scored.game!.totals);
  expect(next.dealId).toBe(2);
});

test("serializeLog is the GameLog shape as JSON", () => {
  const s = newMatch(INITIAL, 7);
  const log = gameLog(s.game!);
  const parsed = JSON.parse(serializeLog(log));
  expect(Object.keys(parsed)).toEqual(["seed", "rules", "round", "leader", "totals", "history", "final"]);
  expect(parsed.seed).toBe(7);
  expect(parsed.final).toEqual(JSON.parse(JSON.stringify(s.game)));
});

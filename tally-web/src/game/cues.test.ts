/**
 * cueFor, row by row from WEB-PLAN §3.4. Positions are real — deal(seed) + reduce — with a seed
 * search for who holds the 3♦ (the human for the "human" rows, an AI for the others). Barks are
 * AI-only: the human never gets one, not even for winning the round.
 */
import { expect, test } from "vitest";
import { THREE_OF_DIAMONDS } from "../engine/cards";
import { type Action, deal, reduce } from "../engine/reducer";
import { DEFAULT_RULES } from "../engine/rules";
import type { GameState } from "../engine/state";
import { legalMoves } from "../ai/moves";
import { cueFor } from "./cues";
import { HUMAN } from "./selectors";

const dealWhere = (pred: (g: GameState) => boolean, label: string): GameState => {
  for (let seed = 1; seed <= 200; seed++) {
    const g = deal(seed, DEFAULT_RULES);
    if (pred(g)) return g;
  }
  throw new Error(`no seed in 1..200 where ${label}`);
};
const humanLead = (): GameState => dealWhere((g) => g.turn === HUMAN, "seat 0 holds the 3♦");
const aiLead = (): GameState => dealWhere((g) => g.turn !== HUMAN, "an AI holds the 3♦");
const seatLeads = (seat: number): GameState => dealWhere((g) => g.turn === seat, `seat ${seat} holds the 3♦`);

const play = (g: GameState, cards: number[]): [Action, GameState] => {
  const a: Action = { type: "PLAY", player: g.turn, cards };
  return [a, reduce(g, a)];
};
const pass = (g: GameState): [Action, GameState] => {
  const a: Action = { type: "PASS", player: g.turn };
  return [a, reduce(g, a)];
};
/** The leader's hand replaced, so a chosen opening lead is in hand and may end the round. */
const leaderHolds = (g: GameState, hand: number[]): GameState => ({ ...g, players: g.players.map((p, i) => (i === g.turn ? { ...p, hand } : p)) });

test("PLAY of 1-3 cards by an AI -> playSmall + bark play", () => {
  const g = aiLead();
  const [a, n] = play(g, [THREE_OF_DIAMONDS]);
  expect(cueFor(g, a, n)).toEqual({ sfx: ["playSmall"], bark: { seat: g.turn, kind: "play" } });
  const pair = leaderHolds(g, [0, 1, 2, 3, 4, 5]);
  const [a2, n2] = play(pair, [0, 1]);
  expect(cueFor(pair, a2, n2)).toEqual({ sfx: ["playSmall"], bark: { seat: g.turn, kind: "play" } });
  const [a3, n3] = play(pair, [0, 1, 2]);
  expect(cueFor(pair, a3, n3)).toEqual({ sfx: ["playSmall"], bark: { seat: g.turn, kind: "play" } });
});

test("PLAY of 1-3 cards by the human -> playSmall, no bark", () => {
  const g = humanLead();
  const [a, n] = play(g, [THREE_OF_DIAMONDS]);
  const cue = cueFor(g, a, n);
  expect(cue).toEqual({ sfx: ["playSmall"] });
  expect("bark" in cue).toBe(false);
});

test("PLAY of 5+ cards -> playFive (a real five-card opening lead)", () => {
  for (let seed = 1; seed <= 2000; seed++) {
    const g = deal(seed, DEFAULT_RULES);
    const five = legalMoves(g.players[g.turn].hand, null, DEFAULT_RULES, true).find((m) => m.cards.length === 5);
    if (!five) continue;
    const [a, n] = play(g, five.cards);
    const cue = cueFor(g, a, n);
    expect(cue.sfx).toEqual(["playFive"]);
    expect(cue.bark).toEqual(g.turn === HUMAN ? undefined : { seat: g.turn, kind: "play" });
    return;
  }
  throw new Error("no seed in 1..2000 gives the leader a five-card opening lead");
});

test("human PLAY that ends the round -> [playSmall, roundWin], bark undefined", () => {
  const g = leaderHolds(humanLead(), [THREE_OF_DIAMONDS]);
  const [a, n] = play(g, [THREE_OF_DIAMONDS]);
  expect(n.phase).toBe("roundover");
  const cue = cueFor(g, a, n);
  expect(cue.sfx).toEqual(["playSmall", "roundWin"]);
  expect(cue.bark).toBeUndefined();
});

test("human five-card PLAY that ends the round -> [playFive, roundWin], bark undefined", () => {
  const straightFlush = [0, 4, 8, 12, 16]; // 3♦ 4♦ 5♦ 6♦ 7♦: includes the 3♦, so legal on the forced lead
  const g = leaderHolds(humanLead(), straightFlush);
  const [a, n] = play(g, straightFlush);
  expect(n.phase).toBe("roundover");
  expect(cueFor(g, a, n)).toEqual({ sfx: ["playFive", "roundWin"] });
});

test("AI PLAY that ends the round -> [playSmall, roundWin], bark win", () => {
  const g = leaderHolds(aiLead(), [THREE_OF_DIAMONDS]);
  const [a, n] = play(g, [THREE_OF_DIAMONDS]);
  expect(n.phase).toBe("roundover");
  expect(cueFor(g, a, n)).toEqual({ sfx: ["playSmall", "roundWin"], bark: { seat: g.turn, kind: "win" } });
});

test("AI five-card PLAY that ends the round -> [playFive, roundWin], bark win", () => {
  const straightFlush = [0, 4, 8, 12, 16];
  const g = leaderHolds(aiLead(), straightFlush);
  const [a, n] = play(g, straightFlush);
  expect(cueFor(g, a, n)).toEqual({ sfx: ["playFive", "roundWin"], bark: { seat: g.turn, kind: "win" } });
});

test("PASS by an AI that leaves the trick standing -> pass + bark pass", () => {
  const g = seatLeads(1); // seat 1 leads, seat 2 (an AI) follows
  const [, g1] = play(g, [THREE_OF_DIAMONDS]);
  expect(g1.turn).toBe(2);
  const [a, n] = pass(g1);
  expect(n.lastPlay).not.toBeNull();
  expect(cueFor(g1, a, n)).toEqual({ sfx: ["pass"], bark: { seat: 2, kind: "pass" } });
});

test("PASS by the human that leaves the trick standing -> pass, no bark", () => {
  const g = seatLeads(3); // seat 3 leads, the human follows
  const [, g1] = play(g, [THREE_OF_DIAMONDS]);
  expect(g1.turn).toBe(HUMAN);
  const [a, n] = pass(g1);
  expect(n.lastPlay).not.toBeNull();
  const cue = cueFor(g1, a, n);
  expect(cue).toEqual({ sfx: ["pass"] });
  expect("bark" in cue).toBe(false);
});

test("PASS that clears the trick -> trickClear, read from the engine's outcome", () => {
  const g = humanLead(); // the human leads; three AI passes clear the trick
  const [, g1] = play(g, [THREE_OF_DIAMONDS]);
  const [, g2] = pass(g1);
  const [, g3] = pass(g2);
  expect(g3.lastPlay).not.toBeNull();
  expect(g3.turn).toBe(3);
  const [a, n] = pass(g3);
  expect(n.lastPlay).toBeNull();
  expect(cueFor(g3, a, n)).toEqual({ sfx: ["trickClear"], bark: { seat: 3, kind: "pass" } });
});

test("the human's PASS that clears the trick -> trickClear, no bark", () => {
  const g = seatLeads(1); // seat 1 leads; 2 and 3 pass; the human's pass clears
  const [, g1] = play(g, [THREE_OF_DIAMONDS]);
  const [, g2] = pass(g1);
  const [, g3] = pass(g2);
  expect(g3.turn).toBe(HUMAN);
  const [a, n] = pass(g3);
  expect(n.lastPlay).toBeNull();
  const cue = cueFor(g3, a, n);
  expect(cue).toEqual({ sfx: ["trickClear"] });
  expect("bark" in cue).toBe(false);
});

test("NEW_MATCH / NEXT_ROUND -> dealRoll, no sfx, no bark", () => {
  const g = humanLead();
  expect(cueFor(null, { type: "NEW_MATCH", seed: 1, rules: DEFAULT_RULES }, g)).toEqual({ sfx: [], dealRoll: true });
  expect(cueFor(g, { type: "NEXT_ROUND", seed: 2 }, g)).toEqual({ sfx: [], dealRoll: true });
});

test("QUIT / SCORE_ROUND / DEAL -> silence", () => {
  const g = humanLead();
  expect(cueFor(g, { type: "QUIT" }, null)).toEqual({ sfx: [] });
  expect(cueFor(null, { type: "QUIT" }, null)).toEqual({ sfx: [] });
  expect(cueFor(g, { type: "SCORE_ROUND" }, g)).toEqual({ sfx: [] });
  expect(cueFor(g, { type: "DEAL", seed: 1 }, g)).toEqual({ sfx: [] });
});

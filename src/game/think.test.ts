/**
 * The AI stream as a state number (engine/cards seededRng) and thinkNow: a worker's answer must
 * be the answer the main thread would have given, draw for draw.
 */
import { expect, test } from "vitest";
import { mulberry32, seededRng } from "../engine/cards";
import { DEFAULT_RULES } from "../engine/rules";
import { aiTurn } from "../ai/aiTurn";
import { aiRngFor, aiRngState } from "./seeds";
import { thinkNow } from "./think";
import { appReduce, INITIAL } from "./appReducer";

test("seededRng is mulberry32, and resumes from its state", () => {
  for (const seed of [0, 1, 42, 0x9e3779b9, -7]) {
    const a = mulberry32(seed);
    const b = seededRng(seed);
    for (let i = 0; i < 50; i++) expect(b.next()).toBe(a());
    const c = seededRng(b.state); // a new holder of the same stream carries on
    for (let i = 0; i < 50; i++) expect(c.next()).toBe(a());
  }
  expect(aiRngFor(17)()).toBe(seededRng(aiRngState(17)).next());
});

test("thinkNow plays aiTurn's move and hands back the advanced stream", () => {
  for (const seed of [3, 9, 14, 17, 1001]) {
    const g = appReduce(INITIAL, { type: "NEW_MATCH", seed, rules: DEFAULT_RULES }).game!;
    const seat = g.turn === 0 ? 1 : g.turn; // any AI seat: aiTurn does not check whose turn it is
    for (const difficulty of ["easy", "medium", "hard"] as const) {
      const rng = aiRngFor(seed);
      const expected = aiTurn(g, seat, rng, difficulty);
      const r = thinkNow({ game: structuredClone(g), seat, rngState: aiRngState(seed), difficulty });
      expect(r.action).toEqual(expected);
      expect(seededRng(r.rngState).next()).toBe(rng()); // the next draw matches too
    }
  }
});

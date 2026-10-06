/**
 * The simulation gate under Vitest: 200 seeded games through the real reduce(), 0 illegal
 * actions, 0 stalls; the AI is deterministic for a seed. Win rates are printed by
 * `npm run sim`, not asserted (DECISIONS: Hard is not measurably stronger than Medium).
 */
import { beforeEach, describe, expect, test } from "vitest";
import { type Action, deal, reduce } from "../engine/reducer";
import { DEFAULT_RULES } from "../engine/rules";
import { aiRngFor } from "../game/seeds";
import { aiTurn } from "./aiTurn";
import type { Difficulty } from "./choose";
import { clearPartitionCache } from "./partition";

const SEATS = [
  { name: "A", kind: "ai" as const, personality: "marshal" },
  { name: "B", kind: "ai" as const, personality: "outlaw" },
  { name: "C", kind: "ai" as const, personality: "gambler" },
  { name: "D", kind: "ai" as const, personality: "marshal" },
];

const MATCHUPS: Difficulty[][] = [
  ["medium", "medium", "medium", "medium"],
  ["hard", "easy", "easy", "easy"],
  ["medium", "easy", "easy", "easy"],
  ["hard", "medium", "medium", "medium"],
];

function playGame(seed: number, diffs: Difficulty[]) {
  const rng = aiRngFor(seed);
  let g = deal(seed, DEFAULT_RULES, SEATS);
  const actions: Action[] = [];
  let errors = 0;
  while (g.phase === "playing" && actions.length < 600) {
    const a = aiTurn(g, g.turn, rng, diffs[g.turn]);
    try {
      g = reduce(g, a);
    } catch {
      errors++;
      break;
    }
    actions.push(a);
  }
  return { winner: g.phase === "roundover" ? g.turn : -1, errors, stalled: g.phase === "playing", actions, final: g };
}

describe("simulation gate", () => {
  beforeEach(clearPartitionCache);

  test("200 games: no illegal action, no stall, every round ends with one empty hand", () => {
    let errors = 0;
    let stalls = 0;
    for (let i = 0; i < 200; i++) {
      const r = playGame(1000 + i, MATCHUPS[i % MATCHUPS.length]);
      errors += r.errors;
      if (r.stalled) stalls++;
      else {
        expect(r.final.players[r.winner].hand).toHaveLength(0);
        expect(r.final.players.filter((p) => p.hand.length === 0)).toHaveLength(1);
      }
    }
    expect(errors).toBe(0);
    expect(stalls).toBe(0);
  });

  test("the first action of every game is a play that includes the 3♦", () => {
    for (let i = 0; i < 50; i++) {
      const a = playGame(1000 + i, MATCHUPS[0]).actions[0];
      expect(a.type).toBe("PLAY");
      if (a.type === "PLAY") expect(a.cards).toContain(0);
    }
  });

  test("a pass never follows a cleared trick (chooseMove never passes on an open lead)", () => {
    for (let i = 0; i < 50; i++) {
      const { actions, errors } = playGame(2000 + i, MATCHUPS[i % 4]);
      // a PASS on an open lead makes reduce() throw inside playGame, which counts it as an error
      // and drops the action — so the swallowed error must be asserted, not only the action list
      expect(errors).toBe(0);
      let passes = 0;
      for (const a of actions) {
        if (a.type === "PASS") {
          expect(passes).toBeLessThan(3); // the fourth consecutive pass would be on an open lead
          passes++;
        } else passes = 0;
      }
    }
  });

  test("a game is deterministic for its seed (warm and cold cache)", () => {
    const a = playGame(1000, MATCHUPS[0]);
    clearPartitionCache();
    const b = playGame(1000, MATCHUPS[0]);
    expect(JSON.stringify(b.actions)).toBe(JSON.stringify(a.actions));
    expect(b.winner).toBe(a.winner);
    expect(a.actions.length).toBeGreaterThan(10);
  });
});

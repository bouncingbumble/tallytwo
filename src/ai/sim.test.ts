/**
 * Whole AI-only games through the real reduce(). The legality-and-termination gate over hundreds
 * of games is `npm run sim` (scripts/sim.mjs); these check the opening lead and determinism.
 */
import { beforeEach, describe, expect, test } from "vitest";
import { type Action, deal, reduce } from "../engine/reducer";
import { DEFAULT_RULES } from "../engine/rules";
import { aiRngFor } from "../game/seeds";
import { aiTurn } from "./aiTurn";
import { clearPartitionCache } from "./partition";

const SEATS = [
  { name: "A", kind: "ai" as const, personality: "marshal" },
  { name: "B", kind: "ai" as const, personality: "outlaw" },
  { name: "C", kind: "ai" as const, personality: "gambler" },
  { name: "D", kind: "ai" as const, personality: "marshal" },
];

/** One round of four Regulars; reduce() throws on any illegal action. */
function playGame(seed: number) {
  const rng = aiRngFor(seed);
  let g = deal(seed, DEFAULT_RULES, SEATS);
  const actions: Action[] = [];
  while (g.phase === "playing" && actions.length < 600) {
    const a = aiTurn(g, g.turn, rng, "medium");
    g = reduce(g, a);
    actions.push(a);
  }
  return { winner: g.phase === "roundover" ? g.turn : -1, actions };
}

describe("simulated games", () => {
  beforeEach(clearPartitionCache);

  test("the first action of every game is a play that includes the 3♦", () => {
    for (let i = 0; i < 50; i++) {
      const a = playGame(1000 + i).actions[0];
      expect(a.type).toBe("PLAY");
      if (a.type === "PLAY") expect(a.cards).toContain(0);
    }
  });

  test("a game is deterministic for its seed (warm and cold cache)", () => {
    const a = playGame(1000);
    clearPartitionCache();
    const b = playGame(1000);
    expect(JSON.stringify(b.actions)).toBe(JSON.stringify(a.actions));
    expect(b.winner).toBe(a.winner);
    expect(a.actions.length).toBeGreaterThan(10);
  });
});

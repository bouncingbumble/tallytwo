/**
 * The AI's contracts: personalities resolve, chooseMove only ever returns a legal move (or a
 * pass when following), the evaluation helpers say what they mean.
 */
import { describe, expect, test } from "vitest";
import { type Card, mulberry32, parseCards } from "../engine/cards";
import { classify } from "../engine/combos";
import { deal, reduce } from "../engine/reducer";
import { DEFAULT_RULES } from "../engine/rules";
import { publicView } from "../engine/state";
import { aiTurn } from "./aiTurn";
import { type Difficulty, chooseMove } from "./choose";
import { controlSpend, unbeatable, unseenList } from "./evaluate";
import { getPersonality } from "./getPersonality";
import { legalMoves } from "./moves";
import { clearPartitionCache, partitionCount } from "./partition";
import { PERSONALITIES } from "./personalities";

const R = DEFAULT_RULES;
const SEATS = [
  { name: "A", kind: "ai" as const, personality: "marshal" },
  { name: "B", kind: "ai" as const, personality: "outlaw" },
  { name: "C", kind: "ai" as const, personality: "gambler" },
  { name: "D", kind: "ai" as const, personality: "marshal" },
];

describe("personalities", () => {
  test("getPersonality narrows the key and the portrait", () => {
    expect(() => getPersonality(undefined)).toThrow();
    expect(() => getPersonality("nope")).toThrow();
    const m = getPersonality("marshal");
    expect(m.portrait).toBe("p_marshal");
    expect(m.name).toBe("Marshal Cobb");
    expect(getPersonality("outlaw").portrait).toBe("p_outlaw");
    expect(getPersonality("gambler").portrait).toBe("p_gambler");
    expect(Object.keys(PERSONALITIES)).toEqual(["marshal", "outlaw", "gambler"]);
    for (const p of Object.values(PERSONALITIES)) {
      expect(p.barks.play.length).toBeGreaterThan(0);
      expect(p.barks.pass.length).toBeGreaterThan(0);
      expect(p.barks.win.length).toBeGreaterThan(0);
    }
  });
});

describe("chooseMove", () => {
  test("returns a legal move, or null only when following, at every difficulty", () => {
    clearPartitionCache();
    const rng = mulberry32(42);
    let positions = 0;
    for (let seed = 1; seed <= 100; seed++) {
      let g = deal(seed, R, SEATS);
      const k = Math.floor(rng() * 12);
      for (let i = 0; i < k && g.phase === "playing"; i++) g = reduce(g, aiTurn(g, g.turn, rng, "medium"));
      if (g.phase !== "playing") continue;
      const me = g.turn;
      const pub = publicView(g, me);
      const legal = legalMoves(g.players[me].hand, g.lastPlay, R, pub.need3D).map((m) => m.cards.join(","));
      for (const d of ["easy", "medium", "hard"] as Difficulty[]) {
        const mv = chooseMove(pub, g.players[me].hand, getPersonality(g.players[me].personality), R, rng, d);
        positions++;
        if (mv === null) expect(pub.lastPlay).not.toBeNull();
        else expect(legal).toContain(mv.cards.join(","));
      }
    }
    expect(positions).toBeGreaterThan(200);
  });

  test("aiTurn wraps the answer as PLAY or PASS and refuses the human seat", () => {
    const g = deal(7, R, SEATS);
    const a = aiTurn(g, g.turn, mulberry32(1), "medium");
    expect(a.type).toBe("PLAY");
    expect(() => aiTurn(deal(7, R), 0, mulberry32(1), "medium")).toThrow(/not an AI/);
  });
});

describe("evaluation helpers", () => {
  test("partitionCount", () => {
    expect(partitionCount([], R)).toBe(0);
    expect(partitionCount(parseCards("3D 4C 5H 6S 7D"), R)).toBe(1);
    expect(partitionCount(parseCards("3D"), R)).toBe(1);
    expect(partitionCount(parseCards("3D 5C"), R)).toBe(2);
  });
  test("unbeatable counts what is still out there", () => {
    const all: Card[] = Array.from({ length: 51 }, (_, i) => i); // everything but the 2♠
    expect(unbeatable(classify(parseCards("2S"), R)!, all)).toBe(true);
    expect(unbeatable(classify(parseCards("3D 3C"), R)!, parseCards("4D 4C 9H"))).toBe(false);
    expect(unbeatable(classify(parseCards("3D 3C"), R)!, parseCards("4D 9H"))).toBe(true);
    expect(unbeatable(classify(parseCards("3D 4C 5H 6S 7D"), R)!, all)).toBe(false); // five-card hands are never counted
  });
  test("controlSpend and unseenList", () => {
    expect(controlSpend(classify(parseCards("2S"), R)!)).toBe(3);
    expect(controlSpend(classify(parseCards("AS AD"), R)!)).toBe(2);
    expect(controlSpend(classify(parseCards("9D"), R)!)).toBe(0);
    const g = deal(3, R, SEATS);
    const u = unseenList(publicView(g, 0), g.players[0].hand);
    expect(u).toHaveLength(39);
    expect(u.some((c) => g.players[0].hand.includes(c))).toBe(false);
  });
});

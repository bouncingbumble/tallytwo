/**
 * The engine suite: encoding, the classification table, the full comparison matrix, properties
 * over random hands, scoring, deal, the reducer's legality rules, and replay determinism.
 * The port of the handoff's 65-assertion suite, extended.
 */
import { describe, expect, test } from "vitest";
import { aiRngFor } from "../game/seeds";
import { aiTurn } from "../ai/aiTurn";
import { clearPartitionCache } from "../ai/partition";
import { type Card, RANKS, cardCode, cardName, makeDeck, mulberry32, parseCard, parseCards, rank, shuffle, suit } from "./cards";
import { type Combo, classify, describe as describeCombo } from "./combos";
import { beats } from "./compare";
import { type Action, DEFAULT_SEATS, IllegalActionError, type Seat, deal, reduce, replay } from "./reducer";
import { DEFAULT_RULES, withRules } from "./rules";
import { cardPenalty, roundScore } from "./scoring";
import type { GameState } from "./state";

const R = DEFAULT_RULES;
const C = (codes: string): Combo => {
  const c = classify(parseCards(codes), R);
  if (!c) throw new Error(`not a combo: ${codes}`);
  return c;
};
const typeOf = (codes: string, rules = R) => classify(parseCards(codes), rules)?.type ?? null;
const cmp = (a: string, b: string, rules = R) => beats(classify(parseCards(a), rules)!, classify(parseCards(b), rules)!);

/** All-AI seats, so a round can be driven to the end without a human. */
const AI_SEATS: Seat[] = [
  { name: "A", kind: "ai", personality: "marshal" },
  { name: "B", kind: "ai", personality: "outlaw" },
  { name: "C", kind: "ai", personality: "gambler" },
  { name: "D", kind: "ai", personality: "marshal" },
];

/** The first seed in 1..200 that deals the 3♦ to seat 0. */
function seedWhereSeat0Leads(): number {
  for (let s = 1; s <= 200; s++) if (deal(s, R).players[0].hand.includes(0)) return s;
  throw new Error("no seed found");
}

function playToEnd(seed: number, seats = AI_SEATS, rules = R): { final: GameState; actions: Action[] } {
  const rng = aiRngFor(seed);
  let g = deal(seed, rules, seats);
  const actions: Action[] = [];
  while (g.phase === "playing" && actions.length < 600) {
    const a = aiTurn(g, g.turn, rng, "medium");
    actions.push(a);
    g = reduce(g, a);
  }
  return { final: g, actions };
}

describe("cards", () => {
  test("code round-trip for all 52 values", () => {
    for (let v = 0; v < 52; v++) expect(parseCard(cardCode(v))).toBe(v);
  });
  test("encoding", () => {
    expect(rank(0)).toBe(0);
    expect(suit(0)).toBe(0);
    expect(rank(51)).toBe(12);
    expect(suit(51)).toBe(3);
    expect(cardCode(0)).toBe("3D");
    expect(cardCode(51)).toBe("2S");
    expect(cardName(0)).toBe("Three of Diamonds");
    expect(parseCards("3D 4C 5H")).toEqual([0, 5, 10]);
    expect(RANKS[12]).toBe("2");
    expect(() => parseCard("ZZ")).toThrow();
  });
  test("mulberry32 is deterministic and shuffle is a non-mutating permutation", () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    for (let i = 0; i < 5; i++) expect(a()).toBe(b());
    const deck = makeDeck();
    const s = shuffle(deck, mulberry32(3));
    expect(deck).toEqual(makeDeck());
    expect(s).not.toEqual(deck);
    expect([...s].sort((x, y) => x - y)).toEqual(deck);
  });
});

describe("classification", () => {
  test("the table", () => {
    expect(typeOf("9S")).toBe("single");
    expect(typeOf("9S 9H")).toBe("pair");
    expect(typeOf("9S 8H")).toBeNull();
    expect(typeOf("4D 4C 4H")).toBe("triple");
    expect(typeOf("4D 4C 4H 4S")).toBeNull();
    expect(typeOf("3D 4C 5H 6S 7D")).toBe("straight");
    expect(typeOf("10D JC QH KS AD")).toBe("straight");
    expect(typeOf("JD QC KH AS 2D")).toBeNull();
    expect(typeOf("3H 5H 9H JH KH")).toBe("flush");
    expect(typeOf("KD KC KH 4S 4D")).toBe("fullhouse");
    expect(typeOf("KD KC KH KS 4D")).toBe("four");
    expect(typeOf("3H 4H 5H 6H 7H")).toBe("straightflush");
    expect(typeOf("3D 4C 6H 7S 8D")).toBeNull();
    expect(typeOf("3D 4C 5H 6S 7D 8C")).toBeNull();
  });
  test("wrap-around straights are a rule", () => {
    const wrap = withRules({ straightWrap: true });
    expect(typeOf("AD 2C 3H 4S 5D")).toBeNull();
    expect(typeOf("2D 3C 4H 5S 6D")).toBeNull();
    expect(typeOf("AD 2C 3H 4S 5D", wrap)).toBe("straight");
    expect(typeOf("2D 3C 4H 5S 6D", wrap)).toBe("straight");
    expect(cmp("3D 4C 5H 6S 7D", "AD 2C 3H 4S 5D", wrap)).toBe(true);
    expect(cmp("2D 3C 4H 5S 6D", "AD 2C 3H 4S 5D", wrap)).toBe(true);
    expect(typeOf("AH 2H 3H 4H 5H", wrap)).toBe("straightflush");
  });
  test("describe", () => {
    expect(describeCombo(C("KD KC KH 4S 4D"))).toBe("Full House, Kings over Fours");
    expect(describeCombo(C("KD KC KH KS 4D"))).toBe("Four Kings");
    expect(describeCombo(C("9S 9H"))).toBe("Pair of Nines");
    expect(describeCombo(C("4D 4C 4H"))).toBe("Three Fours");
    expect(describeCombo(C("3D 4C 5H 6S 7D"))).toBe("Straight, Seven high");
    expect(describeCombo(C("3H 5H 9H JH KH"))).toBe("Flush in Hearts, King high");
    expect(describeCombo(C("3H 4H 5H 6H 7H"))).toBe("Straight Flush in Hearts, Seven high");
    expect(describeCombo(C("2S"))).toBe("Deuce of Spades");
    expect(describeCombo(null)).toBe("—");
  });
});

describe("comparison", () => {
  test("singles by value, suits ♦ < ♣ < ♥ < ♠", () => {
    expect(cmp("2D", "AS")).toBe(true);
    expect(cmp("9S", "9H")).toBe(true);
    expect(cmp("9H", "9C")).toBe(true);
    expect(cmp("9C", "9D")).toBe(true);
    expect(cmp("9D", "9C")).toBe(false);
  });
  test("categories", () => {
    expect(cmp("3H 5H 9H JH KH", "10D JC QH KS AD")).toBe(true);
    expect(cmp("4D 4C 4H 5S 5D", "AH KH QH JH 9H")).toBe(true);
    expect(cmp("4D 4C 4H 4S 5D", "AD AC AH KS KD")).toBe(true);
    expect(cmp("3H 4H 5H 6H 7H", "AD AC AH AS KD")).toBe(true);
    expect(cmp("9S 9H", "AS")).toBe(false);
    expect(cmp("AS", "9S 9H")).toBe(false);
  });
  test("flush: suit first by default, highest card when the flag is off", () => {
    expect(cmp("3S 5S 9S JS QS", "AH KH QH JH 9H")).toBe(true);
    expect(cmp("3S 5S 9S JS QS", "AH KH QH JH 9H", withRules({ flushSuitFirst: false }))).toBe(false);
  });
  test("the full 5x5 category matrix", () => {
    const samples = ["3D 4C 5H 6S 7D", "3H 5H 9H JH KH", "KD KC KH 4S 4D", "KD KC KH KS 4D", "3H 4H 5H 6H 7H"];
    for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) if (i !== j) expect(cmp(samples[i], samples[j])).toBe(i > j);
  });
  test("anything beats an open table; shapes must match", () => {
    expect(beats(C("3D"), null)).toBe(true);
    expect(beats(C("3D 4C 5H 6S 7D"), null)).toBe(true);
    expect(beats(C("2S"), C("3D 3C"))).toBe(false);
  });
  test("properties over 4000 random hands: antisymmetric and irreflexive", () => {
    const rng = mulberry32(7);
    let anti = 0;
    let refl = 0;
    let pairs = 0;
    for (let i = 0; i < 4000; i++) {
      const d = shuffle(makeDeck(), rng);
      const n = [1, 2, 3, 5][Math.floor(rng() * 4)];
      const a = classify(d.slice(0, n), R);
      const b = classify(d.slice(n, 2 * n), R);
      if (!a || !b) continue;
      pairs++;
      if (beats(a, b) && beats(b, a)) anti++;
      if (beats(a, a)) refl++;
    }
    expect(pairs).toBeGreaterThan(1000);
    expect(anti).toBe(0);
    expect(refl).toBe(0);
  });
});

describe("scoring", () => {
  test("penalties double at ten and triple at thirteen", () => {
    expect(cardPenalty(1)).toBe(1);
    expect(cardPenalty(9)).toBe(9);
    expect(cardPenalty(10)).toBe(20);
    expect(cardPenalty(12)).toBe(24);
    expect(cardPenalty(13)).toBe(39);
  });
  test("the winner collects the pot and the deltas sum to zero", () => {
    const d = roundScore([0, 4, 10, 13]);
    expect(d).toEqual([63, -4, -20, -39]);
    expect(d.reduce((a, b) => a + b, 0)).toBe(0);
  });
});

describe("deal", () => {
  test("13 each, all distinct, sorted, led by the 3♦ holder", () => {
    const g = deal(1, R);
    expect(g.players).toHaveLength(4);
    for (const p of g.players) {
      expect(p.hand).toHaveLength(13);
      expect(p.hand).toEqual([...p.hand].sort((a, b) => a - b));
    }
    expect(new Set(g.players.flatMap((p) => p.hand)).size).toBe(52);
    expect(g.players[g.turn].hand).toContain(0);
    expect(g.leader).toBe(g.turn);
    expect(g.forced3D).toBe(true);
    expect(g.phase).toBe("playing");
    expect(g.round).toBe(1);
    expect(g.totals).toEqual([0, 0, 0, 0]);
    expect(g.players[0].kind).toBe("human");
    expect(g.players[0].personality).toBeUndefined();
    expect(g.players[1].personality).toBe("outlaw");
    expect(g.players[2].personality).toBe("marshal"); // Marshal Cobb sits in the middle of the three
    expect(g.players[3].personality).toBe("gambler");
  });
  test("the 3♦ rule and later rounds follow the rules", () => {
    expect(deal(1, withRules({ mustLeadWith3D: false })).forced3D).toBe(false);
    const r2 = deal(1, R, DEFAULT_SEATS, 2, 3, [5, -1, -2, -2]);
    expect(r2.round).toBe(2);
    expect(r2.turn).toBe(3);
    expect(r2.forced3D).toBe(false);
    expect(r2.totals).toEqual([5, -1, -2, -2]);
    const r2d = deal(1, withRules({ laterRoundLead: "threeD" }), DEFAULT_SEATS, 2, 3, [0, 0, 0, 0]);
    expect(r2d.players[r2d.turn].hand).toContain(0);
    expect(r2d.forced3D).toBe(true);
  });
});

describe("reducer", () => {
  const seed = seedWhereSeat0Leads();
  const g0 = deal(seed, R);

  test("the opening play", () => {
    expect(g0.turn).toBe(0);
    expect(() => reduce(g0, { type: "PLAY", player: 1, cards: [g0.players[1].hand[0]] })).toThrow(IllegalActionError);
    expect(() => reduce(g0, { type: "PLAY", player: 0, cards: [g0.players[1].hand[0]] })).toThrow(/not in hand/);
    expect(() => reduce(g0, { type: "PLAY", player: 0, cards: [] })).toThrow(/no cards/);
    expect(() => reduce(g0, { type: "PLAY", player: 0, cards: [0, 0] })).toThrow(/duplicate/);
    const h = g0.players[0].hand;
    const nonPair = h.find((c) => c !== 0 && rank(c) !== rank(h[1]))!;
    expect(() => reduce(g0, { type: "PLAY", player: 0, cards: [h[1], nonPair] })).toThrow(/shape/);
    expect(() => reduce(g0, { type: "PLAY", player: 0, cards: [h[1]] })).toThrow(/3♦/);
    expect(() => reduce(g0, { type: "PASS", player: 0 })).toThrow(/open lead/);
    const g1 = reduce(g0, { type: "PLAY", player: 0, cards: [0] });
    expect(g1.lastPlay?.type).toBe("single");
    expect(g1.lastBy).toBe(0);
    expect(g1.history).toEqual([{ by: 0, cards: [0] }]);
    expect(g1.turn).toBe(1);
    expect(g1.players[0].hand).toHaveLength(12);
    expect(g0.players[0].hand).toHaveLength(13); // never mutated
  });

  test("following, passing, and the trick clearing after three passes", () => {
    const g1 = reduce(g0, { type: "PLAY", player: 0, cards: [0] });
    expect(() => reduce(g1, { type: "PLAY", player: 1, cards: g1.players[1].hand.slice(0, 2) })).toThrow();
    const hi = g1.players[1].hand[12];
    const g2 = reduce(g1, { type: "PLAY", player: 1, cards: [hi] });
    expect(g2.lastBy).toBe(1);
    expect(g2.turn).toBe(2);
    expect(() => reduce(g2, { type: "PLAY", player: 2, cards: [g2.players[2].hand[0]] })).toThrow(/beat/);
    const g3 = reduce(g2, { type: "PASS", player: 2 });
    expect(g3.passesInRow).toBe(1);
    expect(g3.players[2].passed).toBe(true);
    expect(g3.turn).toBe(3);
    const g4 = reduce(g3, { type: "PASS", player: 3 });
    expect(g4.passesInRow).toBe(2);
    const g5 = reduce(g4, { type: "PASS", player: 0 });
    expect(g5.lastPlay).toBeNull();
    expect(g5.passesInRow).toBe(0);
    expect(g5.turn).toBe(1);
    expect(g5.leader).toBe(1);
    expect(g5.players.every((p) => !p.passed)).toBe(true);
    expect(g5.history).toHaveLength(5);
    expect(g4.trickStart).toBe(0); // the first trick runs from the deal
    expect(g5.trickStart).toBe(5); // the next one starts after the clearing pass
    expect(() => reduce(g5, { type: "PASS", player: 1 })).toThrow(/open lead/);
    expect(() => reduce(g5, { type: "SCORE_ROUND" })).toThrow(IllegalActionError);
  });

  test("passLocksOut: a seat that passed is skipped until the trick clears", () => {
    const rules = withRules({ passLocksOut: true });
    const s = (() => {
      for (let x = 1; x <= 300; x++) {
        const d = deal(x, rules);
        if (d.turn === 0 && Math.max(...d.players[0].hand) > Math.min(...d.players[2].hand)) return x;
      }
      throw new Error("no seed");
    })();
    let g = deal(s, rules);
    g = reduce(g, { type: "PLAY", player: 0, cards: [0] });
    g = reduce(g, { type: "PASS", player: 1 });
    g = reduce(g, { type: "PLAY", player: 2, cards: [g.players[2].hand[0]] });
    expect(g.players[1].passed).toBe(true); // a play does not clear the flags under lockout
    expect(g.turn).toBe(3);
    g = reduce(g, { type: "PASS", player: 3 });
    expect(g.turn).toBe(0);
    g = reduce(g, { type: "PLAY", player: 0, cards: [Math.max(...g.players[0].hand)] });
    expect(g.turn).toBe(2); // seat 1 is locked out, seat 2 is next
    g = reduce(g, { type: "PASS", player: 2 });
    expect(g.lastPlay).toBeNull(); // 1, 2 and 3 have all passed: the trick clears to seat 0
    expect(g.turn).toBe(0);
    expect(g.players.every((p) => !p.passed)).toBe(true);
    // without lockout the flags reset on every play
    const plain = reduce(reduce(reduce(deal(s, R), { type: "PLAY", player: 0, cards: [0] }), { type: "PASS", player: 1 }), {
      type: "PLAY",
      player: 2,
      cards: [deal(s, R).players[2].hand[0]],
    });
    expect(plain.players[1].passed).toBe(false);
  });

  test("roundover, SCORE_ROUND and NEXT_ROUND", () => {
    const { final } = playToEnd(11);
    expect(final.phase).toBe("roundover");
    const winner = final.turn;
    expect(final.players[winner].hand).toHaveLength(0);
    expect(() => reduce(final, { type: "PLAY", player: winner, cards: [] })).toThrow(/phase/);
    const scored = reduce(final, { type: "SCORE_ROUND" });
    expect(scored.phase).toBe("scored");
    expect(scored.totals.reduce((a, b) => a + b, 0)).toBe(0);
    expect(scored.totals[winner]).toBeGreaterThan(0);
    expect(scored.turn).toBe(winner);
    expect(() => reduce(scored, { type: "SCORE_ROUND" })).toThrow(IllegalActionError);
    const next = reduce(scored, { type: "NEXT_ROUND", seed: 99 });
    expect(next.round).toBe(2);
    expect(next.seed).toBe(99);
    expect(next.totals).toEqual(scored.totals);
    expect(next.turn).toBe(winner);
    expect(next.forced3D).toBe(false);
    expect(next.players.map((p) => p.name)).toEqual(["A", "B", "C", "D"]);
    const counts = scored.players.map((p) => p.hand.length);
    const loserRules = withRules({ laterRoundLead: "loser" });
    const scoredL = { ...scored, rules: loserRules };
    expect(reduce(scoredL, { type: "NEXT_ROUND", seed: 99 }).turn).toBe(counts.indexOf(Math.max(...counts)));
  });

  test("IllegalActionError carries the action", () => {
    const a: Action = { type: "PASS", player: 0 };
    try {
      reduce(g0, a);
      throw new Error("did not throw");
    } catch (e) {
      expect(e).toBeInstanceOf(IllegalActionError);
      expect((e as IllegalActionError).action).toBe(a);
    }
  });
});

describe("replay", () => {
  test("seed + actions rebuilds the final position, and the AI is deterministic", () => {
    const seed = 1234;
    clearPartitionCache();
    const first = playToEnd(seed);
    expect(first.final.phase).toBe("roundover");
    expect(first.actions.length).toBeGreaterThan(10);
    expect(JSON.stringify(replay(seed, R, first.actions, AI_SEATS))).toBe(JSON.stringify(first.final));
    clearPartitionCache();
    const second = playToEnd(seed);
    expect(JSON.stringify(second.actions)).toBe(JSON.stringify(first.actions));
  });
  test("history records passes as empty plays, so historyToActions can rebuild round 2", () => {
    const { final } = playToEnd(5);
    const passes = final.history.filter((r) => r.cards.length === 0).length;
    const plays = final.history.filter((r) => r.cards.length > 0).length;
    expect(passes + plays).toBe(final.history.length);
    expect(plays).toBeGreaterThan(0);
    const played = new Set<Card>(final.history.flatMap((r) => r.cards));
    expect(played.size).toBe(52 - final.players.reduce((n, p) => n + p.hand.length, 0));
  });
});

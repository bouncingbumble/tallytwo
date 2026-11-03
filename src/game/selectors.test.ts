/**
 * selectors.ts: every rule-of-the-game `if` the components lean on, plus the copied game log
 * round-tripping through replayLog(). Positions are real deals with fields overridden where a
 * specific hand is needed.
 */
import { expect, test } from "vitest";
import { type Rng, THREE_OF_DIAMONDS, parseCards } from "../engine/cards";
import { classify, describe as describeCombo } from "../engine/combos";
import { type Action, deal, reduce } from "../engine/reducer";
import { DEFAULT_RULES, type RuleConfig } from "../engine/rules";
import { roundScore } from "../engine/scoring";
import { type GameState, publicView } from "../engine/state";
import { chooseMove } from "../ai/choose";
import { getPersonality } from "../ai/getPersonality";
import { PERSONALITIES } from "../ai/personalities";
import { COPY } from "./copy";
import { aiRngFor } from "./seeds";
import {
  HUMAN,
  barkLinesFor,
  canPass,
  canToggle,
  emptyFeltText,
  exactMove,
  gameLog,
  hintFor,
  historyToActions,
  humanTurn,
  legalFor,
  liveCards,
  matchOver,
  ROUNDS_PER_MATCH,
  matchWinner,
  musicFor,
  portraitFor,
  replayLog,
  roundDeltas,
  roundWinner,
  signFor,
  sortHand,
  statusFor,
  tensionFor,
} from "./selectors";

/* ---- fixtures ---- */

const dealWhere = (pred: (g: GameState) => boolean, label: string): GameState => {
  for (let seed = 1; seed <= 200; seed++) {
    const g = deal(seed, DEFAULT_RULES);
    if (pred(g)) return g;
  }
  throw new Error(`no seed in 1..200 where ${label}`);
};
const humanLead = (): GameState => dealWhere((g) => g.turn === HUMAN, "seat 0 holds the 3♦");
const aiLead = (): GameState => dealWhere((g) => g.turn !== HUMAN, "an AI holds the 3♦");

const cards = (codes: string): number[] => parseCards(codes).sort((a, b) => a - b);

/** The human on turn with a given hand, lead open and unforced unless `extra` says otherwise. */
const humanHolds = (hand: string, extra: Partial<GameState> = {}): GameState => {
  const g = humanLead();
  return { ...g, forced3D: false, players: g.players.map((p, i) => (i === HUMAN ? { ...p, hand: cards(hand) } : p)), ...extra };
};
/** The human on turn facing a single on the table, played by seat 3. */
const humanFacing = (hand: string, table: string): GameState =>
  humanHolds(hand, { lastPlay: classify(cards(table), DEFAULT_RULES), lastBy: 3, leader: 3, history: [{ by: 3, cards: cards(table) }] });

const moveFor = (g: GameState, rng: Rng): Action => {
  const seat = g.turn;
  const p = g.players[seat];
  const pers = p.kind === "ai" ? getPersonality(p.personality) : PERSONALITIES.marshal;
  const m = chooseMove(publicView(g, seat), p.hand, pers, g.rules, rng, "medium");
  return m ? { type: "PLAY", player: seat, cards: m.cards.slice() } : { type: "PASS", player: seat };
};
const advance = (g: GameState, n: number, rng: Rng): GameState => {
  for (let i = 0; i < n && g.phase === "playing"; i++) g = reduce(g, moveFor(g, rng));
  return g;
};
const playOut = (g: GameState, rng: Rng): GameState => {
  for (let guard = 0; g.phase === "playing" && guard < 1000; guard++) g = reduce(g, moveFor(g, rng));
  expect(g.phase).toBe("roundover");
  return g;
};
const sameCards = (a: readonly number[], b: readonly number[]): boolean => a.length === b.length && a.every((c, i) => c === b[i]);

/* ---- turn guards ---- */

test("humanTurn / canToggle: only the human's turn in a live round", () => {
  expect(humanTurn(null)).toBe(false);
  expect(canToggle(null)).toBe(false);
  expect(canToggle(aiLead())).toBe(false);
  expect(canToggle(humanLead())).toBe(true);
  expect(canToggle({ ...humanLead(), phase: "roundover" })).toBe(false);
  expect(canToggle({ ...humanLead(), phase: "scored" })).toBe(false);
});

test("legalFor: [] off turn, every opening lead includes the 3♦ on turn", () => {
  expect(legalFor(null)).toEqual([]);
  expect(legalFor(aiLead())).toEqual([]);
  const legal = legalFor(humanLead());
  expect(legal.length).toBeGreaterThan(0);
  expect(legal.every((m) => m.cards.includes(THREE_OF_DIAMONDS))).toBe(true);
});

/* ---- the status line, one test per string (P:836-842) ---- */

test("status: no game -> empty, neutral", () => {
  expect(statusFor(null, [], [])).toEqual({ text: "", tone: "neutral" });
});

test("status: an AI on turn -> `<name> is thinking…`", () => {
  const g = aiLead();
  expect(statusFor(g, [], [])).toEqual({ text: COPY.status.thinking(g.players[g.turn].name), tone: "neutral" });
  expect(COPY.status.thinking("Marshal Cobb")).toBe("Marshal Cobb is thinking…");
});

test("status: not playing -> empty", () => {
  expect(statusFor({ ...humanLead(), phase: "roundover" }, [], [])).toEqual({ text: "", tone: "neutral" });
});

test("status: nothing beats the table -> mustPass, bad", () => {
  const g = humanFacing("3C 4C", "2S");
  const legal = legalFor(g);
  expect(legal).toEqual([]);
  expect(statusFor(g, legal, [])).toEqual({ text: COPY.status.mustPass, tone: "bad" });
});

test("status: following with nothing selected -> beatIt", () => {
  const g = humanFacing("3C AS", "9C");
  const legal = legalFor(g);
  expect(legal.length).toBe(1);
  expect(statusFor(g, legal, [])).toEqual({ text: COPY.status.beatIt, tone: "neutral" });
});

test("status: the forced opening lead with nothing selected -> yourLead3D", () => {
  const g = humanLead();
  expect(statusFor(g, legalFor(g), [])).toEqual({ text: COPY.status.yourLead3D, tone: "neutral" });
});

test("status: an open lead with nothing selected -> yourLead", () => {
  const g = humanHolds("3C AS");
  expect(statusFor(g, legalFor(g), [])).toEqual({ text: COPY.status.yourLead, tone: "neutral" });
});

test("status: a selection that is not a hand -> notAHand(n), bad", () => {
  const g = humanHolds("3C 4D AS");
  expect(statusFor(g, legalFor(g), cards("3C 4D"))).toEqual({ text: COPY.status.notAHand(2), tone: "bad" });
  expect(statusFor(g, legalFor(g), cards("3C 4D AS"))).toEqual({ text: COPY.status.notAHand(3), tone: "bad" });
  expect(COPY.status.notAHand(2)).toBe("2 cards — that's not a hand.");
});

test("status: an exact legal move -> its description, good", () => {
  const g = humanHolds("3C 3H AS");
  const legal = legalFor(g);
  expect(statusFor(g, legal, cards("3H 3C"))).toEqual({ text: "Pair of Threes", tone: "good" });
  expect(statusFor(g, legal, cards("AS"))).toEqual({ text: "Ace of Spades", tone: "good" });
});

test("status: a hand without the 3♦ on the forced lead -> needs3D, bad", () => {
  const g = humanLead();
  const other = g.players[HUMAN].hand.find((c) => c !== THREE_OF_DIAMONDS)!;
  const desc = describeCombo(classify([other], DEFAULT_RULES));
  expect(statusFor(g, legalFor(g), [other])).toEqual({ text: COPY.status.needs3D(desc), tone: "bad" });
  expect(COPY.status.needs3D("Pair of Fours")).toBe("Pair of Fours — must include the 3♦.");
});

test("status: a hand that does not beat the table -> doesntBeat, bad", () => {
  const g = humanFacing("3C AS", "9C");
  expect(statusFor(g, legalFor(g), cards("3C"))).toEqual({ text: COPY.status.doesntBeat("Three of Clubs"), tone: "bad" });
  expect(COPY.status.doesntBeat("Three of Clubs")).toBe("Three of Clubs — doesn't beat it.");
});


/* ---- the controls ---- */

test("canPass: false on your own lead with moves, true when following or stuck, false off turn", () => {
  const lead = humanHolds("3C AS");
  expect(canPass(lead, legalFor(lead))).toBe(false);
  const following = humanFacing("3C AS", "9C");
  expect(canPass(following, legalFor(following))).toBe(true);
  const stuck = humanFacing("3C 4C", "2S");
  expect(canPass(stuck, legalFor(stuck))).toBe(true);
  expect(canPass(aiLead(), [])).toBe(false);
  expect(canPass(null, [])).toBe(false);
});

test("exactMove: the legal move whose cards equal the selection", () => {
  const g = humanHolds("3C 3H 4C 4D 9S");
  const legal = legalFor(g);
  expect(exactMove(legal, [])).toBeNull();
  expect(exactMove(legal, cards("3H 3C"))!.type).toBe("pair");
  expect(exactMove(legal, cards("9S"))!.type).toBe("single");
  expect(exactMove(legal, cards("3C 4C"))).toBeNull();
  expect(exactMove(legal, cards("3C 3H 4C 4D 9S"))).toBeNull();
});

test("liveCards: the cards that can still complete a legal move with the selection", () => {
  const g = humanHolds("3C 3H 4C 4D 9S");
  const legal = legalFor(g);
  expect(liveCards(legal, [])).toBeNull();
  expect([...liveCards(legal, cards("3C"))!].sort((a, b) => a - b)).toEqual(cards("3C 3H"));
  expect([...liveCards(legal, cards("4D"))!].sort((a, b) => a - b)).toEqual(cards("4C 4D"));
  expect(liveCards(legal, cards("3C 4C"))!.size).toBe(0);
  const following = humanFacing("3C 3H 4C 4D 9S", "4S");
  expect([...liveCards(legalFor(following), cards("9S"))!]).toEqual(cards("9S"));
});

test("hintFor returns one of the legal moves (rand = 0.5), null off turn", () => {
  const g = humanLead();
  const legal = legalFor(g);
  const hint = hintFor(g, legal, () => 0.5);
  expect(hint).not.toBeNull();
  expect(legal.some((m) => sameCards(m.cards, hint!.cards))).toBe(true);
  const following = humanFacing("3C AS", "9C");
  const h2 = hintFor(following, legalFor(following), () => 0.5);
  expect(h2!.cards).toEqual(cards("AS"));
  expect(hintFor(null, [], () => 0.5)).toBeNull();
  expect(hintFor(aiLead(), [], () => 0.5)).toBeNull();
  expect(hintFor(humanFacing("3C 4C", "2S"), [], () => 0.5)).toBeNull();
});

test("sortHand: by rank (value order) or by suit then rank", () => {
  expect(sortHand([5, 0, 3, 8])).toEqual([0, 3, 5, 8]); // low to high, a rank's cards by suit
  expect(sortHand([51, 1, 2, 0])).toEqual([0, 1, 2, 51]); // 3♦ 3♣ 3♥ … 2♠
  const hand = [5, 0, 3, 8];
  sortHand(hand);
  expect(hand).toEqual([5, 0, 3, 8]); // never mutates
});

/* ---- the felt ---- */

test("signFor: Table / waiting / played / fresh lead", () => {
  expect(signFor(null)).toEqual({ who: COPY.sign.table, text: "" });
  const g = humanLead();
  expect(signFor(g)).toEqual({ who: COPY.sign.table, text: COPY.sign.waitingOpening });
  const g1 = reduce(g, { type: "PLAY", player: HUMAN, cards: [THREE_OF_DIAMONDS] });
  expect(signFor(g1)).toEqual({ who: COPY.sign.played("You"), text: "Three of Diamonds" });
  let g4 = g1;
  for (let i = 0; i < 3; i++) g4 = reduce(g4, { type: "PASS", player: g4.turn });
  expect(g4.lastPlay).toBeNull();
  expect(signFor(g4)).toEqual({ who: COPY.sign.table, text: COPY.sign.freshLead });
});

test("emptyFeltText: cards are down before the first play, then who leads", () => {
  const g = humanLead();
  expect(emptyFeltText(g)).toBe(COPY.sign.cardsDown);
  let g4 = reduce(g, { type: "PLAY", player: HUMAN, cards: [THREE_OF_DIAMONDS] });
  for (let i = 0; i < 3; i++) g4 = reduce(g4, { type: "PASS", player: g4.turn });
  expect(emptyFeltText(g4)).toBe(COPY.sign.clearLeads("You"));
});

test("roundDeltas / roundWinner: null while playing, the scoring and the winner from roundover on", () => {
  const g = humanLead();
  expect(roundDeltas(g)).toBeNull();
  expect(roundWinner(g)).toBeNull();
  const last = { ...g, players: g.players.map((p, i) => (i === HUMAN ? { ...p, hand: [THREE_OF_DIAMONDS] } : p)) };
  const over = reduce(last, { type: "PLAY", player: HUMAN, cards: [THREE_OF_DIAMONDS] });
  expect(over.phase).toBe("roundover");
  expect(roundWinner(over)).toBe(HUMAN);
  expect(roundDeltas(over)).toEqual(roundScore([0, 13, 13, 13]));
  const scored = reduce(over, { type: "SCORE_ROUND" });
  expect(roundDeltas(scored)).toEqual(roundScore([0, 13, 13, 13]));
  expect(roundWinner(scored)).toBe(HUMAN);
});

/* ---- the match ---- */

test("matchOver: a match is exactly ROUNDS_PER_MATCH = 8 rounds — true once round 8 is scored, never before, not mid-round", () => {
  expect(ROUNDS_PER_MATCH).toBe(8);
  const scored: GameState = { ...humanLead(), round: 8, phase: "scored" };
  expect(matchOver(scored)).toBe(true);
  for (let r = 1; r < 8; r++) expect(matchOver({ ...scored, round: r }), `round ${r}`).toBe(false);
  expect(matchOver({ ...scored, phase: "roundover" })).toBe(false);
  expect(matchOver({ ...scored, phase: "playing" })).toBe(false);
  expect(matchOver({ ...scored, round: 9 })).toBe(true); // never reached: NEW_MATCH follows the final poster
  expect(matchOver(null)).toBe(false);
});

test("matchWinner: the clear leader; a tie goes to the last round's winner, else the lowest seat", () => {
  const g = humanLead();
  expect(matchWinner({ ...g, totals: [3, 10, -5, -8], turn: 0 })).toBe(1);
  expect(matchWinner({ ...g, totals: [10, 10, -10, -10], turn: 1 })).toBe(1);
  expect(matchWinner({ ...g, totals: [10, 10, -10, -10], turn: 0 })).toBe(0);
  expect(matchWinner({ ...g, totals: [10, 10, -10, -10], turn: 2 })).toBe(0);
  expect(matchWinner({ ...g, totals: [0, 0, 0, 0], turn: 3 })).toBe(3);
});

/* ---- music ---- */

test("musicFor: title -> null, table -> table, scored -> results, howto -> results", () => {
  expect(musicFor(null, "none")).toBeNull();
  expect(musicFor(null, "settings")).toBeNull();
  expect(musicFor(null, "howto")).toBe("results");
  const g = humanLead();
  expect(musicFor(g, "none")).toBe("table");
  expect(musicFor(g, "settings")).toBe("table");
  expect(musicFor(g, "howto")).toBe("results");
  expect(musicFor({ ...g, phase: "roundover" }, "none")).toBe("table");
  expect(musicFor({ ...g, phase: "scored" }, "none")).toBe("results");
});

test("tensionFor: on at 3 cards in any hand, off at 4, held through roundover, off once scored", () => {
  const g = humanLead();
  const withCount = (seat: number, n: number, extra: Partial<GameState> = {}): GameState => ({
    ...g,
    players: g.players.map((p, i) => (i === seat ? { ...p, hand: p.hand.slice(0, n) } : p)),
    ...extra,
  });
  expect(tensionFor(null)).toBe(false);
  expect(tensionFor(g)).toBe(false);
  expect(tensionFor(withCount(2, 4))).toBe(false);
  expect(tensionFor(withCount(2, 3))).toBe(true);
  expect(tensionFor(withCount(0, 1))).toBe(true);
  expect(tensionFor(withCount(2, 3, { phase: "scored" }))).toBe(false);
  // roundover: the winner (g.turn) holds nothing; the flag counts the cards they just played, so it
  // is exactly what it was at the winning play and the round's end is one switch, to results
  const five = { type: "straight", key: 4, cards: [0, 4, 8, 12, 16] } as GameState["lastPlay"];
  const three = { type: "triple", key: 2, cards: [0, 1, 2] } as GameState["lastPlay"];
  const finish = (lastPlay: GameState["lastPlay"], extra: Partial<GameState> = {}): GameState => ({ ...withCount(0, 0), phase: "roundover", turn: 0, lastBy: 0, lastPlay, ...extra });
  expect(tensionFor(finish(five))).toBe(false); // a five-card finish with every other seat at 13: no tension before, none now
  expect(tensionFor(finish(three))).toBe(true);
  expect(tensionFor(finish(five, { players: withCount(2, 3).players.map((p, i) => (i === 0 ? { ...p, hand: [] } : p)) }))).toBe(true); // another seat is low
});

/* ---- seats ---- */

test("portraitFor / barkLinesFor: the AI seats have a face and lines, the human has neither", () => {
  const g = humanLead();
  expect(portraitFor(g.players[0])).toBeNull();
  expect(portraitFor(g.players[1])).toBe("p_outlaw");
  expect(portraitFor(g.players[2])).toBe("p_marshal");
  expect(portraitFor(g.players[3])).toBe("p_gambler");
  expect(barkLinesFor(g, 1, "pass")).toEqual(["Tch.", "Fine."]);
  expect(barkLinesFor(g, 2, "win")).toEqual(["Justice served."]);
  expect(barkLinesFor(g, 3, "play")).toEqual(PERSONALITIES.gambler.barks.play);
  expect(barkLinesFor(g, 0, "play")).toEqual([]);
  expect(barkLinesFor(g, 0, "win")).toEqual([]);
  expect(barkLinesFor(g, 9, "play")).toEqual([]);
});

/* ---- the copied game log ---- */

test("historyToActions: a record with cards is a PLAY, an empty one is a PASS", () => {
  expect(historyToActions([])).toEqual([]);
  expect(
    historyToActions([
      { by: 1, cards: [0] },
      { by: 2, cards: [] },
      { by: 3, cards: [4, 8, 12, 16, 20] },
    ]),
  ).toEqual([
    { type: "PLAY", player: 1, cards: [0] },
    { type: "PASS", player: 2 },
    { type: "PLAY", player: 3, cards: [4, 8, 12, 16, 20] },
  ]);
});

test("gameLog: leader is the first record's author, or the deal's leader before any play", () => {
  const g = aiLead();
  expect(gameLog(g)).toEqual({ seed: g.seed, rules: g.rules, round: 1, leader: g.turn, totals: [0, 0, 0, 0], history: [], final: g });
  const g1 = reduce(g, { type: "PLAY", player: g.turn, cards: [THREE_OF_DIAMONDS] });
  expect(gameLog(g1).leader).toBe(g.turn);
  expect(gameLog(g1).history).toBe(g1.history);
});

test("replayLog(gameLog(g)) rebuilds a round-1 position after several moves", () => {
  const rng = aiRngFor(11);
  const g = advance(deal(11, DEFAULT_RULES), 9, rng);
  expect(g.history.length).toBeGreaterThanOrEqual(5);
  expect(JSON.stringify(replayLog(gameLog(g)))).toBe(JSON.stringify(g));
  const fresh = deal(12, DEFAULT_RULES);
  expect(JSON.stringify(replayLog(gameLog(fresh)))).toBe(JSON.stringify(fresh));
});

for (const lead of ["winner", "loser", "threeD"] as const) {
  test(`replayLog(gameLog(g)) rebuilds round-2 positions reached through SCORE_ROUND + NEXT_ROUND under laterRoundLead "${lead}"`, () => {
    const rules: RuleConfig = { ...DEFAULT_RULES, laterRoundLead: lead };
    const over = playOut(deal(21, rules), aiRngFor(21));
    const scored = reduce(over, { type: "SCORE_ROUND" });
    const r2 = reduce(scored, { type: "NEXT_ROUND", seed: 77 });
    expect(r2.round).toBe(2);
    expect(r2.totals).toEqual(scored.totals);
    expect(r2.totals.some((t) => t !== 0)).toBe(true);
    expect(JSON.stringify(replayLog(gameLog(r2)))).toBe(JSON.stringify(r2)); // before any play
    const g = advance(r2, 7, aiRngFor(77));
    expect(g.history.length).toBeGreaterThanOrEqual(5);
    expect(JSON.stringify(replayLog(gameLog(g)))).toBe(JSON.stringify(g));
    expect(gameLog(g).leader).toBe(r2.leader); // the log's leader is who led the round, not the current trick
  });
}

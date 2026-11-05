/**
 * reduce(state, action) -> state. Pure: it never mutates its input and never calls
 * Math.random or the clock. Everything that changes the game goes through here.
 *
 * Illegal PLAY and PASS actions THROW. The UI only ever dispatches moves that came from
 * legalMoves(), and the AI only returns such moves, so a throw is a bug, not a user error —
 * and it is reproducible: `replay(seed, rules, actions)` rebuilds any round-1 position from
 * the seed and the action list, and `deal(seed, rules, seats, round, totals)`
 * does the same for a later round. A bug report is a seed and a list of moves.
 *
 * Actions:
 *   DEAL        start a new match at round 1 (the app uses NEW_MATCH -> deal() instead)
 *   PLAY        the seat on turn plays a legal combo
 *   PASS        the seat on turn passes (never legal on an open lead)
 *   SCORE_ROUND roundover -> scored: apply roundScore() to the totals
 *   NEXT_ROUND  deal the next round with the same rules and seats; the 3♦ holder leads again
 */
import { type Card, THREE_OF_DIAMONDS, makeDeck, mulberry32, shuffle } from "./cards";
import { classify } from "./combos";
import { beats } from "./compare";
import type { RuleConfig } from "./rules";
import { roundScore } from "./scoring";
import { type GameState, type Player, type PlayerKind, needThreeD } from "./state";

export type Action =
  | { type: "DEAL"; seed: number }
  | { type: "PLAY"; player: number; cards: Card[] }
  | { type: "PASS"; player: number }
  | { type: "SCORE_ROUND" }
  | { type: "NEXT_ROUND"; seed: number };

export interface Seat {
  name: string;
  kind: PlayerKind;
  personality?: string;
}

/** Seat 0 is the human and has no personality; the three AI seats are the saloon regulars. */
export const DEFAULT_SEATS: readonly Seat[] = [
  { name: "You", kind: "human" },
  { name: "Dusty Vane", kind: "ai", personality: "outlaw" },
  { name: "Marshal Cobb", kind: "ai", personality: "marshal" },
  { name: "Lucky Pearl", kind: "ai", personality: "gambler" },
];

/**
 * Deal a round. Every round is led by whoever holds the 3♦, and that opening play must include
 * it. Hands come out sorted ascending.
 */
export function deal(
  seed: number,
  rules: RuleConfig,
  seats: readonly Seat[] = DEFAULT_SEATS,
  round = 1,
  totals: readonly number[] = [0, 0, 0, 0],
): GameState {
  const rng = mulberry32(seed);
  const deck = shuffle(makeDeck(), rng);
  const hands: Card[][] = seats.map(() => []);
  for (let i = 0; i < 52; i++) hands[i % seats.length].push(deck[i]);
  for (const h of hands) h.sort((a, b) => a - b);

  const players: Player[] = seats.map((s, i) => ({
    name: s.name,
    kind: s.kind,
    ...(s.personality !== undefined ? { personality: s.personality } : {}),
    hand: hands[i],
    passed: false,
  }));

  const lead = players.findIndex((p) => p.hand.includes(THREE_OF_DIAMONDS));
  return {
    seed,
    round,
    rules,
    phase: "playing",
    players,
    turn: lead,
    leader: lead,
    lastPlay: null,
    lastBy: null,
    passesInRow: 0,
    forced3D: true,
    history: [],
    trickStart: 0,
    totals: totals.slice(),
  };
}

export class IllegalActionError extends Error {
  action: Action;
  constructor(message: string, action: Action) {
    super(`illegal ${action.type}: ${message}`);
    this.name = "IllegalActionError";
    this.action = action;
  }
}

const seatsOf = (g: GameState): Seat[] =>
  g.players.map((p) => ({ name: p.name, kind: p.kind, ...(p.personality !== undefined ? { personality: p.personality } : {}) }));

/** The next seat to act after `from`. A seat that passed may play again when the trick comes back round. */
const nextSeat = (g: GameState, from: number): number => (from + 1) % g.players.length;

function play(g: GameState, a: Extract<Action, { type: "PLAY" }>): GameState {
  if (g.phase !== "playing") throw new IllegalActionError(`phase is ${g.phase}`, a);
  if (a.player !== g.turn) throw new IllegalActionError(`seat ${a.player} is not on turn (turn is ${g.turn})`, a);
  const hand = g.players[a.player].hand;
  const cards = a.cards.slice().sort((x, y) => x - y);
  if (cards.length === 0) throw new IllegalActionError("no cards", a);
  if (new Set(cards).size !== cards.length) throw new IllegalActionError("duplicate cards", a);
  if (!cards.every((c) => hand.includes(c))) throw new IllegalActionError("cards not in hand", a);
  const combo = classify(cards, g.rules);
  if (!combo) throw new IllegalActionError("not a legal hand shape", a);
  if (!beats(combo, g.lastPlay)) throw new IllegalActionError("does not beat the table", a);
  if (needThreeD(g) && !cards.includes(THREE_OF_DIAMONDS)) throw new IllegalActionError("opening lead must include the 3♦", a);

  const gone = new Set(cards);
  const players = g.players.map((p, i) =>
    i === a.player ? { ...p, hand: p.hand.filter((c) => !gone.has(c)), passed: false } : { ...p, passed: false },
  );
  const emptied = players[a.player].hand.length === 0;
  const next: GameState = {
    ...g,
    players,
    lastPlay: combo,
    lastBy: a.player,
    passesInRow: 0,
    history: [...g.history, { by: a.player, cards }],
    phase: emptied ? "roundover" : "playing",
  };
  // After a round ends the turn stays on the winner; that is who NEXT_ROUND reads as "winner".
  next.turn = emptied ? a.player : nextSeat(next, a.player);
  return next;
}

function pass(g: GameState, a: Extract<Action, { type: "PASS" }>): GameState {
  if (g.phase !== "playing") throw new IllegalActionError(`phase is ${g.phase}`, a);
  if (a.player !== g.turn) throw new IllegalActionError(`seat ${a.player} is not on turn (turn is ${g.turn})`, a);
  if (g.lastPlay === null || g.lastBy === null) throw new IllegalActionError("cannot pass on an open lead", a);

  const players = g.players.map((p, i) => (i === a.player ? { ...p, passed: true } : p));
  const history = [...g.history, { by: a.player, cards: [] }];
  const lastBy = g.lastBy;
  // The trick clears when nobody but the last player to play is still in it. Every play resets
  // the flags, so this is exactly "three passes in a row".
  if (players.every((p, i) => i === lastBy || p.passed)) {
    return {
      ...g,
      players: players.map((p) => ({ ...p, passed: false })),
      history,
      trickStart: history.length,
      lastPlay: null,
      passesInRow: 0,
      turn: lastBy,
      leader: lastBy,
    };
  }
  const next: GameState = { ...g, players, history, passesInRow: g.passesInRow + 1 };
  next.turn = nextSeat(next, a.player);
  return next;
}

function scoreRound(g: GameState, a: Action): GameState {
  if (g.phase !== "roundover") throw new IllegalActionError(`phase is ${g.phase}`, a);
  const delta = roundScore(g.players.map((p) => p.hand.length));
  return { ...g, phase: "scored", totals: g.totals.map((t, i) => t + delta[i]) };
}

function nextRound(g: GameState, seed: number): GameState {
  return deal(seed, g.rules, seatsOf(g), g.round + 1, g.totals);
}

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "DEAL":
      return deal(action.seed, state.rules, seatsOf(state));
    case "PLAY":
      return play(state, action);
    case "PASS":
      return pass(state, action);
    case "SCORE_ROUND":
      return scoreRound(state, action);
    case "NEXT_ROUND":
      return nextRound(state, action.seed);
  }
}

/** Rebuild a round-1 position from its seed and action list. Deterministic. */
export function replay(seed: number, rules: RuleConfig, actions: readonly Action[], seats: readonly Seat[] = DEFAULT_SEATS): GameState {
  let g = deal(seed, rules, seats);
  for (const a of actions) g = reduce(g, a);
  return g;
}

/**
 * Card sharp's lookahead: Monte Carlo rollouts over guessed deals. Pure; every random draw
 * comes from the `rng` it is handed, so a seeded round still replays exactly.
 *
 * For each sample, the cards Card sharp cannot see are shuffled and dealt to the opponents in
 * the counts they actually hold (a "determinization"). Every option — a few of the heuristic's
 * best moves, plus passing when following — is then played out to the end of the round, every
 * seat playing the quick heuristic (ROLLOUT tuning), and scored with the real round score
 * (scoring.roundScore: winning takes the pot, losing pays per card left). The option with the
 * best total wins. Within a sample all options share one deal and one rollout stream (common
 * random numbers), so they are compared on equal luck.
 *
 * The rollout table is a few plain arrays, not GameState: the same trick rules as the reducer
 * (a play must beat the table, the trick clears when every seat but its last player has passed,
 * a seat that passed may play again when the trick comes back round), without the copying.
 */
import { type Card, type Rng, mulberry32, shuffle } from "../engine/cards";
import type { Combo } from "../engine/combos";
import type { RuleConfig } from "../engine/rules";
import { roundScore } from "../engine/scoring";
import type { PublicView } from "../engine/state";
import { WEIGHTS } from "./evaluate";
import { type Tuning, heuristicPick } from "./heuristic";
import { legalMoves } from "./moves";

export const LOOKAHEAD = {
  /** How many of the heuristic's best moves are played out (passing is added when following). */
  moves: 4,
  /** Guessed deals per decision; each option is played out once per deal. */
  samples: 24,
  /** A rollout that has not ended after this many turns is scored as it stands. */
  maxTurns: 240,
} as const;

/** How every seat plays inside a rollout: Card sharp's old fixed tuning, without the counting. */
export const ROLLOUT: Tuning = { control: WEIGHTS.hardControl, passBias: WEIGHTS.hardPass, count: false };

interface Table {
  hands: Card[][];
  lastPlay: Combo | null;
  lastBy: number;
  passed: boolean[];
  passesInRow: number;
  turn: number;
}

const NO_PLAYED: Set<Card> = new Set();

/** One turn on the rollout table. Returns the seat that went out, or -1. */
function step(t: Table, move: Combo | null): number {
  const seat = t.turn;
  const n = t.hands.length;
  if (move) {
    const gone = new Set(move.cards);
    t.hands[seat] = t.hands[seat].filter((c) => !gone.has(c));
    t.lastPlay = move;
    t.lastBy = seat;
    t.passed.fill(false);
    t.passesInRow = 0;
    if (t.hands[seat].length === 0) return seat;
    t.turn = (seat + 1) % n;
    return -1;
  }
  t.passed[seat] = true;
  t.passesInRow++;
  if (t.passed.every((p, i) => p || i === t.lastBy)) {
    t.lastPlay = null;
    t.passed.fill(false);
    t.passesInRow = 0;
    t.turn = t.lastBy;
  } else t.turn = (seat + 1) % n;
  return -1;
}

/** The quick player: out in one if it can, otherwise the heuristic. Never passes on an open lead. */
function rolloutMove(t: Table, rules: RuleConfig, rng: Rng): Combo | null {
  const seat = t.turn;
  const hand = t.hands[seat];
  const moves = legalMoves(hand, t.lastPlay, rules, false);
  if (!moves.length) return null;
  const finisher = moves.find((m) => m.cards.length === hand.length);
  if (finisher) return finisher;
  const pub: PublicView = {
    me: seat,
    counts: t.hands.map((h) => h.length),
    lastPlay: t.lastPlay,
    passesInRow: t.passesInRow,
    played: NO_PLAYED,
    need3D: false,
  };
  return heuristicPick(pub, hand, moves, rules, rng, ROLLOUT);
}

/** Play `first` for seat `me`, then everyone plays on to the end of the round; seat me's score. */
function playOut(start: Table, me: number, first: Combo | null, rules: RuleConfig, rng: Rng): number {
  const t: Table = { ...start, hands: start.hands.slice(), passed: start.passed.slice() };
  let out = step(t, first);
  for (let i = 0; out < 0 && i < LOOKAHEAD.maxTurns; i++) out = step(t, rolloutMove(t, rules, rng));
  return roundScore(t.hands.map((h) => h.length))[me];
}

/**
 * The option (a move, or null for a pass) with the best mean rollout score. `options` is
 * non-empty; ties go to the earlier option, so list the heuristic's favourite first.
 */
export function lookahead(pub: PublicView, hand: readonly Card[], options: readonly (Combo | null)[], rules: RuleConfig, rng: Rng): Combo | null {
  if (options.length === 1) return options[0];
  const n = pub.counts.length;
  const me = pub.me;

  // Unseen: every card not played and not in my hand, dealt by count to the others.
  const mine = new Set(hand);
  const unseen: Card[] = [];
  for (let v = 0; v < 52; v++) if (!pub.played.has(v) && !mine.has(v)) unseen.push(v);

  // The trick as it stands. Play goes round in seat order and every play resets the pass
  // flags, so the seats between the last player and me are exactly the passesInRow who passed.
  const lastBy = pub.lastPlay ? (((me - pub.passesInRow - 1) % n) + n) % n : me;
  const passed = Array.from({ length: n }, () => false);
  if (pub.lastPlay) for (let k = 1; k <= pub.passesInRow; k++) passed[(lastBy + k) % n] = true;

  const totals = options.map(() => 0);
  for (let s = 0; s < LOOKAHEAD.samples; s++) {
    const deck = shuffle(unseen, rng);
    const hands: Card[][] = [];
    let at = 0;
    for (let i = 0; i < n; i++) {
      if (i === me) hands.push(hand.slice());
      else {
        hands.push(deck.slice(at, at + pub.counts[i]).sort((a, b) => a - b));
        at += pub.counts[i];
      }
    }
    const start: Table = { hands, lastPlay: pub.lastPlay, lastBy, passed, passesInRow: pub.passesInRow, turn: me };
    const seed = Math.floor(rng() * 0x100000000);
    options.forEach((o, i) => {
      totals[i] += playOut(start, me, o, rules, mulberry32(seed));
    });
  }

  let best = 0;
  for (let i = 1; i < options.length; i++) if (totals[i] > totals[best]) best = i;
  return options[best];
}

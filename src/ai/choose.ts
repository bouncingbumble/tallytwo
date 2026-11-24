/**
 * chooseMove: the whole AI. Pure. It sees the public state and its own hand, nothing else,
 * and draws every random decision from the `rng` it is handed (a seeded one in the game, so a
 * round replays from its seed; callers that want variety pass Math.random).
 *
 * Difficulty:
 *   easy    a random legal move biased low; occasionally passes for no reason
 *   medium  the heuristics (ai/heuristic.ts), flavoured by the personality (control, noise, passBias)
 *   hard    lookahead (ai/lookahead.ts): the heuristic's best few moves, plus passing when
 *           following, each played out to the end of the round over guessed deals of the
 *           unseen cards, and the best average round score wins
 */
import type { Card, Rng } from "../engine/cards";
import type { Combo } from "../engine/combos";
import type { RuleConfig } from "../engine/rules";
import type { PublicView } from "../engine/state";
import { WEIGHTS } from "./evaluate";
import { type Tuning, heuristicPick, rankMoves } from "./heuristic";
import { LOOKAHEAD, lookahead } from "./lookahead";
import { legalMoves } from "./moves";
import type { Personality } from "./personalities";

export type Difficulty = "easy" | "medium" | "hard";

/** Card sharp's candidate ranking: fixed tuning plus card counting. */
const HARD: Tuning = { control: WEIGHTS.hardControl, passBias: WEIGHTS.hardPass, count: true };

/** Returns the combo to play, or null to pass. Never returns null on an open lead. */
export function chooseMove(
  pub: PublicView,
  hand: readonly Card[],
  pers: Personality,
  rules: RuleConfig,
  rng: Rng,
  difficulty: Difficulty,
): Combo | null {
  const moves = legalMoves(hand, pub.lastPlay, rules, pub.need3D);
  if (!moves.length) return null;

  // Out in one — always take it.
  const finisher = moves.find((m) => m.cards.length === hand.length);
  if (finisher) return finisher;

  if (difficulty === "easy") {
    const sorted = moves.slice().sort((a, b) => a.key - b.key || a.cards.length - b.cards.length);
    const i = Math.min(sorted.length - 1, Math.floor(Math.abs(rng() - rng()) * sorted.length));
    return rng() < 0.12 && pub.lastPlay ? null : sorted[i];
  }

  if (difficulty === "medium") {
    if (rng() < pers.noise) return moves[Math.floor(rng() * moves.length)];
    return heuristicPick(pub, hand, moves, rules, rng, { control: pers.control, passBias: pers.passBias, count: false });
  }

  const options: (Combo | null)[] = rankMoves(pub, hand, moves, rules, HARD)
    .slice(0, LOOKAHEAD.moves)
    .map((r) => r.move);
  if (!options.length) options.push(moves[0]);
  if (pub.lastPlay) options.push(null);
  return lookahead(pub, hand, options, rules, rng);
}

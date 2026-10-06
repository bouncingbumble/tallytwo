/**
 * chooseMove: the whole AI. Pure. It sees the public state and its own hand, nothing else,
 * and draws every random decision from the `rng` it is handed (a seeded one in the game, so a
 * round replays from its seed; callers that want variety pass Math.random).
 *
 * Difficulty:
 *   easy    a random legal move biased low; occasionally passes for no reason
 *   medium  the heuristics, flavoured by the personality (control, noise, passBias)
 *   hard    the heuristics with fixed tuning plus card counting (unbeatable())
 *
 * Measured over 600 games per matchup (DECISIONS.md): Hard is NOT stronger than Medium.
 * Card counting alone buys nothing without lookahead. The labels differ; the play does not.
 */
import type { Card, Rng } from "../engine/cards";
import type { Combo } from "../engine/combos";
import type { RuleConfig } from "../engine/rules";
import type { PublicView } from "../engine/state";
import { WEIGHTS, controlSpend, unbeatable, unseenList } from "./evaluate";
import { legalMoves } from "./moves";
import { partitionCount } from "./partition";
import type { Personality } from "./personalities";

export type Difficulty = "easy" | "medium" | "hard";

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

  const hard = difficulty === "hard";
  if (!hard && rng() < pers.noise) return moves[Math.floor(rng() * moves.length)];

  const pressure = Math.min(...pub.counts.filter((_, i) => i !== pub.me));
  const endgame = pressure <= WEIGHTS.endgameAt;
  const before = partitionCount(hand, rules);
  const control = hard ? WEIGHTS.hardControl : pers.control;
  const unseen = hard ? unseenList(pub, hand) : null;

  // Sample the cheapest few of every shape, so five-card hands stay in contention.
  const groups: Record<string, Combo[]> = {};
  for (const m of moves) (groups[m.type] ??= []).push(m);
  const cand: Combo[] = [];
  for (const k in groups) {
    groups[k].sort((a, b) => a.key - b.key);
    cand.push(...groups[k].slice(0, WEIGHTS.perType));
  }

  let best: Combo | null = null;
  let bestCost = Infinity;
  let bestAfter = 0;
  for (const m of cand) {
    const gone = new Set(m.cards);
    const after = partitionCount(
      hand.filter((c) => !gone.has(c)),
      rules,
    );
    let cost = after * 10 + controlSpend(m) * (endgame ? 1 : control) + m.key * WEIGHTS.keyW;
    if (m.cards.length === 5) cost -= WEIGHTS.fiveBonus; // five-card hands unload fastest
    if (endgame && m.cards.length === 1) cost += WEIGHTS.endgameSingle; // stop feeding cheap singles
    if (hard && unseen && unbeatable(m, unseen)) cost -= WEIGHTS.safeBonus; // card counting
    if (cost < bestCost) {
      bestCost = cost;
      best = m;
      bestAfter = after;
    }
  }
  if (!best) return moves[0];

  // Following: is taking this trick worth what it costs?
  if (pub.lastPlay) {
    const pb = hard ? WEIGHTS.hardPass : pers.passBias;
    if (bestAfter >= before && !endgame && rng() < pb) return null;
    if (controlSpend(best) >= 3 && !endgame && pub.passesInRow < 2 && rng() < pb * 0.6) return null;
  }
  return best;
}

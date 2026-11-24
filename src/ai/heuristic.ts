/**
 * The heuristic move picker shared by Regular (tuned by personality), Card sharp's candidate
 * list, and the quick players inside Card sharp's lookahead rollouts (ai/lookahead.ts). Pure;
 * every random decision comes from the `rng` it is handed.
 */
import type { Card, Rng } from "../engine/cards";
import type { Combo } from "../engine/combos";
import type { RuleConfig } from "../engine/rules";
import type { PublicView } from "../engine/state";
import { WEIGHTS, controlSpend, unbeatable, unseenList } from "./evaluate";
import { partitionCount } from "./partition";

export interface Tuning {
  /** How dearly control cards (2s and aces) are held outside the endgame. */
  control: number;
  /** Chance of letting a trick go when taking it would not shorten the hand. */
  passBias: number;
  /** Card counting: a move nothing unseen can beat earns WEIGHTS.safeBonus. */
  count: boolean;
}

export interface Ranked {
  move: Combo;
  cost: number;
  /** Plays to empty the hand after this move. */
  after: number;
}

/** The cheapest few moves of every shape, scored and sorted cheapest first (ties keep move order). */
export function rankMoves(pub: PublicView, hand: readonly Card[], moves: readonly Combo[], rules: RuleConfig, tune: Tuning): Ranked[] {
  const endgame = isEndgame(pub);
  const unseen = tune.count ? unseenList(pub, hand) : null;

  // Sample the cheapest few of every shape, so five-card hands stay in contention.
  const groups: Record<string, Combo[]> = {};
  for (const m of moves) (groups[m.type] ??= []).push(m);
  const cand: Combo[] = [];
  for (const k in groups) {
    groups[k].sort((a, b) => a.key - b.key);
    cand.push(...groups[k].slice(0, WEIGHTS.perType));
  }

  const out: Ranked[] = [];
  for (const m of cand) {
    const gone = new Set(m.cards);
    const after = partitionCount(
      hand.filter((c) => !gone.has(c)),
      rules,
    );
    let cost = after * 10 + controlSpend(m) * (endgame ? 1 : tune.control) + m.key * WEIGHTS.keyW;
    if (m.cards.length === 5) cost -= WEIGHTS.fiveBonus; // five-card hands unload fastest
    if (endgame && m.cards.length === 1) cost += WEIGHTS.endgameSingle; // stop feeding cheap singles
    if (unseen && unbeatable(m, unseen)) cost -= WEIGHTS.safeBonus; // card counting
    out.push({ move: m, cost, after });
  }
  // a stable sort: equal costs keep the order they were found in
  return out.sort((a, b) => a.cost - b.cost);
}

/** An opponent is down to WEIGHTS.endgameAt cards or fewer. */
export const isEndgame = (pub: PublicView): boolean => Math.min(...pub.counts.filter((_, i) => i !== pub.me)) <= WEIGHTS.endgameAt;

/** The cheapest move, or null to let the trick go. `moves` is non-empty and legal. */
export function heuristicPick(pub: PublicView, hand: readonly Card[], moves: readonly Combo[], rules: RuleConfig, rng: Rng, tune: Tuning): Combo | null {
  const ranked = rankMoves(pub, hand, moves, rules, tune);
  if (!ranked.length) return moves[0];
  const best = ranked[0];

  // Following: is taking this trick worth what it costs?
  if (pub.lastPlay) {
    const endgame = isEndgame(pub);
    const before = partitionCount(hand, rules);
    const pb = tune.passBias;
    if (best.after >= before && !endgame && rng() < pb) return null;
    if (controlSpend(best.move) >= 3 && !endgame && pub.passesInRow < 2 && rng() < pb * 0.6) return null;
  }
  return best.move;
}

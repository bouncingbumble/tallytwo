/**
 * Heuristic knobs and the small evaluation helpers chooseMove() combines. The weights were
 * tuned against the simulation harness; change one and re-run `npm run sim`.
 */
import { type Card, rank } from "../engine/cards";
import type { Combo } from "../engine/combos";
import type { PublicView } from "../engine/state";

export const WEIGHTS = {
  /** An opponent at this many cards or fewer puts the table in the endgame. */
  endgameAt: 2,
  /** How dearly Hard values control cards (2s and aces) outside the endgame. */
  hardControl: 4,
  /** How many of the cheapest moves of each shape are evaluated. */
  perType: 3,
  /** Mild preference for playing low: cost per unit of combo key. */
  keyW: 0.1,
  /** Five-card hands unload fastest and are hardest to beat. */
  fiveBonus: 2.5,
  /** In the endgame, stop feeding cheap singles to a seat about to go out. */
  endgameSingle: 4,
  /** Hard only: a move nothing unseen can beat is worth this much. */
  safeBonus: 2,
  /** Hard's chance of letting a trick go when taking it would not shorten the hand. */
  hardPass: 0.55,
} as const;

/** 2s and aces are the cards worth keeping: how many of them a move spends. */
export function controlSpend(move: Combo): number {
  let s = 0;
  for (const c of move.cards) {
    if (rank(c) === 12) s += 3;
    else if (rank(c) === 11) s += 1;
  }
  return s;
}

/** Every card not yet played and not in my hand: what the opponents hold between them. */
export function unseenList(pub: PublicView, hand: readonly Card[]): Card[] {
  const u: Card[] = [];
  for (let v = 0; v < 52; v++) if (!pub.played.has(v) && !hand.includes(v)) u.push(v);
  return u;
}

/** Can anything still out there beat this move? Singles, pairs and triples only. */
export function unbeatable(move: Combo, unseen: readonly Card[]): boolean {
  const n = move.cards.length;
  if (n === 1) return !unseen.some((v) => v > move.key);
  if (n === 2 || n === 3) {
    const byRank: Record<number, Card[]> = {};
    for (const v of unseen) (byRank[rank(v)] ??= []).push(v);
    for (const r in byRank) if (byRank[r].length >= n && Number(r) * 4 + 3 > move.key) return false;
    return true;
  }
  return false;
}

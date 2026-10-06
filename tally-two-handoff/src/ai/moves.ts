/**
 * Move generation. Structural, not brute force: pairs and triples come from rank groups,
 * flushes from suit groups, straights from rank windows, so a 13-card hand yields at most a
 * few hundred candidates in well under a millisecond.
 *
 * The output ORDER is part of the AI's behaviour (ties in chooseMove go to the first
 * candidate found), so keep it: singles in hand order, then pairs and triples by rank,
 * four-of-a-kind + kicker, full houses, flushes by suit, straights by window.
 */
import { type Card, rank, suit } from "../engine/cards";
import { type Combo, classify } from "../engine/combos";
import { beats } from "../engine/compare";
import type { RuleConfig } from "../engine/rules";

/** All k-subsets of arr, in lexicographic index order. */
function pick<T>(arr: T[], k: number): T[][] {
  const out: T[][] = [];
  const cur: T[] = [];
  const rec = (i: number): void => {
    if (cur.length === k) {
      out.push(cur.slice());
      return;
    }
    for (; i < arr.length; i++) {
      cur.push(arr[i]);
      rec(i + 1);
      cur.pop();
    }
  };
  rec(0);
  return out;
}

/** Cartesian product of card groups, capped so a hand full of one rank cannot explode. */
function cross(groups: Card[][], cap: number): Card[][] {
  let out: Card[][] = [[]];
  for (const g of groups) {
    const next: Card[][] = [];
    for (const p of out) {
      for (const c of g) {
        next.push(p.concat(c));
        if (next.length >= cap) break;
      }
      if (next.length >= cap) break;
    }
    out = next;
  }
  return out;
}

/** Every combo the hand can form, regardless of what is on the table. */
export function genMoves(hand: readonly Card[], rules: RuleConfig): Combo[] {
  const out: Combo[] = [];
  const seen = new Set<string>();
  const add = (cs: Card[]): void => {
    const k = cs.slice().sort((a, b) => a - b).join(",");
    if (seen.has(k)) return;
    const m = classify(cs, rules);
    if (m) {
      seen.add(k);
      out.push(m);
    }
  };
  const byRank: Record<number, Card[]> = {};
  const bySuit: Record<number, Card[]> = {};
  for (const c of hand) {
    (byRank[rank(c)] ??= []).push(c);
    (bySuit[suit(c)] ??= []).push(c);
  }

  for (const c of hand) add([c]);
  for (const r in byRank) {
    const g = byRank[r];
    if (g.length >= 2) pick(g, 2).forEach(add);
    if (g.length >= 3) pick(g, 3).forEach(add);
  }
  // four of a kind + any kicker
  for (const r in byRank) {
    const g = byRank[r];
    if (g.length === 4) for (const c of hand) if (rank(c) !== Number(r)) add(g.concat(c));
  }
  // full houses — one representative per (triple rank, pair rank); the key only depends on the triple
  for (const rt in byRank) {
    if (byRank[rt].length < 3) continue;
    const trip = byRank[rt].slice(0, 3);
    for (const rp in byRank) {
      if (rp === rt || byRank[rp].length < 2) continue;
      add(trip.concat(byRank[rp].slice(0, 2)));
    }
  }
  // flushes
  for (const s in bySuit) {
    const g = bySuit[s];
    if (g.length >= 5) pick(g, 5).forEach(add);
  }
  // straights
  const windows: number[][] = [];
  for (let s = 0; s <= 7; s++) windows.push([s, s + 1, s + 2, s + 3, s + 4]);
  if (rules.straightWrap) windows.push([11, 12, 0, 1, 2], [12, 0, 1, 2, 3]);
  for (const w of windows) {
    if (!w.every((r) => byRank[r] && byRank[r].length)) continue;
    cross(
      w.map((r) => byRank[r]),
      48,
    ).forEach(add);
  }
  return out;
}

/** The combos that may be played now: same shape as the table and beating it, or anything on an open lead. */
export function legalMoves(hand: readonly Card[], lastPlay: Combo | null, rules: RuleConfig, need3D: boolean): Combo[] {
  let ms = genMoves(hand, rules).filter((m) => beats(m, lastPlay));
  if (need3D) ms = ms.filter((m) => m.cards.includes(0));
  return ms;
}

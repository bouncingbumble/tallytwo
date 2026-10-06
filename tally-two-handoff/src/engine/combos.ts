import { type Card, rank, suit, RANK_NAMES, RANK_PLURALS, SUIT_NAMES } from "./cards";
import type { RuleConfig } from "./rules";

export type FiveCardType = "straight" | "flush" | "fullhouse" | "four" | "straightflush";
export type ComboType = "single" | "pair" | "triple" | FiveCardType;

/**
 * A legal play. `cards` is always sorted ascending. `key` orders combos of the same type:
 * a higher key beats a lower one (see compare.ts for the cross-type rules).
 */
export interface Combo {
  type: ComboType;
  key: number;
  cards: Card[];
}

interface StraightInfo {
  /** Position in the straight order: the top rank, or -2 / -1 for the two wrap-around straights. */
  pos: number;
  /** The card that breaks ties between straights of the same position. */
  top: Card;
}

function straightInfo(sorted: readonly Card[], rules: RuleConfig): StraightInfo | null {
  const rs = sorted.map(rank);
  if (new Set(rs).size !== 5) return null;
  const s = rs.slice().sort((a, b) => a - b);
  if (s[4] <= 11 && s[4] - s[0] === 4) return { pos: s[4], top: sorted[4] };
  if (rules.straightWrap) {
    const key = s.join(",");
    if (key === "0,1,2,11,12") return { pos: -2, top: sorted.find((c) => rank(c) === 2)! }; // A-2-3-4-5, five high
    if (key === "0,1,2,3,12") return { pos: -1, top: sorted.find((c) => rank(c) === 3)! }; // 2-3-4-5-6, six high
  }
  return null;
}

/**
 * Classify a selection. Returns null when the cards are not a legal shape: two unmatched
 * cards, four cards, a five-card hand that is nothing, and so on.
 */
export function classify(cards: readonly Card[], rules: RuleConfig): Combo | null {
  const cs = cards.slice().sort((a, b) => a - b);
  const n = cs.length;
  const mk = (type: ComboType, key: number): Combo => ({ type, key, cards: cs });

  if (n === 1) return mk("single", cs[0]);
  if (n === 2) return rank(cs[0]) === rank(cs[1]) ? mk("pair", cs[1]) : null;
  if (n === 3) return rank(cs[0]) === rank(cs[1]) && rank(cs[1]) === rank(cs[2]) ? mk("triple", cs[2]) : null;
  if (n !== 5) return null;

  const count = new Map<number, number>();
  for (const c of cs) count.set(rank(c), (count.get(rank(c)) ?? 0) + 1);
  const ranks = [...count.keys()];
  const flush = cs.every((c) => suit(c) === suit(cs[0]));
  const str = straightInfo(cs, rules);

  if (str && flush) return mk("straightflush", str.pos * 4 + suit(str.top));
  if (ranks.length === 2) {
    const [a, b] = ranks;
    if (count.get(a) === 4 || count.get(b) === 4) return mk("four", count.get(a) === 4 ? a : b);
    if (count.get(a) === 3 || count.get(b) === 3) return mk("fullhouse", count.get(a) === 3 ? a : b);
    return null;
  }
  if (flush) return mk("flush", rules.flushSuitFirst ? suit(cs[0]) * 16 + rank(cs[4]) : cs[4]);
  if (str) return mk("straight", str.pos * 4 + suit(str.top));
  return null;
}

/** "Full House, Kings over Fours" — the words on the wooden sign. */
export function describe(combo: Combo | null): string {
  if (!combo) return "—";
  const c = combo.cards;
  const hi = c[c.length - 1];
  const byRank = () => {
    const m = new Map<number, number>();
    for (const v of c) m.set(rank(v), (m.get(rank(v)) ?? 0) + 1);
    return m;
  };
  switch (combo.type) {
    case "single":
      return `${RANK_NAMES[rank(hi)]} of ${SUIT_NAMES[suit(hi)]}`;
    case "pair":
      return `Pair of ${RANK_PLURALS[rank(hi)]}`;
    case "triple":
      return `Three ${RANK_PLURALS[rank(hi)]}`;
    case "straight":
      return `Straight, ${RANK_NAMES[rank(hi)]} high`;
    case "flush":
      return `Flush in ${SUIT_NAMES[suit(hi)]}, ${RANK_NAMES[rank(hi)]} high`;
    case "fullhouse": {
      const m = byRank();
      let trip = 0;
      let pair = 0;
      for (const [r, n] of m) {
        if (n === 3) trip = r;
        else pair = r;
      }
      return `Full House, ${RANK_PLURALS[trip]} over ${RANK_PLURALS[pair]}`;
    }
    case "four": {
      const m = byRank();
      let quad = 0;
      for (const [r, n] of m) if (n === 4) quad = r;
      return `Four ${RANK_PLURALS[quad]}`;
    }
    case "straightflush":
      return `Straight Flush in ${SUIT_NAMES[suit(hi)]}, ${RANK_NAMES[rank(hi)]} high`;
  }
}

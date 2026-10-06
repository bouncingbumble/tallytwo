/**
 * Card encoding. A card is one integer 0..51:
 *
 *   value = rank * 4 + suit
 *
 * ranks 3,4,5,6,7,8,9,10,J,Q,K,A,2 -> 0..12   (Big Two order: 3 low, 2 high)
 * suits ♦ ♣ ♥ ♠                   -> 0..3    (Hong Kong order: diamonds low, spades high)
 *
 * So the 3♦ is 0, the 2♠ is 51, and a single is beaten by any higher integer.
 * String codes ("3D", "10S", "2S") exist only at the JSON/test boundary.
 */
export type Card = number;
export type Rank = number;
export type Suit = number;
/** A random number source in [0, 1). The engine never calls Math.random itself. */
export type Rng = () => number;

export const RANKS = ["3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A", "2"] as const;
export const SUITS = ["♦", "♣", "♥", "♠"] as const;
export const SUIT_LETTERS = "DCHS";
export const SUIT_NAMES = ["Diamonds", "Clubs", "Hearts", "Spades"] as const;
export const RANK_NAMES = ["Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Jack", "Queen", "King", "Ace", "Deuce"] as const;
export const RANK_PLURALS = ["Threes", "Fours", "Fives", "Sixes", "Sevens", "Eights", "Nines", "Tens", "Jacks", "Queens", "Kings", "Aces", "Deuces"] as const;

export const THREE_OF_DIAMONDS: Card = 0;
export const RANK_ACE: Rank = 11;
export const RANK_TWO: Rank = 12;

export const rank = (v: Card): Rank => v >> 2;
export const suit = (v: Card): Suit => v & 3;
export const card = (r: Rank, s: Suit): Card => r * 4 + s;

/** "3D", "10S", "2S" */
export function cardCode(v: Card): string {
  return RANKS[rank(v)] + SUIT_LETTERS[suit(v)];
}

/** Inverse of cardCode. Throws on anything that is not a card code. */
export function parseCard(code: string): Card {
  const m = /^(10|[23456789JQKA])([DCHS])$/.exec(code.trim().toUpperCase());
  if (!m) throw new Error(`not a card code: "${code}"`);
  return card(RANKS.indexOf(m[1] as (typeof RANKS)[number]), SUIT_LETTERS.indexOf(m[2]));
}

/** "3D 4C 5H" -> [0, 5, 10] */
export const parseCards = (codes: string): Card[] => codes.trim().split(/\s+/).map(parseCard);

/** "Three of Diamonds" */
export function cardName(v: Card): string {
  return `${RANK_NAMES[rank(v)]} of ${SUIT_NAMES[suit(v)]}`;
}

/**
 * mulberry32: a small, fast, seedable PRNG. Deterministic for a given seed, which is what makes
 * a game reproducible from its seed. Not for anything that needs real randomness.
 */
export function mulberry32(seed: number): Rng {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The 52 cards in value order. */
export function makeDeck(): Card[] {
  const d: Card[] = [];
  for (let i = 0; i < 52; i++) d.push(i);
  return d;
}

/** Fisher-Yates over a copy, drawing from `rng`. Never mutates its input. */
export function shuffle<T>(arr: readonly T[], rng: Rng): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

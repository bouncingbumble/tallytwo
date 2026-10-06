import type { Combo, FiveCardType } from "./combos";

/**
 * Five-card hands rank by category first: any flush beats any straight, and so on up.
 * Within a category the combo key decides.
 */
export const FIVE_CARD_ORDER: Record<FiveCardType, number> = {
  straight: 0,
  flush: 1,
  fullhouse: 2,
  four: 3,
  straightflush: 4,
};

const isFive = (c: Combo): c is Combo & { type: FiveCardType } => c.cards.length === 5;

/** Does `a` beat `b`? Anything beats an empty table. Card counts must match. */
export function beats(a: Combo, b: Combo | null): boolean {
  if (!b) return true;
  if (a.cards.length !== b.cards.length) return false;
  if (isFive(a) && isFive(b)) {
    const ca = FIVE_CARD_ORDER[a.type];
    const cb = FIVE_CARD_ORDER[b.type];
    return ca !== cb ? ca > cb : a.key > b.key;
  }
  return a.type === b.type && a.key > b.key;
}

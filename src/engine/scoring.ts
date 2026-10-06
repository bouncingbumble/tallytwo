/**
 * Losers pay one point per card still in hand, doubled at ten or more cards, tripled at
 * thirteen (they never played at all). The winner collects the pot, so every round's deltas
 * sum to zero.
 */
export function cardPenalty(cardsLeft: number): number {
  return cardsLeft * (cardsLeft >= 13 ? 3 : cardsLeft >= 10 ? 2 : 1);
}

/** counts[i] = cards left in seat i's hand. Returns the signed delta per seat. */
export function roundScore(counts: readonly number[]): number[] {
  const pay = counts.map(cardPenalty);
  const pot = pay.reduce((a, b) => a + b, 0);
  return counts.map((n, i) => (n === 0 ? pot : -pay[i]));
}

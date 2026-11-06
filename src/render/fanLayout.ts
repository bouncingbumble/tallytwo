/**
 * Where each card of the hand sits, in whole CSS px. Integer positions and zero rotation at
 * rest are what keep the pixel art crisp; animations may pass through fractions but must end
 * here.
 */
export const CARD_W = 96;
export const CARD_H = 128;
/**
 * The most a fanned card ever shows of its left edge. The table is a phone held sideways, so a
 * 13-card hand spreads to 96 + 12 * 64 = 864 px when the strip allows and shrinks as far as the
 * strip needs (41 px on an iPhone SE, 55 on an iPhone 15; render/scale.test.ts).
 */
export const FAN_STEP_MAX = 64;
/** The trick plays' card step: floor(72 * 0.42) for the 72-px cards on the felt (render/scale.ts PLAY_CARD_W). */
export const PILE_STEP = 30;
/** A selected card lifts this many CSS px. */
export const SELECT_LIFT = 14;

export interface FanLayout {
  /** Distance between card left edges. */
  step: number;
  /** Total width of the fan. */
  span: number;
  /** Left edge of the first card, centring the fan in availW. */
  x0: number;
  /** Left edge of every card. */
  xs: number[];
}

/**
 * Fit n cards into availW. Cards overlap by (cardW - step); the step is FAN_STEP_MAX at most and
 * shrinks as far as needed for a long hand on a narrow strip:
 * 13 cards at 864 px or more -> step 64; at 504 px -> step 34, span 504.
 */
export function fanLayout(n: number, availW: number, cardW = CARD_W): FanLayout {
  if (n <= 0) return { step: 0, span: 0, x0: 0, xs: [] };
  const step = n > 1 ? Math.max(0, Math.min(FAN_STEP_MAX, Math.floor((availW - cardW) / (n - 1)))) : 0;
  const span = step * (n - 1) + cardW;
  const x0 = Math.max(0, Math.floor((availW - span) / 2));
  return { step, span, x0, xs: Array.from({ length: n }, (_, i) => x0 + i * step) };
}

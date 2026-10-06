/**
 * Where each card of the hand sits, in whole CSS px. Integer positions and zero rotation at
 * rest are what keep the pixel art crisp; animations may pass through fractions but must end
 * here.
 */
export const CARD_W = 96;
export const CARD_H = 128;
/**
 * The most a fanned card ever shows of its left edge: floor(96 * 0.23) = scale.ts fanStepArt(96).
 * A 13-card hand is therefore never wider than 360 px, on any phone (the "fanFit" rule, not
 * the prototype's near-side-by-side spread); shorter hands make a narrower fan, centred.
 */
export const FAN_STEP = 22;
/** The pile's card step: floor(96 * 0.42). */
export const PILE_STEP = 40;
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
 * Fit n cards into availW. Cards overlap by (cardW - step); the step is FAN_STEP at most and
 * shrinks as far as needed for a long hand on a narrow phone:
 * 13 cards at 360 px -> step 22, span 360; at 359 px -> step 21, span 348.
 */
export function fanLayout(n: number, availW: number, cardW = CARD_W): FanLayout {
  if (n <= 0) return { step: 0, span: 0, x0: 0, xs: [] };
  const step = n > 1 ? Math.max(0, Math.min(FAN_STEP, Math.floor((availW - cardW) / (n - 1)))) : 0;
  const span = step * (n - 1) + cardW;
  const x0 = Math.max(0, Math.floor((availW - span) / 2));
  return { step, span, x0, xs: Array.from({ length: n }, (_, i) => x0 + i * step) };
}

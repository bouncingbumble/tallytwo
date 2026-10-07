/**
 * The table's geometry. Pure, zero imports.
 *
 * The game is designed on a fixed logical canvas: LOGICAL_H (440) logical px tall and as wide
 * as the viewport allows at that height. The web shell scales the whole canvas by
 * k = viewportHeight / LOGICAL_H (`transform: scale(k)` on `.game`, platform/useFitScale.ts),
 * so a phone held sideways (k < 1) shows the same layout smaller and a desktop window (k > 1)
 * shows it larger; there is no letterbox and no cap. Every layout number below and in
 * fanLayout.ts is a logical px; the DOM hooks (platform/useElementSize.ts) divide their
 * measurements by k so the UI never sees a physical px.
 */
export const CARD_ART_W = 96;
export const CARD_ART_H = 128;

/** The canvas height in logical px: the largest iPhone held sideways (956x440) is the 1:1 case. */
export const LOGICAL_H = 440;

/** The rank + suit index in a card's top-left corner is this wide; a covered card must show at least this much. */
export const CORNER_INDEX_ART = 20;
/** The narrowest fan we accept: each card shows floor(cardW * FAN_STEP_RATIO) px of its left edge (22 for 96). */
export const FAN_STEP_RATIO = 0.23;
/** The trick's cards on the felt: three quarters of the hand's 96x128, a fixed logical size (smoothed, not an integer scale). */
export const PLAY_CARD_W = 72;
export const PLAY_CARD_H = 96;
/** A play slot is the small card plus 2 px. */
export const PLAY_SLACK_PT = 2;

export interface FitScale {
  /** Physical CSS px per logical px: viewportHeight / LOGICAL_H. */
  k: number;
  /** The canvas width in logical px: viewportWidth / k. Not floored, so the scaled box is exactly the viewport. */
  logicalWidth: number;
}

/** The scale that fits the logical canvas to a viewport: full height, the width following. */
export function fitScale(viewportW: number, viewportH: number): FitScale {
  const k = viewportH > 0 ? viewportH / LOGICAL_H : 1;
  return { k, logicalWidth: viewportW / k };
}

/** The narrowest fan step for a card `cardW` art px wide: 22 for 96. */
export const fanStepArt = (cardW: number): number => Math.floor(cardW * FAN_STEP_RATIO);

/** Width of the narrowest n-card fan in art px: 360 for 13 cards of 96. */
export const fanSpanArt = (cardW: number, n = 13): number => cardW + (n - 1) * fanStepArt(cardW);

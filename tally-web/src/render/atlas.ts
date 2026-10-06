/**
 * Where a card lives in cards_atlas.png (13 columns x 4 rows of 96x128 cells).
 *
 * The engine and the atlas disagree on BOTH axes:
 *   engine suit order is ♦ ♣ ♥ ♠ (0..3); the atlas rows run ♦ ♠ ♥ ♣
 *   engine ranks run 3..K, A, 2 (0..12); the atlas columns run A, 2, 3..K
 * Get either table wrong and the game is still "right" — it just draws the wrong card.
 * atlas.test.ts pins three cells so that failure is loud.
 */
import { type Card, rank, suit } from "../engine/cards";

export const CELL_W = 96;
export const CELL_H = 128;
export const ATLAS_COLS = 13;
export const ATLAS_ROWS = 4;

/** engine suit index -> atlas row */
export const ATLAS_ROW: readonly number[] = [0, 3, 2, 1];
/** engine rank index -> atlas column */
export const ATLAS_COL: readonly number[] = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 0, 1];

export interface SpriteRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The cell of card `v`, in art pixels. */
export function spriteFor(v: Card): SpriteRect {
  return { x: ATLAS_COL[rank(v)] * CELL_W, y: ATLAS_ROW[suit(v)] * CELL_H, w: CELL_W, h: CELL_H };
}

/** The CSS custom properties the card rule reads: --col and --row. */
export const atlasCell = (v: Card): { col: number; row: number } => ({ col: ATLAS_COL[rank(v)], row: ATLAS_ROW[suit(v)] });

/**
 * The table's geometry: what styles/table.css's grid used to compute, as whole logical px of
 * the 440-px canvas (render/scale.ts). Pure, zero DOM, unit-tested (tableLayout.test.ts).
 *
 *     felt    side        felt: the three opponents' badges along its top edge, the trick's four
 *     hand    side        plays staggered in three rows beneath; side: round, tally, menu, the
 *                         sign, the status, the buttons; hand: the fan over the saloon
 *
 * The table runs edge to edge with only EDGE (16) to clear the rounded corners. The notch /
 * Dynamic Island is cleared only where it is: the trick's rows step in by `clearL` when it is on
 * the left, the sign and status by `clearR` (and the side column widens) when it is on the right.
 */
import { CARD_H, PILE_STEP } from "./fanLayout";
import { LOGICAL_H, PLAY_CARD_H, PLAY_CARD_W, PLAY_SLACK_PT } from "./scale";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Clears the screen's rounded corners on both sides. */
export const EDGE = 16;
/** The side column's width before any notch clearance. */
export const SIDE_W = 136;
/** Column gap between the felt / hand and the side column. */
export const COL_GAP = 6;
/** Row gap between the felt and the hand, and the table's top and bottom padding. */
export const ROW_GAP = 2;
export const PAD_Y = 2;
/** The hand row: the 128-px cards overhang the felt's edge by 6 px. */
export const HAND_H = CARD_H - 6;
/** The felt's inner padding: top, sides, bottom. */
export const FELT_PAD = { top: 2, x: 8, bottom: 6 } as const;
/** An opponent's badge: an 88-px portrait plus 1 px above and below. */
export const BADGE_H = 90;
/** Gap between the badges, and between the badges and the trick area. */
export const BADGE_GAP = 6;
export const BADGE_ROW_GAP = 2;
/** The hand strip's horizontal padding inside its row. */
export const HAND_PAD_X = 8;
/** The portraits on the badges: 96x104 sprites drawn at 85 %. */
export const FACE_W = 82;
export const FACE_H = 88;
/** A play slot is the small card plus 2 px. */
export const SLOT_H = PLAY_CARD_H + PLAY_SLACK_PT;
/** A five-card hand in a narrow slot overlaps more than PILE_STEP, but never below this. */
export const MIN_PILE_STEP = 12;

export interface TableInput {
  /** The canvas width in logical px (render/scale.ts fitScale). */
  width: number;
  /** Notch clearance on each side, logical px (clearFor). */
  clearL: number;
  clearR: number;
  /** The home indicator, logical px: only the side column's buttons keep clear of it. */
  insetBottom: number;
}

export interface TableLayout {
  felt: Rect;
  /** The opponents' badges, by seat (1, 2, 3 left to right). */
  badges: Record<number, Rect>;
  /** The trick's area under the badges. */
  plays: Rect;
  /** Each seat's play slot (absolute): Dusty (2) on top, Marshal (1) and Lucky (3) in the middle, the human (0) at the bottom. */
  slots: Record<number, Rect>;
  side: Rect;
  /** The sign's and status line's right margin (the island on the right). */
  sideClearR: number;
  /** The hand row (the saloon fills it). */
  handRow: Rect;
  /** Where the fan lays out: the hand row inside its padding. */
  fan: Rect;
}

/**
 * The notch clearance beyond EDGE on each side, from the safe-area insets in logical px. iOS
 * reports the island's inset on both long edges; only the island's side keeps it.
 */
export function clearFor(safeL: number, safeR: number, notch: "left" | "right" | null): { clearL: number; clearR: number } {
  const clearL = Math.max(0, Math.round(safeL - EDGE));
  const clearR = Math.max(0, Math.round(safeR - EDGE));
  if (notch === "left") return { clearL, clearR: 0 };
  if (notch === "right") return { clearL: 0, clearR };
  return { clearL, clearR };
}

export function tableLayout({ width, clearL, clearR, insetBottom }: TableInput): TableLayout {
  const W = Math.floor(width);
  const sideW = SIDE_W + clearR;
  const mainW = Math.max(0, W - 2 * EDGE - COL_GAP - sideW);
  const feltH = LOGICAL_H - 2 * PAD_Y - ROW_GAP - HAND_H;
  const felt = { x: EDGE, y: PAD_Y, w: mainW, h: feltH };

  const innerX = felt.x + FELT_PAD.x;
  const innerW = felt.w - 2 * FELT_PAD.x;
  const colW = Math.floor((innerW - 2 * BADGE_GAP) / 3);
  const badges: Record<number, Rect> = {};
  for (let i = 0; i < 3; i++) badges[i + 1] = { x: innerX + i * (colW + BADGE_GAP), y: felt.y + FELT_PAD.top, w: colW, h: BADGE_H };

  const playsY = felt.y + FELT_PAD.top + BADGE_H + BADGE_ROW_GAP;
  const plays = { x: innerX + clearL, y: playsY, w: Math.max(0, innerW - clearL), h: Math.max(SLOT_H, felt.y + felt.h - FELT_PAD.bottom - playsY) };
  // Row tops: the bottom row flush with the bottom, the middle row halfway, whole px.
  const bottom = Math.max(0, plays.h - SLOT_H);
  const middle = Math.floor(bottom / 2);
  const halfW = Math.floor(plays.w / 2) - 4;
  const slots: Record<number, Rect> = {
    2: { x: plays.x, y: plays.y, w: plays.w, h: SLOT_H },
    1: { x: plays.x, y: plays.y + middle, w: halfW, h: SLOT_H },
    3: { x: plays.x + plays.w - halfW, y: plays.y + middle, w: halfW, h: SLOT_H },
    0: { x: plays.x, y: plays.y + bottom, w: plays.w, h: SLOT_H },
  };

  const side = { x: EDGE + mainW + COL_GAP, y: PAD_Y, w: sideW, h: LOGICAL_H - 2 * PAD_Y - Math.max(0, Math.round(insetBottom)) };
  const handRow = { x: EDGE, y: felt.y + felt.h + ROW_GAP, w: mainW, h: HAND_H };
  const fan = { x: handRow.x + HAND_PAD_X, y: handRow.y, w: Math.max(0, mainW - 2 * HAND_PAD_X), h: HAND_H };
  return { felt, badges, plays, slots, side, sideClearR: clearR, handRow, fan };
}

/** Where a play sits in its slot: under its player's badge. */
export type Align = "start" | "center" | "end";
export const SLOT_ALIGN: Record<number, Align> = { 0: "center", 1: "start", 2: "center", 3: "end" };

export interface PileLayout {
  /** Each card's left edge in the slot. */
  xs: number[];
  /** Where the cards meet as a stack before they spread: the middle of the span. */
  cx: number;
}

/** An n-card play's x positions in a slot `slotW` wide, aligned under its seat's badge. */
export function pileLayout(n: number, slotW: number, align: Align, cardW = PLAY_CARD_W): PileLayout {
  const step = n > 1 ? Math.max(MIN_PILE_STEP, Math.min(PILE_STEP, Math.floor((slotW - cardW) / (n - 1)))) : 0;
  const span = n ? cardW + (n - 1) * step : 0;
  const x0 = Math.max(0, align === "start" ? 0 : align === "end" ? slotW - span : Math.floor((slotW - span) / 2));
  return { xs: Array.from({ length: n }, (_, i) => x0 + i * step), cx: x0 + Math.floor((span - cardW) / 2) };
}

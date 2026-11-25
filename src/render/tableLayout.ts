/**
 * The table's geometry, as whole logical px of the 440-px canvas (render/scale.ts). Pure, zero
 * DOM, unit-tested (tableLayout.test.ts).
 *
 * The felt runs edge to edge: round and tally in its top-left corner, the menu top-right, and
 * just above the hand a band: the sign and status on the left, the buttons on the right, and the
 * player's own play landing between them. The opponents sit in one of two arrangements (`top`):
 *
 *     "bar"                               "around"
 *     corner  chip  chip  chip  menu      corner      chip       menu
 *     ......... trick ...........         chip  ... trick ...    chip
 *     sign      mine      buttons         sign      mine      buttons
 *
 * "bar": three slim chips in one row across the top, the trick staggered beneath. "around": the
 * middle opponent across the top, the other two standing at the felt's left and right edges,
 * each beside where their cards land.
 *
 * The table runs edge to edge with only EDGE (16) to clear the rounded corners. The notch /
 * Dynamic Island is cleared only where it is: the corner and the trick step in by `clearL` when
 * it is on the left, the menu and the buttons by `clearR` when it is on the right.
 */
import { CARD_H, PILE_STEP, SELECT_LIFT } from "./fanLayout";
import { LOGICAL_H, PLAY_CARD_H, PLAY_CARD_W, PLAY_SLACK_PT } from "./scale";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Clears the screen's rounded corners on both sides. */
export const EDGE = 16;
/** Row gap between the felt and the hand, and the table's top and bottom padding. */
export const ROW_GAP = 2;
export const PAD_Y = 2;
/** The hand row: the 128-px cards overhang the felt's edge by 6 px. */
export const HAND_H = CARD_H - 6;
/** How far the hand's cards reach up over the felt: the overhang, plus a selected card's lift. */
export const HAND_REACH = 6 + SELECT_LIFT;
/** The felt's inner padding: top, sides, bottom. */
export const FELT_PAD = { top: 2, x: 8, bottom: 6 } as const;
/** The top-left corner (round and tally) and the top-right one (the menu), beside the badges. */
export const CORNER_W = 96;
export const MENU_W = 48;
/** The top row: a slim chip, one 56-px portrait tall plus 2 px above and below. */
export const BADGE_H = 60;
/** "around": the middle opponent's chip across the top, and the side chips standing at the edges. */
export const TOP_CHIP_W = 210;
export const SIDE_CHIP_W = 96;
/** Gap between the badges, and between the badges and the trick area. */
export const BADGE_GAP = 6;
export const BADGE_ROW_GAP = 2;
/** The hand strip's horizontal padding inside its row. */
export const HAND_PAD_X = 8;
/** The portraits' aspect: 96x104 sprites. */
export const FACE_ASPECT = 96 / 104;
/** A play slot is the small card plus 2 px. */
export const SLOT_H = PLAY_CARD_H + PLAY_SLACK_PT;
/** A five-card hand in a narrow slot overlaps more than PILE_STEP, but never below this. */
export const MIN_PILE_STEP = 12;
/** The band above the hand: one control tall, clear of a selected card by BAND_GAP. */
export const BAND_H = 60;
export const BAND_GAP = 4;
/** The buttons: Pass, with Play when Flick to play is off and Hint when Hints are on, side by side. */
export const CTRL_BTN_W = 92;
export const CTRL_GAP = 6;
export const controlsWidth = (n: number): number => n * CTRL_BTN_W + Math.max(0, n - 1) * CTRL_GAP;
/** The sign and status panel at the band's left: as wide as it can be, leaving a five-card play room. */
export const INFO_MIN_W = 196;
export const INFO_MAX_W = 280;
const FIVE_PLAY_W = PLAY_CARD_W + 4 * PILE_STEP;
/** Gap between the band's panel, the player's play and the buttons. */
export const BAND_SPLIT = 8;
/** The middle row of plays steps down from the top row by at most this much. */
export const MIDDLE_STAGGER = 57;

export interface TableInput {
  /** The canvas width in logical px (render/scale.ts fitScale). */
  width: number;
  /** Notch clearance on each side, logical px (clearFor). */
  clearL: number;
  clearR: number;
  /** How many buttons the band shows (1-3). */
  buttons: number;
  /** Where the opponents sit (see the top of this file). */
  top: TopLayout;
}

export type TopLayout = "bar" | "around";
export const TOP_LAYOUTS: readonly TopLayout[] = ["bar", "around"];

export interface TableLayout {
  felt: Rect;
  /** Round and tally, top-left of the felt. */
  corner: Rect;
  /** The menu button's square, top-right of the felt. */
  menu: Rect;
  /** The opponents' badges, by seat (1, 2, 3 left to right): wider than tall is a row chip, else a standing one. */
  badges: Record<number, Rect>;
  /** The trick's area under the badges. */
  plays: Rect;
  /** Each seat's play slot (absolute): Dusty (2) on top, Marshal (1) and Lucky (3) in the middle, the human (0) at the bottom. */
  slots: Record<number, Rect>;
  /** The sign and status, at the left of the band just above the hand. */
  info: Rect;
  /** The buttons, at the right of the band just above the hand (right-aligned inside it). */
  controls: Rect;
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

export function tableLayout({ width, clearL, clearR, buttons, top: arrangement }: TableInput): TableLayout {
  const W = Math.floor(width);
  const mainW = Math.max(0, W - 2 * EDGE);
  const feltH = LOGICAL_H - 2 * PAD_Y - ROW_GAP - HAND_H;
  const felt = { x: EDGE, y: PAD_Y, w: mainW, h: feltH };

  const innerX = felt.x + FELT_PAD.x + clearL;
  const innerR = felt.x + felt.w - FELT_PAD.x - clearR;
  const innerW = Math.max(0, innerR - innerX);
  const top = felt.y + FELT_PAD.top;
  const corner = { x: innerX, y: top, w: CORNER_W, h: BADGE_H };
  const menu = { x: innerR - MENU_W, y: top, w: MENU_W, h: BADGE_H };
  // the band: just above where a selected card reaches
  const handRow = { x: EDGE, y: felt.y + felt.h + ROW_GAP, w: mainW, h: HAND_H };
  const bandY = handRow.y - HAND_REACH - BAND_GAP - BAND_H;

  const playsY = top + BADGE_H + BADGE_ROW_GAP;
  const playsH = Math.max(SLOT_H, felt.y + felt.h - FELT_PAD.bottom - playsY);
  const badges: Record<number, Rect> = {};
  let plays: Rect;
  if (arrangement === "around") {
    const midX = Math.round(innerX + (innerW - TOP_CHIP_W) / 2);
    badges[2] = { x: midX, y: top, w: TOP_CHIP_W, h: BADGE_H };
    const sideY = playsY + 2;
    const sideH = Math.max(0, bandY - BAND_GAP - sideY);
    badges[1] = { x: innerX, y: sideY, w: SIDE_CHIP_W, h: sideH };
    badges[3] = { x: innerR - SIDE_CHIP_W, y: sideY, w: SIDE_CHIP_W, h: sideH };
    const px = innerX + SIDE_CHIP_W + BADGE_GAP;
    plays = { x: px, y: playsY, w: Math.max(0, innerR - SIDE_CHIP_W - BADGE_GAP - px), h: playsH };
  } else {
    const badgesX = corner.x + CORNER_W + BADGE_GAP;
    const colW = Math.floor((menu.x - BADGE_GAP - badgesX - 2 * BADGE_GAP) / 3);
    for (let i = 0; i < 3; i++) badges[i + 1] = { x: badgesX + i * (colW + BADGE_GAP), y: top, w: colW, h: BADGE_H };
    plays = { x: innerX, y: playsY, w: innerW, h: playsH };
  }
  const controlsW = Math.min(controlsWidth(Math.max(1, buttons)), innerW);
  const controls = { x: innerR - controlsW, y: bandY, w: controlsW, h: BAND_H };
  const infoW = Math.min(INFO_MAX_W, Math.max(INFO_MIN_W, innerW - controlsW - 2 * BAND_SPLIT - FIVE_PLAY_W));
  const info = { x: innerX, y: bandY, w: Math.min(infoW, Math.max(0, innerW - controlsW - BAND_SPLIT)), h: BAND_H };

  // Row tops: the bottom row flush with the bottom; the middle row staggered down from the top,
  // but never into the band (its plays sit right above the sign and the buttons), whole px.
  const bottom = Math.max(0, plays.h - SLOT_H);
  const middle = Math.max(0, Math.min(MIDDLE_STAGGER, bandY - BAND_GAP - SLOT_H - plays.y));
  const halfW = Math.floor(plays.w / 2) - 4;
  // the player's own play lands in the band, between the sign and the buttons
  const mineX = info.x + info.w + BAND_SPLIT;
  const slots: Record<number, Rect> = {
    2: { x: plays.x, y: plays.y, w: plays.w, h: SLOT_H },
    1: { x: plays.x, y: plays.y + middle, w: halfW, h: SLOT_H },
    3: { x: plays.x + plays.w - halfW, y: plays.y + middle, w: halfW, h: SLOT_H },
    0: { x: mineX, y: plays.y + bottom, w: Math.max(PLAY_CARD_W, controls.x - BAND_SPLIT - mineX), h: SLOT_H },
  };

  const fan = { x: handRow.x + HAND_PAD_X + clearL, y: handRow.y, w: Math.max(0, mainW - 2 * HAND_PAD_X - clearL - clearR), h: HAND_H };
  return { felt, corner, menu, badges, plays, slots, info, controls, handRow, fan };
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

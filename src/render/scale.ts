/**
 * Pixel-art scaling for the table. Pure, zero imports; the same numbers drive the browser
 * build and the React Native port.
 *
 * The rule: card art is 96x128 pixels and a card on screen is 96x128 CSS px, always. On every
 * iPhone (devicePixelRatio 2 or 3) the browser then blits the @2x/@3x atlas one device pixel
 * per atlas pixel — no resampling, so nothing blurs. The scale factor S is the number of
 * device pixels per art pixel; it must be a whole number or the art looks like the browser
 * is blurring it.
 *
 * The table is laid out for a phone held sideways (styles/table.css): the felt, a 124-px side
 * column and a 122-px hand strip the cards overhang by 6 px. The matrix below checks every
 * iPhone in landscape.
 */
export const CARD_ART_W = 96;
export const CARD_ART_H = 128;

/** The rank + suit index in a card's top-left corner is this wide; a covered card must show at least this much. */
export const CORNER_INDEX_ART = 20;
/** Below this many CSS px a 96-px card face is unreadable at arm's length. */
export const LEGIBLE_MIN_PT = 48;
/** The narrowest fan we accept: each card shows floor(cardW * FAN_STEP_RATIO) px of its left edge (22 for 96). */
export const FAN_STEP_RATIO = 0.23;
/** Side gutters either side of the hand strip, in CSS px (8 + 8). */
export const HAND_GUTTER_PT = 16;
/** The controls column to the right of the felt and the hand (table.css --side-w) plus its gap. */
export const SIDE_W_PT = 124 + 6;
/** Padding on each side of the table grid, or the safe-area inset where that is larger. */
export const TABLE_PAD_PT = 6;
/** The vertical budget (table.css): the felt (padding 2 + badge + gap 2 + the play rows + padding 6), the hand strip, the row gap and the top and bottom padding. */
/** The hand's row: the cards (128) overhang the felt's bottom padding by 6 px, and the select lift rises over the felt. */
export const HAND_H_PT = CARD_ART_H - 6;
/** An opponent's badge: the 104-px portrait plus 1 px of padding above and below. */
export const BADGE_H_PT = 104 + 2;
export const FELT_PAD_PT = 2 + 6;
export const FELT_GAP_PT = 2;
/** A play slot is the small card plus 2 px. */
export const PLAY_SLACK_PT = 2;
/** The 2-px row gap and 2 px of padding above and below. */
export const TABLE_V_EXTRA_PT = 2 + 2 + 2;

export interface DeviceSpec {
  name: string;
  /** Portrait CSS px; held sideways the width is heightPt. */
  widthPt: number;
  heightPt: number;
  dpr: number;
  /** Safe-area inset on each side in landscape (the notch / Dynamic Island). */
  notchPt: number;
}

/** The iPhone matrix the table is verified against, in CSS px. */
export const DEVICES: readonly DeviceSpec[] = [
  { name: "iPhone SE (3rd gen)", widthPt: 375, heightPt: 667, dpr: 2, notchPt: 0 },
  { name: "iPhone 13 mini", widthPt: 375, heightPt: 812, dpr: 3, notchPt: 50 },
  { name: "iPhone 15", widthPt: 393, heightPt: 852, dpr: 3, notchPt: 59 },
  { name: "iPhone 15 Plus", widthPt: 430, heightPt: 932, dpr: 3, notchPt: 59 },
  { name: "iPhone 15 Pro Max", widthPt: 430, heightPt: 932, dpr: 3, notchPt: 59 },
  { name: "iPhone 16 Pro", widthPt: 402, heightPt: 874, dpr: 3, notchPt: 62 },
  { name: "iPhone 16 Pro Max", widthPt: 440, heightPt: 956, dpr: 3, notchPt: 62 },
];

export interface CardScale {
  /** Device pixels per art pixel. Always an integer. */
  S: number;
  /** Card size in CSS px. */
  pointW: number;
  pointH: number;
  /** Card size in device pixels. */
  deviceW: number;
  deviceH: number;
}

/** The hand's card scale on a device: one art pixel per device pixel per dpr, i.e. 96 CSS px. */
export function cardScale(dpr: number): CardScale {
  const S = Math.max(1, Math.round(dpr));
  return { S, pointW: (CARD_ART_W * S) / dpr, pointH: (CARD_ART_H * S) / dpr, deviceW: CARD_ART_W * S, deviceH: CARD_ART_H * S };
}

/** The trick plays' card scale on a phone: one step smaller than the hand (48 CSS px on dpr 2, 64 on dpr 3), never below S = 1. */
export function smallCardScale(dpr: number): CardScale {
  const S = Math.max(1, Math.round(dpr) - 1);
  return { S, pointW: (CARD_ART_W * S) / dpr, pointH: (CARD_ART_H * S) / dpr, deviceW: CARD_ART_W * S, deviceH: CARD_ART_H * S };
}

/**
 * The largest whole-pixel scale at which `artW` art pixels fit in `availablePt` CSS px.
 * Returns 0 when not even S = 1 fits. Leftover points are the caller's to centre.
 */
export function fixedWidthScale(availablePt: number, artW: number, dpr: number): number {
  const devicePx = Math.floor(availablePt * dpr);
  return Math.max(0, Math.floor(devicePx / artW));
}

/** The narrowest fan step for a card `cardW` art px wide: 22 for 96. */
export const fanStepArt = (cardW: number): number => Math.floor(cardW * FAN_STEP_RATIO);

/** Width of the narrowest n-card fan in art px: 360 for 13 cards of 96. */
export const fanSpanArt = (cardW: number, n = 13): number => cardW + (n - 1) * fanStepArt(cardW);

/** A CSS-px size lands on whole device pixels when size * dpr is an integer. */
export const landsOnWholeDevicePixels = (pt: number, dpr: number): boolean => Number.isInteger(pt * dpr);

export interface DeviceReport {
  device: DeviceSpec;
  S: number;
  cardPt: number;
  /** Landscape width and height in CSS px. */
  widePt: number;
  tallPt: number;
  /** Fan width available after the insets, the side column and the gutters. */
  availPt: number;
  /** Fan step after fitting 13 cards into availPt, between fanStepArt(96) and FAN_STEP_MAX (fanLayout.ts). */
  step: number;
  span: number;
  /** The table's vertical budget on this device, with the three play rows fully overlapped. */
  neededPt: number;
  /** The height left for the trick's three play rows. */
  playsPt: number;
  /** How far two adjacent play rows overlap on this device (0 where the felt is tall enough to separate them). */
  playRowOverlapPt: number;
  wholePixels: boolean;
  fits: boolean;
  fitsHeight: boolean;
  legible: boolean;
}

/** Mirrors fanLayout.ts: the step is capped at FAN_STEP_MAX and never less than the corner index allows. */
export const FAN_STEP_MAX_ART = 64;

/** The invariants per device held sideways: whole device pixels, a 13-card fan that fits, a readable corner index, a column that fits. */
export function reportFor(device: DeviceSpec): DeviceReport {
  const { S, pointW } = cardScale(device.dpr);
  const widePt = device.heightPt;
  const tallPt = device.widthPt;
  const availPt = widePt - 2 * Math.max(TABLE_PAD_PT, device.notchPt) - SIDE_W_PT - HAND_GUTTER_PT;
  const step = Math.min(FAN_STEP_MAX_ART, Math.floor((availPt - pointW) / 12));
  const span = pointW + 12 * step;
  const slotPt = smallCardScale(device.dpr).pointH + PLAY_SLACK_PT;
  const fixedPt = FELT_PAD_PT + BADGE_H_PT + FELT_GAP_PT + HAND_H_PT + TABLE_V_EXTRA_PT;
  const neededPt = fixedPt + slotPt;
  const playsPt = Math.max(slotPt, tallPt - fixedPt);
  // ui/Pile.tsx: the bottom row sits at playsPt - slotPt, the middle row at half that
  const playRowOverlapPt = Math.max(0, slotPt - Math.floor((playsPt - slotPt) / 2));
  return {
    device,
    S,
    cardPt: pointW,
    widePt,
    tallPt,
    availPt,
    step,
    span,
    neededPt,
    playsPt,
    playRowOverlapPt,
    wholePixels: landsOnWholeDevicePixels(pointW, device.dpr) && Number.isInteger(S),
    fits: span <= availPt,
    fitsHeight: neededPt <= tallPt,
    legible: pointW >= LEGIBLE_MIN_PT && step >= CORNER_INDEX_ART,
  };
}

export const scaleMatrix = (): DeviceReport[] => DEVICES.map(reportFor);

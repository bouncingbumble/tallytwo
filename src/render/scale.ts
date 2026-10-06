/**
 * Pixel-art scaling for the table. Pure, zero imports; the same numbers drive the browser
 * build and the React Native port.
 *
 * The rule: card art is 96x128 pixels and a card on screen is 96x128 CSS px, always. On every
 * iPhone (devicePixelRatio 2 or 3) the browser then blits the @2x/@3x atlas one device pixel
 * per atlas pixel — no resampling, so nothing blurs. The scale factor S is the number of
 * device pixels per art pixel; it must be a whole number or the art looks like the browser
 * is blurring it.
 */
export const CARD_ART_W = 96;
export const CARD_ART_H = 128;

/** The rank + suit index in a card's top-left corner is this wide; a covered card must show at least this much. */
export const CORNER_INDEX_ART = 20;
/** Below this many CSS px a 96-px card face is unreadable at arm's length. */
export const LEGIBLE_MIN_PT = 48;
/** Hand fan: cards overlap so that each shows floor(cardW * FAN_STEP_RATIO) px of its left edge. */
export const FAN_STEP_RATIO = 0.23;
/** Side gutters either side of the hand strip, in CSS px (8 + 8). */
export const HAND_GUTTER_PT = 16;

export interface DeviceSpec {
  name: string;
  widthPt: number;
  heightPt: number;
  dpr: number;
}

/** The iPhone matrix the table is verified against (portrait, CSS px). */
export const DEVICES: readonly DeviceSpec[] = [
  { name: "iPhone SE (3rd gen)", widthPt: 375, heightPt: 667, dpr: 2 },
  { name: "iPhone 13 mini", widthPt: 375, heightPt: 812, dpr: 3 },
  { name: "iPhone 15", widthPt: 393, heightPt: 852, dpr: 3 },
  { name: "iPhone 15 Plus", widthPt: 430, heightPt: 932, dpr: 3 },
  { name: "iPhone 15 Pro Max", widthPt: 430, heightPt: 932, dpr: 3 },
  { name: "iPhone 16 Pro", widthPt: 402, heightPt: 874, dpr: 3 },
  { name: "iPhone 16 Pro Max", widthPt: 440, heightPt: 956, dpr: 3 },
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

/** The pile's card scale: one step smaller than the hand (48 CSS px on dpr 2, 64 on dpr 3), never below S = 1. */
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

/** How far apart fanned cards sit, in art px, for a card `cardW` art px wide. */
export const fanStepArt = (cardW: number): number => Math.floor(cardW * FAN_STEP_RATIO);

/** Width of an n-card fan in art px: 360 for 13 cards of 96. */
export const fanSpanArt = (cardW: number, n = 13): number => cardW + (n - 1) * fanStepArt(cardW);

/** A CSS-px size lands on whole device pixels when size * dpr is an integer. */
export const landsOnWholeDevicePixels = (pt: number, dpr: number): boolean => Number.isInteger(pt * dpr);

export interface DeviceReport {
  device: DeviceSpec;
  S: number;
  cardPt: number;
  /** Fan width available after the gutters. */
  availPt: number;
  /** Fan step after fitting 13 cards into availPt (22 everywhere except the 375-px phones, where it is 21). */
  step: number;
  span: number;
  wholePixels: boolean;
  fits: boolean;
  legible: boolean;
}

/** The three invariants per device: whole device pixels, a 13-card fan that fits, and a readable corner index. */
export function reportFor(device: DeviceSpec): DeviceReport {
  const { S, pointW } = cardScale(device.dpr);
  const availPt = device.widthPt - HAND_GUTTER_PT;
  const step = Math.min(fanStepArt(CARD_ART_W), Math.floor((availPt - pointW) / 12));
  const span = pointW + 12 * step;
  return {
    device,
    S,
    cardPt: pointW,
    availPt,
    step,
    span,
    wholePixels: landsOnWholeDevicePixels(pointW, device.dpr) && Number.isInteger(S),
    fits: span <= availPt,
    legible: pointW >= LEGIBLE_MIN_PT && step >= CORNER_INDEX_ART,
  };
}

export const scaleMatrix = (): DeviceReport[] => DEVICES.map(reportFor);

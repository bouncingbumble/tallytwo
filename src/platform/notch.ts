/**
 * Which long edge of a sideways phone the notch / Dynamic Island is on. iOS reports the same
 * safe-area inset on BOTH sides in landscape, so the inset alone cannot say where the island
 * is; the device's rotation can. window.orientation is 90 when the phone is turned
 * counter-clockwise (its top, and the island, on the left) and -90 when clockwise;
 * screen.orientation.angle is the fallback (90 / 270); 0 or 180 means upright or a desktop.
 * Pure, so notch.test.ts runs under node.
 */
export type NotchSide = "left" | "right" | null;

/** The rotation in degrees to the edge the top of the device is on. */
export function notchSideFor(deg: number): NotchSide {
  const a = ((deg % 360) + 360) % 360;
  if (a === 90) return "left";
  if (a === 270) return "right";
  return null;
}

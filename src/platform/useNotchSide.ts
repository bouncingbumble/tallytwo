/**
 * Which long edge of a sideways phone the notch / Dynamic Island is on, as React state. iOS
 * reports the same safe-area inset on BOTH sides in landscape (59 pt on an island iPhone), so
 * the inset alone cannot say where the island is; the device's rotation can. App.tsx puts
 * `notch-left` / `notch-right` on `.game` and table.css clears the island on that side only,
 * letting the other edge run out to the screen's rounded corner. On a device with no inset the
 * class still appears but the clearance it adds computes to 0 (table.css --notch-x). WEB bucket.
 *
 * window.orientation (iOS, deprecated but the one Safari keeps current) is 90 when the phone is
 * turned counter-clockwise — its top, and the island, on the left — and -90 when clockwise;
 * screen.orientation.angle is the fallback (90 / 270), and 0 or 180 means upright or a desktop.
 */
import { useSyncExternalStore } from "react";

export type NotchSide = "left" | "right" | null;

function angle(): number {
  const legacy = (window as { orientation?: unknown }).orientation;
  if (typeof legacy === "number") return legacy;
  return screen.orientation?.angle ?? 0;
}

/** Pure: the rotation in degrees to the edge the top of the device is on. */
export function notchSideFor(deg: number): NotchSide {
  const a = ((deg % 360) + 360) % 360;
  if (a === 90) return "left";
  if (a === 270) return "right";
  return null;
}

const getSnapshot = (): NotchSide => notchSideFor(angle());

function subscribe(onChange: () => void): () => void {
  window.addEventListener("orientationchange", onChange);
  window.addEventListener("resize", onChange);
  screen.orientation?.addEventListener?.("change", onChange);
  return () => {
    window.removeEventListener("orientationchange", onChange);
    window.removeEventListener("resize", onChange);
    screen.orientation?.removeEventListener?.("change", onChange);
  };
}

export function useNotchSide(): NotchSide {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

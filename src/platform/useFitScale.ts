/**
 * The scale that fits the logical canvas (render/scale.ts LOGICAL_H = 440 logical px tall) to
 * the viewport, as React state: k = innerHeight / 440, the canvas as wide as innerWidth / k.
 * App.tsx puts `--k` and `--logical-w` on `.game`, where base.css sizes the box and applies
 * `transform: scale(var(--k))` from the top-left corner, so the scaled box is exactly the
 * viewport — a phone held sideways (k < 1) shrinks the layout uniformly, a desktop window
 * (k > 1) grows it. Two classes ride along: `upscaled` when k >= 1 (the sprites switch to
 * pixelated only then; downscaled pixel art is smoothed) and `wide` when the canvas is at least
 * WIDE_W logical px (the title's corner decor needs the room).
 *
 * ScaleContext carries k to the hooks that measure the DOM (useElementSize) and read pointers
 * (ui/Hand.tsx): getBoundingClientRect and clientX are physical CSS px, every layout number in
 * the app is a logical px, and k is the only conversion. WEB bucket.
 */
import { type CSSProperties, createContext, useContext, useSyncExternalStore } from "react";
import { type FitScale, fitScale } from "../render/scale";

/** A canvas at least this wide shows the title's corner decor (base.css .wide). */
export const WIDE_W = 900;

/** k for the hooks below the `.game` root; 1 until the root mounts (tests, the crash screen). */
export const ScaleContext = createContext(1);
export const useScale = (): number => useContext(ScaleContext);

let last: FitScale = { k: 1, logicalWidth: 0 };
/** The same object while the viewport is unchanged, so useSyncExternalStore sees no churn. */
function getSnapshot(): FitScale {
  const next = fitScale(window.innerWidth, window.innerHeight);
  if (next.k !== last.k || next.logicalWidth !== last.logicalWidth) last = next;
  return last;
}

/** Window resize covers rotation and the desktop; the visual viewport covers iOS toolbars and pinch. */
function subscribe(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  window.visualViewport?.addEventListener("resize", onChange);
  return () => {
    window.removeEventListener("resize", onChange);
    window.visualViewport?.removeEventListener("resize", onChange);
  };
}

export function useFitScale(): FitScale {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/** `.game`'s classes for a fit: `upscaled` at k >= 1, `wide` from WIDE_W logical px. */
export const fitClass = ({ k, logicalWidth }: FitScale): string => "game" + (k >= 1 ? " upscaled" : "") + (logicalWidth >= WIDE_W ? " wide" : "");

/** `.game`'s custom properties for a fit; base.css derives the box and the transform from them. */
export const fitStyle = ({ k, logicalWidth }: FitScale): CSSProperties => ({ "--k": k, "--logical-w": logicalWidth + "px" }) as CSSProperties;

/**
 * The bridge as React state, the way usePageVisibility.ts does document.hidden: the host's
 * pause/resume folds into `paused` in App.tsx next to the hidden-tab flag, its safe-area insets
 * land on the .game element as --inset-* custom properties (stream A's CSS reads them as
 * `var(--inset-left, env(safe-area-inset-left))`), and `ready` goes out once after the first
 * render. With no host every hook is inert: bridge.paused stays false, bridge.insets null.
 */
import { type RefObject, useEffect, useSyncExternalStore } from "react";
import { bridge } from "./bridge";

const subscribePause = (onChange: () => void): (() => void) => {
  const offPause = bridge.on("pause", onChange);
  const offResume = bridge.on("resume", onChange);
  return () => {
    offPause();
    offResume();
  };
};

/** True between the host's `pause` and its next `resume`. */
export function useBridgePause(): boolean {
  return useSyncExternalStore(subscribePause, () => bridge.paused);
}

const subscribeInsets = (onChange: () => void): (() => void) => bridge.on("insets", onChange);
const SIDES = ["top", "right", "bottom", "left"] as const;

/** Mirror the host's insets onto `ref`'s element; clears them when none have arrived. */
export function useBridgeInsets(ref: RefObject<HTMLElement | null>): void {
  const insets = useSyncExternalStore(subscribeInsets, () => bridge.insets);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    for (const side of SIDES) {
      if (insets) el.style.setProperty(`--inset-${side}`, `${insets[side]}px`);
      else el.style.removeProperty(`--inset-${side}`);
    }
  }, [ref, insets]);
}

let announced = false;

/** Send `ready` once per page, after the first render (StrictMode runs effects twice; the flag absorbs that). */
export function useBridgeReady(): void {
  useEffect(() => {
    if (announced) return;
    announced = true;
    bridge.send("ready", {});
  }, []);
}

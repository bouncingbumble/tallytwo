/**
 * True while a phone or tablet is held upright. The table is laid out for a phone held sideways
 * (styles/table.css), so App.tsx covers the game with the rotate prompt (ui/RotatePrompt.tsx),
 * makes the game inert, and folds this into `paused` so no AI move fires behind the prompt.
 *
 * Only touch-first devices are gated — `(pointer: coarse) and (hover: none)` — so a narrow
 * desktop window still plays. `orientation: portrait` is the viewport being taller than wide,
 * which also covers a shell's webview. WEB bucket.
 */
import { useSyncExternalStore } from "react";

const PORTRAIT_BLOCK_QUERY = "(orientation: portrait) and (pointer: coarse) and (hover: none)";

function query(): MediaQueryList | null {
  return typeof window.matchMedia === "function" ? window.matchMedia(PORTRAIT_BLOCK_QUERY) : null;
}

const getSnapshot = (): boolean => query()?.matches ?? false;

function subscribe(onChange: () => void): () => void {
  const mq = query();
  mq?.addEventListener?.("change", onChange);
  window.addEventListener("resize", onChange);
  window.addEventListener("orientationchange", onChange);
  return () => {
    mq?.removeEventListener?.("change", onChange);
    window.removeEventListener("resize", onChange);
    window.removeEventListener("orientationchange", onChange);
  };
}

export function usePortraitBlock(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}

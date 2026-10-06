/**
 * document.hidden as React state (P:1272-1275). True while the tab is away: App.tsx folds it
 * into `paused`, so no AI move fires in the background and the audio hook suspends.
 */
import { useSyncExternalStore } from "react";

const subscribe = (onChange: () => void): (() => void) => {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
};
const getSnapshot = (): boolean => document.hidden;

export function usePageVisibility(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}

/**
 * Is the phone held sideways? There is no landscape layout on purpose (the original build plan §3.6): the
 * same media query that shows the "Turn your phone" cover (styles/responsive.css) feeds
 * `paused` in App.tsx, so no AI move fires under the cover and play resumes on rotate-back.
 */
import { useSyncExternalStore } from "react";

export const LANDSCAPE_SHORT = "(orientation: landscape) and (max-height: 500px)";

const subscribe = (onChange: () => void): (() => void) => {
  const mql = window.matchMedia(LANDSCAPE_SHORT);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
};
const getSnapshot = (): boolean => window.matchMedia(LANDSCAPE_SHORT).matches;

export function useLandscapeShort(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}

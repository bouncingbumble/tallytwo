/**
 * devicePixelRatio as React state, mirrored to --dpr on :root so the CSS can derive the pile's
 * card size (tokens.css --cw-small) and the Spike its half-pixel probe. A `(resolution: Ndppx)`
 * query stops matching the moment the dpr changes (a window dragged to another screen) and
 * resize covers browser zoom; the query is re-armed for the new dpr each time it fires.
 */
import { useEffect, useSyncExternalStore } from "react";

const getSnapshot = (): number => window.devicePixelRatio || 1;

function subscribe(onChange: () => void): () => void {
  let mql: MediaQueryList | null = null;
  function arm(): void {
    mql?.removeEventListener("change", fire);
    mql = window.matchMedia(`(resolution: ${getSnapshot()}dppx)`);
    mql.addEventListener("change", fire);
  }
  function fire(): void {
    arm();
    onChange();
  }
  arm();
  window.addEventListener("resize", onChange);
  return () => {
    mql?.removeEventListener("change", fire);
    window.removeEventListener("resize", onChange);
  };
}

export function useDevice(): { dpr: number } {
  const dpr = useSyncExternalStore(subscribe, getSnapshot);
  useEffect(() => {
    document.documentElement.style.setProperty("--dpr", String(dpr));
  }, [dpr]);
  return { dpr };
}

/**
 * The speech bubbles over the AI seats (P:890-900). The caller picks the line (barkLinesFor in
 * selectors.ts), so this hook knows nothing about personalities. `show` keeps its identity for
 * the component's lifetime: act() depends on it, and a new act() would recreate actAi and
 * re-arm the turn loop's timer mid-think. HOOKS bucket: React + setTimeout only.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { BARK_MS } from "./timing";
import type { Bark } from "./useGame";

export interface BarksApi {
  list: Bark[];
  /** Show `text` over `seat` for BARK_MS. Stable for the component's lifetime. */
  show(seat: number, text: string): void;
}

export function useBarks(): BarksApi {
  const [list, setList] = useState<Bark[]>([]);
  const nextId = useRef(1);
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());

  const show = useCallback((seat: number, text: string) => {
    const id = nextId.current++;
    setList((l) => [...l, { id, seat, text }]);
    const t = setTimeout(() => {
      timers.current.delete(t);
      setList((l) => l.filter((b) => b.id !== id));
    }, BARK_MS);
    timers.current.add(t);
  }, []);

  // Clear every pending removal on unmount; a late setList on an unmounted tree is a no-op in
  // React 18+, but the timers would still be live.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const t of pending) clearTimeout(t);
      pending.clear();
    };
  }, []);

  return { list, show };
}

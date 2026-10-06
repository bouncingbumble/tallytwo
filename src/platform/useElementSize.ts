/**
 * The size of a DOM element in whole CSS px, kept current by a ResizeObserver. The hand fans
 * from the width (render/fanLayout.ts) and the trick rows stack from the height (ui/Pile.tsx),
 * so both are floored: a fractional size would centre a card on a half pixel. WEB bucket —
 * platform/ is where DOM globals are touched.
 */
import { type RefObject, useLayoutEffect, useRef, useState } from "react";

export interface ElementSize {
  width: number;
  height: number;
}

const ZERO: ElementSize = { width: 0, height: 0 };

export function useElementSize<T extends HTMLElement>(): [RefObject<T | null>, ElementSize] {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState(ZERO);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const next = { width: Math.floor(r.width), height: Math.floor(r.height) };
      setSize((prev) => (prev.width === next.width && prev.height === next.height ? prev : next));
    };
    measure(); // before the first paint, so the fan never shows at x = 0
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size];
}

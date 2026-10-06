/**
 * The width of a DOM element in whole CSS px, kept current by a ResizeObserver. The hand fans
 * from this number (render/fanLayout.ts), so it is floored: a fractional width would centre
 * the fan on a half pixel. WEB bucket — platform/ is where DOM globals are touched.
 */
import { type RefObject, useLayoutEffect, useRef, useState } from "react";

export function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.floor(el.getBoundingClientRect().width));
    measure(); // before the first paint, so the fan never shows at x = 0
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

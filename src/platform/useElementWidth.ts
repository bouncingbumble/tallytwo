/**
 * The width of a DOM element in whole CSS px (useElementSize, for the callers that only fan
 * horizontally).
 */
import type { RefObject } from "react";
import { useElementSize } from "./useElementSize";

export function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const [ref, size] = useElementSize<T>();
  return [ref, size.width];
}

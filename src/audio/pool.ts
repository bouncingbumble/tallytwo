/**
 * Round-robin without an immediate repeat: a random index, bumped by one if it equals the
 * last pick (P:358-360). n === 0 is the caller's guard — play() never asks for a variant of
 * an empty pool.
 */
export function pickVariant(n: number, last: number, rand: () => number): number {
  if (n <= 0) throw new Error("pickVariant: empty pool");
  let i = Math.floor(rand() * n);
  if (i >= n) i = n - 1;
  if (n > 1 && i === last) i = (i + 1) % n;
  return i;
}

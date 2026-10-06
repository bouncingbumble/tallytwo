/**
 * Seeds. A deal's seed fixes the shuffle AND the AI's random stream, so a round replays from
 * its seed alone (and from seed + history). The URL's ?seed= is parsed in App.tsx, not here —
 * URLSearchParams is a DOM type and this file copies to React Native unchanged.
 */
import { type Rng, mulberry32 } from "../engine/cards";

/** A fresh seed for a deal. `now` and `r` are injectable for tests. */
export const newSeed = (round: number, now: number = Date.now(), r: number = Math.random()): number =>
  ((now ^ Math.floor(r * 0x7fffffff)) ^ Math.imul(round, 2654435761)) >>> 0;

/** The AI's stream for a deal: a second stream off the same seed (sim.mjs uses the same constant). */
export const aiRngFor = (seed: number): Rng => mulberry32(seed ^ 0x9e3779b9);

/**
 * "Plays to empty": a greedy partition of a hand into the fewest plays, taking the largest
 * combo first and the cheapest among equals. It is the AI's core evaluation number, so it is
 * memoised at module level — call clearPartitionCache() on every new match and in test
 * setup, because a hand's count depends on the straightWrap rule.
 */
import type { Card } from "../engine/cards";
import type { RuleConfig } from "../engine/rules";
import { genMoves } from "./moves";

const cache = new Map<string, number>();
const CACHE_LIMIT = 60000;

export function partitionCount(hand: readonly Card[], rules: RuleConfig): number {
  if (!hand.length) return 0;
  const key = hand.join(",") + "|" + (rules.straightWrap ? 1 : 0);
  const hit = cache.get(key);
  if (hit !== undefined) return hit;

  let rem = hand.slice();
  let plays = 0;
  let guard = 0;
  while (rem.length && guard++ < 20) {
    const ms = genMoves(rem, rules);
    if (!ms.length) {
      plays += rem.length;
      break;
    }
    let best = ms[0];
    for (const m of ms) {
      if (m.cards.length > best.cards.length || (m.cards.length === best.cards.length && m.key < best.key)) best = m;
    }
    plays++;
    const gone = new Set(best.cards);
    rem = rem.filter((c) => !gone.has(c));
  }
  if (cache.size > CACHE_LIMIT) cache.clear();
  cache.set(key, plays);
  return plays;
}

export function clearPartitionCache(): void {
  cache.clear();
}

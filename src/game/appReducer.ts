/**
 * The app's reducer wraps the engine's. game === null is the title screen. App-level actions
 * (NEW_MATCH, NEXT_ROUND, SCORE_ROUND, QUIT, SET_RULES) get no-op guards because a button can be
 * double-tapped and must not unmount the tree; PLAY/PASS stay loud — they are gated by
 * legalMoves() and canPass(), so an engine throw there is a real bug and tryReduce() turns it
 * into a CrashReport with everything needed to replay it.
 */
import { classify } from "../engine/combos";
import { type Action, DEFAULT_SEATS, deal, reduce } from "../engine/reducer";
import type { RuleConfig } from "../engine/rules";
import type { GameState } from "../engine/state";
import { clearPartitionCache } from "../ai/partition";
import { type GameLog, gameLog } from "./selectors";

export interface AppState {
  game: GameState | null;
  /** Bumps on every deal; keys the deal animation. */
  dealId: number;
}

export const INITIAL: AppState = { game: null, dealId: 0 };

export type AppAction = Action | { type: "NEW_MATCH"; seed: number; rules: RuleConfig } | { type: "QUIT" } | { type: "SET_RULES"; rules: RuleConfig };

const sameRules = (a: RuleConfig, b: RuleConfig): boolean => a.straightWrap === b.straightWrap && a.flushSuitFirst === b.flushSuitFirst;

/**
 * Settings apply to the game in progress, not only the next one. The combo on the table was
 * keyed under the old rules (flushSuitFirst changes a flush's key), so it is re-classified under
 * the new ones; a play the new rules no longer recognise (a wrap-around straight with wrapping
 * turned off) stays as it was, and is still beaten by any higher straight.
 */
export function applyRules(g: GameState, rules: RuleConfig): GameState {
  if (sameRules(g.rules, rules)) return g;
  const lastPlay = g.lastPlay ? (classify(g.lastPlay.cards, rules) ?? g.lastPlay) : null;
  return { ...g, rules, lastPlay };
}

export function appReduce(s: AppState, a: AppAction): AppState {
  switch (a.type) {
    case "NEW_MATCH":
      clearPartitionCache();
      return { game: deal(a.seed, a.rules, DEFAULT_SEATS), dealId: s.dealId + 1 };
    case "QUIT":
      return { game: null, dealId: s.dealId };
    case "SET_RULES": {
      if (!s.game) return s;
      const game = applyRules(s.game, a.rules);
      return game === s.game ? s : { ...s, game };
    }
    case "DEAL":
      return s; // the app deals through NEW_MATCH; the engine's DEAL has no phase guard
    case "NEXT_ROUND":
      if (!s.game || s.game.phase !== "scored") return s;
      return { game: reduce(s.game, a), dealId: s.dealId + 1 };
    case "SCORE_ROUND":
      if (!s.game || s.game.phase !== "roundover") return s;
      return { ...s, game: reduce(s.game, a) };
    default:
      if (!s.game) return s;
      return { ...s, game: reduce(s.game, a) };
  }
}

export type CrashReport = { error: Error; action: AppAction } & GameLog;

/** The ONE place an engine throw is caught. Pure, so it is unit-tested directly. */
export function tryReduce(s: AppState, a: AppAction): { next: AppState; crash?: undefined } | { next?: undefined; crash: CrashReport } {
  try {
    return { next: appReduce(s, a) };
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    // reduce() is only reached with a game, so s.game is non-null here
    return { crash: { error, action: a, ...gameLog(s.game!) } };
  }
}

/** The log as the crash screen and the menu copy it: JSON, replayable with replayLog(). */
export const serializeLog = (log: GameLog): string =>
  JSON.stringify({ seed: log.seed, rules: log.rules, round: log.round, leader: log.leader, totals: log.totals, history: log.history, final: log.final }, null, 2);

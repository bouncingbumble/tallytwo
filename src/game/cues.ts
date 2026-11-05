/**
 * cueFor(before, action, next): the sounds and the bark one action causes. Pure and tested row
 * by row (the original build plan §3.4). Barks are AI-only: seat 0 has no personality and no lines.
 */
import type { GameState } from "../engine/state";
import type { SfxEvent } from "../audio/sfxTable";
import type { AppAction } from "./appReducer";

/** Seat 0. Not imported from selectors.ts, which imports this file's types. */
const HUMAN = 0;
/** The last round of a match (selectors.ROUNDS_PER_MATCH; asserted equal in cues.test.ts). */
export const FINAL_ROUND = 8;

export type BarkKind = "play" | "pass" | "win";

export interface Cue {
  sfx: SfxEvent[];
  /** A deal roll (shuffle + four ticks) rather than a single event. */
  dealRoll?: boolean;
  /** The deal that just happened is the match's final round: announce it. */
  finalRound?: boolean;
  bark?: { seat: number; kind: BarkKind };
}

const isAi = (g: GameState | null, seat: number): boolean => !!g && g.players[seat]?.kind === "ai";

/** An AI's move handed the turn to the human in a live round. */
const turnComesRound = (player: number, next: GameState | null): boolean =>
  player !== HUMAN && !!next && next.phase === "playing" && next.turn === HUMAN;

export function cueFor(before: GameState | null, action: AppAction, next: GameState | null): Cue {
  switch (action.type) {
    case "PLAY": {
      const sfx: SfxEvent[] = [action.cards.length >= 5 ? "playFive" : "playSmall"];
      const won = next?.phase === "roundover";
      if (won) sfx.push("roundWin");
      else if (next?.players[action.player]?.hand.length === 1) sfx.push("lastCard");
      if (turnComesRound(action.player, next)) sfx.push("yourTurn");
      const bark = isAi(before, action.player) ? { seat: action.player, kind: won ? ("win" as const) : ("play" as const) } : undefined;
      return bark ? { sfx, bark } : { sfx };
    }
    case "PASS": {
      const cleared = !!before && before.lastPlay !== null && !!next && next.lastPlay === null;
      const sfx: SfxEvent[] = [cleared ? "trickClear" : "pass"];
      if (turnComesRound(action.player, next)) sfx.push("yourTurn");
      const bark = isAi(before, action.player) ? { seat: action.player, kind: "pass" as const } : undefined;
      return bark ? { sfx, bark } : { sfx };
    }
    case "NEW_MATCH":
    case "NEXT_ROUND":
      return next?.round === FINAL_ROUND ? { sfx: ["finalRound"], dealRoll: true, finalRound: true } : { sfx: [], dealRoll: true };
    case "SCORE_ROUND":
      return { sfx: ["tally"] };
    default:
      return { sfx: [] };
  }
}

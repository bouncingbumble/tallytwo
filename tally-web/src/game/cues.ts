/**
 * cueFor(before, action, next): the sounds and the bark one action causes. Pure and tested row
 * by row (WEB-PLAN §3.4). Barks are AI-only: seat 0 has no personality and no lines.
 */
import type { GameState } from "../engine/state";
import type { SfxEvent } from "../audio/sfxTable";
import type { AppAction } from "./appReducer";

export type BarkKind = "play" | "pass" | "win";

export interface Cue {
  sfx: SfxEvent[];
  /** A deal roll (shuffle + four ticks) rather than a single event. */
  dealRoll?: boolean;
  bark?: { seat: number; kind: BarkKind };
}

const isAi = (g: GameState | null, seat: number): boolean => !!g && g.players[seat]?.kind === "ai";

export function cueFor(before: GameState | null, action: AppAction, next: GameState | null): Cue {
  switch (action.type) {
    case "PLAY": {
      const sfx: SfxEvent[] = [action.cards.length >= 5 ? "playFive" : "playSmall"];
      const won = next?.phase === "roundover";
      if (won) sfx.push("roundWin");
      const bark = isAi(before, action.player) ? { seat: action.player, kind: won ? ("win" as const) : ("play" as const) } : undefined;
      return bark ? { sfx, bark } : { sfx };
    }
    case "PASS": {
      const cleared = !!before && before.lastPlay !== null && !!next && next.lastPlay === null;
      const sfx: SfxEvent[] = [cleared ? "trickClear" : "pass"];
      const bark = isAi(before, action.player) ? { seat: action.player, kind: "pass" as const } : undefined;
      return bark ? { sfx, bark } : { sfx };
    }
    case "NEW_MATCH":
    case "NEXT_ROUND":
      return { sfx: [], dealRoll: true };
    default:
      return { sfx: [] };
  }
}

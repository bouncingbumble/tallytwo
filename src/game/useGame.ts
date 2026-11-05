/**
 * The store's public face. GameProvider builds this value; every component reads it through
 * useGame(). HOOKS bucket: React only, no DOM.
 */
import { createContext, useContext } from "react";
import type { Card } from "../engine/cards";
import type { Combo } from "../engine/combos";
import type { GameState } from "../engine/state";
import type { Difficulty } from "../ai/choose";
import type { AudioPort } from "../audio/port";
import type { AppAction, CrashReport } from "./appReducer";
import type { Sign, Status } from "./selectors";

export interface Bark {
  id: number;
  seat: number;
  text: string;
}

/** A banner over the felt: "Final round, Dusty Vane is wanted". */
export interface Announcement {
  id: number;
  text: string;
}

/**
 * What a shell (a native wrapper or an iframe parent) is told about the game. The web adapter
 * is platform/bridge.ts `bridgeShell`; it arrives as a GameProvider prop like `audio`, so this
 * file stays portable. Every method is fire-and-forget.
 */
export interface ShellPort {
  /** "slap" for a play that landed, "win" when it emptied a hand, "deal" on a deal roll. */
  haptic(kind: "slap" | "win" | "deal"): void;
  score(round: number, totals: number[]): void;
  matchOver(winner: number, totals: number[]): void;
}

export interface GameApi {
  game: GameState | null;
  /** Bumps on every deal; keys the deal animation and the Hand's card elements. */
  dealId: number;
  selection: Card[];
  /** The human's legal moves on their turn, memoised on [game] only. */
  legal: Combo[];
  /** The legal move equal to the selection; Play is enabled iff non-null. */
  exact: Combo | null;
  /** Cards that can still complete a legal move with the selection; null when nothing is selected. */
  live: Set<Card> | null;
  canPass: boolean;
  status: Status;
  sign: Sign;
  /** Dispatch. Illegal engine actions become `crash`, never a throw. */
  act(a: AppAction): void;
  /** One AI move for `seat`, from the provider's seeded rng. */
  actAi(seat: number, difficulty: Difficulty): void;
  toggleCard(v: Card): void;
  setSelection(cards: Card[]): void;
  barks: Bark[];
  /** The final-round banner while it is up, else null. */
  announcement: Announcement | null;
  /** The injected port, re-exposed so useAudio never imports WebAudio. */
  audio: AudioPort;
  crash: CrashReport | null;
}

export const GameContext = createContext<GameApi | null>(null);

export function useGame(): GameApi {
  const v = useContext(GameContext);
  if (!v) throw new Error("useGame() must be used inside <GameProvider>");
  return v;
}

/**
 * The whole game is one plain JSON object. Nothing in it is a class, a Set or a function,
 * so it can be logged, copied, diffed and replayed. The only derived structure (the Set of
 * played cards an AI counts) is rebuilt per call by publicView().
 */
import type { Card } from "./cards";
import type { Combo } from "./combos";
import type { RuleConfig } from "./rules";

/** playing -> roundover (a hand emptied) -> scored (totals updated) -> playing (next deal) */
export type Phase = "playing" | "roundover" | "scored";

export type PlayerKind = "human" | "ai";

export interface Player {
  name: string;
  kind: PlayerKind;
  /** Personality key for AI seats; absent for the human. */
  personality?: string;
  /** Sorted ascending. */
  hand: Card[];
  /** Has passed since the last play. */
  passed: boolean;
}

/** One entry per action in the round. A pass is a record with no cards. */
export interface PlayRecord {
  by: number;
  cards: Card[];
}

export interface GameState {
  seed: number;
  round: number;
  rules: RuleConfig;
  phase: Phase;
  players: Player[];
  /** Whose turn it is. After a round ends it stays on the winner. */
  turn: number;
  /** Who led the current trick. */
  leader: number;
  /** What is on the table, or null when the lead is open. */
  lastPlay: Combo | null;
  /** Who played lastPlay. Survives a trick clear, because that seat leads next. */
  lastBy: number | null;
  /** Consecutive passes since the last play. */
  passesInRow: number;
  /** The opening play of this round must include the 3♦. */
  forced3D: boolean;
  history: PlayRecord[];
  /** Index into history where the current trick began (0 at the deal; history.length after a clear). */
  trickStart: number;
  /** Running match totals, one per seat. */
  totals: number[];
}

/** What an AI is allowed to see: public state plus its own hand index. */
export interface PublicView {
  me: number;
  counts: number[];
  lastPlay: Combo | null;
  passesInRow: number;
  /** Every card played so far this round. Rebuilt per call; never stored. */
  played: Set<Card>;
  /** The next play must include the 3♦. */
  need3D: boolean;
}

/** True until the round's first play has been made, when the lead is forced to hold the 3♦. */
export const needThreeD = (g: GameState): boolean => g.forced3D && g.lastPlay === null && g.history.length === 0;

export function publicView(g: GameState, me: number): PublicView {
  const played = new Set<Card>();
  for (const r of g.history) for (const c of r.cards) played.add(c);
  return {
    me,
    counts: g.players.map((p) => p.hand.length),
    lastPlay: g.lastPlay,
    passesInRow: g.passesInRow,
    played,
    need3D: needThreeD(g),
  };
}

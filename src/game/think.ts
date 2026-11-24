/**
 * An AI move as a request and a result, so it can be computed off the main thread. Card sharp
 * looks ahead by playing rounds out (ai/lookahead.ts): ~10 ms a move, 80+ ms at worst — long
 * enough to drop frames while the previous play is still flying in. The web shell answers
 * through a Worker (platform/think.ts); tests, the sim and a browser without workers answer with
 * thinkNow() on the spot.
 *
 * Determinism: the AI's random stream travels as its state (engine/cards seededRng) and comes
 * back advanced, so a worker's answer is the answer aiTurn would have given on the main thread,
 * draw for draw, and a round still replays from its seed.
 *
 * PURE.
 */
import { seededRng } from "../engine/cards";
import type { Action } from "../engine/reducer";
import type { GameState } from "../engine/state";
import { aiTurn } from "../ai/aiTurn";
import type { Difficulty } from "../ai/choose";

export interface ThinkRequest {
  game: GameState;
  seat: number;
  /** The AI stream's state before this move. */
  rngState: number;
  difficulty: Difficulty;
}

export interface ThinkResult {
  action: Action;
  /** The stream's state after this move's draws. */
  rngState: number;
}

/** Something that answers think requests, eventually. A rejection is an AI-side bug: the store turns it into a crash report. */
export interface ThinkPort {
  think(req: ThinkRequest): Promise<ThinkResult>;
}

/** One AI move, here and now. */
export function thinkNow(req: ThinkRequest): ThinkResult {
  const rng = seededRng(req.rngState);
  const action = aiTurn(req.game, req.seat, rng.next, req.difficulty);
  return { action, rngState: rng.state };
}

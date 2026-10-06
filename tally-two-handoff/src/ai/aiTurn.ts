/**
 * One AI turn as an Action. The recipe from ENGINE.md: build the seat's public view, look up
 * its personality, ask chooseMove, and wrap the answer as PLAY or PASS. Pure; the rng is the
 * caller's (the provider keeps a seeded one per deal).
 */
import type { Rng } from "../engine/cards";
import type { Action } from "../engine/reducer";
import { type GameState, publicView } from "../engine/state";
import { type Difficulty, chooseMove } from "./choose";
import { getPersonality } from "./getPersonality";

export function aiTurn(game: GameState, seat: number, rng: Rng, difficulty: Difficulty): Action {
  const player = game.players[seat];
  if (player.kind !== "ai") throw new Error(`seat ${seat} is not an AI`);
  const pers = getPersonality(player.personality);
  const move = chooseMove(publicView(game, seat), player.hand, pers, game.rules, rng, difficulty);
  return move ? { type: "PLAY", player: seat, cards: move.cards.slice() } : { type: "PASS", player: seat };
}

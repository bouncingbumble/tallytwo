/**
 * The turn loop: ONE effect that arms ONE timer from the current game state and clears it on
 * every change (the prototype's single S.timer, P:922). AI think delay and roundover ->
 * SCORE_ROUND live here. The human's turn arms nothing: the player is never passed for them,
 * even with no legal move — the Pass button is the only way on. `paused` (hidden tab, landscape
 * overlay) is computed in App.tsx so no DOM object appears in this file; it copies to React
 * Native unchanged.
 *
 * INVARIANT: every value in the deps array below must keep its identity between renders unless
 * `game` changed. (act/actAi depend on state + barks.show + audio; opts.* are primitives.) A
 * value that changes identity for any other reason clears and re-arms the pending timer, which
 * looks like "the AI hesitates".
 *
 * Because the effect depends on the `game` object, each turn re-runs with exactly the state the
 * AI must act on (no stale dispatch, no throw). Every branch returns clearTimeout. chooseMove
 * runs INSIDE the timeout, inside the provider, so StrictMode's mount/cleanup/mount never
 * consumes the AI rng twice. A crash inside act() leaves `game` unchanged and sets `crash`, so
 * no timer is re-armed and the crash screen is the only thing that happens.
 */
import { useEffect } from "react";
import { useSettings } from "../settings/useSettings";
import { HUMAN } from "./selectors";
import { FIRST_STEP_MS, ROUND_OVER_MS, paced, playLandMs, thinkMs } from "./timing";
import { useGame } from "./useGame";

export function useTurnLoop(paused: boolean): void {
  const { game, crash, act, actAi } = useGame();
  const { opts } = useSettings();

  useEffect(() => {
    if (!game || paused || crash) return; // no timers in a hidden tab, under the landscape overlay, or on the crash screen
    // Every wait is paced by the Game speed setting, and only by it.
    const clamp = (ms: number) => paced(ms, opts.gameSpeed);
    // A play's flight onto the felt is a fixed length, not paced: nothing happens next until it has landed.
    const last = game.history.at(-1);
    const landing = last && last.cards.length ? playLandMs(last.cards.length) : 0;
    if (game.phase === "roundover") {
      // The turn stays on the winner, which is how the two delays tell human and AI apart.
      const t = setTimeout(() => act({ type: "SCORE_ROUND" }), landing + clamp(game.turn === HUMAN ? ROUND_OVER_MS.human : ROUND_OVER_MS.ai));
      return () => clearTimeout(t);
    }
    if (game.phase !== "playing") return;
    const seat = game.turn;
    if (game.players[seat].kind === "human") return; // the player's move, however long it takes
    const extra = game.history.length === 0 ? FIRST_STEP_MS : 0;
    const t = setTimeout(() => actAi(seat, opts.difficulty), landing + clamp(thinkMs(opts.gameSpeed, Math.random()) + extra));
    return () => clearTimeout(t);
  }, [game, paused, crash, opts.gameSpeed, opts.difficulty, act, actAi]);
}

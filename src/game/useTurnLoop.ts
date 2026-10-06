/**
 * The turn loop: ONE effect that arms ONE timer from the current game state and clears it on
 * every change (the prototype's single S.timer, P:922). AI think delay, the human's auto-pass,
 * and roundover -> SCORE_ROUND all live here. `paused` (hidden tab, landscape overlay) is
 * computed in App.tsx so no DOM object appears in this file; it copies to React Native unchanged.
 *
 * INVARIANT: every value in the deps array below must keep its identity between renders unless
 * `game` changed. (act/actAi depend on state + barks.show + audio; legal is memoised on [game];
 * opts.* are primitives.) A value that changes identity for any other reason clears and re-arms
 * the pending timer, which looks like "the AI hesitates".
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
import { AUTO_PASS_MS, FIRST_STEP_MS, ROUND_OVER_MS, clampMotion, thinkMs } from "./timing";
import { useGame } from "./useGame";

export function useTurnLoop(paused: boolean): void {
  const { game, legal, crash, act, actAi } = useGame();
  const { opts } = useSettings();

  useEffect(() => {
    if (!game || paused || crash) return; // no timers in a hidden tab, under the landscape overlay, or on the crash screen
    const clamp = (ms: number) => clampMotion(ms, opts.reduceMotion);
    if (game.phase === "roundover") {
      // The turn stays on the winner, which is how the two delays tell human and AI apart.
      const t = setTimeout(() => act({ type: "SCORE_ROUND" }), clamp(game.turn === HUMAN ? ROUND_OVER_MS.human : ROUND_OVER_MS.ai));
      return () => clearTimeout(t);
    }
    if (game.phase !== "playing") return;
    const seat = game.turn;
    if (game.players[seat].kind === "human") {
      if (!opts.autoPass || !game.lastPlay || legal.length) return;
      const t = setTimeout(() => act({ type: "PASS", player: seat }), clamp(AUTO_PASS_MS));
      return () => clearTimeout(t);
    }
    const extra = game.history.length === 0 ? FIRST_STEP_MS : 0;
    const t = setTimeout(() => actAi(seat, opts.difficulty), clamp(thinkMs(opts.speed, Math.random()) + extra));
    return () => clearTimeout(t);
  }, [game, legal, paused, crash, opts.autoPass, opts.speed, opts.difficulty, opts.reduceMotion, act, actAi]);
}

/**
 * DEV only: window.__tally = { act, game } so the M1b gate can force an illegal PLAY from the
 * console (`__tally.act({ type: "PLAY", player: 0, cards: [51] })` → CrashScreen) without
 * editing code. Mounted inside GameProvider; renders nothing; dead code in a production build.
 * The window.__tally type lives in platform/globals.d.ts beside the audio probe's.
 */
import { useEffect, useRef } from "react";
import { useGame } from "../game/useGame";

export function DevHook() {
  const api = useGame();
  const ref = useRef(api);
  useEffect(() => {
    ref.current = api;
  });
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__tally = {
      act: (a) => ref.current.act(a),
      get game() {
        return ref.current.game;
      },
    };
    return () => {
      delete window.__tally;
    };
  }, []);
  return null;
}

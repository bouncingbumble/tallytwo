/**
 * The store. One useReducer over appReduce, useState for the selection and the crash, a seeded
 * rng per deal for the AI, and the cosmetic layer (sounds, barks, shell events) inside act().
 * HOOKS bucket: React + setTimeout only; the AudioPort and the ShellPort arrive as props. The provider never renders a crash
 * screen itself: App.tsx reads `crash` from useGame() and does that, so this always renders its
 * children.
 *
 * Math.random is for cosmetics only (bark chance, which line). The AI draws from aiRng, which
 * is reseeded on every deal and consumed by nothing else, so a round replays from its seed.
 */
import { type ReactNode, useCallback, useMemo, useReducer, useRef, useState } from "react";
import type { Card, Rng } from "../engine/cards";
import { aiTurn } from "../ai/aiTurn";
import type { Difficulty } from "../ai/choose";
import type { AudioPort } from "../audio/port";
import { type AppAction, type CrashReport, INITIAL, appReduce, tryReduce } from "./appReducer";
import { cueFor } from "./cues";
import { aiRngFor } from "./seeds";
import { barkLinesFor, canPass as canPassFor, canToggle, exactMove, gameLog, legalFor, liveCards, matchOver, matchWinner, signFor, statusFor } from "./selectors";
import { BARK_CHANCE } from "./timing";
import { useBarks } from "./useBarks";
import { type GameApi, GameContext, type ShellPort } from "./useGame";

const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));

/** No shell (a plain browser tab, a test): the events go nowhere. A module constant, so act() keeps its identity. */
const NO_SHELL: ShellPort = { haptic() {}, score() {}, matchOver() {} };

export function GameProvider({ audio, shell = NO_SHELL, children }: { audio: AudioPort; shell?: ShellPort; children: ReactNode }) {
  const [state, dispatch] = useReducer(appReduce, INITIAL);
  const [selection, setSelection] = useState<Card[]>([]);
  const [crash, setCrash] = useState<CrashReport | null>(null);
  const aiRng = useRef<Rng>(aiRngFor(0));
  const { list: barkList, show: showBark } = useBarks(); // show, never the whole object: a bark must not recreate act()
  const game = state.game;

  const act = useCallback(
    (a: AppAction) => {
      const before = state.game;
      if (a.type === "QUIT") setCrash(null);
      const r = tryReduce(state, a); // pure, so this pre-call is free
      if (r.crash) {
        setCrash(r.crash); // nothing dispatched: `game` is unchanged, no timer is re-armed
        return;
      }
      if (r.next === state) return; // an app-level no-op (double tap, stale NEXT_ROUND): no dispatch, no reseed, no sound
      // Reseed per deal, and only for a deal that actually happened, so the AI's stream always
      // matches the deal's own seed and a round replays from its log.
      if (r.next.dealId !== state.dealId && (a.type === "NEW_MATCH" || a.type === "NEXT_ROUND")) aiRng.current = aiRngFor(a.seed);
      dispatch(a);
      if (a.type === "PLAY" || a.type === "PASS" || a.type === "NEW_MATCH" || a.type === "NEXT_ROUND" || a.type === "QUIT") setSelection([]);
      // The cosmetic layer. A throw here happens in a click handler or a timer callback, where
      // no error boundary can see it, so it ALSO becomes a crash report.
      try {
        const cue = cueFor(before, a, r.next.game);
        if (cue.dealRoll) audio.dealRoll();
        for (const e of cue.sfx) audio.play(e);
        if (cue.bark && before && Math.random() < BARK_CHANCE) {
          const lines = barkLinesFor(before, cue.bark.seat, cue.bark.kind);
          if (lines.length) showBark(cue.bark.seat, lines[Math.floor(Math.random() * lines.length)]);
        }
        // The shell's view of the same transition. `r.next !== state` above means each of these
        // fires exactly once: a PLAY that reduced landed; SCORE_ROUND is roundover -> scored;
        // matchOver() is false before that last SCORE_ROUND and true after it.
        const after = r.next.game;
        if (cue.dealRoll) shell.haptic("deal");
        if (a.type === "PLAY") shell.haptic(after?.phase === "roundover" ? "win" : "slap");
        if (a.type === "SCORE_ROUND" && after) shell.score(after.round, after.totals);
        if (after && matchOver(after)) shell.matchOver(matchWinner(after), after.totals);
      } catch (e) {
        const g = before ?? r.next.game;
        if (!g) throw e; // unreachable: without a game before or after, cueFor touches nothing
        setCrash({ error: toError(e), action: a, ...gameLog(g) });
      }
    },
    [state, audio, shell, showBark],
  );

  const actAi = useCallback(
    (seat: number, difficulty: Difficulty) => {
      if (!game) return;
      // aiTurn runs inside the turn-loop timer, where neither tryReduce nor the error boundary can
      // see a throw; without this catch an AI-side bug would freeze the table on "X is thinking…".
      let action: AppAction;
      try {
        action = aiTurn(game, seat, aiRng.current, difficulty); // the rng ref never leaves the provider
      } catch (e) {
        setCrash({ error: toError(e), action: { type: "PASS", player: seat }, ...gameLog(game) });
        return;
      }
      act(action);
    },
    [game, act],
  );

  const toggleCard = useCallback(
    (v: Card) => {
      if (!canToggle(game)) return; // taps during AI turns / roundover do nothing, no sound
      setSelection((s) => (s.includes(v) ? s.filter((c) => c !== v) : [...s, v]));
      audio.play("select");
    },
    [game, audio],
  );

  // `legal` on [game] ONLY: it is a dependency of the turn-loop effect, and memoising it on the
  // selection would recompute the legal moves on every tap.
  const legal = useMemo(() => legalFor(game), [game]);
  const exact = useMemo(() => exactMove(legal, selection), [legal, selection]);
  const live = useMemo(() => liveCards(legal, selection), [legal, selection]);
  const canPass = useMemo(() => canPassFor(game, legal), [game, legal]);
  const status = useMemo(() => statusFor(game, legal, selection), [game, legal, selection]);
  const sign = useMemo(() => signFor(game), [game]);

  const api = useMemo<GameApi>(
    () => ({
      game,
      dealId: state.dealId,
      selection,
      legal,
      exact,
      live,
      canPass,
      status,
      sign,
      act,
      actAi,
      toggleCard,
      setSelection,
      barks: barkList,
      audio,
      crash,
    }),
    [game, state.dealId, selection, legal, exact, live, canPass, status, sign, act, actAi, toggleCard, barkList, audio, crash],
  );

  return <GameContext.Provider value={api}>{children}</GameContext.Provider>;
}

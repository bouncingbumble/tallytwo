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
import { type ReactNode, useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { Card, Rng } from "../engine/cards";
import { aiTurn } from "../ai/aiTurn";
import type { Difficulty } from "../ai/choose";
import type { AudioPort } from "../audio/port";
import { type AppAction, type CrashReport, INITIAL, appReduce, tryReduce } from "./appReducer";
import { cueFor } from "./cues";
import { aiRngFor } from "./seeds";
import { useSettings } from "../settings/useSettings";
import {
  HUMAN,
  barkLinesFor,
  canPass as canPassFor,
  canToggle,
  exactMove,
  finalRoundText,
  gameLog,
  humanTurn,
  legalFor,
  liveCards,
  matchOver,
  matchWinner,
  signFor,
  statusFor,
} from "./selectors";
import { BARK_CHANCE, FINAL_ROUND_MS } from "./timing";
import { useBarks } from "./useBarks";
import { type Announcement, type GameApi, GameContext, type ShellPort } from "./useGame";

const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));

/** No shell (a plain browser tab, a test): the events go nowhere. A module constant, so act() keeps its identity. */
const NO_SHELL: ShellPort = { haptic() {}, score() {}, matchOver() {} };

export function GameProvider({ audio, shell = NO_SHELL, children }: { audio: AudioPort; shell?: ShellPort; children: ReactNode }) {
  const [state, dispatch] = useReducer(appReduce, INITIAL);
  const [selection, setSelection] = useState<Card[]>([]);
  const [crash, setCrash] = useState<CrashReport | null>(null);
  const aiRng = useRef<Rng>(aiRngFor(0));
  const { list: barkList, show: showBark } = useBarks(); // show, never the whole object: a bark must not recreate act()
  const { opts, rules } = useSettings();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const announceId = useRef(0);
  const game = state.game;

  // Rules apply to the game in progress the moment they change, not only to the next match.
  // appReduce's SET_RULES is a no-op when the game already has these rules (or there is no game),
  // so hydration and unrelated settings changes do not touch the game. Changing the rules never
  // changes whose turn it is, so the turn loop's pending timer is only re-armed, never skipped.
  useEffect(() => {
    dispatch({ type: "SET_RULES", rules });
  }, [rules]);

  // The final-round banner goes away on its own; a quit or a new deal takes it down sooner.
  useEffect(() => {
    if (!announcement) return;
    const t = setTimeout(() => setAnnouncement(null), FINAL_ROUND_MS);
    return () => clearTimeout(t);
  }, [announcement]);

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
      // The selection survives the regulars' moves (it can be lined up off turn); the human's own
      // play or pass, a deal and a quit clear it.
      if (((a.type === "PLAY" || a.type === "PASS") && a.player === HUMAN) || a.type === "NEW_MATCH" || a.type === "NEXT_ROUND" || a.type === "QUIT") setSelection([]);
      if (a.type === "NEW_MATCH" || a.type === "NEXT_ROUND" || a.type === "QUIT") setAnnouncement(null);
      // The cosmetic layer. A throw here happens in a click handler or a timer callback, where
      // no error boundary can see it, so it ALSO becomes a crash report.
      try {
        const cue = cueFor(before, a, r.next.game);
        if (cue.dealRoll) audio.dealRoll();
        for (const e of cue.sfx) audio.play(e);
        if (cue.finalRound && r.next.game) setAnnouncement({ id: ++announceId.current, text: finalRoundText(r.next.game) });
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
      if (!canToggle(game)) return; // taps after the round is over do nothing, no sound
      const on = !selection.includes(v);
      setSelection((s) => (s.includes(v) ? s.filter((c) => c !== v) : [...s, v]));
      audio.play(on ? "select" : "deselect");
    },
    [game, audio, selection],
  );

  // `legal` on [game] ONLY: it is a dependency of the turn-loop effect, and memoising it on the
  // selection would recompute the legal moves on every tap.
  const legal = useMemo(() => legalFor(game), [game]);
  const exact = useMemo(() => exactMove(legal, selection), [legal, selection]);
  // Off turn there are no legal moves to measure the selection against, so nothing is dimmed.
  const live = useMemo(() => (humanTurn(game) ? liveCards(legal, selection) : null), [game, legal, selection]);
  const canPass = useMemo(() => canPassFor(game, legal), [game, legal]);
  const status = useMemo(() => statusFor(game, legal, selection, opts.hints), [game, legal, selection, opts.hints]);
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
      announcement,
      audio,
      crash,
    }),
    [game, state.dealId, selection, legal, exact, live, canPass, status, sign, act, actAi, toggleCard, barkList, announcement, audio, crash],
  );

  return <GameContext.Provider value={api}>{children}</GameContext.Provider>;
}

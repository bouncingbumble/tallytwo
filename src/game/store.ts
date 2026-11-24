/**
 * The game store, with no framework. One AppState over appReduce, the selection, the crash
 * report, a seeded rng per deal for the AI, the cosmetic layer (sounds, barks, shell events)
 * inside act(), and the turn loop: ONE pending timer, re-armed only when something it reads
 * changed (the game object, paused, crash, the Game speed / difficulty settings) — a card tap or
 * a bark expiring never re-arms it, so the AI never "hesitates".
 *
 * PURE: time arrives as a ClockPort, sound as an AudioPort, the host as a ShellPort. The Phaser
 * scenes are subscribers; they read `view` and call the methods.
 *
 * Math.random is for cosmetics only (bark chance, which line, think-time jitter). The AI draws
 * from its own stream, reseeded on every deal and consumed by nothing else, so a round replays
 * from its seed. The stream is kept as a state number (engine/cards seededRng) so a ThinkPort can
 * take it to a worker and bring it back advanced.
 *
 * With a ThinkPort the AI's move is computed WHILE its think delay runs (off the main thread on
 * the web), and played when both the delay and the answer are in; a stale answer (the game moved
 * on, a pause, a quit) is dropped and consumes nothing. Without one, actAi computes it on the spot.
 */
import { type Card, seededRng } from "../engine/cards";
import type { Combo } from "../engine/combos";
import type { RuleConfig } from "../engine/rules";
import type { GameState } from "../engine/state";
import { aiTurn } from "../ai/aiTurn";
import type { Difficulty } from "../ai/choose";
import type { AudioPort } from "../audio/port";
import { SEATED, SEAT_PAN } from "../audio/sfxTable";
import { type AppAction, type AppState, type CrashReport, INITIAL, tryReduce } from "./appReducer";
import type { ClockPort } from "./clock";
import { cueFor } from "./cues";
import { Observable } from "./observable";
import { aiRngState } from "./seeds";
import type { ThinkPort, ThinkResult } from "./think";
import {
  HUMAN,
  type Sign,
  type Status,
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
  revealLeftovers,
  signFor,
  statusFor,
} from "./selectors";
import { BARK_CHANCE, BARK_MS, FINAL_ROUND_MS, FIRST_STEP_MS, type GameSpeed, ROUND_END, ROUND_OVER_MS, paced, pacedThink, playLandMs } from "./timing";

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
 * is platform/bridge.ts `bridgeShell`. Every method is fire-and-forget.
 */
export interface ShellPort {
  /** "slap" for a play that landed, "win" when it emptied a hand, "deal" on a deal roll. */
  haptic(kind: "slap" | "win" | "deal"): void;
  score(round: number, totals: number[]): void;
  matchOver(winner: number, totals: number[]): void;
}

/** No shell (a plain browser tab, a test): the events go nowhere. */
export const NO_SHELL: ShellPort = { haptic() {}, score() {}, matchOver() {} };

/** The settings the store reads; the settings store pushes them in (setOpts). */
export interface LoopOpts {
  gameSpeed: GameSpeed;
  difficulty: Difficulty;
  hints: boolean;
}

/** Everything a scene draws from. A new object whenever anything in it changed, else the same one. */
export interface GameView {
  game: GameState | null;
  /** Bumps on every deal; keys the deal animation and the hand's card objects. */
  dealId: number;
  selection: readonly Card[];
  /** The human's legal moves on their turn, recomputed only when `game` changes. */
  legal: readonly Combo[];
  /** The legal move equal to the selection; Play is enabled iff non-null. */
  exact: Combo | null;
  /** Cards that can still complete a legal move with the selection; null when nothing is selected. */
  live: ReadonlySet<Card> | null;
  canPass: boolean;
  status: Status;
  sign: Sign;
  barks: readonly Bark[];
  announcement: Announcement | null;
  crash: CrashReport | null;
  paused: boolean;
}

const toError = (e: unknown): Error => (e instanceof Error ? e : new Error(String(e)));
const NO_CARDS: readonly Card[] = [];

export interface GameStoreDeps {
  audio: AudioPort;
  clock: ClockPort;
  shell?: ShellPort;
  opts?: LoopOpts;
  /** Uniform [0, 1): Math.random in the game, fixed in tests. Cosmetics and think-time only. */
  random?: () => number;
  /** Where AI moves are computed; absent = on the spot, in the timer callback. */
  think?: ThinkPort;
}

export class GameStore extends Observable {
  readonly audio: AudioPort;
  readonly #clock: ClockPort;
  readonly #shell: ShellPort;
  readonly #random: () => number;
  readonly #think: ThinkPort | null;
  #opts: LoopOpts;

  #state: AppState = INITIAL;
  #selection: readonly Card[] = NO_CARDS;
  #crash: CrashReport | null = null;
  #paused = false;
  #barks: readonly Bark[] = [];
  #barkId = 0;
  #barkTimers = new Map<number, () => void>();
  #announcement: Announcement | null = null;
  #announceId = 0;
  #announceCancel: (() => void) | null = null;
  #aiRngState: number = aiRngState(0);
  /** Identifies the think request the loop is waiting on; anything else that answers is stale. */
  #thinkToken: object | null = null;

  // derived, cached by identity of their inputs
  #legalFor: GameState | null | undefined = undefined;
  #legal: readonly Combo[] = [];
  #view: GameView | null = null;

  // the turn loop's one timer and what it was armed from
  #loopCancel: (() => void) | null = null;
  #loopKey: readonly unknown[] = [];

  constructor({ audio, clock, shell = NO_SHELL, opts = { gameSpeed: "normal", difficulty: "medium", hints: false }, random = Math.random, think }: GameStoreDeps) {
    super();
    this.audio = audio;
    this.#clock = clock;
    this.#shell = shell;
    this.#opts = opts;
    this.#random = random;
    this.#think = think ?? null;
  }

  get state(): AppState {
    return this.#state;
  }

  get game(): GameState | null {
    return this.#state.game;
  }

  /** The snapshot scenes render from; the same object until something changes. */
  get view(): GameView {
    if (this.#view) return this.#view;
    const game = this.#state.game;
    if (this.#legalFor !== game) {
      this.#legal = legalFor(game);
      this.#legalFor = game;
    }
    const legal = this.#legal;
    const selection = this.#selection;
    this.#view = {
      game,
      dealId: this.#state.dealId,
      selection,
      legal,
      exact: exactMove(legal, selection),
      // Off turn there are no legal moves to measure the selection against, so nothing is dimmed.
      live: humanTurn(game) ? liveCards(legal, selection) : null,
      canPass: canPassFor(game, legal),
      status: statusFor(game, legal, selection, this.#opts.hints),
      sign: signFor(game),
      barks: this.#barks,
      announcement: this.#announcement,
      crash: this.#crash,
      paused: this.#paused,
    };
    return this.#view;
  }

  #changed(): void {
    this.#view = null;
    this.#syncLoop();
    this.emit();
  }

  /* ---------------- dispatch ---------------- */

  /** Dispatch. Illegal engine actions become `crash`, never a throw. */
  act = (a: AppAction): void => {
    const state = this.#state;
    const before = state.game;
    if (a.type === "QUIT") this.#crash = null;
    const r = tryReduce(state, a);
    if (r.crash) {
      this.#crash = r.crash; // nothing dispatched: `game` is unchanged, no timer is re-armed
      this.#changed();
      return;
    }
    if (r.next === state) {
      if (a.type === "QUIT") this.#changed(); // a QUIT from the crash screen with no game still clears it
      return; // an app-level no-op (double tap, stale NEXT_ROUND): no reseed, no sound
    }
    // Reseed per deal, and only for a deal that actually happened, so the AI's stream always
    // matches the deal's own seed and a round replays from its log.
    if (r.next.dealId !== state.dealId && (a.type === "NEW_MATCH" || a.type === "NEXT_ROUND")) this.#aiRngState = aiRngState(a.seed);
    this.#state = r.next;
    // The selection survives the regulars' moves (it can be lined up off turn); the human's own
    // play or pass, a deal and a quit clear it.
    if (((a.type === "PLAY" || a.type === "PASS") && a.player === HUMAN) || a.type === "NEW_MATCH" || a.type === "NEXT_ROUND" || a.type === "QUIT") this.#selection = NO_CARDS;
    if (a.type === "NEW_MATCH" || a.type === "NEXT_ROUND" || a.type === "QUIT") this.#setAnnouncement(null);
    if (a.type === "QUIT") this.#clearBarks();
    // The cosmetic layer. A throw here happens in a tap handler or a timer callback, so it ALSO
    // becomes a crash report.
    try {
      const cue = cueFor(before, a, r.next.game);
      if (cue.dealRoll) this.audio.dealRoll();
      // a seat's own cards sound from where that seat sits; everything else from the middle
      const seat = a.type === "PLAY" || a.type === "PASS" ? a.player : null;
      for (const e of cue.sfx) this.audio.play(e, seat !== null && SEATED.has(e) ? { pan: SEAT_PAN[seat] ?? 0 } : undefined);
      if (cue.finalRound && r.next.game) this.#setAnnouncement({ id: ++this.#announceId, text: finalRoundText(r.next.game) });
      if (cue.bark && before && this.#random() < BARK_CHANCE) {
        const lines = barkLinesFor(before, cue.bark.seat, cue.bark.kind);
        if (lines.length) this.#showBark(cue.bark.seat, lines[Math.floor(this.#random() * lines.length)]);
      }
      // The shell's view of the same transition; `r.next !== state` above means each fires once.
      const after = r.next.game;
      if (cue.dealRoll) this.#shell.haptic("deal");
      if (a.type === "PLAY") this.#shell.haptic(after?.phase === "roundover" ? "win" : "slap");
      if (a.type === "SCORE_ROUND" && after) this.#shell.score(after.round, after.totals);
      if (after && matchOver(after)) this.#shell.matchOver(matchWinner(after), after.totals);
    } catch (e) {
      const g = before ?? r.next.game;
      if (!g) throw e; // unreachable: without a game before or after, cueFor touches nothing
      this.#crash = { error: toError(e), action: a, ...gameLog(g) };
    }
    this.#changed();
  };

  /** One AI move for `seat`, from the store's seeded rng. */
  actAi = (seat: number, difficulty: Difficulty): void => {
    const game = this.#state.game;
    if (!game) return;
    let action: AppAction;
    try {
      const rng = seededRng(this.#aiRngState);
      action = aiTurn(game, seat, rng.next, difficulty);
      this.#aiRngState = rng.state;
    } catch (e) {
      this.#aiCrash(game, seat, e);
      return;
    }
    this.act(action);
  };

  /** Without this an AI-side bug would freeze the table on "X is thinking…". */
  #aiCrash(game: GameState, seat: number, e: unknown): void {
    this.#crash = { error: toError(e), action: { type: "PASS", player: seat }, ...gameLog(game) };
    this.#changed();
  }

  /** A worker's answer for `game`: played only if the table is still where it was asked. */
  #applyThink(game: GameState, r: ThinkResult): void {
    if (this.#state.game !== game || this.#crash) return;
    this.#aiRngState = r.rngState;
    this.act(r.action);
  }

  /**
   * Ask the ThinkPort now and arm the think delay beside it; whichever lands second plays the move.
   * The returned cancel drops both (a late answer then finds a different token and is ignored).
   */
  #thinkAhead(game: GameState, seat: number, difficulty: Difficulty, delay: number): () => void {
    const think = this.#think!;
    const token = {};
    this.#thinkToken = token;
    let result: ThinkResult | null = null;
    let failure: unknown = null;
    let due = false;
    const settle = () => {
      // both halves in: the delay has run AND the answer (or its failure) has landed
      if (this.#thinkToken !== token || !due || (result === null && failure === null)) return;
      this.#thinkToken = null;
      if (result) this.#applyThink(game, result);
      else this.#aiCrash(game, seat, failure);
    };
    think.think({ game, seat, rngState: this.#aiRngState, difficulty }).then(
      (r) => {
        result = r;
        settle();
      },
      (e: unknown) => {
        failure = e ?? new Error("ai: think failed");
        settle();
      },
    );
    const cancelTimer = this.#clock.after(delay, () => {
      due = true;
      settle();
    });
    return () => {
      cancelTimer();
      if (this.#thinkToken === token) this.#thinkToken = null;
    };
  }

  toggleCard = (v: Card): void => {
    if (!canToggle(this.#state.game)) return; // taps after the round is over do nothing, no sound
    const on = !this.#selection.includes(v);
    this.#selection = on ? [...this.#selection, v] : this.#selection.filter((c) => c !== v);
    this.audio.play(on ? "select" : "deselect");
    this.#changed();
  };

  setSelection = (cards: readonly Card[]): void => {
    this.#selection = cards;
    this.#changed();
  };

  /** Rules apply to the game in progress the moment they change (appReduce SET_RULES is a no-op when unchanged). */
  setRules = (rules: RuleConfig): void => {
    const r = tryReduce(this.#state, { type: "SET_RULES", rules });
    if (r.next && r.next !== this.#state) {
      this.#state = r.next;
      this.#changed();
    }
  };

  setOpts = (opts: LoopOpts): void => {
    const o = this.#opts;
    if (o.gameSpeed === opts.gameSpeed && o.difficulty === opts.difficulty && o.hints === opts.hints) return;
    this.#opts = { ...opts };
    this.#changed();
  };

  /** A hidden tab, the shell's `pause`, the rotate prompt: no AI timer fires while true. */
  setPaused = (paused: boolean): void => {
    if (paused === this.#paused) return;
    this.#paused = paused;
    this.#changed();
  };

  /** Back to the title with nothing pending: the error screen's Saddle up. */
  reset = (): void => {
    this.#state = INITIAL;
    this.#selection = NO_CARDS;
    this.#crash = null;
    this.#setAnnouncement(null);
    this.#clearBarks();
    this.#changed();
  };

  /* ---------------- the turn loop ---------------- */

  /**
   * ONE timer, armed from the current game. Every wait is paced by the Game speed setting. The
   * human's turn arms nothing: the player is never passed for them. A play's flight onto the
   * felt is fixed, not paced: nothing happens next until it has landed.
   */
  #syncLoop(): void {
    const game = this.#state.game;
    const key = [game, this.#paused, this.#crash, this.#opts.gameSpeed, this.#opts.difficulty];
    if (key.every((v, i) => Object.is(v, this.#loopKey[i]))) return;
    this.#loopKey = key;
    this.#loopCancel?.();
    this.#loopCancel = null;
    if (!game || this.#paused || this.#crash) return;
    const speed = this.#opts.gameSpeed;
    const last = game.history.at(-1);
    const landing = last && last.cards.length ? playLandMs(last.cards.length) : 0;
    if (game.phase === "roundover") {
      // The turn stays on the winner, which is how the two delays tell human and AI apart. On
      // Greenhorn the losers' leftover cards are shown first (revealLeftovers), and the poster
      // waits a fixed ROUND_END.revealHoldMs more so they can be read.
      const reveal = revealLeftovers(game, this.#opts.difficulty).length ? ROUND_END.revealHoldMs : 0;
      this.#loopCancel = this.#clock.after(landing + paced(game.turn === HUMAN ? ROUND_OVER_MS.human : ROUND_OVER_MS.ai, speed) + reveal, () => this.act({ type: "SCORE_ROUND" }));
      return;
    }
    if (game.phase !== "playing") return;
    const seat = game.turn;
    if (game.players[seat].kind === "human") return;
    const extra = game.history.length === 0 ? FIRST_STEP_MS : 0;
    const difficulty = this.#opts.difficulty;
    const delay = landing + pacedThink(speed, this.#random()) + paced(extra, speed);
    this.#loopCancel = this.#think ? this.#thinkAhead(game, seat, difficulty, delay) : this.#clock.after(delay, () => this.actAi(seat, difficulty));
  }

  /** Whether the loop has a timer armed (tests). */
  get waiting(): boolean {
    return this.#loopCancel !== null;
  }

  /* ---------------- barks and the banner ---------------- */

  #showBark(seat: number, text: string): void {
    const id = ++this.#barkId;
    this.#barks = [...this.#barks, { id, seat, text }];
    this.#barkTimers.set(
      id,
      this.#clock.after(BARK_MS, () => {
        this.#barkTimers.delete(id);
        this.#barks = this.#barks.filter((b) => b.id !== id);
        this.#changed();
      }),
    );
  }

  #clearBarks(): void {
    for (const cancel of this.#barkTimers.values()) cancel();
    this.#barkTimers.clear();
    this.#barks = [];
  }

  #setAnnouncement(a: Announcement | null): void {
    this.#announceCancel?.();
    this.#announceCancel = null;
    this.#announcement = a;
    if (a)
      this.#announceCancel = this.#clock.after(FINAL_ROUND_MS, () => {
        this.#announceCancel = null;
        this.#announcement = null;
        this.#changed();
      });
  }
}

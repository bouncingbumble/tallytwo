/** The store with a fake clock: the turn loop driven by hand. */
import { expect, test } from "vitest";
import { THREE_OF_DIAMONDS } from "../engine/cards";
import { DEFAULT_RULES } from "../engine/rules";
import { recordingAudio, silentAudio } from "../audio/port";
import { manualClock } from "./clock";
import { HUMAN } from "./selectors";
import { GameStore } from "./store";
import { SEAT_PAN } from "../audio/sfxTable";
import { ROUND_END, ROUND_OVER_MS, paced, playLandMs } from "./timing";

const make = () => {
  const clock = manualClock();
  const store = new GameStore({ audio: silentAudio, clock, random: () => 0.5 });
  return { clock, store };
};

/** A seed where the human holds the 3♦ (and so leads), and one where an AI does. */
const seedWhere = (humanLeads: boolean): number => {
  for (let seed = 1; seed < 500; seed++) {
    const { store } = make();
    store.act({ type: "NEW_MATCH", seed, rules: DEFAULT_RULES });
    if ((store.game!.turn === HUMAN) === humanLeads) return seed;
  }
  throw new Error("no seed");
};

test("the human's turn arms nothing; an AI's turn arms one timer that plays", () => {
  const { clock, store } = make();
  store.act({ type: "NEW_MATCH", seed: seedWhere(true), rules: DEFAULT_RULES });
  expect(store.waiting).toBe(false);
  store.act({ type: "PLAY", player: HUMAN, cards: [THREE_OF_DIAMONDS] });
  expect(store.waiting).toBe(true);
  const turn = store.game!.turn;
  clock.tick(60_000);
  expect(store.game!.history.length).toBeGreaterThan(1);
  expect(store.game!.history[1].by).toBe(turn);
});

test("a whole round plays out with the human always passing, and scores itself", () => {
  const { clock, store } = make();
  store.act({ type: "NEW_MATCH", seed: seedWhere(false), rules: DEFAULT_RULES });
  for (let i = 0; i < 400 && store.game!.phase !== "scored"; i++) {
    const v = store.view;
    if (v.game!.phase === "playing" && v.game!.turn === HUMAN) {
      if (v.canPass) store.act({ type: "PASS", player: HUMAN });
      else store.act({ type: "PLAY", player: HUMAN, cards: v.legal[0].cards });
    } else clock.tick(30_000);
  }
  expect(store.game!.phase).toBe("scored");
  expect(store.view.crash).toBeNull();
  expect(store.game!.totals.reduce((a, b) => a + b, 0)).toBe(0);
});

test("round over -> poster: landing + the paced wait, plus ROUND_END.revealHoldMs on Greenhorn (the leftovers are shown)", () => {
  for (const difficulty of ["medium", "easy"] as const) {
    const clock = manualClock();
    const store = new GameStore({ audio: silentAudio, clock, random: () => 0.5, opts: { gameSpeed: "normal", difficulty } });
    let overAt: number | null = null;
    let scoredAt: number | null = null;
    store.subscribe(() => {
      const ph = store.game?.phase;
      if (ph === "roundover" && overAt === null) overAt = clock.now;
      if (ph === "scored" && scoredAt === null) scoredAt = clock.now;
    });
    store.act({ type: "NEW_MATCH", seed: seedWhere(false), rules: DEFAULT_RULES });
    for (let i = 0; i < 4000 && store.game!.phase !== "scored"; i++) {
      const v = store.view;
      if (v.game!.phase === "playing" && v.game!.turn === HUMAN) {
        if (v.canPass) store.act({ type: "PASS", player: HUMAN });
        else store.act({ type: "PLAY", player: HUMAN, cards: v.legal[0].cards });
      } else clock.tick(50);
    }
    const g = store.game!;
    const last = g.history.at(-1)!;
    const reveal = difficulty === "easy" && g.players.some((p, i) => i !== g.turn && p.kind === "ai" && p.hand.length > 0) ? ROUND_END.revealHoldMs : 0;
    const expected = playLandMs(last.cards.length) + paced(g.turn === HUMAN ? ROUND_OVER_MS.human : ROUND_OVER_MS.ai, "normal") + reveal;
    expect(overAt).not.toBeNull();
    expect(scoredAt! - overAt!).toBe(expected);
    if (difficulty === "easy") expect(reveal).toBe(ROUND_END.revealHoldMs);
  }
});

test("a card tap never re-arms the pending AI timer; pause cancels it and resume re-arms it", () => {
  const { clock, store } = make();
  store.act({ type: "NEW_MATCH", seed: seedWhere(false), rules: DEFAULT_RULES });
  const history = store.game!.history.length;
  clock.tick(100);
  store.toggleCard(store.game!.players[HUMAN].hand[0]);
  expect(store.view.selection.length).toBe(1);
  store.setPaused(true);
  expect(store.waiting).toBe(false);
  clock.tick(60_000);
  expect(store.game!.history.length).toBe(history);
  store.setPaused(false);
  expect(store.waiting).toBe(true);
  clock.tick(60_000);
  expect(store.game!.history.length).toBeGreaterThan(history);
});

test("a quit during a think fires nothing more; an illegal play becomes a crash, not a throw", () => {
  const { clock, store } = make();
  store.act({ type: "NEW_MATCH", seed: seedWhere(false), rules: DEFAULT_RULES });
  store.act({ type: "QUIT" });
  expect(store.waiting).toBe(false);
  clock.tick(60_000);
  expect(store.game).toBeNull();

  store.act({ type: "NEW_MATCH", seed: seedWhere(true), rules: DEFAULT_RULES });
  store.act({ type: "PLAY", player: HUMAN, cards: [store.game!.players[1].hand[0]] });
  expect(store.view.crash?.error.message).toMatch(/not in hand/);
  expect(store.waiting).toBe(false);
  store.act({ type: "QUIT" });
  expect(store.view.crash).toBeNull();
});

test("the view keeps its identity until something changes; sounds come from act()", () => {
  const audio = recordingAudio();
  const clock = manualClock();
  const store = new GameStore({ audio, clock, random: () => 0.5 });
  const v0 = store.view;
  expect(store.view).toBe(v0);
  store.act({ type: "NEW_MATCH", seed: 3, rules: DEFAULT_RULES });
  expect(store.view).not.toBe(v0);
  expect(audio.calls).toContain("dealRoll");
  let n = 0;
  store.subscribe(() => n++);
  store.toggleCard(store.game!.players[HUMAN].hand[0]);
  expect(n).toBe(1);
  expect(audio.calls.at(-1)).toBe("play:select");
});

/* ---------------- the think port (an AI move computed off the main thread) ---------------- */

import type { ThinkPort, ThinkRequest, ThinkResult } from "./think";
import { thinkNow } from "./think";

/** A ThinkPort the test answers by hand (as a worker would, later). */
const manualThink = () => {
  const asked: { req: ThinkRequest; resolve: (r: ThinkResult) => void; reject: (e: Error) => void }[] = [];
  const port: ThinkPort = { think: (req) => new Promise((resolve, reject) => void asked.push({ req, resolve, reject })) };
  return { port, asked };
};
const flush = () => new Promise((r) => setTimeout(r, 0));

test("with a ThinkPort, a round plays the same moves as on the spot, move for move", async () => {
  const seed = seedWhere(false);
  const inline = make();
  inline.store.act({ type: "NEW_MATCH", seed, rules: DEFAULT_RULES });
  const clock = manualClock();
  const think: ThinkPort = { think: (req) => Promise.resolve(thinkNow(structuredClone(req))) };
  const worker = new GameStore({ audio: silentAudio, clock, random: () => 0.5, think });
  worker.act({ type: "NEW_MATCH", seed, rules: DEFAULT_RULES });
  /** Run a store's AIs until the human is to act or the round is scored (one tick can hold several AI moves). */
  const settle = async (s: GameStore, c: ReturnType<typeof manualClock>) => {
    for (let i = 0; i < 200; i++) {
      const g = s.game!;
      if (g.phase === "scored" || (g.phase === "playing" && g.turn === HUMAN)) return;
      c.tick(30_000);
      await flush();
    }
  };
  for (let i = 0; i < 100; i++) {
    await settle(inline.store, inline.clock);
    await settle(worker, clock);
    expect(worker.game!.history).toEqual(inline.store.game!.history);
    const v = inline.store.view;
    if (v.game!.phase === "scored") break;
    const a = v.canPass ? ({ type: "PASS", player: HUMAN } as const) : ({ type: "PLAY", player: HUMAN, cards: v.legal[0].cards } as const);
    inline.store.act(a);
    worker.act(a);
  }
  expect(worker.game!.phase).toBe("scored");
  expect(worker.view.crash).toBeNull();
});

test("the move plays when BOTH the delay and the answer are in, whichever is later", async () => {
  const { port, asked } = manualThink();
  const clock = manualClock();
  const store = new GameStore({ audio: silentAudio, clock, random: () => 0.5, think: port });
  store.act({ type: "NEW_MATCH", seed: seedWhere(false), rules: DEFAULT_RULES });
  expect(asked.length).toBe(1); // asked at once, while the delay runs
  const before = store.game!.history.length;
  // the answer lands early: nothing plays until the delay is over
  asked[0].resolve(thinkNow(asked[0].req));
  await flush();
  expect(store.game!.history.length).toBe(before);
  clock.tick(60_000);
  expect(store.game!.history.length).toBe(before + 1);
  // the next AI: the delay runs out first, the answer lands later and plays at once
  if (store.game!.turn !== HUMAN && store.game!.phase === "playing") {
    expect(asked.length).toBe(2);
    clock.tick(60_000);
    expect(store.game!.history.length).toBe(before + 1);
    asked[1].resolve(thinkNow(asked[1].req));
    await flush();
    expect(store.game!.history.length).toBe(before + 2);
  }
});

test("a stale answer (paused while thinking) plays nothing and consumes no randomness", async () => {
  const { port, asked } = manualThink();
  const clock = manualClock();
  const store = new GameStore({ audio: silentAudio, clock, random: () => 0.5, think: port });
  store.act({ type: "NEW_MATCH", seed: seedWhere(false), rules: DEFAULT_RULES });
  const first = asked[0];
  store.setPaused(true);
  first.resolve({ action: { type: "PASS", player: first.req.seat }, rngState: 12345 });
  clock.tick(60_000);
  await flush();
  expect(store.game!.history.length).toBe(0);
  store.setPaused(false);
  expect(asked.length).toBe(2);
  expect(asked[1].req.rngState).toBe(first.req.rngState); // the stale answer's state was not taken
});

test("a think that rejects becomes a crash report, not a frozen table", async () => {
  const { port, asked } = manualThink();
  const clock = manualClock();
  const store = new GameStore({ audio: silentAudio, clock, random: () => 0.5, think: port });
  store.act({ type: "NEW_MATCH", seed: seedWhere(false), rules: DEFAULT_RULES });
  asked[0].reject(new Error("boom"));
  clock.tick(60_000);
  await flush();
  expect(store.view.crash?.error.message).toBe("boom");
  expect(store.waiting).toBe(false);
});

test("a seat's own cards are panned to where it sits; other sounds are centred", () => {
  const plays: { e: string; pan?: number }[] = [];
  const audio = { ...silentAudio, play: (e: string, o?: { pan?: number }) => void plays.push({ e, pan: o?.pan }) };
  const clock = manualClock();
  const store = new GameStore({ audio, clock, random: () => 0.5 });
  store.act({ type: "NEW_MATCH", seed: seedWhere(true), rules: DEFAULT_RULES });
  store.toggleCard(THREE_OF_DIAMONDS);
  expect(plays.at(-1)).toEqual({ e: "select", pan: undefined });
  store.act({ type: "PLAY", player: HUMAN, cards: [THREE_OF_DIAMONDS] });
  expect(plays.find((p) => p.e === "playSmall")?.pan).toBe(0); // the player sits in the middle
  plays.length = 0;
  const seat = store.game!.turn;
  clock.tick(60_000);
  const own = plays.find((p) => p.e === "playSmall" || p.e === "pass");
  expect(own?.pan).toBe(SEAT_PAN[seat]);
});

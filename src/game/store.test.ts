/**
 * The store with a fake clock: the turn loop that used to be a React effect, now driven by hand.
 */
import { expect, test } from "vitest";
import { THREE_OF_DIAMONDS } from "../engine/cards";
import { DEFAULT_RULES } from "../engine/rules";
import { recordingAudio, silentAudio } from "../audio/port";
import { manualClock } from "./clock";
import { HUMAN } from "./selectors";
import { GameStore } from "./store";

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

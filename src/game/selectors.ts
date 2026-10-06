/**
 * Every `if` about the rules of the game that a component would otherwise contain. Pure
 * functions over GameState (+ the selection, + a setting); the provider memoises them.
 */
import { type Card, type Rng, THREE_OF_DIAMONDS, rank, suit } from "../engine/cards";
import { type Combo, classify, describe } from "../engine/combos";
import { type Action, DEFAULT_SEATS, deal, reduce } from "../engine/reducer";
import type { RuleConfig } from "../engine/rules";
import { roundScore } from "../engine/scoring";
import { type GameState, type PlayRecord, type Player, needThreeD, publicView } from "../engine/state";
import { chooseMove } from "../ai/choose";
import { getPersonality } from "../ai/getPersonality";
import { legalMoves } from "../ai/moves";
import { PERSONALITIES } from "../ai/personalities";
import type { PortraitKey } from "../assets/names";
import { TENSION_THRESHOLD, type MusicTrack } from "../audio/sfxTable";
import { COPY } from "./copy";
import type { BarkKind } from "./cues";

export type Sheet = "none" | "settings" | "howto";
export type StatusTone = "neutral" | "bad" | "good";
export interface Status {
  text: string;
  tone: StatusTone;
}
export interface Sign {
  who: string;
  text: string;
}

export const HUMAN = 0;

/** It is the human's turn in a live round. */
export const humanTurn = (g: GameState | null): boolean => !!g && g.phase === "playing" && g.turn === HUMAN;

/** Taps on hand cards do something only on the human's turn in a live round (P:818-819). */
export const canToggle = (g: GameState | null): boolean => humanTurn(g);

/** The human's legal moves, or [] when it is not their turn. Memoise on [game] only. */
export const legalFor = (g: GameState | null): Combo[] =>
  g && humanTurn(g) ? legalMoves(g.players[HUMAN].hand, g.lastPlay, g.rules, needThreeD(g)) : [];

/** The legal move whose cards are exactly the selection; Play is enabled iff non-null. */
export function exactMove(legal: readonly Combo[], selection: readonly Card[]): Combo | null {
  if (!selection.length) return null;
  const sel = new Set(selection);
  return legal.find((m) => m.cards.length === sel.size && m.cards.every((c) => sel.has(c))) ?? null;
}

/** Cards that can still extend the selection into a legal move; null when nothing is selected. */
export function liveCards(legal: readonly Combo[], selection: readonly Card[]): Set<Card> | null {
  if (!selection.length) return null;
  const live = new Set<Card>();
  for (const m of legal) if (selection.every((c) => m.cards.includes(c))) for (const c of m.cards) live.add(c);
  return live;
}

/** Passing on your own lead throws in the engine, so it is never offered (P:831). */
export const canPass = (g: GameState | null, legal: readonly Combo[]): boolean => !!g && humanTurn(g) && (g.lastPlay !== null || legal.length === 0);

/** The status line under the hand (P:836-842). */
export function statusFor(g: GameState | null, legal: readonly Combo[], selection: readonly Card[]): Status {
  if (!g) return { text: "", tone: "neutral" };
  if (!humanTurn(g)) return { text: g.phase === "playing" ? COPY.status.thinking(g.players[g.turn].name) : "", tone: "neutral" };
  if (!legal.length) return { text: COPY.status.mustPass, tone: "bad" };
  const sel = selection.slice().sort((a, b) => a - b);
  if (!sel.length) return { text: g.lastPlay ? COPY.status.beatIt : needThreeD(g) ? COPY.status.yourLead3D : COPY.status.yourLead, tone: "neutral" };
  const combo = classify(sel, g.rules);
  if (!combo) return { text: COPY.status.notAHand(sel.length), tone: "bad" };
  if (exactMove(legal, sel)) return { text: describe(combo), tone: "good" };
  if (needThreeD(g) && !sel.includes(THREE_OF_DIAMONDS)) return { text: COPY.status.needs3D(describe(combo)), tone: "bad" };
  return { text: COPY.status.doesntBeat(describe(combo)), tone: "bad" };
}

/** The wooden sign on the felt (P:872-886). */
export function signFor(g: GameState | null): Sign {
  if (!g) return { who: COPY.sign.table, text: "" };
  if (!g.lastPlay || g.lastBy === null) return { who: COPY.sign.table, text: g.history.length ? COPY.sign.freshLead : COPY.sign.waitingOpening };
  return { who: COPY.sign.played(g.players[g.lastBy].name), text: describe(g.lastPlay) };
}

/** What the empty felt says. */
export const emptyFeltText = (g: GameState): string => (g.history.length ? COPY.sign.clearLeads(g.players[g.leader].name) : COPY.sign.cardsDown);

export function sortHand(hand: readonly Card[], by: "rank" | "suit"): Card[] {
  const h = hand.slice();
  return by === "suit" ? h.sort((a, b) => suit(a) - suit(b) || rank(a) - rank(b)) : h.sort((a, b) => a - b);
}

/** The Hint button: what the Marshal would play at Regular, else the cheapest legal move (P:1236-1243). */
export function hintFor(g: GameState | null, legal: readonly Combo[], rand: Rng): Combo | null {
  if (!g || !humanTurn(g) || !legal.length) return null;
  return chooseMove(publicView(g, HUMAN), g.players[HUMAN].hand, PERSONALITIES.marshal, g.rules, rand, "medium") ?? legal[0];
}

/** The portrait sprite for an AI seat; null for the human (who has no personality). ui/ reads this, never ai/. */
export const portraitFor = (p: Player): PortraitKey | null => (p.kind === "ai" ? getPersonality(p.personality).portrait : null);

/** An AI seat's bark lines for a kind; [] for the human. */
export const barkLinesFor = (g: GameState, seat: number, kind: BarkKind): readonly string[] => {
  const p = g.players[seat];
  return p && p.kind === "ai" ? getPersonality(p.personality).barks[kind] : [];
};

/** One seat's most recent play in the current trick, by history index. */
export interface TrickPlay {
  seat: number;
  cards: Card[];
  /** Index into history: changes exactly when this seat plays again. */
  at: number;
}

/**
 * What is on the felt: every seat's latest play since the trick began (a seat that plays
 * again replaces its earlier one), empty once the trick has cleared. Seat order.
 */
export function trickPlays(g: GameState): TrickPlay[] {
  const bySeat = new Map<number, TrickPlay>();
  for (let i = g.trickStart; i < g.history.length; i++) {
    const r = g.history[i];
    if (r.cards.length) bySeat.set(r.by, { seat: r.by, cards: r.cards, at: i });
  }
  return [...bySeat.values()].sort((a, b) => a.seat - b.seat);
}

/** This round's deltas, available from roundover on (the poster's "Round" column). */
export const roundDeltas = (g: GameState | null): number[] | null => (g && g.phase !== "playing" ? roundScore(g.players.map((p) => p.hand.length)) : null);

/** The seat that emptied its hand: the turn stays there after roundover. */
export const roundWinner = (g: GameState | null): number | null => (g && g.phase !== "playing" ? g.turn : null);

/** The engine has no match concept; a match ends after roundsPerMatch rounds (0 = Endless, never). */
export const matchOver = (g: GameState | null, roundsPerMatch: number): boolean => !!g && g.phase === "scored" && roundsPerMatch > 0 && g.round >= roundsPerMatch;

/** Highest tally; a tie goes to the seat that won the last round, else the lowest seat. */
export function matchWinner(g: GameState): number {
  const best = Math.max(...g.totals);
  const tied = g.totals.flatMap((t, i) => (t === best ? [i] : []));
  return tied.length === 1 ? tied[0] : tied.includes(g.turn) ? g.turn : tied[0];
}

/** Which loop the table wants. The tension layer is tensionFor(), not a track. */
export const musicFor = (g: GameState | null, sheet: Sheet): MusicTrack | null =>
  sheet === "howto" ? "results" : g === null ? null : g.phase === "scored" ? "results" : "table";

export const tensionFor = (g: GameState | null): boolean =>
  !!g && g.phase === "playing" && Math.min(...g.players.map((p) => p.hand.length)) <= TENSION_THRESHOLD;

/* ---- the copied game log: seed + history rebuilds any position, round 2+ included ---- */

export interface GameLog {
  seed: number;
  rules: RuleConfig;
  round: number;
  leader: number;
  totals: number[];
  history: PlayRecord[];
  final: GameState;
}

export const historyToActions = (h: readonly PlayRecord[]): Action[] =>
  h.map((r) => (r.cards.length ? { type: "PLAY", player: r.by, cards: r.cards } : { type: "PASS", player: r.by }));

/** `leader` = who led the round: the first record's author, or the deal's leader before any play. */
export function gameLog(g: GameState): GameLog {
  // `totals` are the deal-time totals: in "scored" the state already holds this round's deltas,
  // which replayLog() would otherwise add a second time.
  const deltas = g.phase === "scored" ? roundScore(g.players.map((p) => p.hand.length)) : null;
  const totals = deltas ? g.totals.map((t, i) => t - deltas[i]) : g.totals;
  return { seed: g.seed, rules: g.rules, round: g.round, leader: g.history[0]?.by ?? g.leader, totals, history: g.history, final: g };
}

/** Rebuild the logged position: deal the same round, replay the history. */
export function replayLog(log: GameLog): GameState {
  const seats = log.final.players.map((p) => ({ name: p.name, kind: p.kind, ...(p.personality !== undefined ? { personality: p.personality } : {}) }));
  let g = deal(log.seed, log.rules, seats.length ? seats : DEFAULT_SEATS, log.round, log.leader, log.totals);
  for (const a of historyToActions(log.history)) g = reduce(g, a);
  if (log.final.phase === "scored" && g.phase === "roundover") g = reduce(g, { type: "SCORE_ROUND" });
  return g;
}

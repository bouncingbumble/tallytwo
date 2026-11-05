/**
 * ONE table of what the game sounds like: event -> files, gain, whether it ducks the music,
 * plus the music cues and the handful of audio constants. PURE: it names assets through
 * assets/names.ts and never touches a URL or the Web Audio API (that is WebAudio.ts).
 *
 * Gains are the prototype's (P:343); the files are the kept pack (docs/ASSETS.md).
 */
import type { AssetName, SfxAssetName } from "../assets/names";

export type SfxEvent =
  | "shuffle"
  | "deal"
  | "select"
  | "deselect"
  | "reorder"
  | "playSmall"
  | "playFive"
  | "pass"
  | "trickClear"
  | "yourTurn"
  | "lastCard"
  | "roundWin"
  | "tally"
  | "finalRound";

export interface SfxSpec {
  /** Round-robin pool; a pool of one plays the same file every time. */
  files: readonly SfxAssetName[];
  gain: number;
  /** Steps the music back for a moment (DUCK). */
  ducks: boolean;
}

/* Gains are the prototype's x SFX_BOOST (2026-10-07: "card sound effects 20% louder"), capped at 1. */
export const SFX_BOOST = 1.2;
const boost = (g: number): number => Math.min(1, Math.round(g * SFX_BOOST * 100) / 100);

export const SFX: Record<SfxEvent, SfxSpec> = {
  shuffle: { files: ["sfx_DeckShuffle01", "sfx_DeckShuffle04", "sfx_DeckShuffle05"], gain: boost(0.65), ducks: false },
  deal: {
    files: ["sfx_CardMoveFast01", "sfx_CardMoveFast03", "sfx_CardMoveFast05", "sfx_CardMoveFast06", "sfx_CardMoveFast07", "sfx_CardMoveFast08", "sfx_CardMoveFast09"],
    gain: boost(0.42),
    ducks: false,
  },
  select: { files: ["sfx_CardGrab03", "sfx_CardGrab04"], gain: boost(0.3), ducks: false },
  /** A card put back down in the hand. */
  deselect: { files: ["sfx_CardGenericMove01", "sfx_CardGenericMove05", "sfx_CardGenericMove07"], gain: boost(0.3), ducks: false },
  /** A dragged card dropped into a new place in the fan. */
  reorder: { files: ["sfx_CardGenericMovesLong01", "sfx_CardGenericMovesLong03", "sfx_CardGenericMovesLong11"], gain: boost(0.35), ducks: false },
  playSmall: {
    files: ["sfx_CardSlapFast01", "sfx_CardSlapFast03", "sfx_CardSlapFast04", "sfx_CardSlapFast05", "sfx_CardSlapFast07", "sfx_CardSlapFast09"],
    gain: boost(0.8),
    ducks: true,
  },
  playFive: { files: ["sfx_CardSlide01", "sfx_CardSlide03", "sfx_CardSlide05"], gain: boost(0.55), ducks: false },
  pass: {
    files: [
      "sfx_CardGrabSlide01",
      "sfx_CardGrabSlide02",
      "sfx_CardGrabSlide03",
      "sfx_CardGrabSlide04",
      "sfx_CardGrabSlide05",
      "sfx_CardGrabSlide06",
      "sfx_CardGrabSlide07",
      "sfx_CardGrabSlide11",
      "sfx_CardGrabSlide13",
    ],
    gain: boost(0.45),
    ducks: false,
  },
  trickClear: { files: ["sfx_CardsFalling01", "sfx_CardsFalling03", "sfx_CardsFalling04", "sfx_CardsFalling05"], gain: boost(0.6), ducks: false },
  /** The turn comes round to the human: a soft slide, so a look away from the screen is not a missed turn. */
  yourTurn: {
    files: ["sfx_CardGrabSlideLong01", "sfx_CardGrabSlideLong03", "sfx_CardGrabSlideLong04", "sfx_CardGrabSlideLong05"],
    gain: boost(0.3),
    ducks: false,
  },
  /** A play leaves a hand on its last card. */
  lastCard: { files: ["sfx_CardsImpact02", "sfx_CardsImpact04"], gain: boost(0.55), ducks: false },
  roundWin: { files: ["sfx_CardsImpact01"], gain: boost(0.85), ducks: true },
  /** The round is scored: the poster's money changes hands. */
  tally: { files: ["sfx_BuyCards01", "sfx_BuyCards02", "sfx_BuyCards03", "sfx_BuyCards04", "sfx_BuyCards05"], gain: boost(0.5), ducks: false },
  /** The last round of the match is dealt: the deck slapped down under the "Final round" banner. */
  finalRound: { files: ["sfx_DeckMoves01", "sfx_DeckMoves02", "sfx_DeckMoves03"], gain: boost(0.7), ducks: false },
};

export const SFX_EVENTS = Object.keys(SFX) as SfxEvent[];

/**
 * A music cue the game can ask for. "tension" is what plays in place of "table" while
 * setTension(true). Over the poster: "roundWon" when the human emptied their hand, "matchWon"
 * when the human took the match, "results" otherwise (an AI's round, a lost match, How to play).
 */
export type MusicTrack = "table" | "results" | "roundWon" | "matchWon";
export type MusicLayer = MusicTrack | "tension";

export interface LoopSpec {
  file: AssetName;
  gain: number;
  /** Seconds; sample-accurate loop points from the asset manifest. */
  loopEnd: number;
}

export const MUSIC: Record<MusicLayer, LoopSpec> = {
  table: { file: "music_ost_1", gain: 0.3, loopEnd: 119.081 },
  tension: { file: "music_ost_3", gain: 0.3, loopEnd: 107.714 },
  results: { file: "music_ost_4", gain: 0.3, loopEnd: 103.109 },
  roundWon: { file: "music_ost_2", gain: 0.3, loopEnd: 110.208 },
  matchWon: { file: "music_ost_5", gain: 0.3, loopEnd: 110.941 },
};

/** Music steps back under a slap: to 0.12 within 20 ms, back to 0.30 after 300 ms unless re-ducked within 280 ms (P:368-373). */
export const DUCK = { to: 0.12, from: 0.3, attackS: 0.02, holdMs: 300, rearmMs: 280 } as const;
/** True pitch jitter per SFX play, ±4 %. */
export const JITTER = 0.04;
/** A deal: one shuffle at 0, then `ticks` deal sounds at first + k * every ms (P:386-390). */
export const DEAL_ROLL = { first: 260, every: 110, ticks: 4 } as const;
/** The tension track takes over from the table track when any seat is down to this many cards. */
export const TENSION_THRESHOLD = 3;
/**
 * A track switch is two fades in sequence, never a crossfade: the playing loop fades out over
 * `outMs`, and only once it is silent does the next loop start and fade in over `inMs`.
 */
export const FADE = { outMs: 1500, inMs: 2000 } as const;

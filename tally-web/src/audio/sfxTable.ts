/**
 * ONE table of what the game sounds like: event -> files, gain, whether it ducks the music,
 * plus the music cues and the handful of audio constants. PURE: it names assets through
 * assets/names.ts and never touches a URL or the Web Audio API (that is WebAudio.ts).
 *
 * Gains are the prototype's (P:343); the files are the kept pack (docs/ASSETS.md).
 */
import type { AssetName, SfxAssetName } from "../assets/names";

export type SfxEvent = "shuffle" | "deal" | "select" | "playSmall" | "playFive" | "pass" | "trickClear" | "roundWin";

export interface SfxSpec {
  /** Round-robin pool; a pool of one plays the same file every time. */
  files: readonly SfxAssetName[];
  gain: number;
  /** Steps the music back for a moment (DUCK). */
  ducks: boolean;
}

export const SFX: Record<SfxEvent, SfxSpec> = {
  shuffle: { files: ["sfx_DeckShuffle01", "sfx_DeckShuffle04", "sfx_DeckShuffle05"], gain: 0.65, ducks: false },
  deal: {
    files: ["sfx_CardMoveFast01", "sfx_CardMoveFast03", "sfx_CardMoveFast05", "sfx_CardMoveFast06", "sfx_CardMoveFast07", "sfx_CardMoveFast08", "sfx_CardMoveFast09"],
    gain: 0.42,
    ducks: false,
  },
  select: { files: ["sfx_CardGrab03", "sfx_CardGrab04"], gain: 0.3, ducks: false },
  playSmall: {
    files: ["sfx_CardSlapFast01", "sfx_CardSlapFast03", "sfx_CardSlapFast04", "sfx_CardSlapFast05", "sfx_CardSlapFast07", "sfx_CardSlapFast09"],
    gain: 0.8,
    ducks: true,
  },
  playFive: { files: ["sfx_CardSlide01", "sfx_CardSlide03", "sfx_CardSlide05"], gain: 0.55, ducks: false },
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
    gain: 0.45,
    ducks: false,
  },
  trickClear: { files: ["sfx_CardsFalling01", "sfx_CardsFalling05"], gain: 0.6, ducks: false },
  roundWin: { files: ["sfx_CardsImpact01"], gain: 0.85, ducks: true },
};

export const SFX_EVENTS = Object.keys(SFX) as SfxEvent[];

/** A music cue the game can ask for. "tension" is a layer over "table", not a switch. */
export type MusicTrack = "table" | "results";
export type MusicLayer = MusicTrack | "tension" | "ambience";

export interface LoopSpec {
  file: AssetName;
  gain: number;
  /** Seconds; sample-accurate loop points from the asset manifest. */
  loopEnd: number;
}

export const dbToGain = (db: number): number => Math.pow(10, db / 20);
export const AMBIENCE_DB = -14;

export const MUSIC: Record<MusicLayer, LoopSpec> = {
  table: { file: "music_ost_1", gain: 0.3, loopEnd: 119.081 },
  tension: { file: "music_ost_3", gain: 0.3, loopEnd: 107.714 },
  results: { file: "music_ost_4", gain: 0.3, loopEnd: 103.109 },
  ambience: { file: "sfx_CardsMovingLoop03", gain: dbToGain(AMBIENCE_DB), loopEnd: 10.069 },
};

/** Music steps back under a slap: to 0.12 within 20 ms, back to 0.30 after 300 ms unless re-ducked within 280 ms (P:368-373). */
export const DUCK = { to: 0.12, from: 0.3, attackS: 0.02, holdMs: 300, rearmMs: 280 } as const;
/** True pitch jitter per SFX play, ±4 %. */
export const JITTER = 0.04;
/** A deal: one shuffle at 0, then `ticks` deal sounds at first + k * every ms (P:386-390). */
export const DEAL_ROLL = { first: 260, every: 110, ticks: 4 } as const;
/** The tension layer fades in when any seat is down to this many cards. */
export const TENSION_THRESHOLD = 3;
/** Crossfade for the tension layer and track switches. */
export const CROSSFADE_MS = 2000;

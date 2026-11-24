/**
 * The settings shape, written down once. Rules live inside GameState and GameProvider pushes
 * every change into the game in progress (appReducer SET_RULES); opts are read live. parseSettings() must accept the prototype's
 * exact localStorage blob (same KEY) and fill in the fields it never had.
 */
import { DEFAULT_RULES, type RuleConfig } from "../engine/rules";
import type { Difficulty } from "../ai/choose";
import { GAME_SPEEDS, type GameSpeed } from "../game/timing";


export interface Volume {
  music: number;
  sfx: number;
}

/**
 * Motion: "auto" follows the device's reduce-motion setting (live), "full" and "reduced"
 * override it. Reduced cuts every presentation tween to nothing (phaser/motion.ts).
 */
export type MotionPref = "auto" | "full" | "reduced";
export const MOTION_PREFS: readonly MotionPref[] = ["auto", "full", "reduced"];
/** Whether presentation motion is off, given the setting and the device's reduce-motion flag. */
export const motionReduced = (pref: MotionPref, deviceReduced: boolean): boolean => pref === "reduced" || (pref === "auto" && deviceReduced);

export interface Opts {
  difficulty: Difficulty;
  /** Game speed: one setting for the AI's think time and every wait at the table (timing.ts SPEED). */
  gameSpeed: GameSpeed;
  /** Hints: the Hint button and the "nothing here beats that" status line. Off hides both. */
  hints: boolean;
  /** "Card sounds": the sfx bus on/off. */
  sfx: boolean;
  /** 0-1 multipliers over the sfxTable gains. */
  volume: Volume;
  motion: MotionPref;
  /** Swipe across the hand to select several cards; off, a sideways drag rearranges at once (the old way). */
  swipe: boolean;
  /** Drag the selected cards up onto the felt to play them. */
  flick: boolean;
  /** The one-time "swipe to pick several" coach mark has been shown. */
  swipeHintSeen: boolean;
}

export interface Settings {
  rules: RuleConfig;
  opts: Opts;
}

export const DEFAULTS: Settings = {
  rules: DEFAULT_RULES,
  opts: {
    difficulty: "medium",
    gameSpeed: "normal",
    hints: false,
    sfx: true,
    volume: { music: 1, sfx: 1 },
    motion: "auto",
    swipe: true,
    flick: true,
    swipeHintSeen: false,
  },
};

export const KEY = "tallytwo.settings";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);
const oneOf = <T extends string | number>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);
const unit = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);

/**
 * A blob saved before Game speed and Opponent pace were merged: the old 1x-4x multiplier and
 * fast / normal / slow pace become the nearest tier. Fast pace or 3x+ was a brisk table -> fast;
 * 2x -> normal; 1x (the old default) -> slow.
 */
function legacySpeed(o: Record<string, unknown>): GameSpeed | null {
  const mult = o.speedMultiplier;
  const pace = o.speed;
  if (mult === undefined && pace === undefined) return null;
  if (pace === "fast" || mult === 3 || mult === 4) return "fast";
  if (mult === 2) return "normal";
  return "slow";
}

/** Field-by-field merge over DEFAULTS: unknown keys dropped, wrong types replaced. Never throws. */
export function parseSettings(raw: string | null | undefined): Settings {
  let data: unknown = null;
  if (typeof raw === "string" && raw.length) {
    try {
      data = JSON.parse(raw);
    } catch {
      data = null;
    }
  }
  const root = isObj(data) ? data : {};
  const r = isObj(root.rules) ? root.rules : {};
  const o = isObj(root.opts) ? root.opts : {};
  const vol = isObj(o.volume) ? o.volume : {};
  const D = DEFAULTS;
  return {
    rules: {
      straightWrap: bool(r.straightWrap, D.rules.straightWrap),
    },
    opts: {
      difficulty: oneOf<Difficulty>(o.difficulty, ["easy", "medium", "hard"], D.opts.difficulty),
      gameSpeed: oneOf<GameSpeed>(o.gameSpeed, GAME_SPEEDS, legacySpeed(o) ?? D.opts.gameSpeed),
      hints: bool(o.hints, D.opts.hints),
      sfx: bool(o.sfx, D.opts.sfx),
      volume: {
        // the retired "Saloon piano" switch: a blob saved with it off keeps the music silent
        music: o.music === false ? 0 : unit(vol.music, D.opts.volume.music),
        sfx: unit(vol.sfx, D.opts.volume.sfx),
      },
      // the prototype's reduceMotion switch, when it was on, is kept as an explicit "reduced"
      motion: oneOf<MotionPref>(o.motion, MOTION_PREFS, o.reduceMotion === true ? "reduced" : D.opts.motion),
      swipe: bool(o.swipe, D.opts.swipe),
      flick: bool(o.flick, D.opts.flick),
      swipeHintSeen: bool(o.swipeHintSeen, D.opts.swipeHintSeen),
    },
  };
}

export const serializeSettings = (s: Settings): string => JSON.stringify(s);

/**
 * A first-time player: Greenhorn opponents and Hints on, so the table teaches before it bites.
 * Saved as their settings on the first hydrate, so from then on they are an ordinary choice the
 * player can change in Settings; a returning player is never put back on them.
 */
export const FIRST_TIME: Settings = { ...DEFAULTS, opts: { ...DEFAULTS.opts, difficulty: "easy", hints: true } };

/**
 * The settings for what storage returned. Nothing stored at all (`null`: this browser, or this
 * shell install, has never saved settings) is a first-time player; anything stored, even a blob
 * that no longer parses, is a returning one and gets parseSettings' merge over DEFAULTS.
 */
export const settingsFor = (raw: string | null | undefined): Settings => (raw === null || raw === undefined ? FIRST_TIME : parseSettings(raw));

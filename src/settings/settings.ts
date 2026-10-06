/**
 * The settings shape, written down once. Rules are read at NEW_MATCH only (they live inside
 * GameState after that); opts are read live. parseSettings() must accept the prototype's
 * exact localStorage blob (same KEY) and fill in the fields it never had.
 */
import { DEFAULT_RULES, type LaterRoundLead, type RuleConfig } from "../engine/rules";
import type { Difficulty } from "../ai/choose";
import { SPEED_MULTIPLIERS, type Speed, type SpeedMultiplier } from "../game/timing";

export type SortBy = "rank" | "suit";
export type RoundsPerMatch = 0 | 5 | 10;

export interface Volume {
  music: number;
  sfx: number;
  ambience: number;
}

export interface Opts {
  difficulty: Difficulty;
  /** The AI's think-time range (fast / normal / slow). */
  speed: Speed;
  /** Game speed: how many times faster than the base table (timing.ts BASE_TIME_SCALE) the waits run. */
  speedMultiplier: SpeedMultiplier;
  /** "Saloon piano": the music bus on/off. */
  music: boolean;
  /** "Card sounds": the sfx bus on/off. */
  sfx: boolean;
  reduceMotion: boolean;
  sortBy: SortBy;
  /** 0 = Endless (the prototype's behaviour). */
  roundsPerMatch: RoundsPerMatch;
  /** 0-1 multipliers over the sfxTable gains. */
  volume: Volume;
}

export interface Settings {
  rules: RuleConfig;
  opts: Opts;
}

export const DEFAULTS: Settings = {
  rules: DEFAULT_RULES,
  opts: {
    difficulty: "medium",
    speed: "normal",
    speedMultiplier: 1,
    music: true,
    sfx: true,
    reduceMotion: false,
    sortBy: "rank",
    roundsPerMatch: 0,
    volume: { music: 1, sfx: 1, ambience: 1 },
  },
};

export const KEY = "tallytwo.settings";

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const bool = (v: unknown, d: boolean): boolean => (typeof v === "boolean" ? v : d);
const oneOf = <T extends string | number>(v: unknown, allowed: readonly T[], d: T): T => (allowed.includes(v as T) ? (v as T) : d);
const unit = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : d);

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
      passLocksOut: bool(r.passLocksOut, D.rules.passLocksOut),
      straightWrap: bool(r.straightWrap, D.rules.straightWrap),
      flushSuitFirst: bool(r.flushSuitFirst, D.rules.flushSuitFirst),
      mustLeadWith3D: bool(r.mustLeadWith3D, D.rules.mustLeadWith3D),
      laterRoundLead: oneOf<LaterRoundLead>(r.laterRoundLead, ["winner", "loser", "threeD"], D.rules.laterRoundLead),
    },
    opts: {
      difficulty: oneOf<Difficulty>(o.difficulty, ["easy", "medium", "hard"], D.opts.difficulty),
      speed: oneOf<Speed>(o.speed, ["fast", "normal", "slow"], D.opts.speed),
      speedMultiplier: oneOf<SpeedMultiplier>(o.speedMultiplier, SPEED_MULTIPLIERS, D.opts.speedMultiplier),
      music: bool(o.music, D.opts.music),
      sfx: bool(o.sfx, D.opts.sfx),
      reduceMotion: bool(o.reduceMotion, D.opts.reduceMotion),
      sortBy: oneOf<SortBy>(o.sortBy, ["rank", "suit"], D.opts.sortBy),
      roundsPerMatch: oneOf<RoundsPerMatch>(o.roundsPerMatch, [0, 5, 10], D.opts.roundsPerMatch),
      volume: {
        music: unit(vol.music, D.opts.volume.music),
        sfx: unit(vol.sfx, D.opts.volume.sfx),
        ambience: unit(vol.ambience, D.opts.volume.ambience),
      },
    },
  };
}

export const serializeSettings = (s: Settings): string => JSON.stringify(s);

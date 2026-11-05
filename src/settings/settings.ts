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
  ambience: number;
}

export interface Opts {
  difficulty: Difficulty;
  /** Game speed: one setting for the AI's think time and every wait at the table (timing.ts SPEED). */
  gameSpeed: GameSpeed;
  /** "Saloon piano": the music bus on/off. */
  music: boolean;
  /** "Card sounds": the sfx bus on/off. */
  sfx: boolean;
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
    gameSpeed: "normal",
    music: true,
    sfx: true,
    volume: { music: 1, sfx: 1, ambience: 1 },
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
      flushSuitFirst: bool(r.flushSuitFirst, D.rules.flushSuitFirst),
    },
    opts: {
      difficulty: oneOf<Difficulty>(o.difficulty, ["easy", "medium", "hard"], D.opts.difficulty),
      gameSpeed: oneOf<GameSpeed>(o.gameSpeed, GAME_SPEEDS, legacySpeed(o) ?? D.opts.gameSpeed),
      music: bool(o.music, D.opts.music),
      sfx: bool(o.sfx, D.opts.sfx),
      volume: {
        music: unit(vol.music, D.opts.volume.music),
        sfx: unit(vol.sfx, D.opts.volume.sfx),
        ambience: unit(vol.ambience, D.opts.volume.ambience),
      },
    },
  };
}

export const serializeSettings = (s: Settings): string => JSON.stringify(s);

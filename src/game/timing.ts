/**
 * Every millisecond in the game, in one place. All values are the prototype's (P line refs
 * in the original build plan §3.5). Nothing else in src/ may hold a timing number.
 */
/**
 * Game speed: ONE setting (it used to be two — Game speed 1x-4x and Opponent pace). Each tier
 * is the AI's think-time range in the prototype's ms plus the multiplier every table wait (AI
 * think, first step, round over) is scaled by.
 *
 *   slow    the old default: Normal pace at 1x — the unhurried table (prototype ms × 4)
 *   normal  Normal pace at 2x (× 2)
 *   fast    the old Fast pace at 4x (× 1), its speed then cut by 30% (FAST_SPEED: every
 *           wait ÷ 0.7) and then made 1.5x slower again (FAST_SLOWDOWN), so the fastest table
 *           is brisk but still easy to follow
 */
export type GameSpeed = "slow" | "normal" | "fast";
export const GAME_SPEEDS: readonly GameSpeed[] = ["slow", "normal", "fast"];

/** The prototype's AI think delay ranges, ms, uniform (P:917). */
export const THINK = {
  normal: [650, 1250],
  fast: [280, 520],
} as const;

/** Fast runs at 70% of the old fastest table's speed (Fast pace at 4x): speed down 30%, waits ÷ 0.7. */
export const FAST_SPEED = 0.7;
/** ...and then 1.5x slower again (2026: "Fast game speed is too fast, should be 1.5x slower"). */
export const FAST_SLOWDOWN = 1.5;

export interface SpeedTier {
  /** AI think range in prototype ms, before `scale`. */
  think: readonly [number, number];
  /** Every prototype wait at the table is multiplied by this. */
  scale: number;
}

export const SPEED: Record<GameSpeed, SpeedTier> = {
  slow: { think: THINK.normal, scale: 4 },
  normal: { think: THINK.normal, scale: 2 },
  fast: { think: THINK.fast, scale: FAST_SLOWDOWN / FAST_SPEED },
};

/** r is a uniform random in [0, 1) — Math.random in the game, a fixed value in tests. Prototype ms, before paced(). */
export const thinkMs = (speed: GameSpeed, r: number): number => {
  const [lo, hi] = SPEED[speed].think;
  return lo + r * (hi - lo);
};

/** A prototype wait at the table, scaled by the Game speed tier, whole ms. */
export const paced = (ms: number, speed: GameSpeed): number => Math.round(ms * SPEED[speed].scale);


/** From the last card hitting the felt to the poster. */
export const ROUND_OVER_MS = { ai: 900, human: 800 } as const;
/** Extra pause before the very first move of a round, on top of the think delay. */
export const FIRST_STEP_MS = 700;
/** The saloon doors swing before the table appears. */
export const DOORS_MS = 620;
/** Deal animation stagger per card. */
export const DEAL_STAGGER_MS = 32;
/** Pile slap stagger per card. */
export const SLAP_STAGGER_MS = 40;
/** How long a bark bubble shows, and the chance an AI speaks at all. */
export const BARK_MS = 2000;
export const BARK_CHANCE = 0.55;
/** Card select lift. */
export const SELECT_MS = 160;
/** How long the "Final round" banner stays over the felt at the start of the last round. */
export const FINAL_ROUND_MS = 3200;

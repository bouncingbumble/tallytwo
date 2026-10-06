/**
 * Every millisecond in the game, in one place. All values are the prototype's (P line refs
 * in WEB-PLAN §3.5). Nothing else in src/ may hold a timing number.
 */
export type Speed = "fast" | "normal" | "slow";

/** AI think delay range per pace, ms, uniform. */
export const SPEED: Record<Speed, readonly [number, number]> = {
  fast: [280, 520],
  normal: [650, 1250],
  slow: [1100, 1900],
};

/** r is a uniform random in [0, 1) — Math.random in the game, a fixed value in tests. */
export const thinkMs = (speed: Speed, r: number): number => {
  const [lo, hi] = SPEED[speed];
  return lo + r * (hi - lo);
};

/** With reduce motion on, no wait is longer than this. */
export const REDUCED_MOTION_MAX_MS = 260;
export const clampMotion = (ms: number, reduceMotion: boolean): number => (reduceMotion ? Math.min(ms, REDUCED_MOTION_MAX_MS) : ms);

/** Pass for the human automatically after this long when nothing beats the table. */
export const AUTO_PASS_MS = 850;
/** From the last card hitting the felt to the poster. */
export const ROUND_OVER_MS = { ai: 900, human: 800 } as const;
/** Extra pause before the very first move of a round, on top of the think delay. */
export const FIRST_STEP_MS = 700;
/** The saloon doors swing before the table appears. */
export const DOORS_MS = { normal: 620, reduced: 60 } as const;
/** The felt dips when cards land. */
export const NUDGE_MS = 170;
/** Deal animation stagger per card. */
export const DEAL_STAGGER_MS = 32;
/** Pile slap stagger per card. */
export const SLAP_STAGGER_MS = 40;
/** How long a bark bubble shows, and the chance an AI speaks at all. */
export const BARK_MS = 2000;
export const BARK_CHANCE = 0.55;
/** Card select lift. */
export const SELECT_MS = 160;

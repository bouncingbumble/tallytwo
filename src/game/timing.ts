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
 *           is brisk but still easy to follow; the AI's think time alone is × FAST_THINK_SCALE (2.5)
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

/** Fast's AI think time alone is scaled by this (2026: "opponent think time for fast should be 2.5"). */
export const FAST_THINK_SCALE = 2.5;

export interface SpeedTier {
  /** AI think range in prototype ms, before `thinkScale`. */
  think: readonly [number, number];
  /** The AI think range is multiplied by this. */
  thinkScale: number;
  /** Every other prototype wait at the table is multiplied by this. */
  scale: number;
}

export const SPEED: Record<GameSpeed, SpeedTier> = {
  slow: { think: THINK.normal, thinkScale: 4, scale: 4 },
  normal: { think: THINK.normal, thinkScale: 2, scale: 2 },
  fast: { think: THINK.fast, thinkScale: FAST_THINK_SCALE, scale: FAST_SLOWDOWN / FAST_SPEED },
};

/** r is a uniform random in [0, 1) — Math.random in the game, a fixed value in tests. Prototype ms, before paced(). */
export const thinkMs = (speed: GameSpeed, r: number): number => {
  const [lo, hi] = SPEED[speed].think;
  return lo + r * (hi - lo);
};

/** A prototype wait at the table, scaled by the Game speed tier, whole ms. */
export const paced = (ms: number, speed: GameSpeed): number => Math.round(ms * SPEED[speed].scale);

/** An AI think wait at the table: thinkMs() scaled by the tier's thinkScale, whole ms. */
export const pacedThink = (speed: GameSpeed, r: number): number => Math.round(thinkMs(speed, r) * SPEED[speed].thinkScale);


/** From the last card hitting the felt to the poster. */
export const ROUND_OVER_MS = { ai: 900, human: 800 } as const;
/** Extra pause before the very first move of a round, on top of the think delay. */
export const FIRST_STEP_MS = 700;
/** The saloon doors swing before the table appears. */
export const DOORS_MS = 620;
/** Deal animation stagger per card. */
export const DEAL_STAGGER_MS = 32;
/**
 * A play's flight (styles/motion.css `fly`, ui/Pile.tsx): each card leaves from behind its
 * player's portrait (from behind the hand for the human), flies to the middle of its slot with
 * the others as a stack, then spreads into place. Fixed, not paced by Game speed: it is how
 * long the eye needs, whatever the table's tempo. The prototype's slap was 280 ms.
 */
export const PLAY_FLY_MS = 700;
/** Each card leaves this long after the one before it. */
export const PLAY_FLY_STAGGER_MS = 30;
/** Until the last card of an n-card play has spread into place. */
export const playLandMs = (n: number): number => PLAY_FLY_MS + Math.max(0, n - 1) * PLAY_FLY_STAGGER_MS;
/** How long a bark bubble shows, and the chance an AI speaks at all. */
export const BARK_MS = 2000;
export const BARK_CHANCE = 0.55;
/** Card select lift. */
export const SELECT_MS = 160;
/** How long the "Final round" banner stays over the felt at the start of the last round. */
export const FINAL_ROUND_MS = 3200;

/* ---- Presentation motion (docs/MOBILE_UX_PLAN.md §1.5, §2.1) ----
 *
 * How long things take to *look* like they happen, as opposed to the table's pace above. Not
 * paced by Game speed. Bands: feedback 80-150 ms, UI transitions 180-350 ms, emphasis 400-700 ms;
 * the long runs (bark, banner) are how long a thing stays on screen. Under reduced motion every
 * one of these becomes 0 (phaser/motion.ts ms()); the store's timers still decide when things
 * appear and go.
 */
export const MOTION = {
  /** A control squished under a finger, and back. */
  press: 80,
  /** A one-shot pop: a count ticking, a card painted into the selection. */
  micro: 120,
  /** A "no" shake: a disabled control or a card that cannot be played, tapped. */
  shake: 260,
  /** The select lift and the hand's slide (table.css: 0.16s cubic-bezier(0.2, 0.9, 0.3, 1.2)). */
  slide: 160,
  /** A switch's knob. */
  knob: 150,
  /** An overlay or sheet coming in. */
  uiIn: 260,
  /** An overlay or sheet going away. */
  uiOut: 180,
  /** One card's fly-in at the deal (motion.css `deal`, 0.38s ease). */
  dealIn: 380,
  /** Something that should be noticed: a turn arriving, a trick won. */
  emphasis: 450,
  /** The title doors' glow brightening as they swing. */
  doorsGlow: 500,
  /** After a play, the remaining cards close the gap 4x slower than a slide. */
  settle: 640,
  /** A looping pulse's period (an idle reminder). */
  pulse: 1200,
  /** The bark bubble's run (motion.css barkin 1.9s): in over the first 10 %, out over the last 15 %. */
  bark: 1900,
  /** The final-round banner's run (motion.css announce 3.2s). */
  announce: 3200,
} as const;

/** The doors' sprite frames: ajar, then open, inside DOORS_MS. */
export const DOORS_FRAMES_MS = { ajar: 200, open: 420 } as const;
/** A button that copied something says "Copied" this long. */
export const COPIED_MS = 1500;

/**
 * The hand's gestures (render/handGesture.ts, docs/MOBILE_UX_PLAN.md §4.2). Input timings, not
 * motion: reduced motion does not change them.
 */
export const GESTURE = {
  /** A press held still this long picks the card up to rearrange. */
  holdMs: 180,
  /** Held still this much longer after the pick-up, the card grows to a peek. */
  peekMs: 400,
  /** The select sound plays at most this often while a swipe paints cards. */
  paintSfxMs: 40,
  /** The one-time "swipe to pick several" coach mark goes away by itself after this. */
  coachMs: 4000,
} as const;

/**
 * Named easings (Phaser ease names). Enter decelerates, exit accelerates, `land` overshoots a
 * little and is only for short moves (<= 300 ms: a long overshoot reads as a wobble, PERF_PLAN
 * 2.5), `settle` glides in without one.
 */
export const EASE = {
  enter: "Cubic.Out",
  exit: "Cubic.In",
  land: "Back.Out",
  settle: "Cubic.Out",
  inOut: "Sine.InOut",
  fadeIn: "Sine.Out",
  fadeOut: "Sine.In",
} as const;

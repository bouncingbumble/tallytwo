/**
 * Every duration in the game, in one place. Scenes may not write a tween or timer duration as a
 * number literal (boundary.test.ts).
 */
/**
 * Game speed. Each tier is an AI think-time range plus the multipliers the table's waits are
 * scaled by: `thinkScale` for the AI's think, `scale` for every other wait (the first step, the
 * round over).
 *
 *   slow    base ms × 4
 *   normal  base ms × 2
 *   fast    the short think range × FAST_THINK_SCALE; every other wait × FAST_SLOWDOWN / FAST_SPEED
 */
export type GameSpeed = "slow" | "normal" | "fast";
export const GAME_SPEEDS: readonly GameSpeed[] = ["slow", "normal", "fast"];

/** The AI's base think delay ranges, ms, uniform. */
export const THINK = {
  normal: [650, 1250],
  fast: [280, 520],
} as const;

/** Fast's waits are base ms ÷ FAST_SPEED × FAST_SLOWDOWN. */
export const FAST_SPEED = 0.7;
export const FAST_SLOWDOWN = 1.5;

/** Fast's AI think time is scaled by this. */
export const FAST_THINK_SCALE = 2.5;

export interface SpeedTier {
  /** AI think range in base ms, before `thinkScale`. */
  think: readonly [number, number];
  /** The AI think range is multiplied by this. */
  thinkScale: number;
  /** Every other wait at the table is multiplied by this. */
  scale: number;
}

export const SPEED: Record<GameSpeed, SpeedTier> = {
  slow: { think: THINK.normal, thinkScale: 4, scale: 4 },
  normal: { think: THINK.normal, thinkScale: 2, scale: 2 },
  fast: { think: THINK.fast, thinkScale: FAST_THINK_SCALE, scale: FAST_SLOWDOWN / FAST_SPEED },
};

/** r is a uniform random in [0, 1) — Math.random in the game, a fixed value in tests. Base ms, before pacedThink(). */
export const thinkMs = (speed: GameSpeed, r: number): number => {
  const [lo, hi] = SPEED[speed].think;
  return lo + r * (hi - lo);
};

/** A base wait at the table, scaled by the Game speed tier, whole ms. */
export const paced = (ms: number, speed: GameSpeed): number => Math.round(ms * SPEED[speed].scale);

/** An AI think wait at the table: thinkMs() scaled by the tier's thinkScale, whole ms. */
export const pacedThink = (speed: GameSpeed, r: number): number => Math.round(thinkMs(speed, r) * SPEED[speed].thinkScale);


/** From the last card hitting the felt to the poster. */
export const ROUND_OVER_MS = { ai: 900, human: 800 } as const;
/** Extra pause before the very first move of a round, on top of the think delay. */
export const FIRST_STEP_MS = 700;
/** The saloon doors swing before the table appears. */
export const DOORS_MS = 620;
/**
 * A play's flight (phaser/table/Trick.ts): each card leaves from behind its player's portrait
 * (from behind the hand for the human), flies to the middle of its slot with the others as a
 * stack, then spreads into place. Fixed, not paced by Game speed: it is how long the eye needs,
 * whatever the table's tempo.
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

/* ---- Presentation motion ----
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
  /** The select lift and the hand's slide. */
  slide: 160,
  /** A switch's knob. */
  knob: 150,
  /** An overlay or sheet coming in. */
  uiIn: 260,
  /** An overlay or sheet going away. */
  uiOut: 180,
  /** One card's fly-in at the deal. */
  dealIn: 380,
  /** Something that should be noticed: a turn arriving, a trick won. */
  emphasis: 450,
  /** The title doors' glow brightening as they swing. */
  doorsGlow: 500,
  /** After a play, the remaining cards close the gap 4x slower than a slide. */
  settle: 640,
  /** A looping pulse's period (an idle reminder). */
  pulse: 1200,
  /** A won trick stays put this long so the winning play is read, then sweeps to its winner. */
  trickHold: 250,
  trickSweep: 420,
  /** The bark bubble's run: in over the first 10 %, out over the last 15 %. */
  bark: 1900,
  /** The final-round banner's run. */
  announce: 3200,
} as const;

/**
 * Whose turn it is. The thinking dots step instead of tweening, so a
 * long AI think draws a few frames a second instead of every frame (render on demand).
 */
export const TURN = {
  /** The thinking dots move on this often. */
  dotStepMs: 400,
  /** On the player's turn with no touch for this long, the asked-for control is nudged once. */
  idleNudgeMs: 8000,
} as const;

/**
 * Moving between screens: the title's camera goes in through the
 * opened doors and darkens, then the table fades up out of the dark; leaving the table, the title
 * fades up out of the same dark (C.oakDeep).
 */
export const TRANSITION = {
  /** Through the doors: after DOORS_MS, the title's camera pushes in and fades out this long, then the deal. */
  throughDoorsMs: 300,
  /** How far the camera pushes in through the doors (a multiple of its zoom). */
  throughDoorsZoom: 1.6,
  /** A screen arriving fades up out of the dark this long. */
  fadeUpMs: 260,
} as const;

/**
 * The sheets (Settings, How to play): they slide up over a dim that fades in, and go back
 * down the same way. The body scrolls with momentum and rubber-band ends; pulled down from the
 * top, the whole sheet follows the finger and is dismissed past a distance or a flick. The
 * distances and the drag maths are render/sheetDrag.ts.
 */
export const SHEET = {
  /** After a release, the scroll glides on for this long (a flick's momentum). */
  momentumMs: 650,
  /** A pulled sheet that is let go short of dismissal springs back this long. */
  springBackMs: 220,
} as const;

/**
 * The title's idle life: the doors' glow flickers like a lamp (one change every
 * flickerMs[0]-flickerMs[1] ms: under 2 Hz, so nothing flashes), the doors sway a
 * degree now and then, and after a while with no touch "Deal me in" breathes a few times.
 */
export const TITLE = {
  flickerMs: [500, 1100],
  swayEveryMs: 5200,
  swayMs: 1600,
  /** With no touch for this long, Deal me in breathes... */
  idlePulseMs: 3000,
  /** ...this many times, then rests idlePulseMs again before the next few. */
  pulseCycles: 3,
} as const;

/**
 * Performance guard: from this long into a round, a texture painted
 * for the first time is a DEV warning (phaser/paint.ts paintStrict).
 */
export const PERF_GUARD = { paintGraceMs: 2000 } as const;

/** The doors' sprite frames: ajar, then open, inside DOORS_MS. */
export const DOORS_FRAMES_MS = { ajar: 200, open: 420 } as const;
/** A button that copied something says "Copied" this long. */
export const COPIED_MS = 1500;

/**
 * The hand's gestures (render/handGesture.ts). Input timings, not
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
 * The deal: 52 backs leave a deck on the felt round-robin, the
 * opponents' shrink into their portraits, the player's land face-down in the fan, then flip over
 * in a wave. Presentation only: the store does not wait for it, so it must be over before the
 * earliest first AI move (timing.test.ts pins that), and a tap finishes it at once.
 */
export const DEAL = {
  /** One card leaves the deck this long after the one before it. */
  staggerMs: 14,
  /** One card's flight from the deck. */
  flyMs: 300,
  /** One card's flip, back to face (half shrinking the back, half growing the face). */
  flipMs: 220,
  /** Each card in the fan flips this long after the one to its left. */
  flipStaggerMs: 25,
} as const;
/** The whole deal, first card out to last card flipped. */
export const dealTotalMs = (cards = 52, hand = 13): number => (cards - 1) * DEAL.staggerMs + DEAL.flyMs + (hand - 1) * DEAL.flipStaggerMs + DEAL.flipMs;

/**
 * The round's end: the winning card lands, holds, and slaps down; then, on Greenhorn, the
 * losers' leftover cards fan out face-up over their badges until the poster.
 */
export const ROUND_END = {
  /** After the last play lands, before the slap. */
  holdMs: 300,
  /** The slap: the winning cards grow and come down, the camera jolts. */
  slapMs: 220,
  /** Each leftover card turns over this long after the one before it. */
  revealStaggerMs: 40,
  /**
   * On Greenhorn, with leftovers to show, the poster waits this much longer (fixed, not paced by
   * Game speed: it is reading time). The store adds it to the round-over wait.
   */
  revealHoldMs: 1500,
} as const;

/** The poster: rows arrive one after another, then the numbers count up. */
export const POSTER = {
  rowStaggerMs: 60,
  countMs: 700,
  /** A tick sound plays at most this often while the numbers count. */
  tickMs: 70,
} as const;

/**
 * Named easings (Phaser ease names). Enter decelerates, exit accelerates, `land` overshoots a
 * little and is only for short moves (<= 300 ms: a long overshoot reads as a wobble), `settle`
 * glides in without one.
 */
export const EASE = {
  enter: "Cubic.Out",
  exit: "Cubic.In",
  land: "Back.Out",
  settle: "Cubic.Out",
  inOut: "Sine.InOut",
  fadeIn: "Sine.Out",
  fadeOut: "Sine.In",
  /** A heavier overshoot for something dropped into place (the poster, the final-round banner). */
  spring: "Back.Out",
} as const;

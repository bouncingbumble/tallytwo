/**
 * The juice kit (docs/MOBILE_UX_PLAN.md §2.2): small one-call effects every scene shares, so a
 * "no" shake or a pop looks and times the same everywhere. Each one:
 *
 * - takes its duration from timing.ts MOTION and does nothing at all under reduced motion;
 * - ends exactly where it started (a shake returns to its x, a pop to scale 1), so a rest pose is
 *   never left fractional (viewport.ts snaps still quads to device px);
 * - restarts cleanly when called again mid-run (a second shake does not drift the first's base);
 * - returns a handle: `skip()` jumps to the end state, `stop()` is the same for a loop.
 *
 * Tweens running keep render-on-demand drawing (onDemand.ts), so nothing here marks dirty itself.
 * Scale effects turn about the object's origin: give a Container centred children, or an Image
 * origin 0.5, to grow from the middle.
 */
import type Phaser from "phaser";
import { EASE, MOTION } from "../game/timing";
import { ms } from "./motion";

export interface FxHandle {
  /** Jump to the end state now. */
  skip(): void;
}

type Movable = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;

const NONE: FxHandle = { skip() {} };

/** One running effect per object and kind: a new one first ends the old one at its end state. */
const running = new WeakMap<Movable, Map<string, FxHandle>>();
function claim(obj: Movable, kind: string, h: FxHandle): FxHandle {
  let m = running.get(obj);
  if (!m) running.set(obj, (m = new Map()));
  m.get(kind)?.skip();
  m.set(kind, h);
  return h;
}
function release(obj: Movable, kind: string, h: FxHandle): void {
  const m = running.get(obj);
  if (m?.get(kind) === h) m.delete(kind);
}

/** Forget every effect on `obj` without ending it (its tweens are killed by the caller): a pooled card handed back. */
export function cancel(obj: Movable): void {
  running.delete(obj);
}

/**
 * A scale tween relative to the object's resting scale, which is restored at the end. An image
 * drawn with setDisplaySize rests at a scale far from 1 (a 3x portrait at ~0.28), so "1" is never
 * assumed.
 */
function scaleBy(scene: Phaser.Scene, obj: Movable, kind: string, amount: number, half: number, ease: string, repeat = 0): FxHandle {
  running.get(obj)?.get(kind)?.skip(); // a run already going puts its object back first
  const sx = obj.scaleX;
  const sy = obj.scaleY;
  const t = scene.tweens.add({ targets: obj, scaleX: sx * amount, scaleY: sy * amount, duration: half, yoyo: true, repeat, ease });
  const h: FxHandle = {
    skip() {
      t.stop();
      obj.setScale(sx, sy);
      release(obj, kind, h);
    },
  };
  t.once("complete", () => {
    obj.setScale(sx, sy);
    release(obj, kind, h);
  });
  return claim(obj, kind, h);
}

/** A quick grow-and-back: something changed or was chosen. */
export function pop(scene: Phaser.Scene, obj: Movable, amount = 1.12, duration: number = MOTION.micro): FxHandle {
  const d = ms(duration);
  return d ? scaleBy(scene, obj, "pop", amount, d / 2, EASE.fadeIn) : NONE;
}

/** A sideways "no": a damped wobble of `px` that settles back on the object's x. */
export function shake(scene: Phaser.Scene, obj: Movable, px = 4, duration: number = MOTION.shake): FxHandle {
  const d = ms(duration);
  if (!d) return NONE;
  running.get(obj)?.get("shake")?.skip();
  const base = obj.x;
  const p = { t: 0 };
  const t = scene.tweens.add({
    targets: p,
    t: 1,
    duration: d,
    ease: "Linear",
    // two and a half swings, dying away
    onUpdate: () => obj.setX(base + px * Math.sin(p.t * Math.PI * 5) * (1 - p.t)),
  });
  const h: FxHandle = {
    skip() {
      t.stop();
      obj.setX(base);
      release(obj, "shake", h);
    },
  };
  t.once("complete", () => {
    obj.setX(base);
    release(obj, "shake", h);
  });
  return claim(obj, "shake", h);
}

/** A rotational "no": a damped wiggle of `deg` that settles back on angle 0 (for a card whose x a slide may own). */
export function wobble(scene: Phaser.Scene, obj: Movable, deg = 5, duration: number = MOTION.shake): FxHandle {
  const d = ms(duration);
  if (!d) return NONE;
  running.get(obj)?.get("wobble")?.skip();
  const p = { t: 0 };
  const t = scene.tweens.add({
    targets: p,
    t: 1,
    duration: d,
    ease: "Linear",
    onUpdate: () => obj.setAngle(deg * Math.sin(p.t * Math.PI * 5) * (1 - p.t)),
  });
  const h: FxHandle = {
    skip() {
      t.stop();
      obj.setAngle(0);
      release(obj, "wobble", h);
    },
  };
  t.once("complete", () => {
    obj.setAngle(0);
    release(obj, "wobble", h);
  });
  return claim(obj, "wobble", h);
}

/**
 * A slow breathing scale loop: an idle reminder. Use sparingly — while it runs every frame draws
 * (render on demand counts it as an animation), so stop it as soon as it has done its job.
 */
export function pulse(scene: Phaser.Scene, obj: Movable, amount = 1.05, period: number = MOTION.pulse): FxHandle {
  const d = ms(period);
  return d ? scaleBy(scene, obj, "pulse", amount, d / 2, EASE.inOut, -1) : NONE;
}

/** Squish under a finger (down) and spring back (up). The caller owns when. */
export function press(scene: Phaser.Scene, obj: Movable, down: boolean, amount = 0.96): void {
  const d = ms(MOTION.press);
  scene.tweens.killTweensOf(obj);
  if (!d) {
    obj.setScale(1);
    return;
  }
  scene.tweens.add({ targets: obj, scale: down ? amount : 1, duration: d, ease: down ? EASE.enter : EASE.land });
}

/**
 * FLIP's last step (docs/MOBILE_UX_PLAN.md §7.3): `obj` has just been put at rest; it jumps back to
 * where it was on screen, (fromX, fromY) in absolute logical px, and glides home, ending exactly
 * on its rest pose. For an object whose containers are only translated (the table's layers).
 */
export function flipFrom(scene: Phaser.Scene, obj: Movable, fromX: number, fromY: number, duration: number = MOTION.uiIn): FxHandle {
  const d = ms(duration);
  const m = obj.getWorldTransformMatrix();
  const dx = fromX - m.tx;
  const dy = fromY - m.ty;
  if (!d || (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5)) return NONE;
  running.get(obj)?.get("flip")?.skip();
  const x = obj.x;
  const y = obj.y;
  obj.setPosition(x + dx, y + dy);
  const t = scene.tweens.add({ targets: obj, x, y, duration: d, ease: EASE.settle });
  const h: FxHandle = {
    skip() {
      t.stop();
      obj.setPosition(x, y);
      release(obj, "flip", h);
    },
  };
  t.once("complete", () => release(obj, "flip", h));
  return claim(obj, "flip", h);
}

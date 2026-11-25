/**
 * Render on demand. A card table is still most of the time — the player thinking, the AI's think
 * delay — but Phaser redraws the whole canvas every frame regardless. So every frame still updates
 * (input, timers, tweens all advance), but the draw is skipped unless something could have changed
 * the picture: a tween running, or anything marked dirty in the last DIRTY_MS (a store change, a
 * pointer event, a scene start, a timer firing, a resize). A WebGL canvas that is not drawn to
 * keeps showing its last frame, so a skipped draw costs nothing and shows nothing wrong.
 */
import Phaser from "phaser";

/**
 * How long after a change frames keep being drawn. A text re-raster is synchronous and a queued
 * scene start creates on the next step (and marks dirty again on CREATE), so a few frames cover
 * both; 300 ms kept a 120-Hz display drawing 36 frames after every event.
 */
const DIRTY_MS = 150;

let dirtyUntil = 0;

/** Something changed the picture (or may have): draw for the next DIRTY_MS. */
export function markDirty(): void {
  dirtyUntil = performance.now() + DIRTY_MS;
}

/**
 * Whether anything is moving: a playing tween with something visible to move (a looping pulse on
 * an object that is hidden, or inside a hidden container, draws nothing, so it does not count), or
 * a camera effect (a fade between screens, the slap's jolt).
 */
const animating = (game: Phaser.Game): boolean => {
  for (const s of game.scene.getScenes(true)) {
    if (s.tweens.getTweens().some((t) => t.isPlaying() && (!Array.isArray(t.targets) || t.targets.some(shows)))) return true; // a chain has no targets of its own: it counts
    for (const cam of s.cameras.cameras) if (cam.fadeEffect.isRunning || cam.shakeEffect.isRunning || cam.zoomEffect.isRunning || cam.panEffect.isRunning) return true;
  }
  return false;
};

interface Showable {
  visible?: boolean;
  parentContainer?: Showable | null;
}

/** A tween target that is on screen: not a GameObject (a plain proxy driving onUpdate counts), or visible up through its containers. */
function shows(target: unknown): boolean {
  if (typeof target !== "object" || target === null) return true;
  for (let o: Showable | null | undefined = target as Showable; o; o = o.parentContainer) if (o.visible === false) return false;
  return true;
}

export function renderOnDemand(game: Phaser.Game): void {
  const events = game.events;
  const full = game.step.bind(game);
  // `pendingDestroy` is internal to Phaser.Game; a destroy goes through the original step.
  // SAFETY: Phaser 4.2's Game sets `pendingDestroy` (a boolean) in its constructor and destroy();
  // the typings omit it. Read-only here; if a future version drops it, it reads undefined (falsy).
  const internal = game as unknown as { pendingDestroy: boolean };
  // SAFETY: Phaser 4.2's InputManager defines preRender() and subscribes it to PRE_RENDER in its
  // constructor; the typings omit it. Checked at install: without it nothing is skipped.
  const inputPreRender = (game.input as unknown as { preRender?: () => void }).preRender;
  if (typeof inputPreRender !== "function") return;
  // SAFETY: isProcessing is a plain boolean field on Phaser 4.2's SceneManager (set in update()
  // and render()); the typings declare it readonly only to discourage outside writes.
  const sceneManager = game.scene as unknown as { isProcessing: boolean };
  game.step = function (time: number, delta: number): void {
    if (internal.pendingDestroy || this.isPaused || performance.now() <= dirtyUntil || animating(this)) {
      full(time, delta);
      return;
    }
    // update only: input, timers and tweens advance; nothing is drawn
    events.emit(Phaser.Core.Events.PRE_STEP, time, delta);
    events.emit(Phaser.Core.Events.STEP, time, delta);
    this.scene.update(time, delta);
    events.emit(Phaser.Core.Events.POST_STEP, time, delta);
    // SceneManager.update() raises isProcessing and only render() lowers it; left raised, the next
    // frame's queued scene ops (bringToTop) re-queue themselves forever. Lower it as render would.
    sceneManager.isProcessing = false;
    // the input manager does its per-frame pointer bookkeeping on PRE_RENDER (a method the typings
    // omit); it must run every frame, drawn or not
    inputPreRender.call(this.input);
  };
  // the loop holds the step it was started with (bound at boot); point it at ours
  game.loop.callback = (time: number, delta: number) => game.step(time, delta);
  // any touch may press or drag something
  for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel"]) window.addEventListener(type, markDirty, { passive: true, capture: true });
  // a scene starting or stopping
  game.scene.scenes.forEach((s) => {
    s.events.on(Phaser.Scenes.Events.CREATE, markDirty);
    s.events.on(Phaser.Scenes.Events.SHUTDOWN, markDirty);
  });
  markDirty();
}

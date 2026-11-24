/**
 * A sheet over whatever is below: the dark cover, a wooden panel, and content that scrolls inside
 * the panel when it is taller than the canvas. The content lives in one container drawn by a second
 * camera whose viewport is the panel, so it is clipped by the camera, and a tap outside the panel
 * can never reach a control scrolled out of view. A control only fires on a press that did not
 * travel (widgets.ts TAP_SLOP).
 *
 * Motion: the panel slides up from below the canvas over a dim that fades in with it (MOTION.uiIn)
 * and goes back down the same way (uiOut) before the sheet closes. It closes by a tap on the dim,
 * by pulling it down from the top of its body (it follows the finger, and goes past
 * render/sheetDrag.ts DISMISS_PX or on a downward flick; short of that it springs back), or by its
 * ✕. The body scrolls with momentum and stretches past its ends. A rebuild for a new viewport keeps
 * the scroll and skips the entrance.
 */
import Phaser from "phaser";
import { EASE, MOTION, SHEET } from "../../game/timing";
import { dragTo, settleScroll, shouldDismiss, trackVelocity } from "../../render/sheetDrag";
import { ms } from "../motion";
import { target } from "../probe";
import { IconButton, TAP_SLOP, blocker, cover, sheetPanel } from "../widgets";
import { TAP } from "../theme";
import { zoomOf } from "../viewport";
import { BaseScene } from "./base";

/** Breathing room between the panel and the canvas edges. */
const MARGIN_Y = 10;
const MARGIN_X = 16;
export const SHEET_PAD = 16;

export abstract class SheetScene extends BaseScene {
  /** The panel, logical px (at rest). */
  panel = { x: 0, y: 0, w: 0, h: 0 };
  /** Where content goes: x0 is the panel's inner left edge, inner width `innerW`; y grows from `top`. */
  content!: Phaser.GameObjects.Container;
  innerW = 0;
  top = 0;
  #scroll = 0;
  #max = 0;
  /** How far the whole panel is pulled down from its rest (entering, leaving, or dragged). */
  #pull = 0;
  #closing = false;
  #cam!: Phaser.Cameras.Scene2D.Camera;
  #bg!: Phaser.GameObjects.Image;
  #bgY = 0;
  #shade!: Phaser.GameObjects.Rectangle;
  #x!: IconButton;
  /** The glide after a flick, or a stretched end or a pulled panel springing back. */
  #settling: Phaser.Tweens.Tween | null = null;

  /** Build the content into `this.content` from y = this.top; return its bottom y. */
  protected abstract build(): number;

  /** The panel's width. */
  protected panelWidth(): number {
    return Math.min(680, this.W - 2 * MARGIN_X);
  }

  carry(): Record<string, unknown> {
    return { scroll: this.#scroll };
  }

  create(): void {
    this.setup();
    this.#closing = false;
    this.#pull = 0;
    this.#settling = null;
    const { W, H } = this;
    blocker(this, W, H);
    const shade = (this.#shade = cover(this, W, H));
    const pw = this.panelWidth();
    this.innerW = pw - 2 * SHEET_PAD;
    this.content = this.add.container(0, 0);
    const px = Math.floor((W - pw) / 2);
    this.top = SHEET_PAD;
    this.content.setX(px + SHEET_PAD);
    const bottom = this.build() + SHEET_PAD;
    const ph = Math.min(bottom, H - 2 * MARGIN_Y);
    const py = Math.floor((H - ph) / 2);
    this.panel = { x: px, y: py, w: pw, h: ph };
    const bg = (this.#bg = sheetPanel(this, px, py, pw, ph));
    this.#bgY = bg.y;
    this.children.moveAbove(bg as Phaser.GameObjects.GameObject, shade as Phaser.GameObjects.GameObject); // the panel over the cover, under the content
    this.content.setY(py);
    this.#max = Math.max(0, bottom - ph);

    // the ✕, top right, in the content but kept at the panel's top as the body scrolls under it
    const x = (this.#x = new IconButton(this, this.innerW + SHEET_PAD - TAP, 0, "close", () => this.close()));
    this.content.add(x);
    target(this, `${this.scene.key.toLowerCase()}.close`, x, { w: TAP, h: TAP });

    // the content's own camera: the panel's rect on the canvas
    const z = zoomOf();
    this.#cam = this.cameras.add(0, 0, 1, 1).setOrigin(0, 0).setZoom(z);
    this.cameras.main.ignore(this.content);
    this.#cam.ignore(this.children.list.filter((o) => o !== this.content));

    // a backing zone under the content so a drag on empty paper scrolls too
    const pad = this.add.zone(-SHEET_PAD, 0, pw, bottom).setOrigin(0, 0).setInteractive();
    this.content.addAt(pad, 0);
    this.cameras.main.ignore(pad);

    this.#scroll = Math.min(this.#max, Math.max(0, Number(this.carried.scroll) || 0));
    this.#place();
    this.#drag(z);
    this.#enter();
  }

  /** Close: the panel slides down and the dim fades, then the sheet goes. Once only. */
  close(): void {
    if (this.#closing) return;
    this.#closing = true;
    this.#settling?.stop();
    const d = ms(MOTION.uiOut);
    const done = () => this.app.sheet.set("none");
    if (!d) return done();
    const p = { pull: this.#pull };
    this.tweens.add({ targets: p, pull: this.H - this.panel.y, duration: d, ease: EASE.exit, onUpdate: () => this.#setPull(p.pull), onComplete: done });
  }

  /** Up from below the canvas over a fading-in dim; a rebuild for a new viewport just appears. */
  #enter(): void {
    const d = ms(MOTION.uiIn);
    if (!d || this.resumed) return;
    const p = { pull: this.H - this.panel.y };
    this.#setPull(p.pull);
    this.tweens.add({ targets: p, pull: 0, duration: d, ease: EASE.enter, onUpdate: () => this.#setPull(p.pull), onComplete: () => this.#setPull(0) });
  }

  /**
   * The finger on the sheet: inside the panel it scrolls (and pulls the panel down from the top);
   * a tap on the dim outside it closes. A slider being dragged (data "capture") owns the finger.
   */
  #drag(z: number): void {
    let down = false;
    let outside = false;
    let startY = 0;
    let startScroll = 0;
    let lastY = 0;
    let lastT = 0;
    let vy = 0;
    const inPanel = (p: Phaser.Input.Pointer): boolean => {
      const x = p.x / z;
      const y = p.y / z;
      const r = this.panel;
      return x >= r.x && x < r.x + r.w && y >= r.y + this.#pull && y < r.y + this.#pull + r.h;
    };
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.#closing) return;
      outside = !inPanel(p);
      down = !outside;
      if (!down) return;
      this.#settling?.stop();
      this.#settling = null;
      startY = lastY = p.y / z;
      startScroll = this.#scroll;
      lastT = performance.now();
      vy = 0;
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      if (!down || !p.isDown || this.#closing || this.data.get("capture")) return;
      const y = p.y / z;
      const now = performance.now();
      vy = trackVelocity(vy, y - lastY, now - lastT);
      lastY = y;
      lastT = now;
      const s = dragTo(startScroll, y - startY, this.#max);
      this.#scrollTo(s.scroll);
      this.#setPull(s.pull);
    });
    const up = (p: Phaser.Input.Pointer) => {
      if (outside && !this.#closing && p.getDistance() / z < TAP_SLOP && !inPanel(p)) this.close();
      outside = false;
      if (!down) return;
      down = false;
      if (this.#closing) return;
      // a finger that stopped before lifting has no speed left
      if (performance.now() - lastT > MOTION.micro) vy = 0;
      this.#release(vy);
    };
    this.input.on("pointerup", up);
    this.input.on("pointerupoutside", up);
    this.input.on("wheel", (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      if (this.#closing) return;
      this.#settling?.stop();
      this.#scrollTo(Math.min(this.#max, Math.max(0, this.#scroll + dy / (z / (window.devicePixelRatio || 1)))));
    });
  }

  /** Let go: dismissed, or the panel springs back; a stretched end snaps in; a flick glides. */
  #release(vy: number): void {
    if (this.#pull > 0) {
      if (shouldDismiss(this.#pull, vy)) return this.close();
      const p = { pull: this.#pull };
      this.#settling = this.#animate(p, "pull", 0, ms(SHEET.springBackMs), () => this.#setPull(p.pull));
      return;
    }
    const to = settleScroll(this.#scroll, vy, this.#max);
    if (to === null) return;
    const stretched = this.#scroll < 0 || this.#scroll > this.#max;
    const p = { s: this.#scroll };
    this.#settling = this.#animate(p, "s", to, ms(stretched ? SHEET.springBackMs : SHEET.momentumMs), () => this.#scrollTo(p.s));
  }

  /** Tween `p[key]` to `to`, calling `apply` each step (and once at once when there is no motion). */
  #animate<K extends string>(p: Record<K, number>, key: K, to: number, d: number, apply: () => void): Phaser.Tweens.Tween | null {
    if (!d) {
      p[key] = to;
      apply();
      return null;
    }
    return this.tweens.add({ targets: p, [key]: to, duration: d, ease: EASE.enter, onUpdate: apply, onComplete: apply });
  }

  #scrollTo(s: number): void {
    this.#scroll = s;
    this.#cam.setScroll(this.panel.x, this.panel.y + Math.round(s));
    this.#x.setY(Math.max(0, Math.round(s)));
  }

  /** The panel's pull; the dim fades with it, so a sheet dragged or sliding away uncovers what is below. */
  #setPull(v: number): void {
    this.#pull = Math.max(0, v);
    this.#shade.setAlpha(1 - Math.min(1, this.#pull / (this.H - this.panel.y)));
    this.#place();
  }

  /** The panel and its content camera at the current pull; the camera shrinks as the panel leaves the bottom of the canvas. */
  #place(): void {
    const z = zoomOf();
    const { x, y, w, h } = this.panel;
    const top = y + Math.round(this.#pull);
    this.#bg.setY(this.#bgY + Math.round(this.#pull));
    const shown = Math.max(1, Math.min(h, this.H - top));
    this.#cam.setViewport(Math.round(x * z), Math.round(top * z), Math.round(w * z), Math.max(1, Math.round(shown * z)));
    this.#scrollTo(this.#scroll);
  }
}

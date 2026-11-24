/**
 * A sheet over whatever is below: the dark cover, a wooden panel, and content that scrolls inside
 * the panel when it is taller than the canvas (what .ov / .sheet with overflow:auto did). The
 * content lives in one container drawn by a second camera whose viewport is the panel, so it is
 * clipped by the camera, and a tap outside the panel can never reach a control scrolled out of
 * view. Drag anywhere on the content, or use the wheel, to scroll; a control only fires on a
 * press that did not travel (widgets.ts TAP_SLOP).
 */
import Phaser from "phaser";
import { blocker, cover, sheetPanel } from "../widgets";
import { zoomOf } from "../viewport";
import { BaseScene } from "./base";

/** Breathing room between the panel and the canvas edges. */
const MARGIN_Y = 10;
const MARGIN_X = 16;
export const SHEET_PAD = 16;

export abstract class SheetScene extends BaseScene {
  /** The panel, logical px. */
  panel = { x: 0, y: 0, w: 0, h: 0 };
  /** Where content goes: x0 is the panel's inner left edge, inner width `innerW`; y grows from `top`. */
  content!: Phaser.GameObjects.Container;
  innerW = 0;
  top = 0;
  #scroll = 0;
  #max = 0;
  #cam!: Phaser.Cameras.Scene2D.Camera;

  /** Build the content into `this.content` from y = this.top; return its bottom y. */
  protected abstract build(): number;

  /** The panel's width. */
  protected panelWidth(): number {
    return Math.min(680, this.W - 2 * MARGIN_X);
  }

  create(): void {
    this.setup();
    const { W, H } = this;
    blocker(this, W, H);
    const shade = cover(this, W, H);
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
    const bg = sheetPanel(this, px, py, pw, ph);
    this.children.moveAbove(bg as Phaser.GameObjects.GameObject, shade as Phaser.GameObjects.GameObject); // the panel over the cover, under the content
    this.content.setY(py);
    this.#max = Math.max(0, bottom - ph);

    // the content's own camera: the panel's rect on the canvas
    const z = zoomOf();
    const cam = (this.#cam = this.cameras.add(Math.round(px * z), Math.round(py * z), Math.round(pw * z), Math.round(ph * z)));
    cam.setOrigin(0, 0).setZoom(z);
    cam.setScroll(px, py);
    this.cameras.main.ignore(this.content);
    cam.ignore(this.children.list.filter((o) => o !== this.content));

    // a backing zone under the content so a drag on empty paper scrolls too
    const pad = this.add.zone(-SHEET_PAD, 0, pw, bottom).setOrigin(0, 0).setInteractive();
    this.content.addAt(pad, 0);
    this.cameras.main.ignore(pad);

    if (this.#max > 0) {
      let startY = 0;
      let startScroll = 0;
      let dragging = false;
      this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
        dragging = true;
        startY = p.y;
        startScroll = this.#scroll;
      });
      this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
        if (!dragging || !p.isDown || this.data.get("capture")) return;
        this.#scrollTo(startScroll - (p.y - startY) / z);
      });
      this.input.on("pointerup", () => (dragging = false));
      this.input.on("wheel", (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => this.#scrollTo(this.#scroll + dy / (z / (window.devicePixelRatio || 1))));
    }
  }

  #scrollTo(s: number): void {
    this.#scroll = Math.round(Math.min(this.#max, Math.max(0, s)));
    this.#cam.setScroll(this.panel.x, this.panel.y + this.#scroll);
  }
}

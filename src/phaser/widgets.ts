/**
 * The controls (what buttons.css and overlays.css drew): Button, IconButton, Switch, Slider and
 * Picker. Every one is at least TAP (60 logical px) to hit, whatever its drawing, so the 44-pt
 * floor holds at k = 0.75. A tap is a pointerup on the control that has not travelled — a finger
 * that scrolls a sheet never presses what it started on.
 */
import Phaser from "phaser";
import { dropShadow, insetStroke, painted, roundRect, text, vgrad } from "./paint";
import { C, CSS, FS_EM, TAP } from "./theme";
import { EASE, MOTION } from "../game/timing";
import { press } from "./fx";
import { ms } from "./motion";
import { markDirty } from "./onDemand";
import { zoomOf } from "./viewport";

/** How far (logical px) a pointer may travel and still be a tap. */
export const TAP_SLOP = 10;

const travelled = (p: Phaser.Input.Pointer): number => p.getDistance() / zoomOf();

/** A tap target: a zone that calls `onTap` on a press-and-release that did not travel. */
function tapZone(scene: Phaser.Scene, w: number, h: number, onTap: (p: Phaser.Input.Pointer) => void, onPress?: (down: boolean) => void): Phaser.GameObjects.Zone {
  const z = scene.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
  let down = false;
  z.on("pointerdown", () => {
    down = true;
    onPress?.(true);
  });
  z.on("pointerout", () => {
    if (down) onPress?.(false);
    down = false;
  });
  z.on("pointerup", (p: Phaser.Input.Pointer) => {
    const was = down;
    down = false;
    onPress?.(false);
    if (was && travelled(p) < TAP_SLOP) onTap(p);
  });
  return z;
}

export type ButtonKind = "normal" | "primary" | "ghost" | "ghostDark";

const FACE: Record<ButtonKind, { top: string; bottom: string; base: string | null; text: string; ring: string | null; bold: boolean }> = {
  normal: { top: CSS.oakLight, bottom: CSS.oak, base: "#1a0f07", text: CSS.bone, ring: null, bold: false },
  primary: { top: "#f0b457", bottom: "#c97f22", base: "#6b3f12", text: "#231204", ring: null, bold: true },
  ghost: { top: "", bottom: "", base: null, text: CSS.bone, ring: "rgba(201, 176, 138, 0.35)", bold: false },
  ghostDark: { top: "", bottom: "", base: null, text: CSS.paperInk, ring: "rgba(42, 26, 15, 0.35)", bold: false },
};

/** One button face, up or pressed: the CSS .btn (radius 4, a 3-px base under it, a 1-px highlight). */
function buttonPainter(kind: ButtonKind, pressed: boolean) {
  const f = FACE[kind];
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (f.ring) {
      insetStroke(ctx, w, h, 4, 2, f.ring);
      return;
    }
    const y = pressed ? 3 : 0;
    if (!pressed && f.base) {
      ctx.fillStyle = f.base;
      roundRect(ctx, 0, 3, w, h, 4);
      ctx.fill();
    }
    ctx.fillStyle = vgrad(ctx, y, y + h, f.top, f.bottom);
    roundRect(ctx, 0, y, w, h, 4);
    ctx.fill();
    ctx.fillStyle = kind === "primary" ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.12)";
    ctx.fillRect(3, y + 1, w - 6, 1);
  };
}

export interface ButtonOpts {
  kind?: ButtonKind;
  size?: number;
  font?: string;
  onClick: () => void;
}

export class Button extends Phaser.GameObjects.Container {
  readonly w: number;
  readonly h: number;
  #up: Phaser.GameObjects.Image;
  #down: Phaser.GameObjects.Image;
  #label: Phaser.GameObjects.Text;
  /** The drawing, centred on the button so the press squish shrinks it about its middle; the hit zone stays put. */
  #face: Phaser.GameObjects.Container;
  #enabled = true;
  #kind: ButtonKind;
  #zone: Phaser.GameObjects.Zone;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, label: string, o: ButtonOpts) {
    super(scene, x, y);
    this.w = w;
    this.h = Math.max(TAP, h);
    this.#kind = o.kind ?? "normal";
    const bh = this.h - (FACE[this.#kind].base ? 3 : 0);
    const cx = w / 2;
    const cy = this.h / 2;
    this.#up = painted(scene, `btn-${this.#kind}-up`, -cx, -cy, w, bh, buttonPainter(this.#kind, false), 3);
    this.#down = painted(scene, `btn-${this.#kind}-down`, -cx, -cy, w, bh, buttonPainter(this.#kind, true), 3).setVisible(false);
    this.#label = text(scene, 0, bh / 2 - cy, label, { size: o.size ?? FS_EM, color: FACE[this.#kind].text, bold: FACE[this.#kind].bold, font: o.font, align: "center", wrap: w - 12 }).setOrigin(0.5, 0.5);
    this.#zone = tapZone(
      scene,
      w,
      this.h,
      () => {
        if (this.#enabled) o.onClick();
      },
      (down) => this.#press(down && this.#enabled),
    );
    this.#face = scene.add.container(cx, cy, [this.#up, this.#down, this.#label]);
    this.add([this.#face, this.#zone]);
    scene.add.existing(this);
  }

  #press(down: boolean): void {
    const was = this.#down.visible;
    this.#up.setVisible(!down);
    this.#down.setVisible(down);
    this.#label.setY((this.h - (FACE[this.#kind].base ? 3 : 0)) / 2 - this.h / 2 + (down ? 3 : 0));
    if (down !== was) press(this.scene, this.#face, down);
  }

  setEnabled(on: boolean): this {
    if (on === this.#enabled) return this;
    this.#enabled = on;
    this.setAlpha(on ? 1 : 0.5);
    if (this.#zone.input) this.#zone.input.cursor = on ? "pointer" : "default";
    if (!on) this.#press(false);
    return this;
  }

  get enabled(): boolean {
    return this.#enabled;
  }

  setLabel(s: string): this {
    this.#label.setText(s);
    markDirty(); // may come from a promise (the clipboard), outside any input or store change
    return this;
  }
}

/** A glyph on a TAP square, no face (the menu button). */
export class IconButton extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, glyph: string, onClick: () => void, size = 26) {
    super(scene, x, y);
    const g = scene.add.graphics();
    // the ☰ drawn as three bars, so it never depends on a font having the glyph
    if (glyph === "menu") {
      g.fillStyle(C.dust, 1);
      for (let i = 0; i < 3; i++) g.fillRoundedRect(TAP / 2 - 11, TAP / 2 - 8 + i * 7, 22, 3, 1);
      this.add(g);
    } else this.add(text(scene, TAP / 2, TAP / 2, glyph, { size, color: CSS.dust }).setOrigin(0.5));
    this.add(tapZone(scene, TAP, TAP, onClick, (down) => this.setAlpha(down ? 0.6 : 1)));
    scene.add.existing(this);
  }
}

/** The settings switch: a 60x34 track and a 26-px knob drawn inside a 72 x TAP box. */
export class Switch extends Phaser.GameObjects.Container {
  static readonly W = 72;
  #on: boolean;
  #g: Phaser.GameObjects.Graphics;
  #knob: Phaser.GameObjects.Arc;

  constructor(scene: Phaser.Scene, x: number, y: number, on: boolean, onChange: (v: boolean) => void) {
    super(scene, x, y);
    this.#on = on;
    this.#g = scene.add.graphics();
    this.#knob = scene.add.circle(0, TAP / 2, 13, C.dust);
    this.add([this.#g, this.#knob, tapZone(scene, Switch.W, TAP, () => onChange(!this.#on))]);
    this.#draw(false);
    scene.add.existing(this);
  }

  #draw(animate: boolean): void {
    const g = this.#g;
    g.clear();
    g.fillStyle(this.#on ? 0x4a2e19 : 0x1a0f07, 1);
    g.fillRoundedRect(6, TAP / 2 - 17, 60, 34, 17);
    g.lineStyle(1, this.#on ? C.amber : C.oakLight, 1);
    g.strokeRoundedRect(6.5, TAP / 2 - 16.5, 59, 33, 16.5);
    const x = this.#on ? 49 : 23;
    this.#knob.setFillStyle(this.#on ? C.amber : C.dust);
    if (animate && ms(MOTION.knob)) this.scene.tweens.add({ targets: this.#knob, x, duration: ms(MOTION.knob), ease: EASE.fadeIn });
    else this.#knob.setX(x);
  }

  set(on: boolean): void {
    if (on === this.#on) return;
    this.#on = on;
    this.#draw(true);
  }
}

/** A 0-1 slider: an 8-px track and a 30-px knob in a w x TAP box; grab it anywhere along the row. */
export class Slider extends Phaser.GameObjects.Container {
  #value: number;
  #knob: Phaser.GameObjects.Arc;
  #fill: Phaser.GameObjects.Rectangle;
  readonly #w: number;

  constructor(scene: Phaser.Scene, x: number, y: number, w: number, value: number, onChange: (v: number) => void, step = 0.05) {
    super(scene, x, y);
    this.#w = w;
    this.#value = value;
    const r = 15;
    const track = scene.add.rectangle(r, TAP / 2 - 4, w - 2 * r, 8, 0x1a0f07).setOrigin(0, 0).setStrokeStyle(1, C.oakLight);
    this.#fill = scene.add.rectangle(r, TAP / 2 - 4, 0, 8, C.amber, 0.55).setOrigin(0, 0);
    this.#knob = scene.add.circle(r, TAP / 2, r, C.amber);
    const zone = scene.add.zone(0, 0, w, TAP).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    this.add([track, this.#fill, this.#knob, zone]);
    let dragging = false;
    const at = (p: Phaser.Input.Pointer): void => {
      const left = this.getWorldTransformMatrix().tx;
      const raw = (p.worldX - left - r) / (this.#w - 2 * r);
      const v = Math.round(Math.min(1, Math.max(0, raw)) / step) * step;
      const nv = Math.round(v * 100) / 100;
      if (nv !== this.#value) {
        this.#value = nv;
        this.#place();
        onChange(nv);
      }
    };
    zone.on("pointerdown", (p: Phaser.Input.Pointer) => {
      dragging = true;
      scene.data.set("capture", true);
      at(p);
    });
    const move = (p: Phaser.Input.Pointer): void => {
      if (dragging) at(p);
    };
    const up = (): void => {
      dragging = false;
      scene.data.set("capture", false);
    };
    scene.input.on("pointermove", move);
    scene.input.on("pointerup", up);
    this.once("destroy", () => {
      scene.input.off("pointermove", move);
      scene.input.off("pointerup", up);
    });
    this.#place();
    scene.add.existing(this);
  }

  #place(): void {
    const r = 15;
    const x = r + this.#value * (this.#w - 2 * r);
    this.#knob.setX(x);
    this.#fill.width = x - r;
  }
}

/** One of a few values: ‹ label › in a dark box; the left third steps back, the rest steps on. */
export class Picker<T> extends Phaser.GameObjects.Container {
  constructor(scene: Phaser.Scene, x: number, y: number, w: number, options: readonly { value: T; label: string }[], value: T, onChange: (v: T) => void) {
    super(scene, x, y);
    let i = Math.max(0, options.findIndex((o) => o.value === value));
    const box = painted(scene, "picker", 0, 0, w, TAP, (ctx, bw, bh) => {
      ctx.fillStyle = "#1a0f07";
      roundRect(ctx, 0.5, 0.5, bw - 1, bh - 1, 6);
      ctx.fill();
      ctx.strokeStyle = CSS.oakLight;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    const label = text(scene, w / 2, TAP / 2, options[i].label, { size: FS_EM, align: "center" }).setOrigin(0.5);
    const chevrons = scene.add.graphics();
    chevrons.lineStyle(2.5, C.dust, 1);
    chevrons.strokePoints([new Phaser.Math.Vector2(22, TAP / 2 - 7), new Phaser.Math.Vector2(15, TAP / 2), new Phaser.Math.Vector2(22, TAP / 2 + 7)]);
    chevrons.strokePoints([new Phaser.Math.Vector2(w - 22, TAP / 2 - 7), new Phaser.Math.Vector2(w - 15, TAP / 2), new Phaser.Math.Vector2(w - 22, TAP / 2 + 7)]);
    const step = (d: number) => {
      i = (i + d + options.length) % options.length;
      label.setText(options[i].label);
      onChange(options[i].value);
    };
    const back = tapZone(scene, Math.floor(w / 3), TAP, () => step(-1));
    const fwd = tapZone(scene, w - Math.floor(w / 3), TAP, () => step(1));
    fwd.setX(Math.floor(w / 3));
    this.add([box, label, chevrons, back, fwd]);
    scene.add.existing(this);
  }
}

/** A full-canvas zone that swallows taps, under an overlay's content. */
export function blocker(scene: Phaser.Scene, w: number, h: number): Phaser.GameObjects.Zone {
  return scene.add.zone(0, 0, w, h).setOrigin(0, 0).setInteractive();
}

/** The dark cover the sheets and the poster sit in. */
export function cover(scene: Phaser.Scene, w: number, h: number): Phaser.GameObjects.Rectangle {
  return scene.add.rectangle(0, 0, w, h, 0x0c0703, 0.82).setOrigin(0, 0);
}

/** A sheet's wooden panel: the CSS .sheet. */
export function sheetPanel(scene: Phaser.Scene, x: number, y: number, w: number, h: number): Phaser.GameObjects.Image {
  return painted(
    scene,
    "sheet",
    x,
    y,
    w,
    h,
    (ctx, pw, ph) => {
      dropShadow(ctx, pw, ph, 8, 18, 40, "rgba(0,0,0,0.6)");
      ctx.fillStyle = vgrad(ctx, 0, ph, "#3a2412", "#251506");
      roundRect(ctx, 0, 0, pw, ph, 8);
      ctx.fill();
      insetStroke(ctx, pw, ph, 8, 3, CSS.black);
    },
    40,
  );
}

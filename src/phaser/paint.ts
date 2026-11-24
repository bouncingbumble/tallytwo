/**
 * The CSS that was hard to say in Phaser primitives — rounded boxes with gradients, inset
 * strokes and soft shadows — painted once with the 2D canvas API into a texture at the current
 * render resolution, cached by key, and shown at its logical size. Also the text factory, which
 * rasterises at the same resolution so text is crisp at any zoom.
 */
import Phaser from "phaser";
import { CSS, SANS } from "./theme";
import { resolution } from "./viewport";

export type Painter = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;

/**
 * An Image of a `w` x `h` logical-px box painted by `draw`, with `pad` px of room around it for
 * shadows and glows. The image is placed so the box's top-left is at (x, y).
 */
export function painted(scene: Phaser.Scene, key: string, x: number, y: number, w: number, h: number, draw: Painter, pad = 0): Phaser.GameObjects.Image {
  const R = resolution();
  const W = Math.max(1, Math.round(w));
  const H = Math.max(1, Math.round(h));
  const full = `paint:${key}:${W}x${H}:${pad}@${R}`;
  if (!scene.textures.exists(full)) {
    const tex = scene.textures.createCanvas(full, Math.ceil((W + 2 * pad) * R), Math.ceil((H + 2 * pad) * R));
    if (tex) {
      const ctx = tex.getContext();
      ctx.scale(R, R);
      ctx.translate(pad, pad);
      draw(ctx, W, H);
      tex.refresh();
    }
  }
  return scene.add
    .image(x - pad, y - pad, full)
    .setOrigin(0, 0)
    .setDisplaySize(W + 2 * pad, H + 2 * pad);
}

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** A vertical linear gradient from `top` to `bottom`. */
export function vgrad(ctx: CanvasRenderingContext2D, y0: number, y1: number, top: string, bottom: string): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  return g;
}

/** An inset stroke of width `t` just inside a rounded box. */
export function insetStroke(ctx: CanvasRenderingContext2D, w: number, h: number, r: number, t: number, color: string, inset = 0): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = t;
  roundRect(ctx, inset + t / 2, inset + t / 2, w - 2 * inset - t, h - 2 * inset - t, Math.max(0, r - inset - t / 2));
  ctx.stroke();
  ctx.restore();
}

/** A soft drop shadow under a rounded box (drawn before the box). */
export function dropShadow(ctx: CanvasRenderingContext2D, w: number, h: number, r: number, dy: number, blur: number, color: string): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = dy;
  ctx.fillStyle = "#000";
  roundRect(ctx, 0, 0, w, h, r);
  ctx.fill();
  ctx.restore();
}

/* ---------------- text ---------------- */

export interface TextOpts {
  size?: number;
  color?: string;
  font?: string;
  bold?: boolean;
  /** Wrap at this many logical px. */
  wrap?: number;
  align?: "left" | "center" | "right";
  /** Line height as a multiple of the size (CSS line-height). */
  lineHeight?: number;
  shadow?: { x: number; y: number; color: string; blur?: number };
  letterSpacing?: number;
}

export function text(scene: Phaser.Scene, x: number, y: number, str: string, o: TextOpts = {}): Phaser.GameObjects.Text {
  const size = o.size ?? 15;
  const lh = o.lineHeight ?? 1.3;
  const t = scene.add.text(x, y, str, {
    fontFamily: o.font ?? SANS,
    fontSize: `${size}px`,
    fontStyle: o.bold ? "bold" : "normal",
    color: o.color ?? CSS.bone,
    align: o.align ?? "left",
    resolution: resolution(),
    lineSpacing: Math.round(size * (lh - 1.15)),
    // a squeezed layout (an upright phone behind the rotate gate) must never ask for a wrap narrower than a glyph
    wordWrap: o.wrap ? { width: Math.max(size * 3, o.wrap), useAdvancedWrap: true } : undefined,
    padding: { top: 2, bottom: 2 },
  });
  if (o.shadow) t.setShadow(o.shadow.x, o.shadow.y, o.shadow.color, o.shadow.blur ?? 0, false, true);
  if (o.letterSpacing) t.setLetterSpacing(o.letterSpacing);
  return t;
}

/** Shrink a single-line text with an ellipsis until it fits `maxW`. */
export function fitWidth(t: Phaser.GameObjects.Text, maxW: number): Phaser.GameObjects.Text {
  if (t.width <= maxW) return t;
  let s = t.text;
  while (s.length > 1 && t.width > maxW) {
    s = s.slice(0, -1);
    t.setText(s.trimEnd() + "…");
  }
  return t;
}

/** Clip a wrapped text to at most `lines` lines, ellipsising the last. */
export function maxLines(t: Phaser.GameObjects.Text, lines: number): Phaser.GameObjects.Text {
  const wrapped = t.getWrappedText(t.text);
  if (wrapped.length <= lines) return t;
  const keep = wrapped.slice(0, lines);
  keep[lines - 1] = keep[lines - 1].replace(/\s*\S*$/, "") + "…";
  t.setText(keep.join("\n"));
  return t;
}

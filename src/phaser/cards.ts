/**
 * One card face from the atlas (what ui/Card.tsx + cards.css drew), drawn at the card's logical
 * size, with the CSS drop shadow, the amber ring of a selected or latest card, and the dim of a
 * card that cannot complete a legal move. The container's origin is the card's CENTRE, so a
 * tween's scale and rotation turn about the middle as the CSS transforms did; place it with
 * `left + w / 2`.
 *
 * Every layer comes from the one card sheet (cardSheet.ts): faces, shadows and rings in a single
 * POT texture, so a hand and a trick are one batch even where Phaser batches one texture per draw
 * (iOS, Android), and every edge is filtered (no MSAA needed).
 */
import Phaser from "phaser";
import type { Card } from "../engine/cards";
import { ATLAS_COLS, atlasCell } from "../render/atlas";
import { CARD_SIZES, FACE_PAD, type PaintedFrame, sheetImage } from "./cardSheet";
import { CELL_H, CELL_W } from "../render/atlas";
import { roundRect } from "./paint";
import { CSS } from "./theme";

export const ATLAS_KEY = "cards";
export const BACK_KEY = "card_back";

/** The atlas frame of card `v` (render/atlas.ts pins the cells). */
export const frameOf = (v: Card): number => {
  const { col, row } = atlasCell(v);
  return row * ATLAS_COLS + col;
};

/** Shadows are soft: 2 texels per logical px is plenty, and keeps the sheet's shelf short. */
const SHADOW_RES = 2;
/** Rings are 2-px strokes: painted at the art's 3x, the scale the faces beside them have. */
const RING_RES = 3;

const sizeKey = (w: number, h: number): string => `${w}x${h}`;

/** The painted card frames the sheet holds: per card size, two shadows and two rings. */
export function cardFrames(): PaintedFrame[] {
  return CARD_SIZES.flatMap(([w, h]) => [
    { key: `shadow-${sizeKey(w, h)}`, w, h, pad: 8, res: SHADOW_RES, draw: shadowPainter(false) },
    { key: `shadow-deep-${sizeKey(w, h)}`, w, h, pad: 24, res: SHADOW_RES, draw: shadowPainter(true) },
    { key: `ring-in-${sizeKey(w, h)}`, w, h, pad: 4, res: RING_RES, draw: ringPainter(true) },
    { key: `ring-out-${sizeKey(w, h)}`, w, h, pad: 4, res: RING_RES, draw: ringPainter(false) },
  ]);
}

/** A shadow under a w x h card, painted once per size and depth: the box itself erased, so the face's rounded corners stay clean. */
function shadowPainter(deep: boolean) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.save();
    ctx.shadowColor = deep ? "rgba(0,0,0,0.5)" : "rgba(0,0,0,0.55)";
    ctx.shadowBlur = deep ? 14 : 3;
    ctx.shadowOffsetY = deep ? 8 : 2;
    ctx.fillStyle = "#000";
    roundRect(ctx, 0, 0, w, h, 3);
    ctx.fill();
    ctx.restore();
    ctx.globalCompositeOperation = "destination-out";
    roundRect(ctx, 0, 0, w, h, 3);
    ctx.fill();
  };
}

/** The amber ring: inset 2 px for a selected card, outset 2 px for the play to beat. */
function ringPainter(inset: boolean) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.strokeStyle = inset ? CSS.amber : "rgba(232, 163, 61, 0.9)";
    ctx.lineWidth = 2;
    if (inset) roundRect(ctx, 1, 1, w - 2, h - 2, 3);
    else roundRect(ctx, -1, -1, w + 2, h + 2, 4);
    ctx.stroke();
  };
}

/** A card that cannot complete a legal move: about the old brightness(.62) saturate(.6) over the felt, but opaque. */
const DIM_TINT = 0x8a8780;
/** An earlier play in the trick: a gentler darkening than dim (was the whole group at alpha 0.72). */
const RECEDE_TINT = 0xa9aba2;

/**
 * Every layer is an Image (shadow, face, ring), so a hand of cards draws as one batch — a
 * Graphics per card would be re-tessellated every frame and break the batch twice per card.
 */
export class CardView extends Phaser.GameObjects.Container {
  readonly value: Card;
  readonly face: Phaser.GameObjects.Image;
  readonly cw: number;
  readonly ch: number;
  #shadow: Phaser.GameObjects.Image;
  #shadowDeep: Phaser.GameObjects.Image;
  #ringIn: Phaser.GameObjects.Image;
  #ringOut: Phaser.GameObjects.Image;
  #selected = false;
  #dim = false;
  #lit = false;
  #lifted = false;
  #recede = false;

  constructor(scene: Phaser.Scene, x: number, y: number, value: Card, w: number, h: number) {
    super(scene, x, y);
    this.value = value;
    this.cw = w;
    this.ch = h;
    const x0 = -w / 2;
    const y0 = -h / 2;
    const k = sizeKey(w, h);
    this.#shadow = sheetImage(scene, `shadow-${k}`, x0, y0, w, h);
    this.#shadowDeep = sheetImage(scene, `shadow-deep-${k}`, x0, y0, w, h).setVisible(false);
    this.face = sheetImage(scene, `face-${frameOf(value)}`, x0, y0, w, h);
    this.#ringIn = sheetImage(scene, `ring-in-${k}`, x0, y0, w, h).setVisible(false);
    this.#ringOut = sheetImage(scene, `ring-out-${k}`, x0, y0, w, h).setVisible(false);
    this.add([this.#shadow, this.#shadowDeep, this.face, this.#ringIn, this.#ringOut]);
    this.setSize(w, h);
    scene.add.existing(this);
  }

  #draw(): void {
    const deep = this.#selected || this.#lifted;
    this.#shadow.setVisible(!deep);
    this.#shadowDeep.setVisible(deep);
    this.#ringIn.setVisible(this.#selected);
    this.#ringOut.setVisible(!this.#selected && this.#lit);
    // Darkened by tint only, never by alpha: the cards overlap, so a see-through face shows the
    // card under it and the saloon behind (docs/MOBILE_UX_PLAN.md F1). The face stays opaque.
    if (this.#dim) this.face.setTint(DIM_TINT);
    else if (this.#recede) this.face.setTint(RECEDE_TINT);
    else this.face.clearTint();
  }

  /**
   * selected: lifted ring; dim: cannot complete a legal move; lit: the play to beat; lifted: being
   * dragged; recede: an earlier play in the trick, pushed back behind the latest.
   */
  setLook(o: { selected?: boolean; dim?: boolean; lit?: boolean; lifted?: boolean; recede?: boolean }): this {
    const sel = o.selected ?? this.#selected;
    const dim = o.dim ?? this.#dim;
    const lit = o.lit ?? this.#lit;
    const lifted = o.lifted ?? this.#lifted;
    const recede = o.recede ?? this.#recede;
    if (sel === this.#selected && dim === this.#dim && lit === this.#lit && lifted === this.#lifted && recede === this.#recede) return this;
    this.#selected = sel;
    this.#dim = dim;
    this.#lit = lit;
    this.#lifted = lifted;
    this.#recede = recede;
    this.#draw();
    return this;
  }

  /** How the face is drawn, for the e2e probe: its alpha must stay 1. */
  get look(): { dim: boolean; recede: boolean; faceAlpha: number } {
    return { dim: this.#dim, recede: this.#recede, faceAlpha: this.face.alpha * this.alpha };
  }
}

/** The face's hit area in frame texels: the card itself, not its transparent pad. */
export const faceHitArea = (): Phaser.Geom.Rectangle => new Phaser.Geom.Rectangle(FACE_PAD, FACE_PAD, CELL_W * 3, CELL_H * 3);

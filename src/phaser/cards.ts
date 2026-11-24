/**
 * One card face from the atlas (what ui/Card.tsx + cards.css drew): a sprite frame of
 * cards_atlas.png (13 x 4 cells, 3x the 96x128 art), drawn at the card's logical size, with the
 * CSS drop shadow, the amber ring of a selected or latest card, and the dim of a card that
 * cannot complete a legal move. The container's origin is the card's CENTRE, so a tween's scale
 * and rotation turn about the middle as the CSS transforms did; place it with `left + w / 2`.
 */
import Phaser from "phaser";
import type { Card } from "../engine/cards";
import { ATLAS_COLS, atlasCell } from "../render/atlas";
import { painted, roundRect } from "./paint";
import { CSS } from "./theme";

export const ATLAS_KEY = "cards";
export const BACK_KEY = "card_back";

/** The atlas frame of card `v` (render/atlas.ts pins the cells). */
export const frameOf = (v: Card): number => {
  const { col, row } = atlasCell(v);
  return row * ATLAS_COLS + col;
};

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

  constructor(scene: Phaser.Scene, x: number, y: number, value: Card, w: number, h: number) {
    super(scene, x, y);
    this.value = value;
    this.cw = w;
    this.ch = h;
    const x0 = -w / 2;
    const y0 = -h / 2;
    this.#shadow = painted(scene, "card-shadow", x0, y0, w, h, shadowPainter(false), 8);
    this.#shadowDeep = painted(scene, "card-shadow-deep", x0, y0, w, h, shadowPainter(true), 24).setVisible(false);
    this.face = scene.add.image(x0, y0, ATLAS_KEY, frameOf(value)).setOrigin(0, 0).setDisplaySize(w, h);
    this.#ringIn = painted(scene, "card-ring-in", x0, y0, w, h, ringPainter(true), 4).setVisible(false);
    this.#ringOut = painted(scene, "card-ring-out", x0, y0, w, h, ringPainter(false), 4).setVisible(false);
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
    // brightness(.62) saturate(.6), opacity .85
    if (this.#dim) this.face.setTint(0x9a968f);
    else this.face.clearTint();
    this.face.setAlpha(this.#dim ? 0.85 : 1);
  }

  setLook(o: { selected?: boolean; dim?: boolean; lit?: boolean; lifted?: boolean }): this {
    const sel = o.selected ?? this.#selected;
    const dim = o.dim ?? this.#dim;
    const lit = o.lit ?? this.#lit;
    const lifted = o.lifted ?? this.#lifted;
    if (sel === this.#selected && dim === this.#dim && lit === this.#lit && lifted === this.#lifted) return this;
    this.#selected = sel;
    this.#dim = dim;
    this.#lit = lit;
    this.#lifted = lifted;
    this.#draw();
    return this;
  }
}

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
import { C } from "./theme";

export const ATLAS_KEY = "cards";
export const BACK_KEY = "card_back";

/** The atlas frame of card `v` (render/atlas.ts pins the cells). */
export const frameOf = (v: Card): number => {
  const { col, row } = atlasCell(v);
  return row * ATLAS_COLS + col;
};

export class CardView extends Phaser.GameObjects.Container {
  readonly value: Card;
  readonly face: Phaser.GameObjects.Image;
  readonly cw: number;
  readonly ch: number;
  #shadow: Phaser.GameObjects.Graphics;
  #ring: Phaser.GameObjects.Graphics;
  #selected = false;
  #dim = false;
  #lit = false;
  #lifted = false;

  constructor(scene: Phaser.Scene, x: number, y: number, value: Card, w: number, h: number) {
    super(scene, x, y);
    this.value = value;
    this.cw = w;
    this.ch = h;
    this.#shadow = scene.add.graphics();
    this.face = scene.add.image(-w / 2, -h / 2, ATLAS_KEY, frameOf(value)).setOrigin(0, 0).setDisplaySize(w, h);
    this.#ring = scene.add.graphics();
    this.add([this.#shadow, this.face, this.#ring]);
    this.setSize(w, h);
    this.#draw();
    scene.add.existing(this);
  }

  #draw(): void {
    const w = this.cw;
    const h = this.ch;
    const s = this.#shadow;
    s.setPosition(-w / 2, -h / 2);
    this.#ring.setPosition(-w / 2, -h / 2);
    s.clear();
    // drop-shadow(0 2px 3px rgba(0,0,0,.55)), deeper while lifted
    const deep = this.#selected || this.#lifted;
    const dy = deep ? 8 : 2;
    const layers = deep ? 4 : 2;
    for (let i = layers; i >= 1; i--) {
      s.fillStyle(0x000000, (deep ? 0.12 : 0.2) / i);
      s.fillRoundedRect(-i, dy - i + 1, w + 2 * i, h + 2 * i - 2, 4 + i);
    }
    const r = this.#ring;
    r.clear();
    if (this.#selected) {
      r.lineStyle(2, C.amber, 1);
      r.strokeRoundedRect(1, 1, w - 2, h - 2, 3);
    } else if (this.#lit) {
      r.lineStyle(2, C.amber, 0.9);
      r.strokeRoundedRect(-1, -1, w + 2, h + 2, 4);
    }
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

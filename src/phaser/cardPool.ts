/**
 * The table's card objects, made once and handed round: a CardView is six images, and a round
 * needs ~80 of them (the hand, every play, the leftovers) plus 56 deal backs; making and
 * destroying them each time would leave garbage for the collector mid-trick. So the table
 * prewarms a pool when it is built, and the hand, the trick, the seats and the deal take views
 * from it and give them back. A view handed out is reset to the card asked for, at rest, with
 * no look and no tween; a view given back is hidden and leaves its container.
 *
 * One pool per run of a scene: the scene's shutdown destroys its objects, so the pool goes with it.
 */
import Phaser from "phaser";
import type { Card } from "../engine/cards";
import { CardView, backImage } from "./cards";
import { cancel } from "./fx";

/** How many views of each kind the table builds up front (the pool grows past this if it must). */
export interface PoolSizes {
  /** [w, h, n]: n views of a w x h card. */
  faces: readonly (readonly [number, number, number])[];
  /** [w, h, n]: n backs of a w x h card. */
  backs: readonly [number, number, number];
}

const sizeKey = (w: number, h: number): string => `${w}x${h}`;

export class CardPool {
  readonly #scene: Phaser.Scene;
  readonly #faces = new Map<string, CardView[]>();
  readonly #backs = new Map<string, Phaser.GameObjects.Image[]>();
  /** Views made after the prewarm (a DEV check: none in a round). */
  made = 0;
  #warmed = false;

  constructor(scene: Phaser.Scene) {
    this.#scene = scene;
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.#faces.clear();
      this.#backs.clear();
      pools.delete(scene);
    });
  }

  /** Build the views up front: none is made mid-round. */
  prewarm(sizes: PoolSizes): void {
    for (const [w, h, n] of sizes.faces) {
      const free = this.#freeFaces(w, h);
      while (free.length < n) free.push(new CardView(this.#scene, 0, 0, 0, w, h).setVisible(false));
    }
    const [bw, bh, bn] = sizes.backs;
    const backs = this.#freeBacks(bw, bh);
    while (backs.length < bn) backs.push(this.#newBack(0, 0, bw, bh).setVisible(false));
    this.made = 0;
    this.#warmed = true;
  }

  /** A view of card `v` at w x h, at (x, y), showing, at rest. */
  take(v: Card, w: number, h: number, x = 0, y = 0): CardView {
    const c = this.#freeFaces(w, h).pop();
    if (c) return c.reset(v).setPosition(x, y);
    this.#grew("CardView");
    return new CardView(this.#scene, x, y, v, w, h);
  }

  /** Give a view back: its tweens stopped, out of its container, hidden. */
  give(c: CardView): void {
    if (!c.active) return; // destroyed with a container that was not emptied first
    this.#free(c);
    this.#freeFaces(c.cw, c.ch).push(c);
  }

  /** Give back every CardView in `container` (before it is destroyed). */
  giveAll(container: Phaser.GameObjects.Container): void {
    // a copy first: giving a view back removes it from the list being read
    for (const c of container.list.filter((o): o is CardView => o instanceof CardView)) this.give(c);
  }

  /** A card back centred on (cx, cy), showing, at rest. */
  takeBack(cx: number, cy: number, w: number, h: number): Phaser.GameObjects.Image {
    const b = this.#freeBacks(w, h).pop();
    if (!b) {
      this.#grew("back");
      return this.#newBack(cx, cy, w, h);
    }
    return b.setPosition(cx, cy).setScale(b.getData("rest") as number).setAngle(0).setAlpha(1).setVisible(true);
  }

  giveBack(b: Phaser.GameObjects.Image): void {
    if (!b.active) return;
    this.#free(b);
    this.#backs.get(b.getData("pool") as string)?.push(b);
  }

  /** The pool ran dry and made one: in DEV, say so (the e2e counts console warnings as failures). */
  #grew(what: string): void {
    this.made++;
    if (this.#warmed && import.meta.env.DEV) console.warn(`card pool: made a ${what} mid-round (raise the table's prewarm)`);
  }

  #free(o: Phaser.GameObjects.Image | CardView): void {
    this.#scene.tweens.killTweensOf(o);
    cancel(o);
    o.parentContainer?.remove(o);
    o.setVisible(false);
  }

  /** A back that knows its size (which free list it returns to) and its resting scale. */
  #newBack(cx: number, cy: number, w: number, h: number): Phaser.GameObjects.Image {
    const b = backImage(this.#scene, cx, cy, w, h);
    return b.setData("pool", sizeKey(w, h)).setData("rest", b.scaleX);
  }

  #freeFaces(w: number, h: number): CardView[] {
    const k = sizeKey(w, h);
    let a = this.#faces.get(k);
    if (!a) this.#faces.set(k, (a = []));
    return a;
  }

  #freeBacks(w: number, h: number): Phaser.GameObjects.Image[] {
    const k = sizeKey(w, h);
    let a = this.#backs.get(k);
    if (!a) this.#backs.set(k, (a = []));
    return a;
  }
}

const pools = new WeakMap<Phaser.Scene, CardPool>();

/** The pool of the scene's current run (made on first use). */
export function poolOf(scene: Phaser.Scene): CardPool {
  let p = pools.get(scene);
  if (!p) pools.set(scene, (p = new CardPool(scene)));
  return p;
}

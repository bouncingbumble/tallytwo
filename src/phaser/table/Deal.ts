/**
 * The deal (docs/MOBILE_UX_PLAN.md §6.1). A short deck sits on the felt; 52 backs leave it
 * round-robin, DEAL.staggerMs apart. An opponent's back shrinks into their portrait and their
 * count ticks up as it arrives; the player's land face-down in their fan slots, left to right,
 * and once the last one is down they flip over in a wave (the hand's own cards, hidden until
 * then, grow out of the edge each back shrinks into).
 *
 * Presentation only: the store has already dealt and does not wait (timing.test.ts pins the deal
 * inside the earliest first AI move). `finish()` — on the last flip, on a tap anywhere, or from a
 * rebuild — drops every back, shows the hand at rest and hands the counts back to the game.
 */
import type Phaser from "phaser";
import { DEAL, EASE } from "../../game/timing";
import { CARD_W } from "../../render/fanLayout";
import { HUMAN } from "../../game/selectors";
import { PLAY_CARD_H, PLAY_CARD_W } from "../../render/scale";
import { poolOf } from "../cardPool";
import { ms } from "../motion";
import type { HandView } from "./Hand";
import type { SeatView } from "./Seat";

/** How many backs the deck shows, each a px up and left of the one under it. */
const DECK_SHOWN = 4;
/** A back shrinks to this as it disappears into an opponent's portrait. */
const INTO_PORTRAIT = 0.35;
/** Each back turns a little in flight (degrees, alternating), and lands square. */
const SPIN = 8;

export class DealRun {
  readonly #scene: Phaser.Scene;
  readonly #layer: Phaser.GameObjects.Container;
  readonly #hand: HandView;
  readonly #seats: readonly SeatView[];
  readonly #onDone: () => void;
  #objs: Phaser.GameObjects.Image[] = [];
  #running = false;

  constructor(scene: Phaser.Scene, layer: Phaser.GameObjects.Container, hand: HandView, seats: readonly SeatView[], onDone: () => void) {
    this.#scene = scene;
    this.#layer = layer;
    this.#hand = hand;
    this.#seats = seats;
    this.#onDone = onDone;
  }

  get running(): boolean {
    return this.#running;
  }

  /** Deal from a deck centred on (x, y). With motion reduced there is nothing to show: it finishes at once. */
  start(x: number, y: number): void {
    const fly = ms(DEAL.flyMs);
    this.#running = true;
    if (!fly || !this.#hand.dealing) {
      this.finish();
      return;
    }
    const slots = this.#hand.slots();
    const counts = new Map(this.#seats.map((s) => [s.seat, 0]));
    for (const s of this.#seats) s.setDealt(0);
    for (let i = 0; i < DECK_SHOWN; i++) this.#objs.push(this.#back(x - i, y - i));
    const deck = this.#objs.slice();

    // round-robin from the seat left of the player: 13 to each, the player's in fan order. Scales
    // are relative to the back's resting scale (a 3x texture drawn at play size rests near 0.25).
    const total = slots.length + this.#seats.length * slots.length;
    const mine: Phaser.GameObjects.Image[] = [];
    let landed = 0;
    for (let i = 0; i < total; i++) {
      const seat = (i + 1) % 4;
      const b = this.#back(x - DECK_SHOWN + 1, y - DECK_SHOWN + 1).setAngle(0);
      this.#objs.push(b);
      const s0 = b.scaleX;
      const delay = i * DEAL.staggerMs;
      const angle = (i % 2 ? 1 : -1) * SPIN;
      if (seat === HUMAN) {
        const slot = slots[mine.length];
        if (!slot) continue;
        mine.push(b);
        this.#scene.tweens.add({ targets: b, x: slot.x, y: slot.y, scale: s0 * (CARD_W / PLAY_CARD_W), angle: { from: angle, to: 0 }, delay, duration: fly, ease: EASE.enter, onComplete: () => ++landed === slots.length && this.#flipAll(slots, mine, deck) });
        continue;
      }
      const view = this.#seats.find((s) => s.seat === seat);
      if (!view) continue;
      const face = view.faceCentre();
      this.#scene.tweens.add({
        targets: b,
        x: face.x,
        y: face.y,
        scale: s0 * INTO_PORTRAIT,
        alpha: 0.2,
        angle: angle * 2,
        delay,
        duration: fly,
        ease: EASE.enter,
        onComplete: () => {
          b.setVisible(false);
          const n = (counts.get(seat) ?? 0) + 1;
          counts.set(seat, n);
          view.setDealt(n);
        },
      });
    }
  }

  /** The player's backs (in slot order) flip over left to right; the last one ends the deal. */
  #flipAll(slots: readonly { card: number }[], backs: readonly Phaser.GameObjects.Image[], deck: readonly Phaser.GameObjects.Image[]): void {
    for (const d of deck) this.#scene.tweens.add({ targets: d, alpha: 0, duration: ms(DEAL.flipMs), ease: EASE.fadeOut });
    const half = ms(DEAL.flipMs / 2);
    slots.forEach((slot, k) => {
      const b = backs[k];
      if (!b) return;
      this.#scene.tweens.add({
        targets: b,
        scaleX: 0,
        delay: k * DEAL.flipStaggerMs,
        duration: half,
        ease: EASE.exit,
        onComplete: () => {
          b.setVisible(false);
          this.#hand.flipIn(slot.card);
          if (k === slots.length - 1) this.#scene.time.delayedCall(half, () => this.finish());
        },
      });
    });
  }

  /** End the deal now: every back gone, the hand at rest and live, the counts the game's again. */
  finish(): void {
    if (!this.#running) return;
    this.#running = false;
    const pool = poolOf(this.#scene);
    for (const o of this.#objs) pool.giveBack(o);
    this.#objs = [];
    this.#hand.endDeal();
    for (const s of this.#seats) s.setDealt(null);
    this.#onDone();
  }

  #back(x: number, y: number): Phaser.GameObjects.Image {
    const b = poolOf(this.#scene).takeBack(x, y, PLAY_CARD_W, PLAY_CARD_H);
    this.#layer.add(b);
    return b;
  }
}

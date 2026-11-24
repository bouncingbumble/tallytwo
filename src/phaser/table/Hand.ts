/**
 * The fanned hand (what ui/Hand.tsx did): every card at a whole-px x from fanLayout(), flown in
 * on a fresh deal, lifted when selected, dimmed when it cannot complete a legal move.
 *
 * Order: a fresh deal is sorted low to high, a rank's cards by suit (selectors.sortHand); from
 * then on the player drags cards anywhere, any time, and same-rank neighbours are put back low
 * suit to high (selectors.suitSortRuns). The order is view state per deal, never engine state,
 * and only shrinks as cards are played. A press becomes a drag once the pointer has moved
 * DRAG_THRESHOLD logical px: the card follows the pointer and the others slide to the slot
 * nearest its left edge; a press that never became a drag is a tap and toggles the card.
 * Pointer worldX is already logical px (the camera does the ÷k).
 */
import Phaser from "phaser";
import type { Card } from "../../engine/cards";
import { HUMAN, sortHand, suitSortRuns } from "../../game/selectors";
import type { GameStore, GameView } from "../../game/store";
import { DEAL_STAGGER_MS } from "../../game/timing";
import { CARD_H, CARD_W, SELECT_LIFT, fanLayout } from "../../render/fanLayout";
import type { Rect } from "../../render/tableLayout";
import { CardView } from "../cards";
import { DEAL_IN_MS, SETTLE_MS, SLIDE_MS, ms } from "../motion";

/** A pointer that travels this far (logical px) is dragging, not tapping. */
const DRAG_THRESHOLD = 6;

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

function moveTo(hand: readonly Card[], card: Card, to: number): Card[] {
  const rest = hand.filter((v) => v !== card);
  rest.splice(to, 0, card);
  return rest;
}

interface Drag {
  card: Card;
  pointerId: number;
  /** Where the pointer took hold, relative to the card's left edge. */
  grab: number;
  /** The pointer's x at the press, in fan coordinates. */
  startX: number;
  /** The card's left edge while dragging; null until the press has travelled DRAG_THRESHOLD. */
  x: number | null;
}

export class HandView {
  readonly scene: Phaser.Scene;
  readonly layer: Phaser.GameObjects.Container;
  readonly #fan: Rect;
  readonly #store: GameStore;
  #dealId = -1;
  #order: Card[] = [];
  #count = 0;
  #settle = false;
  #drag: Drag | null = null;
  #views = new Map<Card, CardView>();
  #view: GameView | null = null;
  /** Each card's resting pose, so a repeat update does not restart its tween. */
  #pose = new Map<Card, { x: number; y: number }>();

  constructor(scene: Phaser.Scene, fan: Rect, store: GameStore) {
    this.scene = scene;
    this.#fan = fan;
    this.#store = store;
    this.layer = scene.add.container(fan.x, fan.y + fan.h - CARD_H);
    scene.input.on("pointermove", this.#move, this);
    scene.input.on("pointerup", this.#release, this);
    scene.input.on("pointerupoutside", this.#release, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off("pointermove", this.#move, this);
      scene.input.off("pointerup", this.#release, this);
      scene.input.off("pointerupoutside", this.#release, this);
    });
  }

  /** The cards in fan order as the player has them, filtered to what is still held. */
  #hand(raw: readonly Card[]): Card[] {
    const held = new Set(raw);
    return this.#order.filter((v) => held.has(v));
  }

  update(v: GameView, animate: boolean): void {
    this.#view = v;
    const raw = v.game ? v.game.players[HUMAN].hand : [];
    const fresh = v.dealId !== this.#dealId;
    if (fresh) {
      this.#dealId = v.dealId;
      this.#order = sortHand(raw);
      this.#count = raw.length;
      this.#settle = false;
      this.#drag = null;
      for (const c of this.#views.values()) c.destroy();
      this.#views.clear();
      this.#pose.clear();
    } else if (raw.length !== this.#count) {
      // after a play the remaining cards close the gap at a slower pace
      this.#settle = raw.length < this.#count;
      this.#count = raw.length;
    }
    const held = new Set(raw);
    for (const [card, view] of this.#views) {
      if (!held.has(card)) {
        view.destroy();
        this.#views.delete(card);
        this.#pose.delete(card);
      }
    }
    const hand = this.#hand(raw);
    const dealIn = fresh && animate;
    hand.forEach((card, i) => {
      if (this.#views.has(card)) return;
      const c = new CardView(this.scene, 0, CARD_H / 2, card, CARD_W, CARD_H);
      c.face.setInteractive({ useHandCursor: true });
      c.face.on("pointerdown", (p: Phaser.Input.Pointer) => this.#press(card, p));
      this.layer.add(c);
      this.#views.set(card, c);
      if (dealIn) c.setData("dealIndex", i);
    });
    this.#layout(dealIn);
  }

  /** Place every card: fan slot, lift, dim, drawing order; tween what moved. */
  #layout(dealIn = false): void {
    const v = this.#view;
    if (!v) return;
    const raw = v.game ? v.game.players[HUMAN].hand : [];
    const hand = this.#hand(raw);
    const { xs, x0, step } = fanLayout(hand.length, this.#fan.w);
    const resting = new Map(hand.map((c, i) => [c, i]));
    const d = this.#drag && resting.has(this.#drag.card) ? this.#drag : null;
    const target = d && d.x !== null && step > 0 ? clamp(Math.round((d.x - x0) / step), 0, hand.length - 1) : null;
    const at = target !== null && d ? new Map(moveTo(hand, d.card, target).map((c, i) => [c, i])) : resting;
    const selection = new Set(v.selection);
    const ordered: CardView[] = [];
    for (const [card, view] of this.#views) {
      const i = at.get(card) ?? 0;
      const dragging = d !== null && d.x !== null && d.card === card;
      const selected = selection.has(card);
      const x = dragging && d.x !== null ? d.x : xs[i];
      const y = selected || dragging ? -SELECT_LIFT : 0;
      view.setLook({ selected, dim: v.live !== null && !v.live.has(card), lifted: dragging });
      ordered[i] = view;
      const cx = x + CARD_W / 2;
      const cy = y + CARD_H / 2;
      const pose = this.#pose.get(card);
      if (pose && pose.x === cx && pose.y === cy) continue;
      this.#pose.set(card, { x: cx, y: cy });
      const dealIndex = view.getData("dealIndex") as number | undefined;
      if (dealIn && dealIndex !== undefined) {
        // flies in from the dealer's corner: off up-left, turned and small
        const W = this.scene.scale.gameSize.width / this.scene.cameras.main.zoom;
        view.setPosition(cx - 0.4 * W, cy - 0.38 * 440).setAngle(-40).setScale(0.7).setAlpha(0);
        this.scene.tweens.add({ targets: view, x: cx, y: cy, angle: 0, scale: 1, alpha: 1, delay: dealIndex * DEAL_STAGGER_MS, duration: ms(DEAL_IN_MS), ease: "Sine.Out" });
        view.setData("dealIndex", undefined);
        continue;
      }
      this.scene.tweens.killTweensOf(view);
      view.setAngle(0).setScale(1).setAlpha(1);
      if (dragging) view.setPosition(cx, cy);
      else this.scene.tweens.add({ targets: view, x: cx, y: cy, duration: ms(this.#settle ? SETTLE_MS : SLIDE_MS), ease: "Back.Out", easeParams: [1.2] });
    }
    // drawing order = fan order (so the topmost card under a finger is the one it sees), the dragged card above all
    for (const view of ordered) if (view) this.layer.bringToTop(view);
    if (d && d.x !== null) {
      const dv = this.#views.get(d.card);
      if (dv) this.layer.bringToTop(dv);
    }
  }

  #fanX(p: Phaser.Input.Pointer): number {
    return p.worldX - this.#fan.x;
  }

  #press(card: Card, p: Phaser.Input.Pointer): void {
    if (p.button !== 0) return;
    const v = this.#view;
    if (!v) return;
    this.#settle = false;
    const hand = this.#hand(v.game ? v.game.players[HUMAN].hand : []);
    const { xs } = fanLayout(hand.length, this.#fan.w);
    const px = this.#fanX(p);
    const x = xs[hand.indexOf(card)] ?? 0;
    this.#drag = { card, pointerId: p.id, grab: px - x, startX: px, x: null };
  }

  #move(p: Phaser.Input.Pointer): void {
    const d = this.#drag;
    if (!d || p.id !== d.pointerId || !p.isDown) return;
    const px = this.#fanX(p);
    if (d.x === null && Math.abs(px - d.startX) < DRAG_THRESHOLD) return;
    d.x = Math.round(clamp(px - d.grab, 0, Math.max(0, this.#fan.w - CARD_W)));
    this.#layout();
  }

  #release(p: Phaser.Input.Pointer): void {
    const d = this.#drag;
    if (!d || p.id !== d.pointerId) return;
    this.#drag = null;
    const v = this.#view;
    if (d.x === null) {
      this.#store.toggleCard(d.card); // a tap: the store re-renders us
      return;
    }
    if (v) {
      const hand = this.#hand(v.game ? v.game.players[HUMAN].hand : []);
      const { x0, step } = fanLayout(hand.length, this.#fan.w);
      const target = step > 0 ? clamp(Math.round((d.x - x0) / step), 0, hand.length - 1) : hand.indexOf(d.card);
      const from = hand.indexOf(d.card);
      this.#order = suitSortRuns(moveTo(hand, d.card, target));
      if (target !== from) this.#store.audio.play("reorder");
    }
    this.#layout();
  }

  /** Rects of the cards in fan order, absolute logical px (the e2e probe). */
  probe(): { value: Card; x: number; y: number; w: number; h: number }[] {
    const v = this.#view;
    const hand = this.#hand(v?.game ? v.game.players[HUMAN].hand : []);
    return hand.map((card) => {
      const c = this.#views.get(card)!;
      return { value: card, x: this.layer.x + c.x - CARD_W / 2, y: this.layer.y + c.y - CARD_H / 2, w: CARD_W, h: CARD_H };
    });
  }
}

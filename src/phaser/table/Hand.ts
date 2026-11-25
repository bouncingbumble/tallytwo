/**
 * The fanned hand: every card at a whole-px x from fanLayout(), flown in
 * on a fresh deal, lifted when selected, dimmed when it cannot complete a legal move, glowing
 * amber when the selection is a legal play.
 *
 * Input. One touch zone covers the fan, from above the lifted cards to the bottom edge; the card
 * under a finger comes from the fan's geometry (handGesture.cardIndexAt: each card owns its exposed
 * strip), never from object hits, so thin overlapped strips still register. Every press becomes
 * exactly one gesture (handGesture.resolveGesture):
 *
 *   tap     toggles the card (a card that cannot join a legal play also wobbles "no")
 *   paint   swipe-to-select: the cards between the first and the one under the finger take the
 *           first card's new state, live; sliding back un-paints (paintSelection)
 *   flick   from a selected card, upward: the selection follows the finger and, released far or
 *           fast enough while it is a legal play, is played; otherwise it springs back
 *   hold    held still: the card lifts and grows (and, held longer, grows to a peek), then
 *           follows the finger to rearrange; same-rank neighbours are put back low suit to high
 *
 * The order is view state per deal, never engine state, and only shrinks as cards are played.
 * Pointer worldX/Y are already logical px (the camera does the ÷k).
 */
import Phaser from "phaser";
import type { Card } from "../../engine/cards";
import { HUMAN, canToggle, sortHand, suitSortRuns } from "../../game/selectors";
import type { GameStore, GameView } from "../../game/store";
import { DEAL, EASE, GESTURE } from "../../game/timing";
import { CARD_H, CARD_W, HOLD_SCALE, PEEK_SCALE, SELECT_LIFT, fanLayout } from "../../render/fanLayout";
import { DRAG_THRESHOLD, FLICK_MAX, type Gesture, cardIndexAt, flickPlays, paintSelection, resolveGesture } from "../../render/handGesture";
import { LOGICAL_H, PLAY_CARD_W } from "../../render/scale";
import type { Rect } from "../../render/tableLayout";
import type { CardView } from "../cards";
import { poolOf } from "../cardPool";
import { pop, wobble } from "../fx";
import { SETTLE_MS, SLIDE_MS, ms } from "../motion";
import type { FlyOrigin } from "./Trick";

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

function moveTo(hand: readonly Card[], card: Card, to: number): Card[] {
  const rest = hand.filter((v) => v !== card);
  rest.splice(to, 0, card);
  return rest;
}

/** What the hand reads from Settings, live. */
export interface HandOpts {
  swipe: boolean;
  flick: boolean;
}

/** One press on the hand, from pointerdown to release. */
interface Press {
  pointerId: number;
  card: Card;
  /** The card's index in the fan at the press. */
  idx: number;
  /** Pointer at the press, logical px, and when. */
  x: number;
  y: number;
  t: number;
  onSelected: boolean;
  gesture: Gesture | null;
  /** paint: the selection at the press, the state being painted, the last card index painted. */
  pressSel: readonly Card[];
  paintOn: boolean;
  paintTo: number;
  /** hold: the pointer's offset from the card's left edge, and the card's dragged left edge (null until it moves). */
  grab: number;
  dragX: number | null;
  /** hold: where the hold began, to tell a still hold (peek) from a drag. */
  holdX: number;
  holdY: number;
  peeking: boolean;
  /** flick: how far the selection is pulled (<= 0), and the upward speed at the last move (px/ms). */
  dy: number;
  vy: number;
  lastY: number;
  lastT: number;
  timers: Phaser.Time.TimerEvent[];
}

export class HandView {
  readonly scene: Phaser.Scene;
  readonly layer: Phaser.GameObjects.Container;
  readonly #fan: Rect;
  readonly #store: GameStore;
  readonly #opts: () => HandOpts;
  #dealId = -1;
  #order: Card[] = [];
  #count = 0;
  #settle = false;
  /** A fresh deal is landing: cards hidden at their slots, input off. */
  #dealing = false;
  #press: Press | null = null;
  #views = new Map<Card, CardView>();
  #view: GameView | null = null;
  /** Each card's resting pose, so a repeat update does not restart its tween. */
  #pose = new Map<Card, { x: number; y: number; s: number }>();
  #lastSfx = 0;
  /** Called once per decided gesture (the coach mark goes on the first paint). */
  onGesture: ((g: Gesture) => void) | null = null;

  constructor(scene: Phaser.Scene, fan: Rect, store: GameStore, opts: () => HandOpts) {
    this.scene = scene;
    this.#fan = fan;
    this.#store = store;
    this.#opts = opts;
    const top = fan.y + fan.h - CARD_H;
    this.layer = scene.add.container(fan.x, top);
    // the touch zone: the fan's width, from above a lifted card to the bottom edge
    const zy = top - SELECT_LIFT;
    const zone = scene.add.zone(fan.x, zy, fan.w, LOGICAL_H - zy).setOrigin(0, 0).setInteractive();
    zone.on("pointerdown", this.#down, this);
    scene.input.on("pointermove", this.#move, this);
    scene.input.on("pointerup", this.#up, this);
    scene.input.on("pointerupoutside", this.#up, this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      scene.input.off("pointermove", this.#move, this);
      scene.input.off("pointerup", this.#up, this);
      scene.input.off("pointerupoutside", this.#up, this);
      this.#cancelTimers();
    });
  }

  /** The cards in fan order as the player has them, filtered to what is still held. */
  #hand(raw: readonly Card[] = this.#raw()): Card[] {
    const held = new Set(raw);
    return this.#order.filter((v) => held.has(v));
  }

  #raw(): readonly Card[] {
    const g = this.#view?.game;
    return g ? g.players[HUMAN].hand : [];
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
      this.#endPress();
      for (const c of this.#views.values()) poolOf(this.scene).give(c);
      this.#views.clear();
      this.#pose.clear();
    } else if (raw.length !== this.#count) {
      // after a play the remaining cards close the gap at a slower pace
      this.#settle = raw.length < this.#count;
      this.#count = raw.length;
      if (this.#press && !raw.includes(this.#press.card)) this.#endPress();
    }
    const held = new Set(raw);
    for (const [card, view] of this.#views) {
      if (!held.has(card)) {
        poolOf(this.scene).give(view);
        this.#views.delete(card);
        this.#pose.delete(card);
      }
    }
    const hand = this.#hand(raw);
    // a fresh deal that is to be animated: the cards wait at their slots, hidden, until the deal
    // (table/Deal.ts) lands a back on each and flips it over
    if (fresh) this.#dealing = animate && ms(DEAL.flyMs) > 0;
    hand.forEach((card) => {
      if (this.#views.has(card)) return;
      const c = poolOf(this.scene).take(card, CARD_W, CARD_H, 0, CARD_H / 2);
      if (this.#dealing) c.setVisible(false);
      this.layer.add(c);
      this.#views.set(card, c);
    });
    // not animated (the first render of a rebuild): every card straight to its rest
    this.#layout(!animate);
  }

  /** True while the deal is still landing cards: the hand takes no input. */
  get dealing(): boolean {
    return this.#dealing;
  }

  /** Each card's resting centre in fan order, absolute logical px: where the deal lands the backs. */
  slots(): { card: Card; x: number; y: number }[] {
    return this.#hand().map((card) => {
      const c = this.#views.get(card)!;
      return { card, x: this.layer.x + c.x, y: this.layer.y + c.y };
    });
  }

  /** The deal flips card `card` over: its face grows out of the edge the back shrank into. */
  flipIn(card: Card): void {
    const c = this.#views.get(card);
    if (!c) return;
    c.setVisible(true).setScale(0, 1);
    this.scene.tweens.add({ targets: c, scaleX: 1, duration: ms(DEAL.flipMs / 2), ease: EASE.enter });
  }

  /** The deal is over (or skipped): every card showing, at rest, and the hand takes input. */
  endDeal(): void {
    this.#dealing = false;
    for (const c of this.#views.values()) {
      if (c.scaleX !== 1 || !c.visible) {
        this.scene.tweens.killTweensOf(c);
        c.setVisible(true).setScale(1);
      }
    }
  }

  /** Where card `card` is now, for the trick to fly it from (absolute logical px, scale at play size). */
  poseOf(card: Card): FlyOrigin | null {
    const c = this.#views.get(card);
    if (!c) return null;
    return { x: this.layer.x + c.x, y: this.layer.y + c.y, scale: (c.scaleX * CARD_W) / PLAY_CARD_W };
  }

  /** Place every card: fan slot, lift, scale, look, drawing order; tween what moved. */
  #layout(instant = false): void {
    const v = this.#view;
    if (!v) return;
    const hand = this.#hand();
    const { xs, x0, step } = fanLayout(hand.length, this.#fan.w);
    const p = this.#press && hand.includes(this.#press.card) ? this.#press : null;
    const held = p?.gesture === "hold" ? p : null;
    const flick = p?.gesture === "flick" ? p : null;
    // a held card being dragged: the others make room at the slot nearest its left edge
    const target = held && held.dragX !== null && step > 0 ? clamp(Math.round((held.dragX - x0) / step), 0, hand.length - 1) : null;
    const at = new Map((target !== null && held ? moveTo(hand, held.card, target) : hand).map((c, i) => [c, i]));
    const selection = new Set(v.selection);
    const playable = v.exact !== null;
    const ordered: CardView[] = [];
    for (const [card, view] of this.#views) {
      const i = at.get(card) ?? 0;
      const selected = selection.has(card);
      const isHeld = held?.card === card;
      const pulled = flick !== null && selected;
      view.setLook({ selected, dim: v.live !== null && !v.live.has(card), lifted: isHeld || pulled, playable: playable && selected });
      ordered[i] = view;
      const t = this.#targetOf(xs[i], selected, isHeld ? held : null, pulled ? flick : null);
      const pose = this.#pose.get(card);
      if (pose && pose.x === t.x && pose.y === t.y && pose.s === t.s) continue;
      this.#pose.set(card, t);
      if (this.#dealing || instant) {
        this.scene.tweens.killTweensOf(view);
        view.setPosition(t.x, t.y).setScale(t.s); // waiting for the deal (at rest, hidden), or a rebuild
        continue;
      }
      this.#place(view, t.x, t.y, t.s, t.direct);
    }
    // drawing order = fan order; a held card, or the pulled selection, above all
    for (const view of ordered) if (view) this.layer.bringToTop(view);
    if (held) {
      const hv = this.#views.get(held.card);
      if (hv) this.layer.bringToTop(hv);
    }
    if (flick) for (const c of v.selection) this.#topOf(c);
  }

  /**
   * Where a card rests (its centre, logical px in the layer) and at what scale: its fan slot,
   * lifted when selected; a held card at the finger, grown (more while peeking); the pulled
   * selection raised by the flick. `direct`: follow the finger with no tween.
   */
  #targetOf(slotX: number, selected: boolean, held: Press | null, flick: Press | null): { x: number; y: number; s: number; direct: boolean } {
    const dragged = held !== null && held.dragX !== null;
    const x = held && held.dragX !== null ? held.dragX : slotX;
    let y = selected || held ? -SELECT_LIFT : 0;
    if (held?.peeking) y -= Math.round((CARD_H * (PEEK_SCALE - 1)) / 2);
    if (flick) y += flick.dy;
    let s = 1;
    if (held) s = held.peeking ? PEEK_SCALE : HOLD_SCALE;
    return { x: x + CARD_W / 2, y: y + CARD_H / 2, s, direct: dragged || flick !== null };
  }

  #topOf(card: Card): void {
    const view = this.#views.get(card);
    if (view) this.layer.bringToTop(view);
  }

  /** Move one card to its pose: under the finger at once, else a slide (a settle after a play). */
  #place(view: CardView, cx: number, cy: number, s: number, direct: boolean): void {
    this.scene.tweens.killTweensOf(view);
    view.setAngle(0).setAlpha(1);
    if (direct) {
      view.setPosition(cx, cy);
      if (view.scale !== s) this.scene.tweens.add({ targets: view, scale: s, duration: ms(SLIDE_MS), ease: EASE.enter });
      return;
    }
    // the quick slide keeps a little overshoot; the slow settle after a play
    // glides in without one (a 640-ms overshoot reads as a wobble)
    const d = ms(this.#settle ? SETTLE_MS : SLIDE_MS);
    if (!d) {
      view.setPosition(cx, cy).setScale(s);
      return;
    }
    this.scene.tweens.add({ targets: view, x: cx, y: cy, scale: s, duration: d, ease: this.#settle ? EASE.settle : EASE.land, easeParams: this.#settle ? undefined : [1.2] });
  }

  /* ---------------- input ---------------- */

  #fanX(p: Phaser.Input.Pointer): number {
    return p.worldX - this.#fan.x;
  }

  #down(p: Phaser.Input.Pointer): void {
    if (p.button !== 0 || this.#press || this.#dealing) return; // a tap during the deal finishes it (TableScene) instead
    const v = this.#view;
    if (!v) return;
    const hand = this.#hand();
    const f = fanLayout(hand.length, this.#fan.w);
    const idx = cardIndexAt(this.#fanX(p), f);
    if (idx < 0) return;
    const card = hand[idx];
    this.#settle = false;
    const now = performance.now();
    const press: Press = {
      pointerId: p.id,
      card,
      idx,
      x: p.worldX,
      y: p.worldY,
      t: now,
      onSelected: v.selection.includes(card),
      gesture: null,
      pressSel: v.selection,
      paintOn: true,
      paintTo: idx,
      grab: this.#fanX(p) - f.xs[idx],
      dragX: null,
      holdX: p.worldX,
      holdY: p.worldY,
      peeking: false,
      dy: 0,
      vy: 0,
      lastY: p.worldY,
      lastT: now,
      timers: [],
    };
    this.#press = press;
    // held still: decided at the hold time even if the pointer never moves
    press.timers.push(this.scene.time.delayedCall(GESTURE.holdMs, () => this.#decide(p.worldX, p.worldY, p)));
  }

  /** Run the arbitration; the first gesture it names is final. */
  #decide(x: number, y: number, p: Phaser.Input.Pointer): void {
    const press = this.#press;
    if (!press || press.gesture || p.id !== press.pointerId) return;
    const o = this.#opts();
    const g = resolveGesture(press, x, y, performance.now(), { swipe: o.swipe, flick: o.flick, holdMs: GESTURE.holdMs });
    if (!g) return;
    press.gesture = g;
    this.onGesture?.(g);
    if (g === "paint") {
      press.paintOn = !press.onSelected;
      this.#paint(press, press.idx);
    } else if (g === "hold") {
      press.holdX = x;
      press.holdY = y;
      // a hold that began by moving (Swipe to select off) drags at once; a still one may peek
      if (Math.hypot(x - press.x, y - press.y) < DRAG_THRESHOLD) press.timers.push(this.scene.time.delayedCall(GESTURE.peekMs, () => this.#peek(press)));
      this.#store.audio.play("select");
      this.#layout();
    } else this.#layout();
  }

  #move(p: Phaser.Input.Pointer): void {
    const press = this.#press;
    if (!press || p.id !== press.pointerId || !p.isDown) return;
    if (!press.gesture) this.#decide(p.worldX, p.worldY, p);
    switch (press.gesture) {
      case "paint":
        this.#paint(press, cardIndexAt(this.#fanX(p), fanLayout(this.#hand().length, this.#fan.w)));
        break;
      case "hold":
        this.#dragHeld(press, p);
        break;
      case "flick":
        this.#pull(press, p);
        break;
      default:
        break;
    }
  }

  #up(p: Phaser.Input.Pointer): void {
    const press = this.#press;
    if (!press || p.id !== press.pointerId) return;
    const v = this.#view;
    this.#endPress();
    if (!v) return;
    switch (press.gesture) {
      case null:
        this.#tap(press.card, v);
        break;
      case "hold":
        this.#drop(press);
        break;
      case "flick":
        this.#release(press, v);
        break;
      default:
        break; // a paint is already committed
    }
    this.#layout();
  }

  #cancelTimers(): void {
    for (const t of this.#press?.timers ?? []) t.remove(false);
  }

  #endPress(): void {
    this.#cancelTimers();
    this.#press = null;
  }

  /* ---------------- gestures ---------------- */

  #tap(card: Card, v: GameView): void {
    const misfit = v.live !== null && !v.live.has(card) && !v.selection.includes(card);
    this.#store.toggleCard(card); // the store re-renders us
    const view = this.#views.get(card);
    if (misfit && view && canToggle(v.game)) wobble(this.scene, view); // it cannot join a legal play with what is chosen
  }

  /** Swipe-to-select: the range from the first card to card `to` takes the painted state, live. */
  #paint(press: Press, to: number): void {
    const v = this.#view;
    if (!v || to < 0 || !canToggle(v.game)) return;
    if (to === press.paintTo && v.selection !== press.pressSel) return;
    press.paintTo = to;
    const hand = this.#hand();
    const next = paintSelection(press.pressSel, hand, press.idx, to, press.paintOn);
    const before = new Set(v.selection);
    const after = new Set(next);
    const changed = hand.filter((c) => before.has(c) !== after.has(c));
    if (!changed.length) return;
    this.#store.setSelection(next);
    for (const c of changed) {
      const view = this.#views.get(c);
      if (view) pop(this.scene, view, 1.06, ms(GESTURE.paintSfxMs * 3));
    }
    const now = performance.now();
    if (now - this.#lastSfx >= GESTURE.paintSfxMs) {
      this.#lastSfx = now;
      this.#store.audio.play(after.has(changed[0]) ? "select" : "deselect");
    }
  }

  /** Hold-to-rearrange: the held card follows the finger; a still hold grows to a peek, which a move ends. */
  #dragHeld(press: Press, p: Phaser.Input.Pointer): void {
    if (press.dragX === null && Math.hypot(p.worldX - press.holdX, p.worldY - press.holdY) < DRAG_THRESHOLD) return;
    press.peeking = false;
    press.dragX = Math.round(clamp(this.#fanX(p) - press.grab, 0, Math.max(0, this.#fan.w - CARD_W)));
    this.#layout();
  }

  #peek(press: Press): void {
    if (this.#press !== press || press.dragX !== null) return;
    press.peeking = true;
    this.#layout();
  }

  /** Drop a held card: put it in the slot nearest its left edge (same-rank runs tidied), or just set it down. */
  #drop(press: Press): void {
    if (press.dragX === null) return;
    const hand = this.#hand();
    const { x0, step } = fanLayout(hand.length, this.#fan.w);
    const from = hand.indexOf(press.card);
    const target = step > 0 ? clamp(Math.round((press.dragX - x0) / step), 0, hand.length - 1) : from;
    this.#order = suitSortRuns(moveTo(hand, press.card, target));
    if (target !== from) this.#store.audio.play("reorder");
  }

  /** Flick-to-play: the selection follows the finger upward, never down, never off the felt. */
  #pull(press: Press, p: Phaser.Input.Pointer): void {
    const now = performance.now();
    const dt = Math.max(1, now - press.lastT);
    press.vy = (p.worldY - press.lastY) / dt;
    press.lastY = p.worldY;
    press.lastT = now;
    press.dy = Math.round(clamp(p.worldY - press.y, -FLICK_MAX, 0));
    this.#layout();
  }

  /** Released: a legal selection pulled far or fast enough is played; anything else springs back. */
  #release(press: Press, v: GameView): void {
    const exact = v.exact;
    if (exact && flickPlays(press.dy, press.vy)) {
      this.#store.act({ type: "PLAY", player: HUMAN, cards: exact.cards }); // the trick flies them from here (poseOf)
      return;
    }
    const pulledFar = flickPlays(press.dy, press.vy);
    press.dy = 0;
    if (pulledFar && !exact) for (const c of v.selection) {
      const view = this.#views.get(c);
      if (view) wobble(this.scene, view); // not a play: say no as it goes back
    }
  }

  /** Rects of the cards in fan order, absolute logical px (the e2e probe). */
  probe(): { value: Card; x: number; y: number; w: number; h: number; dim: boolean; faceAlpha: number }[] {
    return this.#hand().map((card) => {
      const c = this.#views.get(card)!;
      const { dim, faceAlpha } = c.look;
      return { value: card, x: this.layer.x + c.x - CARD_W / 2, y: this.layer.y + c.y - CARD_H / 2, w: CARD_W, h: CARD_H, dim, faceAlpha };
    });
  }
}

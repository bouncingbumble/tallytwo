/**
 * The trick on the felt (selectors.trickPlays): each seat's most recent play since the trick
 * began, replaced when that seat plays again and cleared when the trick clears, staggered in
 * three rows (render/tableLayout.ts). The play to beat is ringed in amber and on top; earlier
 * ones recede. Cards are 72x96 at whole-px x, resting at angle 0.
 *
 * A new play flies in (timing.PLAY_FLY_MS): each card leaves from behind its player's portrait,
 * small and tumbling, the cards meet as a stack in the middle of where the play will lie, then
 * spread into place with a little overshoot. The badges are drawn above this layer, so a card is
 * hidden until it clears its portrait's frame.
 *
 * The human's cards leave from exactly where they were in the hand, at their hand size, already
 * showing (docs/MOBILE_UX_PLAN.md §4.5): the hand drops its copies the same frame, so the card
 * the player tapped or flicked is the one that lands. They fly in a layer above the hand and drop
 * into the trick's layer once they land.
 */
import Phaser from "phaser";
import { emptyFeltText, trickPlays } from "../../game/selectors";
import { EASE, PLAY_FLY_MS, PLAY_FLY_STAGGER_MS } from "../../game/timing";
import type { GameView } from "../../game/store";
import { PLAY_CARD_H, PLAY_CARD_W } from "../../render/scale";
import { type Rect, SLOT_ALIGN, type TableLayout, pileLayout } from "../../render/tableLayout";
import { CardView } from "../cards";
import { ms } from "../motion";
import { text } from "../paint";
import { CSS, FS_BODY } from "../theme";

/** Top row, middle row (left and right), bottom row: the drawing order. */
const SEATS = [2, 1, 3, 0];
/** With no hand pose to start from (a rebuild), the human's cards start this far below their slot's top, inside the hand strip. */
const HAND_DROP = PLAY_CARD_H + 70;

/** Where a card of a play starts its flight: a centre in logical px and, for a card leaving the hand, its scale there. */
export interface FlyOrigin {
  x: number;
  y: number;
  /** Set when the card is already on screen at this size (a hand card): it starts visible, unturned. */
  scale?: number;
}

interface Group {
  key: string;
  cards: CardView[];
  container: Phaser.GameObjects.Container;
}

export class TrickView {
  readonly scene: Phaser.Scene;
  readonly layer: Phaser.GameObjects.Container;
  readonly #t: TableLayout;
  readonly #origin: (seat: number, card: number) => FlyOrigin | null;
  #groups = new Map<number, Group>();
  #empty: Phaser.GameObjects.Text;
  /** Above the hand: the human's play flies here, then drops into `layer`. */
  #over: Phaser.GameObjects.Container | null = null;
  /** The seat whose play is the one to beat (drawn on top), or null. */
  #latest: number | null = null;

  constructor(scene: Phaser.Scene, t: TableLayout, origin: (seat: number, card: number) => FlyOrigin | null) {
    this.scene = scene;
    this.#t = t;
    this.#origin = origin;
    this.layer = scene.add.container(0, 0);
    this.#empty = text(scene, t.plays.x + t.plays.w / 2, t.plays.y + t.plays.h / 2, "", { size: FS_BODY, color: CSS.feltText, align: "center", wrap: Math.max(40, t.plays.w - 48) }).setOrigin(0.5);
    this.layer.add(this.#empty);
  }

  /** Give the trick a layer drawn above the hand, for the human's cards in flight. */
  setOverLayer(c: Phaser.GameObjects.Container): void {
    this.#over = c;
  }

  /** Bring the felt in line with the view; `animate` false on a rebuild (a resize), so nothing flies twice. */
  update(v: GameView, animate: boolean): void {
    const g = v.game;
    if (!g) return;
    const plays = trickPlays(g);
    const bySeat = new Map(plays.map((p) => [p.seat, p]));
    for (const seat of SEATS) {
      const play = bySeat.get(seat);
      const key = play ? `${v.dealId}-${play.at}` : "";
      const old = this.#groups.get(seat);
      if (old && old.key !== key) {
        old.container.destroy();
        this.#groups.delete(seat);
      }
      if (play && !this.#groups.has(seat)) this.#groups.set(seat, this.#make(seat, key, play.cards, this.#t.slots[seat], animate));
    }
    // the latest lit, the others receding: by tint, not group alpha, since a play's cards overlap (F1)
    this.#latest = g.lastPlay !== null ? g.lastBy : null;
    for (const seat of SEATS) {
      const grp = this.#groups.get(seat);
      if (!grp) continue;
      const latest = seat === this.#latest;
      for (const c of grp.cards) c.setLook({ lit: latest, recede: !latest });
    }
    this.#restack();
    this.#empty.setText(plays.length === 0 ? emptyFeltText(g) : "").setVisible(plays.length === 0);
  }

  #make(seat: number, key: string, cards: readonly number[], slot: Rect, animate: boolean): Group {
    const scene = this.scene;
    const container = scene.add.container(slot.x, slot.y + 1);
    const { xs, cx } = pileLayout(cards.length, slot.w, SLOT_ALIGN[seat] ?? "center");
    const hw = PLAY_CARD_W / 2;
    const hh = PLAY_CARD_H / 2;
    const fly = animate ? ms(PLAY_FLY_MS) : 0;
    const origins = cards.map((v) => this.#origin(seat, v));
    // a play leaving the hand flies above it, then drops into the trick's layer when it lands
    const over = this.#over;
    const fromHand = fly > 0 && over !== null && origins.some((o) => o?.scale !== undefined);
    (fromHand && over ? over : this.layer).add(container);
    let landed = 0;
    const land = () => {
      if (++landed < cards.length || !fromHand || !over || !container.active) return;
      over.remove(container);
      this.layer.add(container);
      this.#restack();
    };
    const views = cards.map((v, i) => {
      const c = new CardView(scene, xs[i] + hw, hh, v, PLAY_CARD_W, PLAY_CARD_H);
      container.add(c);
      if (!fly) return c;
      const rot = (i % 2 ? 1 : -1) * (3 + i * 1.5);
      const delay = i * PLAY_FLY_STAGGER_MS;
      this.#startPose(c, origins[i], slot, rot, delay, fly);
      scene.tweens.chain({
        targets: c,
        tweens: [
          { x: cx + hw, y: hh, scale: 1.04, angle: rot, delay, duration: fly * 0.58, ease: EASE.enter },
          { x: xs[i] + hw, scale: 1, angle: 0, duration: fly * 0.42, ease: EASE.land, onComplete: land },
        ],
      });
      return c;
    });
    return { key, cards: views, container };
  }

  /**
   * Put a card where its flight starts. From the hand: where it is, as big as it is there, already
   * showing. From behind a portrait (or, with no hand pose, low in the hand strip): small, turned,
   * fading in.
   */
  #startPose(c: CardView, o: FlyOrigin | null, slot: Rect, rot: number, delay: number, fly: number): void {
    if (o?.scale !== undefined) {
      c.setPosition(o.x - slot.x, o.y - slot.y - 1).setScale(o.scale).setAngle(0).setAlpha(1);
      return;
    }
    const hw = PLAY_CARD_W / 2;
    const hh = PLAY_CARD_H / 2;
    const ox = o ? Math.round(o.x - slot.x - hw) : Math.round(slot.w / 2 - hw);
    const oy = o ? Math.round(o.y - slot.y - hh - 1) : HAND_DROP;
    c.setPosition(ox + hw, oy + hh).setScale(0.6).setAngle(rot * -6).setAlpha(0);
    this.scene.tweens.add({ targets: c, alpha: 1, delay, duration: fly * 0.08 });
  }

  /** Draw order in the trick's layer: the rows, then the latest play on top (a play still in flight above the hand is left there). */
  #restack(): void {
    const inLayer = (seat: number | null) => {
      const grp = seat === null ? undefined : this.#groups.get(seat);
      return grp && grp.container.parentContainer === this.layer ? grp.container : null;
    };
    for (const seat of SEATS) {
      const c = inLayer(seat);
      if (c) this.layer.bringToTop(c);
    }
    const top = inLayer(this.#latest);
    if (top) this.layer.bringToTop(top);
  }
}

/**
 * The trick on the felt (selectors.trickPlays): each seat's most recent play since the trick
 * began, replaced when that seat plays again and cleared when the trick clears, staggered in
 * three rows (render/tableLayout.ts). The play to beat is ringed in amber and on top; earlier
 * ones recede. Cards are 72x96 at whole-px x, resting at angle 0.
 *
 * A new play flies in (timing.PLAY_FLY_MS): each card leaves from behind its player's portrait
 * (from behind the hand strip for the human), small and tumbling, the cards meet as a stack in
 * the middle of where the play will lie, then spread into place with a little overshoot. The
 * badges are drawn above this layer, so a card is hidden until it clears its portrait's frame.
 */
import Phaser from "phaser";
import { emptyFeltText, trickPlays } from "../../game/selectors";
import { PLAY_FLY_MS, PLAY_FLY_STAGGER_MS } from "../../game/timing";
import type { GameView } from "../../game/store";
import { PLAY_CARD_H, PLAY_CARD_W } from "../../render/scale";
import { type Rect, SLOT_ALIGN, type TableLayout, pileLayout } from "../../render/tableLayout";
import { CardView } from "../cards";
import { ms } from "../motion";
import { text } from "../paint";
import { CSS, FS_BODY } from "../theme";

/** Top row, middle row (left and right), bottom row: the drawing order. */
const SEATS = [2, 1, 3, 0];
/** The human's cards start this far below their slot's top, inside the hand strip. */
const HAND_DROP = PLAY_CARD_H + 70;

interface Group {
  key: string;
  cards: CardView[];
  container: Phaser.GameObjects.Container;
}

export class TrickView {
  readonly scene: Phaser.Scene;
  readonly layer: Phaser.GameObjects.Container;
  readonly #t: TableLayout;
  readonly #origin: (seat: number) => { x: number; y: number } | null;
  #groups = new Map<number, Group>();
  #empty: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, t: TableLayout, origin: (seat: number) => { x: number; y: number } | null) {
    this.scene = scene;
    this.#t = t;
    this.#origin = origin;
    this.layer = scene.add.container(0, 0);
    this.#empty = text(scene, t.plays.x + t.plays.w / 2, t.plays.y + t.plays.h / 2, "", { size: FS_BODY, color: CSS.feltText, align: "center", wrap: Math.max(40, t.plays.w - 48) }).setOrigin(0.5);
    this.layer.add(this.#empty);
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
    // draw order: the rows, then the latest play on top; the latest lit, the others receding
    for (const seat of SEATS) {
      const grp = this.#groups.get(seat);
      if (!grp) continue;
      const latest = g.lastPlay !== null && g.lastBy === seat;
      // receding by tint, not group alpha: a play's cards overlap, so alpha would show each through the next (F1)
      for (const c of grp.cards) c.setLook({ lit: latest, recede: !latest });
      if (latest) this.layer.bringToTop(grp.container);
    }
    this.#empty.setText(plays.length === 0 ? emptyFeltText(g) : "").setVisible(plays.length === 0);
  }

  #make(seat: number, key: string, cards: readonly number[], slot: Rect, animate: boolean): Group {
    const scene = this.scene;
    const container = scene.add.container(slot.x, slot.y + 1);
    this.layer.add(container);
    const { xs, cx } = pileLayout(cards.length, slot.w, SLOT_ALIGN[seat] ?? "center");
    const hw = PLAY_CARD_W / 2;
    const hh = PLAY_CARD_H / 2;
    // where the cards start, in the slot: centred on the portrait, or low in the hand strip
    const o = this.#origin(seat);
    const ox = o ? Math.round(o.x - slot.x - hw) : Math.round(slot.w / 2 - hw);
    const oy = o ? Math.round(o.y - slot.y - hh - 1) : HAND_DROP;
    const views = cards.map((v, i) => {
      const c = new CardView(scene, xs[i] + hw, hh, v, PLAY_CARD_W, PLAY_CARD_H);
      container.add(c);
      const fly = ms(PLAY_FLY_MS);
      if (animate && fly) {
        const rot = (i % 2 ? 1 : -1) * (3 + i * 1.5);
        const delay = i * PLAY_FLY_STAGGER_MS;
        c.setPosition(ox + hw, oy + hh).setScale(0.6).setAngle(rot * -6).setAlpha(0);
        scene.tweens.add({ targets: c, alpha: 1, delay, duration: fly * 0.08 });
        scene.tweens.chain({
          targets: c,
          tweens: [
            { x: cx + hw, y: hh, scale: 1.04, angle: rot, delay, duration: fly * 0.58, ease: "Cubic.Out" },
            { x: xs[i] + hw, scale: 1, angle: 0, duration: fly * 0.42, ease: "Back.Out" },
          ],
        });
      }
      return c;
    });
    return { key, cards: views, container };
  }
}

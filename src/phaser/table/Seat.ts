/**
 * One opponent's badge on the felt (P:846-867): portrait, name, back chips and count, the running
 * tally, the "passed" stamp, and what they just said as a speech bubble over the info column
 * pointing at the portrait. Active / low / out change the ring, the count's colour and the alpha.
 * The portrait comes from portraitFor() in selectors.ts, so this file never reaches into ai/.
 */
import Phaser from "phaser";
import type { GameState } from "../../engine/state";
import { COPY } from "../../game/copy";
import { portraitFor } from "../../game/selectors";
import type { Bark } from "../../game/store";
import { FACE_H, FACE_W, type Rect } from "../../render/tableLayout";
import { BARK_ANIM_MS, ms } from "../motion";
import { insetStroke, maxLines, painted, roundRect, text, vgrad } from "../paint";
import { CSS, FS_EM, FS_MIN } from "../theme";

/** "+3" / "0" / "-7", as the top bar and the poster show a tally. */
export const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

/** At most this many back chips are drawn, whatever the count says (P:859). */
const MAX_CHIPS = 5;
/** Portrait 82 px + gap 6 px + padding 4 px: where the info column (and the bark) starts. */
const INFO_X = 4 + FACE_W + 6;

export class SeatView extends Phaser.GameObjects.Container {
  readonly seat: number;
  readonly r: Rect;
  #active: Phaser.GameObjects.Image;
  #face: Phaser.GameObjects.Image | null = null;
  #faceKey: string | null = null;
  #name: Phaser.GameObjects.Text;
  #chips: Phaser.GameObjects.Graphics;
  #count: Phaser.GameObjects.Text;
  #tallyLabel: Phaser.GameObjects.Text;
  #tally: Phaser.GameObjects.Text;
  #passed: Phaser.GameObjects.Container;
  #info: Phaser.GameObjects.Container;
  #barkId = 0;
  #bark: Phaser.GameObjects.Container | null = null;
  #nameText = "";

  constructor(scene: Phaser.Scene, seat: number, r: Rect) {
    super(scene, r.x, r.y);
    this.seat = seat;
    this.r = r;
    const { w, h } = r;
    const bg = painted(scene, "badge", 0, 0, w, h, (ctx, bw, bh) => {
      ctx.fillStyle = vgrad(ctx, 0, bh, "rgba(62, 39, 21, 0.9)", "rgba(43, 26, 12, 0.92)");
      roundRect(ctx, 0, 0, bw, bh, 5);
      ctx.fill();
      insetStroke(ctx, bw, bh, 5, 2, CSS.black);
    });
    this.#active = painted(
      scene,
      "badge-active",
      0,
      0,
      w,
      h,
      (ctx, bw, bh) => {
        ctx.save();
        ctx.shadowColor = "rgba(232, 163, 61, 0.35)";
        ctx.shadowBlur = 14;
        ctx.strokeStyle = "rgba(232, 163, 61, 0.35)";
        ctx.lineWidth = 2;
        roundRect(ctx, 0, 0, bw, bh, 5);
        ctx.stroke();
        ctx.restore();
        insetStroke(ctx, bw, bh, 5, 2, CSS.amber);
      },
      14,
    ).setVisible(false);
    const infoW = w - INFO_X - 4;
    this.#name = text(scene, 0, 0, "", { size: FS_MIN, color: CSS.dust, wrap: infoW, lineHeight: 1.15 });
    this.#chips = scene.add.graphics();
    this.#count = text(scene, 0, 0, "", { size: FS_EM, color: CSS.amber, bold: true });
    this.#tallyLabel = text(scene, 0, 0, COPY.seat.tally + " ", { size: FS_MIN, color: CSS.dust });
    this.#tally = text(scene, 0, 0, "", { size: FS_MIN, color: CSS.bone, bold: true });
    this.#info = scene.add.container(INFO_X, 0, [this.#name, this.#chips, this.#count, this.#tallyLabel, this.#tally]);
    // "passed" is stamped across the foot of the portrait, clear of the info column
    const stamp = text(scene, 37, 0, COPY.seat.passed, { size: FS_MIN, align: "center" }).setOrigin(0.5, 0);
    const sh = Math.ceil(stamp.height);
    const stampBg = painted(scene, "passed", 0, 0, 74, sh, (ctx, bw, bh) => {
      ctx.fillStyle = "rgba(18, 10, 4, 0.92)";
      roundRect(ctx, 0, 0, bw, bh, 3);
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.stroke();
      insetStroke(ctx, bw, bh, 3, 1, "rgba(201, 176, 138, 0.35)", 1);
    });
    this.#passed = scene.add.container(8, h - 6 - sh, [stampBg, stamp]).setVisible(false);
    this.add([bg, this.#active, this.#info, this.#passed]);
    scene.add.existing(this);
  }

  update(g: GameState, barks: readonly Bark[]): void {
    const p = g.players[this.seat];
    const n = p.hand.length;
    const key = portraitFor(p);
    if (key !== this.#faceKey) {
      this.#face?.destroy();
      this.#face = key ? this.scene.add.image(4, 1, key).setOrigin(0, 0).setDisplaySize(FACE_W, FACE_H) : null;
      if (this.#face) this.addAt(this.#face, 2);
      this.#faceKey = key;
    }
    this.#active.setVisible(g.turn === this.seat && g.phase === "playing");
    this.setAlpha(n === 0 ? 0.55 : 1);

    // the info column: name (two lines where the badge is narrow), chips and count, tally; centred
    if (p.name !== this.#nameText) {
      this.#nameText = p.name;
      this.#name.setText(p.name);
      maxLines(this.#name, 2);
    }
    const nameH = Math.round(this.#name.height) - 4;
    const rowY = nameH + 4;
    const chips = this.#chips;
    chips.clear();
    const shown = Math.min(MAX_CHIPS, n);
    for (let i = 0; i < shown; i++) {
      const x = i * 4;
      chips.fillStyle(0x120a04, 1);
      chips.fillRect(x - 1, rowY + 5, 10, 12);
      chips.fillStyle(0x7a2b24, 1);
      chips.fillRect(x, rowY + 6, 8, 10);
      chips.fillStyle(0x5e1f1a, 1);
      for (let s = 0; s < 4; s++) chips.fillRect(x + s * 2, rowY + 6 + ((s * 3) % 10), 1, 3);
    }
    const chipsW = shown ? 8 + (shown - 1) * 4 + 4 : 0;
    this.#count.setText(String(n)).setColor(n <= 3 ? CSS.low : CSS.amber);
    this.#count.setPosition(chipsW, rowY);
    const rowH = Math.round(this.#count.height) - 4;
    const tallyY = rowY + rowH + 4;
    this.#tallyLabel.setPosition(0, tallyY);
    this.#tally.setText(signed(g.totals[this.seat])).setPosition(Math.round(this.#tallyLabel.width) - 2, tallyY);
    const total = tallyY + Math.round(this.#tallyLabel.height) - 4;
    this.#info.setY(Math.round((this.r.h - total) / 2) - 2);

    this.#passed.setVisible(p.passed && g.lastPlay !== null);

    // the latest line only: a new bark replaces the last one on the badge
    const said = barks.filter((b) => b.seat === this.seat).at(-1);
    if (!said) {
      this.#bark?.destroy();
      this.#bark = null;
      this.#barkId = 0;
    } else if (said.id !== this.#barkId) {
      this.#barkId = said.id;
      this.#bark?.destroy();
      this.#bark = this.#makeBark(said.text);
    }
  }

  /** The speech bubble: bone, 15-px ink, a tail pointing back at the portrait; fades in and out in place. */
  #makeBark(s: string): Phaser.GameObjects.Container {
    const scene = this.scene;
    const w = this.r.w - (INFO_X + 2) - 6;
    const t = text(scene, w / 2, 0, s, { size: FS_MIN, color: CSS.barkInk, align: "center", wrap: w - 16, lineHeight: 1.2 }).setOrigin(0.5, 0);
    maxLines(t, 4);
    const h = Math.round(t.height) - 4 + 12;
    t.setY(4);
    const bubble = painted(
      scene,
      "bark",
      0,
      0,
      w,
      h,
      (ctx, bw, bh) => {
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 2;
        ctx.fillStyle = CSS.bone;
        roundRect(ctx, 0, 0, bw, bh, 6);
        ctx.fill();
        ctx.restore();
        ctx.strokeStyle = CSS.black;
        ctx.lineWidth = 1;
        roundRect(ctx, -0.5, -0.5, bw + 1, bh + 1, 6.5);
        ctx.stroke();
        ctx.fillStyle = CSS.bone;
        ctx.beginPath();
        ctx.moveTo(0.5, bh / 2 - 6);
        ctx.lineTo(-7, bh / 2);
        ctx.lineTo(0.5, bh / 2 + 6);
        ctx.closePath();
        ctx.fill();
      },
      10,
    );
    const c = scene.add.container(INFO_X + 2 + w / 2, this.r.h / 2, [bubble, t]);
    bubble.setPosition(-w / 2 - 10, -h / 2 - 10);
    t.setPosition(0, -h / 2 + 4);
    this.add(c);
    const run = ms(BARK_ANIM_MS);
    if (run) {
      c.setAlpha(0).setScale(0.92);
      scene.tweens.add({ targets: c, alpha: 1, scale: 1, duration: run * 0.1, ease: "Sine.Out" });
      scene.tweens.add({ targets: c, alpha: 0, delay: run * 0.85, duration: run * 0.15, ease: "Sine.In" });
    }
    return c;
  }

  /** The portrait's centre, absolute logical px: where this seat's plays fly from. */
  faceCentre(): { x: number; y: number } {
    return { x: this.r.x + 4 + FACE_W / 2, y: this.r.y + 1 + FACE_H / 2 };
  }
}

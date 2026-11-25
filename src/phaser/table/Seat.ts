/**
 * One opponent's chip on the felt: portrait, name, back chips and count, the running tally, the
 * "passed" stamp, and what they just said as a speech bubble pointing at the portrait: portrait
 * on the left, the name over the count and tally. Active / low / out change the ring, the count's
 * colour and the alpha.
 * The portrait comes from portraitFor() in selectors.ts, so this file never reaches into ai/.
 *
 * Motion that explains state, all one-shot except the thinking dots, which step on a timer so a
 * long think draws a few frames a second, not every frame:
 * - the ring flares in when the seat's turn starts, and stepping dots say it is thinking;
 * - the portrait lunges toward the felt as the seat plays, and pops when it takes a trick;
 * - "passed" drops in like a stamp; the count ticks with a pop, wobbles as it reaches 3;
 * - at one card a red LAST CARD tag hangs on the portrait (words as well as colour).
 */
import Phaser from "phaser";
import type { Card } from "../../engine/cards";
import type { GameState } from "../../engine/state";
import { COPY } from "../../game/copy";
import { type TableEvents, portraitFor } from "../../game/selectors";
import type { Bark } from "../../game/store";
import { EASE, MOTION, ROUND_END, TURN } from "../../game/timing";
import { PLAY_CARD_H, PLAY_CARD_W } from "../../render/scale";
import { FACE_ASPECT, type Rect } from "../../render/tableLayout";
import { poolOf } from "../cardPool";
import { pop, wobble } from "../fx";
import { BARK_ANIM_MS, ms, reducedMotion } from "../motion";
import { markDirty } from "../onDemand";
import { insetStroke, maxLines, painted, roundRect, setTextColor, text, vgrad } from "../paint";
import { CSS, FS_EM, FS_MIN } from "../theme";

/** "+3" / "0" / "-7", as the top bar and the poster show a tally. */
export const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

/** At most this many back chips are drawn, whatever the count says. */
const MAX_CHIPS = 5;
/** One back chip: a dark 10x12 edge around a 8x10 red back with four darker stripes. */
const CHIP_W = 10;
const CHIP_H = 12;
function paintChip(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#120a04";
  ctx.fillRect(0, 0, CHIP_W, CHIP_H);
  ctx.fillStyle = "#7a2b24";
  ctx.fillRect(1, 1, 8, 10);
  ctx.fillStyle = "#5e1f1a";
  for (let s = 0; s < 4; s++) ctx.fillRect(1 + s * 2, 1 + ((s * 3) % 10), 1, 3);
}

/** A thinking dot: a bone disc. */
function paintDot(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.fillStyle = CSS.bone;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w / 2, 0, Math.PI * 2);
  ctx.fill();
}

/** Where everything sits in a chip of a given size. */
interface Geo {
  faceW: number;
  faceH: number;
  /** The portrait's centre (it turns and grows about it). */
  faceCx: number;
  faceCy: number;
  /** The info: name, then chips and count with the tally at the right. */
  infoX: number;
  infoY: number;
  infoW: number;
}

function geoFor(w: number, h: number): Geo {
  const faceH = Math.min(88, h - 4);
  const faceW = Math.round(faceH * FACE_ASPECT);
  const infoX = 4 + faceW + 6;
  return { faceW, faceH, faceCx: 4 + faceW / 2, faceCy: h / 2, infoX, infoY: 0, infoW: w - infoX - 6 };
}
/** The losers' leftover cards on Greenhorn: play-size cards at this scale, at most this far apart. */
const LEFTOVER_SCALE = 0.56;
const LEFTOVER_STEP = 18;
/** How far the portrait lunges toward the felt as the seat plays. */
const LUNGE = 4;
/** The thinking dots: three, this big, this far apart, in the badge's bottom-right corner. */
const DOTS = 3;
const DOT = 6;
const DOT_GAP = 5;

export class SeatView extends Phaser.GameObjects.Container {
  readonly seat: number;
  readonly r: Rect;
  readonly #geo: Geo;
  #active: Phaser.GameObjects.Image;
  #face: Phaser.GameObjects.Image | null = null;
  #faceKey: string | null = null;
  #name: Phaser.GameObjects.Text;
  /** MAX_CHIPS images of one painted chip: a card back seen edge-on (no Graphics, so nothing re-tessellates per frame). */
  #chips: Phaser.GameObjects.Image[];
  #count: Phaser.GameObjects.Text;
  #tally: Phaser.GameObjects.Text;
  #passed: Phaser.GameObjects.Container;
  #info: Phaser.GameObjects.Container;
  #barkId = 0;
  #bark: Phaser.GameObjects.Container | null = null;
  #nameText = "";
  #dots: Phaser.GameObjects.Image[];
  #dotStep = 0;
  #dotTimer: Phaser.Time.TimerEvent | null = null;
  #lastCard: Phaser.GameObjects.Container;
  #count0 = -1;
  #wasPassed = false;
  /** While the deal runs: the cards that have reached this seat so far (the count shows this, not the hand). */
  #dealt: number | null = null;
  #g: GameState | null = null;
  #leftovers: Phaser.GameObjects.Container | null = null;

  constructor(scene: Phaser.Scene, seat: number, r: Rect) {
    super(scene, r.x, r.y);
    this.seat = seat;
    this.r = r;
    const { w, h } = r;
    const geo = (this.#geo = geoFor(w, h));
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
    this.#name = text(scene, 0, 0, "", { size: FS_MIN, color: CSS.bone, wrap: geo.infoW, lineHeight: 1.15 });
    this.#chips = Array.from({ length: MAX_CHIPS }, () => painted(scene, "chip", 0, 0, CHIP_W, CHIP_H, paintChip).setVisible(false));
    this.#count = text(scene, 0, 0, "", { size: FS_EM, color: CSS.amber, bold: true });
    // the running tally, at the right of the count's row: dust, so it never reads as the count
    this.#tally = text(scene, 0, 0, "", { size: FS_MIN, color: CSS.dust, bold: true }).setOrigin(1, 0);
    this.#info = scene.add.container(geo.infoX, geo.infoY, [this.#name, ...this.#chips, this.#count, this.#tally]);
    // "passed" is stamped across the foot of the portrait
    const stamp = text(scene, 0, 0, COPY.seat.passed, { size: FS_MIN, align: "center" }).setOrigin(0.5, 0);
    const stampW = Math.max(geo.faceW, Math.ceil(stamp.width) + 4);
    const sh = Math.ceil(stamp.height);
    const stampBg = painted(scene, "passed", 0, 0, stampW, sh, (ctx, bw, bh) => {
      ctx.fillStyle = "rgba(18, 10, 4, 0.92)";
      roundRect(ctx, 0, 0, bw, bh, 3);
      ctx.fill();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 1;
      ctx.stroke();
      insetStroke(ctx, bw, bh, 3, 1, "rgba(201, 176, 138, 0.35)", 1);
    });
    // centred, so the stamp drops in about its middle
    stampBg.setPosition(-stampW / 2, -sh / 2);
    stamp.setPosition(0, -sh / 2);
    this.#passed = scene.add.container(geo.faceCx, geo.faceCy + geo.faceH / 2 - sh / 2 - 1, [stampBg, stamp]).setVisible(false);
    // LAST CARD hangs across the top of the portrait, red with bone text
    const lc = text(scene, 0, 0, COPY.seat.lastCard, { size: FS_MIN, color: CSS.bone, bold: true, align: "center" }).setOrigin(0.5);
    const lw = Math.ceil(lc.width) + 10;
    const lh = Math.ceil(lc.height);
    const lcBg = painted(scene, "last-card", -lw / 2, -lh / 2, lw, lh, (ctx, bw, bh) => {
      ctx.fillStyle = "#8a2c22";
      roundRect(ctx, 0, 0, bw, bh, 3);
      ctx.fill();
      insetStroke(ctx, bw, bh, 3, 1, "rgba(242, 232, 213, 0.6)");
    });
    // hung from the chip's bottom edge, under the info
    this.#lastCard = scene.add.container(geo.infoX + geo.infoW / 2, h, [lcBg, lc]).setVisible(false);
    // the thinking dots: the chip's top-right corner
    const dotsW = DOTS * (DOT + DOT_GAP) - DOT_GAP;
    const dotX = w - 8 - dotsW;
    const dotY = 8;
    this.#dots = Array.from({ length: DOTS }, (_, i) => painted(scene, "think-dot", dotX + i * (DOT + DOT_GAP), dotY, DOT, DOT, paintDot).setVisible(false));
    this.add([bg, this.#active, this.#info, this.#passed, this.#lastCard, ...this.#dots]);
    scene.add.existing(this);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.#dotTimer?.remove(false));
  }

  update(g: GameState, barks: readonly Bark[], ev: TableEvents | null = null): void {
    this.#g = g;
    const p = g.players[this.seat];
    const n = this.#dealt ?? p.hand.length;
    const key = portraitFor(p);
    if (key !== this.#faceKey) {
      this.#face?.destroy();
      const geo = this.#geo;
      this.#face = key ? this.scene.add.image(geo.faceCx, geo.faceCy, key).setOrigin(0.5).setDisplaySize(geo.faceW, geo.faceH) : null;
      if (this.#face) this.addAt(this.#face, 2);
      this.#faceKey = key;
    }
    const onTurn = g.turn === this.seat && g.phase === "playing";
    this.#active.setVisible(onTurn);
    this.#thinking(onTurn);
    this.setAlpha(n === 0 ? 0.55 : 1);
    if (ev) this.#cue(ev);
    this.#layoutInfo(g);
    this.#stamps(g);
    this.#updateBark(barks);
  }

  /** The info: the name on one line, then the chips and count with the tally at the right. */
  #layoutInfo(g: GameState): void {
    const geo = this.#geo;
    const p = g.players[this.seat];
    const n = this.#dealt ?? p.hand.length;
    if (p.name !== this.#nameText) {
      this.#nameText = p.name;
      this.#name.setText(p.name);
      maxLines(this.#name, 1);
    }
    const nameH = Math.round(this.#name.height) - 4;
    const rowY = nameH + 3;
    const shown = Math.min(MAX_CHIPS, n);
    this.#chips.forEach((chip, i) => chip.setVisible(i < shown).setPosition(i * 4 - 1, rowY + 5));
    const chipsW = shown ? 8 + (shown - 1) * 4 + 4 : 0;
    setTextColor(this.#count, String(n), n <= 3 ? CSS.low : CSS.amber);
    // origin at the centre so the tick pops about its middle
    this.#count.setOrigin(0.5).setPosition(chipsW + Math.round(this.#count.width / 2), rowY + Math.round(this.#count.height / 2));
    this.#countCue(n);
    this.#tally.setText(signed(g.totals[this.seat])).setPosition(geo.infoW, rowY + 3);
    const total = rowY + Math.round(this.#count.height) - 4;
    this.#info.setY(Math.round((this.r.h - total) / 2) - 2);
  }

  /** "passed" (dropped in when it appears) and LAST CARD (popped in when it appears). */
  #stamps(g: GameState): void {
    const p = g.players[this.seat];
    const passed = p.passed && g.lastPlay !== null;
    this.#passed.setVisible(passed);
    if (passed && !this.#wasPassed) this.#stampIn();
    this.#wasPassed = passed;
    const last = p.hand.length === 1 && g.phase === "playing";
    if (last && !this.#lastCard.visible) pop(this.scene, this.#lastCard, 1.2, MOTION.emphasis);
    this.#lastCard.setVisible(last);
  }

  /** The latest line only: a new bark replaces the last one on the badge. */
  #updateBark(barks: readonly Bark[]): void {
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

  /** The bark's text, at most BARK_LINES lines. */
  #barkText(s: string): Phaser.GameObjects.Text {
    const w = this.#barkW();
    const t = text(this.scene, w / 2, 0, s, { size: FS_MIN, color: CSS.barkInk, align: "center", wrap: w - 16, lineHeight: 1.2 }).setOrigin(0.5, 0);
    maxLines(t, BARK_LINES);
    return t;
  }

  /** The bark covers the chip's info. */
  #barkW(): number {
    return this.r.w - (this.#geo.infoX + 2) - 6;
  }

  /**
   * Paint the bubble at every height a bark can have (one line to BARK_LINES), now, so no bark
   * rasterises a texture mid-round.
   */
  prewarm(): void {
    for (let n = 1; n <= BARK_LINES; n++) {
      const t = this.#barkText(Array.from({ length: n }, () => "M").join("\n"));
      painted(this.scene, "bark", 0, 0, this.#barkW(), Math.round(t.height) - 4 + 12, paintBark, 10).destroy();
      t.destroy();
    }
  }

  /** The speech bubble: bone, 15-px ink, a tail pointing back at the portrait; fades in and out in place. */
  #makeBark(s: string): Phaser.GameObjects.Container {
    const scene = this.scene;
    const w = this.#barkW();
    const t = this.#barkText(s);
    const h = Math.round(t.height) - 4 + 12;
    t.setY(4);
    const bubble = painted(scene, "bark", 0, 0, w, h, paintBark, 10);
    const geo = this.#geo;
    // over the info, kept on screen: a tall bubble hangs down over the felt
    const c = scene.add.container(geo.infoX + 2 + w / 2, Math.max(h / 2 + 2 - this.r.y, this.r.h / 2), [bubble, t]);
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

  /** The one-shot cues for what just happened at this seat. */
  #cue(ev: TableEvents): void {
    const scene = this.scene;
    if (ev.turnStarted === this.seat) {
      // the ring flares in, a beat brighter than it rests
      const d = ms(MOTION.emphasis);
      if (d) {
        this.#active.setAlpha(0);
        scene.tweens.add({ targets: this.#active, alpha: 1, duration: d, ease: EASE.enter });
      }
    }
    const face = this.#face;
    if (face && ev.played === this.seat) {
      // a lunge toward the felt as the cards leave
      const d = ms(MOTION.micro);
      if (d) {
        scene.tweens.killTweensOf(face);
        const geo = this.#geo;
        face.setY(geo.faceCy);
        scene.tweens.add({ targets: face, y: geo.faceCy + LUNGE, duration: d / 2, yoyo: true, ease: EASE.enter, onComplete: () => face.setY(geo.faceCy) });
      }
    }
  }

  /** Took the trick: the portrait pops (Table calls this when the sweep reaches the badge). */
  wonTrick(): void {
    if (this.#face) pop(this.scene, this.#face, 1.08, MOTION.emphasis);
  }

  /** The count ticks with a pop as cards leave, and wobbles as it reaches three (the danger line). */
  #countCue(n: number): void {
    const prev = this.#count0;
    this.#count0 = n;
    if (prev < 0 || n >= prev) return;
    if (n <= 3 && prev > 3) wobble(this.scene, this.#count, 8);
    else pop(this.scene, this.#count, 1.2);
  }

  #stampIn(): void {
    const d = ms(MOTION.uiIn);
    if (!d) return;
    this.#passed.setScale(1.4).setAlpha(0);
    this.scene.tweens.add({ targets: this.#passed, scale: 1, alpha: 1, duration: d, ease: EASE.land });
  }

  /**
   * The thinking dots: shown while the seat is on turn; one dot brightens at a time, stepping on
   * TURN.dotStepMs (static under reduced motion).
   */
  #thinking(on: boolean): void {
    for (const d of this.#dots) d.setVisible(on);
    if (!on) {
      this.#dotTimer?.remove(false);
      this.#dotTimer = null;
      return;
    }
    if (this.#dotTimer) return;
    this.#dotStep = 0;
    this.#paintDots();
    if (reducedMotion()) return;
    this.#dotTimer = this.scene.time.addEvent({
      delay: TURN.dotStepMs,
      loop: true,
      callback: () => {
        this.#dotStep = (this.#dotStep + 1) % DOTS;
        this.#paintDots();
        markDirty();
      },
    });
  }

  #paintDots(): void {
    const still = reducedMotion();
    this.#dots.forEach((d, i) => d.setAlpha(still ? 0.8 : i === this.#dotStep ? 1 : 0.3));
  }

  /**
   * The deal (table/Deal.ts) counts this seat's cards up as they arrive: `n` so far, or null when
   * the deal is over and the count is the hand's again.
   */
  setDealt(n: number | null): void {
    this.#dealt = n;
    this.setAlpha(n === 0 ? 0.55 : 1);
    if (this.#g) this.#layoutInfo(this.#g);
  }

  /**
   * The round is over and this seat lost with `cards` still held (Greenhorn only,
   * selectors.revealLeftovers): they come out of the portrait face-up and fan across the badge,
   * one after another, and stay until the poster covers the table.
   */
  revealLeftovers(cards: readonly Card[], delay: number): void {
    const scene = this.scene;
    if (this.#leftovers) {
      poolOf(scene).giveAll(this.#leftovers);
      this.#leftovers.destroy();
    }
    const w = Math.round(PLAY_CARD_W * LEFTOVER_SCALE);
    const h = Math.round(PLAY_CARD_H * LEFTOVER_SCALE);
    const geo = this.#geo;
    const room = geo.infoW - w;
    const step = cards.length > 1 ? Math.max(4, Math.min(LEFTOVER_STEP, Math.floor(room / (cards.length - 1)))) : 0;
    const fan = scene.add.container(geo.infoX, this.r.h - h / 2 - 3);
    this.#leftovers = fan;
    this.add(fan);
    cards.forEach((card, i) => {
      const c = poolOf(scene).take(card, PLAY_CARD_W, PLAY_CARD_H, i * step + w / 2, 0).setScale(LEFTOVER_SCALE);
      fan.add(c);
      const d = ms(MOTION.emphasis);
      if (!d) return;
      // out of the portrait: small and turned, then to its place in the fan
      const x = c.x;
      c.setPosition(geo.faceCx - geo.infoX, geo.faceCy - fan.y).setScale(0.1).setAngle(-12).setAlpha(0);
      scene.tweens.add({ targets: c, x, y: 0, scale: LEFTOVER_SCALE, angle: 0, alpha: 1, delay: delay + i * ROUND_END.revealStaggerMs, duration: d, ease: EASE.land });
    });
  }

  /** The portrait's centre, absolute logical px: where this seat's plays fly from. */
  faceCentre(): { x: number; y: number } {
    return { x: this.r.x + this.#geo.faceCx, y: this.r.y + this.#geo.faceCy };
  }
}

/** How many lines a bark may run to. */
const BARK_LINES = 4;

/** The bark bubble: bone with a soft shadow, a black edge, and a tail back towards the portrait. */
function paintBark(ctx: CanvasRenderingContext2D, bw: number, bh: number): void {
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
}

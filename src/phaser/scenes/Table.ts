/**
 * The live round, a phone held sideways (render/tableLayout.ts):
 *
 *     felt        the opponents and the trick; round and tally top-left, the menu top-right;
 *                 just above the hand, the buttons on the right
 *     hand        the fan over the saloon
 *
 * One store subscription renders everything from GameView. A restart (a resize) rebuilds from the
 * store with nothing flying; `animate` (the director's start on a deal) lets the first frame deal.
 */
import Phaser from "phaser";
import type { GameView } from "../../game/store";
import { COPY } from "../../game/copy";
import { HUMAN, type TableEvents, humanTurn, revealLeftovers, tableEvents } from "../../game/selectors";
import { EASE, GESTURE, MOTION, PERF_GUARD, ROUND_END, TURN, playLandMs } from "../../game/timing";
import { CARD_H, CARD_W, fanLayout } from "../../render/fanLayout";
import { PLAY_CARD_H, PLAY_CARD_W } from "../../render/scale";
import { poolOf } from "../cardPool";
import { shouldCoach } from "../../render/handGesture";
import { env } from "../../platform/env";
import { type TableLayout, clearFor, tableLayout } from "../../render/tableLayout";
import { CardView } from "../cards";
import { flipFrom } from "../fx";
import { ANNOUNCE_ANIM_MS, ms } from "../motion";
import { artPattern, insetStroke, paintStrict, painted, roundRect, text } from "../paint";
import { C, CSS, FS_BODY, WESTERN } from "../theme";
import { fit } from "../viewport";
import { DealRun } from "../table/Deal";
import { HandView } from "../table/Hand";
import { drawSaloon } from "../table/Saloon";
import { SeatView } from "../table/Seat";
import { HudView, bandButtons } from "../table/Hud";
import { TrickView } from "../table/Trick";
import { BaseScene, type SceneData } from "./base";

/**
 * The card pool's prewarm (cardPool.ts): the hand; the trick (four plays of up to five on the felt
 * plus a won trick sweeping away); on Greenhorn the losers' leftovers too; and the deal's backs
 * (the deck shown plus 52).
 */
const POOL_HAND = 13;
const POOL_TRICK = 24;
const POOL_LEFTOVERS = 36;
const POOL_BACKS = 56;

/** The padded rail round the felt (logical px). */
const RAIL = 11;

/** A stadium: a rectangle whose short ends are half-circles. */
function stadium(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  const r = Math.min(h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + r, y + h);
  ctx.arc(x + r, y + r, r, Math.PI / 2, (3 * Math.PI) / 2);
  ctx.closePath();
}

/**
 * The table top: a shadow on the wood, a padded leather rail, and inside it the felt tile under
 * a lamp-lit vignette with a soft dark edge.
 */
function paintTable(scene: Phaser.Scene, ctx: CanvasRenderingContext2D, w: number, h: number): void {
  // the rail, casting its shadow on the floor boards
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 3;
  stadium(ctx, 1, 1, w - 2, h - 4);
  const rail = ctx.createLinearGradient(0, 0, 0, h);
  rail.addColorStop(0, "#5a3820");
  rail.addColorStop(0.5, "#3f2614");
  rail.addColorStop(1, "#2a180b");
  ctx.fillStyle = rail;
  ctx.fill();
  ctx.restore();
  // the rail's padding: a highlight along its crown, a dark seam where it meets the felt
  ctx.save();
  stadium(ctx, 1 + RAIL / 2, 1 + RAIL / 2, w - 2 - RAIL, h - 4 - RAIL);
  ctx.strokeStyle = "rgba(255, 214, 160, 0.12)";
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
  ctx.save();
  stadium(ctx, 1, 1, w - 2, h - 4);
  ctx.strokeStyle = "#140b04";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();

  // the felt inside the rail
  const fx = 1 + RAIL;
  const fy = 1 + RAIL;
  const fw = w - 2 - 2 * RAIL;
  const fh = h - 4 - 2 * RAIL;
  ctx.save();
  stadium(ctx, fx, fy, fw, fh);
  ctx.clip();
  ctx.fillStyle = CSS.felt;
  ctx.fillRect(fx, fy, fw, fh);
  ctx.fillStyle = artPattern(scene, ctx, "felt", 32) ?? CSS.felt;
  ctx.fillRect(fx, fy, fw, fh);
  ctx.save();
  ctx.translate(fx + fw / 2, fy + fh * 0.42);
  ctx.scale(0.62 * fw, 0.75 * fh);
  const lamp = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  lamp.addColorStop(0, "rgba(90, 160, 110, 0.3)");
  lamp.addColorStop(0.55, "rgba(20, 60, 40, 0.08)");
  lamp.addColorStop(1, "rgba(4, 18, 12, 0.5)");
  ctx.fillStyle = lamp;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
  // a soft dark edge under the rail
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = 18;
  ctx.lineWidth = 20;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.5)";
  stadium(ctx, fx - 10, fy - 10, fw + 20, fh + 20);
  ctx.stroke();
  ctx.restore();
}

/** The your-turn glow's height above the hand row (logical px). */
const TURN_GLOW_H = 26;
/** How far the camera jolts when the round's winning play slaps down (logical px). */
const SLAP_JOLT = 3;

export class TableScene extends BaseScene {
  #t!: TableLayout;
  #seats: SeatView[] = [];
  #trick!: TrickView;
  #hand!: HandView;
  #hud!: HudView;
  /** How many buttons the band was laid out for: a change rebuilds the table. */
  #buttons = 0;
  #announce: Phaser.GameObjects.Container | null = null;
  #announceId = 0;
  #animate = false;
  #prewarm = false;
  #coach: Phaser.GameObjects.Container | null = null;
  #turnGlow: Phaser.GameObjects.Image | null = null;
  /** The one idle reminder on the player's turn. */
  #idle: Phaser.Time.TimerEvent | null = null;
  /** The coach mark has been shown and dismissed in this run of the scene. */
  #coachDone = false;
  #last: GameView | null = null;
  #deal!: DealRun;

  constructor() {
    super("Table");
  }

  init(data: SceneData & { animate?: boolean; prewarm?: boolean }): void {
    super.init(data);
    this.#animate = !!data?.animate;
    this.#prewarm = !!data?.prewarm;
  }

  /**
   * Build the table once, hidden, and stop: every painted texture it draws (the wood, the felt,
   * the saloon strip, the badges, the buttons — ~25 MB of canvas at dpr 3) is cached by key, so
   * the first deal only creates objects instead of painting them (138 -> ~40 ms on WebKit). The
   * title calls this while it is idle. A deal during the prewarm frame simply restarts the scene
   * for real (init clears the flag, so the pending stop below does nothing).
   */
  static prewarm(from: Phaser.Scene): void {
    const mgr = from.scene.manager;
    if (mgr.isActive("Table") || mgr.isPaused("Table")) return;
    mgr.start("Table", { prewarm: true });
  }

  create(): void {
    this.setup();
    const { W, H } = this;
    const f = fit();
    const ins = env.insets.get();
    const { clearL, clearR } = clearFor(ins.left / f.k, ins.right / f.k, env.notch.get());
    this.#buttons = bandButtons(this.app.settings.opts).length;
    const t = (this.#t = tableLayout({ width: W, clearL, clearR, buttons: this.#buttons }));
    this.#seats = [];
    this.#last = null;
    this.#announce = null;
    this.#announceId = 0;

    // the felt and the hand strip run off both edges of the screen (their contents keep clear of
    // the rounded corners and the notch), so their side rims are painted out of sight
    const bleed = t.felt.x + 10;
    // the wood around everything, darkened but still showing its boards
    painted(this, "table-bg", 0, 0, W, H, (ctx, w, h) => {
      ctx.fillStyle = artPattern(this, ctx, "wood", 96) ?? CSS.oakDeep;
      ctx.fillRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(52, 32, 16, 0.5)");
      g.addColorStop(1, "rgba(28, 17, 8, 0.7)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    // the table: an oval of felt in a padded leather rail, on the wood (paintTable)
    painted(this, "felt", t.felt.x, t.felt.y, t.felt.w, t.felt.h, (ctx, w, h) => paintTable(this, ctx, w, h));

    const { game, sheet } = this.app;
    if (!this.#prewarm) {
      const play = POOL_TRICK + (this.app.settings.opts.difficulty === "easy" ? POOL_LEFTOVERS : 0);
      poolOf(this).prewarm({ faces: [[CARD_W, CARD_H, POOL_HAND], [PLAY_CARD_W, PLAY_CARD_H, play]], backs: [PLAY_CARD_W, PLAY_CARD_H, POOL_BACKS] });
    }
    // the trick under the badges: a play flies out from behind its portrait, or from the very spot in the hand
    this.#trick = new TrickView(this, t, (seat, card) => (seat === HUMAN ? (this.#hand?.poseOf(card) ?? null) : (this.#seats.find((s) => s.seat === seat)?.faceCentre() ?? null)));
    // the side chips face in across the felt, the top one down
    const facing = (seat: number) => (seat === 1 ? "right" : seat === 3 ? "left" : "down");
    for (const seat of [1, 2, 3]) this.#seats.push(new SeatView(this, seat, t.badges[seat], facing(seat)));

    // won tricks sweep into the winner's portrait, or down into the hand for the player
    this.#trick.setSweep(
      (seat) => (seat === HUMAN ? { x: t.fan.x + t.fan.w / 2, y: t.fan.y + TURN_GLOW_H } : (this.#seats.find((s) => s.seat === seat)?.faceCentre() ?? { x: t.felt.x, y: t.felt.y })),
      (seat) => (seat === HUMAN ? this.#glowHand() : this.#seats.find((s) => s.seat === seat)?.wonTrick()),
    );

    drawSaloon(this, { ...t.handRow, x: t.handRow.x - bleed, w: t.handRow.w + 2 * bleed });
    // the your-turn glow along the top of the hand row, under the cards; dark until a turn arrives
    this.#turnGlow = painted(this, "turn-glow", t.handRow.x - bleed, t.handRow.y - TURN_GLOW_H, t.handRow.w + 2 * bleed, TURN_GLOW_H, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(232, 163, 61, 0)");
      g.addColorStop(1, "rgba(240, 180, 87, 0.75)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }).setAlpha(0);
    this.#idle?.remove(false);
    this.#idle = null;
    // any touch on the player's turn is attention enough: no reminder; a touch during the deal finishes it
    this.input.on("pointerdown", () => {
      this.#idle?.remove(false);
      this.#idle = null;
      if (this.#deal?.running) this.#deal.finish();
    });
    const opts = () => this.app.settings.opts;
    this.#hand = new HandView(this, t.fan, game, () => ({ swipe: opts().swipe, flick: opts().flick }));
    // the player's own play flies above the hand it leaves, then settles into the trick
    this.#trick.setOverLayer(this.add.container(0, 0));
    this.#coach = null;
    this.#coachDone = false;
    this.#hand.onGesture = (g) => {
      if (g === "paint") this.#endCoach();
    };
    this.#hud = new HudView(this, t, game, () => sheet.set("settings"));
    // the deal's backs fly above everything on the table
    this.#deal = new DealRun(this, this.add.container(0, 0), this.#hand, this.#seats, () => this.#afterDeal());

    if (this.#prewarm) {
      this.cameras.main.setVisible(false);
      this.input.enabled = false;
      this.events.once(Phaser.Scenes.Events.UPDATE, () => {
        if (this.#prewarm) this.scene.stop();
      });
      return;
    }
    this.input.enabled = true;
    this.cameras.main.setVisible(true);
    // everything a round can show, painted now: then nothing is painted mid-round (DEV-checked)
    for (const s of this.#seats) s.prewarm();
    this.#prewarmCoach();
    paintStrict(this, performance.now() + PERF_GUARD.paintGraceMs);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => paintStrict(null));
    // on a fresh deal the felt stays bare until the cards are out (#afterDeal)
    if (this.#animate) this.#trick.setDealing(true);
    this.watch(game, () => this.#render());
    this.watch(this.app.settings, () => {
      // Flick to play or Hints switched: the band's buttons change, so the table is laid out again
      // (as for a new viewport: every card glides from where it was)
      if (bandButtons(this.app.settings.opts).length !== this.#buttons) this.scene.restart({ resumed: true, carry: this.carry(), animate: false });
      else this.#render(true);
    });
    this.#render();
    if (this.resumed) this.#flipFromCarried();
    // a fresh deal (not a rebuild) is dealt out from a deck in the middle of the felt
    if (this.#animate) this.#deal.start(t.plays.x + Math.round(t.plays.w / 2), t.plays.y + Math.round(t.plays.h / 2));
  }

  /**
   * A rebuild for a new viewport (a rotation, Safari's toolbar) starts from where every card was
   * on screen: carry() records each card's centre, and the new table slides them from there to
   * their new places (fx.flipFrom), so nothing jumps.
   */
  carry(): Record<string, unknown> {
    const poses: [number, number, number][] = [];
    for (const c of this.#cards()) {
      const m = c.getWorldTransformMatrix();
      poses.push([c.value, m.tx, m.ty]);
    }
    return { poses };
  }

  /** Every card face on the table, visible, anywhere in the display list. */
  #cards(): CardView[] {
    const out: CardView[] = [];
    const visit = (o: Phaser.GameObjects.GameObject) => {
      if (o instanceof CardView) {
        if (o.visible) out.push(o);
        return;
      }
      if (o instanceof Phaser.GameObjects.Container && o.visible) for (const c of o.list) visit(c);
    };
    for (const o of this.children.list) visit(o);
    return out;
  }

  /** The other half of carry(): each card the old table showed glides from its old place. */
  #flipFromCarried(): void {
    const poses = this.carried.poses;
    if (!Array.isArray(poses)) return;
    const at = new Map<number, [number, number]>();
    for (const p of poses as [number, number, number][]) at.set(p[0], [p[1], p[2]]);
    for (const c of this.#cards()) {
      const from = at.get(c.value);
      if (from) flipFrom(this, c, from[0], from[1]);
    }
  }

  /** The cards are all out: the opening turn gets its cue, and a newcomer the swipe coach mark. */
  #afterDeal(): void {
    this.#trick.setDealing(false);
    const v = this.app.game.view;
    if (!v.game || !this.scene.isActive()) return;
    this.#turnCue({ turnStarted: v.game.turn, played: null, passed: null, trickWonBy: null }, v);
    if (shouldCoach(this.app.settings.opts, humanTurn(v.game), v.game.players[HUMAN].hand.length)) this.#showCoach();
  }

  /**
   * The round's last play: once it has landed it holds, then slaps down with a jolt of the camera;
   * on Greenhorn the losers' leftover cards then come out of their portraits face-up (the store
   * waits ROUND_END.revealHoldMs longer before the poster for it).
   */
  #roundEnd(seat: number, cards: number, g: NonNullable<GameView["game"]>): void {
    const reveal = revealLeftovers(g, this.app.settings.opts.difficulty);
    this.after(playLandMs(cards) + ROUND_END.holdMs, () => {
      if (this.#trick.slap(seat) && ms(ROUND_END.slapMs)) this.cameras.main.shake(ms(ROUND_END.slapMs), SLAP_JOLT / this.H);
      for (const s of reveal) this.#seats.find((v) => v.seat === s)?.revealLeftovers(g.players[s].hand, ms(ROUND_END.slapMs));
    });
  }

  #render(force = false): void {
    const v = this.app.game.view;
    if (!v.game) return;
    if (v === this.#last && !force) return;
    const animate = this.#animate || this.#last !== null;
    // what just happened, for the cues that explain it (null on a rebuild: nothing replays)
    const ev = this.#last ? tableEvents(this.#last.game, v.game) : null;
    this.#last = v;
    for (const s of this.#seats) s.update(v.game, v.barks, ev);
    this.#trick.update(v, animate, ev?.trickWonBy ?? null);
    this.#hand.update(v, animate);
    this.#hud.update(v, this.app.settings.opts);
    this.#updateAnnouncement(v);
    if (ev) this.#cues(ev, v);
    if (!this.#deal.running && shouldCoach(this.app.settings.opts, humanTurn(v.game), v.game.players[HUMAN].hand.length)) this.#showCoach();
  }

  /** The table-wide cues for what just happened: a turn arriving, the round's last play. */
  #cues(ev: TableEvents, v: GameView): void {
    this.#turnCue(ev, v);
    const g = v.game;
    if (ev.played !== null && g?.phase === "roundover") this.#roundEnd(ev.played, g.history.at(-1)?.cards.length ?? 1, g);
  }

  /**
   * The player's turn arriving: the hand row glows once, and the asked-for control is nudged. If
   * nothing is touched for TURN.idleNudgeMs, one more nudge — one reminder, never a nag. The turn
   * moving on cancels it.
   */
  #turnCue(ev: TableEvents, v: GameView): void {
    if (ev.turnStarted === null) return;
    this.#idle?.remove(false);
    this.#idle = null;
    if (ev.turnStarted !== HUMAN) return;
    this.#glowHand();
    this.#hud.nudge(v);
    this.#idle = this.after(TURN.idleNudgeMs, () => {
      this.#idle = null;
      const now = this.app.game.view;
      if (!humanTurn(now.game)) return;
      if (!this.#hud.nudge(now)) this.#glowHand();
    });
  }

  /** One soft amber swell along the top of the hand row. */
  #glowHand(): void {
    const g = this.#turnGlow;
    const d = ms(MOTION.emphasis);
    if (!g || !d) return;
    this.tweens.killTweensOf(g);
    g.setAlpha(0);
    this.tweens.add({ targets: g, alpha: 1, duration: d, yoyo: true, ease: EASE.inOut, onComplete: () => g.setAlpha(0) });
  }

  /**
   * The one-time "swipe to pick several" coach mark: a plaque over the hand and a finger sweeping
   * across the first cards. Gone on the first swipe or after GESTURE.coachMs, and never shown again
   * (Settings swipeHintSeen).
   */
  #showCoach(): void {
    if (this.#coach || this.#coachDone) return;
    const fan = this.#t.fan;
    const { plate, label, w } = this.#coachPlate();
    const x0 = fan.x + 40;
    const fy = fan.y + 64;
    const finger = this.add.circle(x0, fy, 11, C.amber, 0.85).setStrokeStyle(2, C.bone);
    // just above the hand, level with the buttons and to their left
    const band = this.#t.controls;
    const tag = this.add.container(Math.min(band.x - 8 - w / 2, x0 + w / 2), band.y + band.h / 2, [plate, label]);
    this.#coach = this.add.container(0, 0, [tag, finger]);
    const sweep = ms(MOTION.settle);
    if (sweep) {
      this.#coach.setAlpha(0);
      this.tweens.add({ targets: this.#coach, alpha: 1, duration: ms(MOTION.uiIn), ease: EASE.fadeIn });
      this.tweens.add({ targets: finger, x: x0 + 3 * fanLayout(13, fan.w).step, duration: sweep, ease: EASE.inOut, yoyo: true, repeat: 2 });
    }
    this.after(GESTURE.coachMs, () => this.#endCoach());
  }

  /** The coach mark's plaque: its label and the bone pill behind it. */
  #coachPlate(): { plate: Phaser.GameObjects.Image; label: Phaser.GameObjects.Text; w: number; h: number } {
    const label = text(this, 0, 0, COPY.controls.swipeCoach, { size: FS_BODY, color: CSS.barkInk, align: "center" }).setOrigin(0.5);
    const w = Math.ceil(label.width) + 28;
    const h = Math.ceil(label.height) + 10;
    const plate = painted(this, "coach", -w / 2, -h / 2, w, h, (ctx, pw, ph) => {
      ctx.fillStyle = CSS.bone;
      roundRect(ctx, 0, 0, pw, ph, ph / 2);
      ctx.fill();
      insetStroke(ctx, pw, ph, ph / 2, 2, CSS.amber);
    });
    return { plate, label, w, h };
  }

  /** Paint the coach mark's plaque now if it may be shown this round (it can first appear well into one). */
  #prewarmCoach(): void {
    if (this.app.settings.opts.swipeHintSeen || !this.app.settings.opts.hints) return;
    const { plate, label } = this.#coachPlate();
    plate.destroy();
    label.destroy();
  }

  #endCoach(): void {
    if (this.#coachDone) return;
    this.#coachDone = true;
    const c = this.#coach;
    this.#coach = null;
    if (c) {
      const out = ms(MOTION.uiOut);
      if (out) this.tweens.add({ targets: c, alpha: 0, duration: out, ease: EASE.fadeOut, onComplete: () => c.destroy() });
      else c.destroy();
    }
    if (!this.app.settings.opts.swipeHintSeen) this.app.settings.setOpts({ swipeHintSeen: true });
  }

  /** The final-round banner: a wooden plaque dropped across the middle of the felt; it never takes a tap. */
  #updateAnnouncement(v: GameView): void {
    const a = v.announcement;
    if (!a) {
      this.#announce?.destroy();
      this.#announce = null;
      this.#announceId = 0;
      return;
    }
    if (a.id === this.#announceId) return;
    this.#announceId = a.id;
    this.#announce?.destroy();
    const felt = this.#t.felt;
    const maxW = felt.w - 36;
    const label = text(this, 0, 0, a.text, { size: 26, font: WESTERN, color: CSS.amber, align: "center", wrap: maxW - 44, lineHeight: 1.15, shadow: { x: 0, y: 2, color: CSS.black } }).setOrigin(0.5);
    const w = Math.min(maxW, Math.ceil(label.width) + 44);
    const h = Math.ceil(label.height) + 20;
    const plate = painted(
      this,
      "announce",
      -w / 2,
      -h / 2,
      w,
      h,
      (ctx, pw, ph) => {
        ctx.save();
        ctx.shadowColor = "rgba(0,0,0,0.65)";
        ctx.shadowBlur = 24;
        ctx.shadowOffsetY = 6;
        const g = ctx.createLinearGradient(0, 0, 0, ph);
        g.addColorStop(0, "rgba(62, 39, 21, 0.97)");
        g.addColorStop(1, "rgba(36, 21, 9, 0.97)");
        ctx.fillStyle = g;
        roundRect(ctx, 0, 0, pw, ph, 6);
        ctx.fill();
        ctx.restore();
        insetStroke(ctx, pw, ph, 6, 2, CSS.black);
        insetStroke(ctx, pw, ph, 6, 2, "rgba(232, 163, 61, 0.55)", 2);
      },
      30,
    );
    const c = this.add.container(felt.x + felt.w / 2, felt.y + felt.h / 2, [plate, label]);
    this.#announce = c;
    const run = ms(ANNOUNCE_ANIM_MS);
    if (run) {
      // slammed down onto the felt, then left to fade
      c.setAlpha(0).setScale(1.5);
      this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: ms(MOTION.uiIn), ease: EASE.land, easeParams: [2] });
      this.tweens.add({ targets: c, alpha: 0, delay: run * 0.85, duration: run * 0.15, ease: EASE.fadeOut });
    }
  }

  /** Geometry for the e2e probe. */
  probe(): { hand: ReturnType<HandView["probe"]>; fan: TableLayout["fan"]; felt: TableLayout["felt"]; dealing: boolean; poolMade: number } {
    return { hand: this.#hand.probe(), fan: this.#t.fan, felt: this.#t.felt, dealing: this.#deal.running, poolMade: poolOf(this).made };
  }
}

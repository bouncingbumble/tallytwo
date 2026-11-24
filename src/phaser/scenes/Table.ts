/**
 * The live round, a phone held sideways (render/tableLayout.ts):
 *
 *     felt    side        felt: the opponents and the trick; side: round, tally, menu, the sign, the status, the buttons
 *     hand    side        the fan over the saloon
 *
 * One store subscription renders everything from GameView. A restart (a resize) rebuilds from the
 * store with nothing flying; `animate` (the director's start on a deal) lets the first frame deal.
 */
import Phaser from "phaser";
import type { GameView } from "../../game/store";
import { COPY } from "../../game/copy";
import { HUMAN, type TableEvents, humanTurn, tableEvents } from "../../game/selectors";
import { EASE, GESTURE, MOTION, TURN } from "../../game/timing";
import { SELECT_LIFT, fanLayout } from "../../render/fanLayout";
import { shouldCoach } from "../../render/handGesture";
import { env } from "../../platform/env";
import { type TableLayout, clearFor, tableLayout } from "../../render/tableLayout";
import { ANNOUNCE_ANIM_MS, ms } from "../motion";
import { artPattern, insetStroke, painted, roundRect, text } from "../paint";
import { C, CSS, FS_BODY, WESTERN } from "../theme";
import { fit } from "../viewport";
import { HandView } from "../table/Hand";
import { drawSaloon } from "../table/Saloon";
import { SeatView } from "../table/Seat";
import { SideView } from "../table/Side";
import { TrickView } from "../table/Trick";
import { BaseScene } from "./base";

/** The your-turn glow's height above the hand row (logical px). */
const TURN_GLOW_H = 26;

export class TableScene extends BaseScene {
  #t!: TableLayout;
  #seats: SeatView[] = [];
  #trick!: TrickView;
  #hand!: HandView;
  #side!: SideView;
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

  constructor() {
    super("Table");
  }

  init(data: { animate?: boolean; prewarm?: boolean }): void {
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
    const t = (this.#t = tableLayout({ width: W, clearL, clearR, insetBottom: ins.bottom / f.k }));
    this.#seats = [];
    this.#last = null;
    this.#announce = null;
    this.#announceId = 0;

    // the wood around everything, darkened
    painted(this, "table-bg", 0, 0, W, H, (ctx, w, h) => {
      ctx.fillStyle = artPattern(this, ctx, "wood", 96) ?? CSS.oakDeep;
      ctx.fillRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(42, 26, 15, 0.92)");
      g.addColorStop(1, "rgba(28, 17, 8, 0.97)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    // the felt: the tile under a lamp-lit vignette, a dark rim and an inner shadow
    painted(this, "felt", t.felt.x, t.felt.y, t.felt.w, t.felt.h, (ctx, w, h) => {
      roundRect(ctx, 0, 0, w, h, 8);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = CSS.felt;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = artPattern(this, ctx, "felt", 32) ?? CSS.felt;
      ctx.fillRect(0, 0, w, h);
      ctx.save();
      ctx.translate(w / 2, h * 0.38);
      ctx.scale(1.2 * w, 0.9 * h);
      const r = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
      r.addColorStop(0, "rgba(90, 160, 110, 0.3)");
      r.addColorStop(0.48, "rgba(20, 60, 40, 0.1)");
      r.addColorStop(1, "rgba(4, 18, 12, 0.55)");
      ctx.fillStyle = r;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
      // inset 0 0 40px rgba(0,0,0,.45): a soft dark edge
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 40;
      ctx.lineWidth = 40;
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      roundRect(ctx, -20, -20, w + 40, h + 40, 28);
      ctx.stroke();
      ctx.restore();
      insetStroke(ctx, w, h, 8, 5, "#2b1a0c");
    });

    const { game, sheet } = this.app;
    // the trick under the badges: a play flies out from behind its portrait, or from the very spot in the hand
    this.#trick = new TrickView(this, t, (seat, card) => (seat === HUMAN ? (this.#hand?.poseOf(card) ?? null) : (this.#seats.find((s) => s.seat === seat)?.faceCentre() ?? null)));
    for (const seat of [1, 2, 3]) this.#seats.push(new SeatView(this, seat, t.badges[seat]));

    // won tricks sweep into the winner's portrait, or down into the hand for the player
    this.#trick.setSweep(
      (seat) => (seat === HUMAN ? { x: t.fan.x + t.fan.w / 2, y: t.fan.y + TURN_GLOW_H } : (this.#seats.find((s) => s.seat === seat)?.faceCentre() ?? { x: t.felt.x, y: t.felt.y })),
      (seat) => (seat === HUMAN ? this.#glowHand() : this.#seats.find((s) => s.seat === seat)?.wonTrick()),
    );

    drawSaloon(this, t.handRow);
    // the your-turn glow along the top of the hand row, under the cards; dark until a turn arrives
    this.#turnGlow = painted(this, "turn-glow", t.handRow.x, t.handRow.y - TURN_GLOW_H, t.handRow.w, TURN_GLOW_H, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(232, 163, 61, 0)");
      g.addColorStop(1, "rgba(240, 180, 87, 0.75)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }).setAlpha(0);
    this.#idle?.remove(false);
    this.#idle = null;
    // any touch on the player's turn is attention enough: no reminder
    this.input.on("pointerdown", () => {
      this.#idle?.remove(false);
      this.#idle = null;
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
    this.#side = new SideView(this, t.side, t.sideClearR, game, () => sheet.set("settings"));

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
    this.watch(game, () => this.#render());
    this.watch(this.app.settings, () => this.#render(true));
    this.#render();
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
    this.#side.update(v, this.app.settings.opts.hints);
    this.#updateAnnouncement(v);
    if (ev) this.#turnCue(ev, v);
    if (shouldCoach(this.app.settings.opts, humanTurn(v.game), v.game.players[HUMAN].hand.length)) this.#showCoach();
  }

  /**
   * The player's turn arriving (docs/MOBILE_UX_PLAN.md §5.1): the hand row glows once, and the
   * asked-for control is nudged. If nothing is touched for TURN.idleNudgeMs, one more nudge —
   * one reminder, never a nag. The turn moving on cancels it.
   */
  #turnCue(ev: TableEvents, v: GameView): void {
    if (ev.turnStarted === null) return;
    this.#idle?.remove(false);
    this.#idle = null;
    if (ev.turnStarted !== HUMAN) return;
    this.#glowHand();
    this.#side.nudge(v);
    this.#idle = this.after(TURN.idleNudgeMs, () => {
      this.#idle = null;
      const now = this.app.game.view;
      if (!humanTurn(now.game)) return;
      if (!this.#side.nudge(now)) this.#glowHand();
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
   * The one-time "swipe to pick several" coach mark (docs/MOBILE_UX_PLAN.md §4.2): a plaque over
   * the hand and a finger sweeping across the first cards. Gone on the first swipe or after
   * GESTURE.coachMs, and never shown again (Settings swipeHintSeen).
   */
  #showCoach(): void {
    if (this.#coach || this.#coachDone) return;
    const fan = this.#t.fan;
    const label = text(this, 0, 0, COPY.controls.swipeCoach, { size: FS_BODY, color: CSS.barkInk, align: "center" }).setOrigin(0.5);
    const w = Math.ceil(label.width) + 28;
    const h = Math.ceil(label.height) + 10;
    const plate = painted(this, "coach", -w / 2, -h / 2, w, h, (ctx, pw, ph) => {
      ctx.fillStyle = CSS.bone;
      roundRect(ctx, 0, 0, pw, ph, ph / 2);
      ctx.fill();
      insetStroke(ctx, pw, ph, ph / 2, 2, CSS.amber);
    });
    const x0 = fan.x + 40;
    const fy = fan.y + 64;
    const finger = this.add.circle(x0, fy, 11, C.amber, 0.85).setStrokeStyle(2, C.bone);
    const tag = this.add.container(Math.min(fan.x + fan.w / 2, x0 + w / 2), fan.y - SELECT_LIFT - h, [plate, label]);
    this.#coach = this.add.container(0, 0, [tag, finger]);
    const sweep = ms(MOTION.settle);
    if (sweep) {
      this.#coach.setAlpha(0);
      this.tweens.add({ targets: this.#coach, alpha: 1, duration: ms(MOTION.uiIn), ease: EASE.fadeIn });
      this.tweens.add({ targets: finger, x: x0 + 3 * fanLayout(13, fan.w).step, duration: sweep, ease: EASE.inOut, yoyo: true, repeat: 2 });
    }
    this.after(GESTURE.coachMs, () => this.#endCoach());
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
      c.setAlpha(0).setScale(1.08);
      c.y -= 24;
      this.tweens.add({ targets: c, alpha: 1, scale: 1, y: c.y + 24, duration: run * 0.1, ease: "Sine.Out" });
      this.tweens.add({ targets: c, alpha: 0, delay: run * 0.85, duration: run * 0.15, ease: "Sine.In" });
    }
  }

  /** Geometry for the e2e probe. */
  probe(): { hand: ReturnType<HandView["probe"]>; fan: TableLayout["fan"] } {
    return { hand: this.#hand.probe(), fan: this.#t.fan };
  }
}

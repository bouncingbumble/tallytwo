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
import { HUMAN, type TableEvents, humanTurn, revealLeftovers, tableEvents } from "../../game/selectors";
import { EASE, GESTURE, MOTION, ROUND_END, TURN, playLandMs } from "../../game/timing";
import { SELECT_LIFT, fanLayout } from "../../render/fanLayout";
import { shouldCoach } from "../../render/handGesture";
import { env } from "../../platform/env";
import { type TableLayout, clearFor, tableLayout } from "../../render/tableLayout";
import { CardView } from "../cards";
import { flipFrom } from "../fx";
import { ANNOUNCE_ANIM_MS, ms } from "../motion";
import { artPattern, insetStroke, painted, roundRect, text } from "../paint";
import { C, CSS, FS_BODY, WESTERN } from "../theme";
import { fit } from "../viewport";
import { DealRun } from "../table/Deal";
import { HandView } from "../table/Hand";
import { drawSaloon } from "../table/Saloon";
import { SeatView } from "../table/Seat";
import { SideView } from "../table/Side";
import { TrickView } from "../table/Trick";
import { BaseScene, type SceneData } from "./base";

/** The your-turn glow's height above the hand row (logical px). */
const TURN_GLOW_H = 26;
/** How far the camera jolts when the round's winning play slaps down (logical px). */
const SLAP_JOLT = 3;

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
    this.#side = new SideView(this, t.side, t.sideClearR, game, () => sheet.set("settings"));
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
    this.watch(game, () => this.#render());
    this.watch(this.app.settings, () => this.#render(true));
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
    const v = this.app.game.view;
    if (!v.game || !this.scene.isActive()) return;
    this.#turnCue({ turnStarted: v.game.turn, played: null, passed: null, trickWonBy: null }, v);
    if (shouldCoach(this.app.settings.opts, humanTurn(v.game), v.game.players[HUMAN].hand.length)) this.#showCoach();
  }

  /**
   * The round's last play (docs/MOBILE_UX_PLAN.md §6.2): once it has landed it holds, then slaps
   * down with a jolt of the camera; on Greenhorn the losers' leftover cards then come out of their
   * portraits face-up (the store waits ROUND_END.revealHoldMs longer before the poster for it).
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
    this.#side.update(v, this.app.settings.opts.hints);
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
      // slammed down onto the felt, then left to fade (§6.4)
      c.setAlpha(0).setScale(1.5);
      this.tweens.add({ targets: c, alpha: 1, scale: 1, duration: ms(MOTION.uiIn), ease: EASE.land, easeParams: [2] });
      this.tweens.add({ targets: c, alpha: 0, delay: run * 0.85, duration: run * 0.15, ease: EASE.fadeOut });
    }
  }

  /** Geometry for the e2e probe. */
  probe(): { hand: ReturnType<HandView["probe"]>; fan: TableLayout["fan"] } {
    return { hand: this.#hand.probe(), fan: this.#t.fan };
  }
}

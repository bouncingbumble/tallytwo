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
import { HUMAN } from "../../game/selectors";
import { env } from "../../platform/env";
import { type TableLayout, clearFor, tableLayout } from "../../render/tableLayout";
import { ANNOUNCE_ANIM_MS, ms } from "../motion";
import { insetStroke, painted, roundRect, text } from "../paint";
import { CSS, WESTERN } from "../theme";
import { fit } from "../viewport";
import { HandView } from "../table/Hand";
import { drawSaloon } from "../table/Saloon";
import { SeatView } from "../table/Seat";
import { SideView } from "../table/Side";
import { TrickView } from "../table/Trick";
import { BaseScene } from "./base";

/** A tiled pattern of a loaded 3x texture, drawn at its art size (tile px logical). */
function pattern(scene: Phaser.Scene, ctx: CanvasRenderingContext2D, key: string, tile: number): CanvasPattern | null {
  const src = scene.textures.get(key).getSourceImage() as CanvasImageSource & { width: number };
  const p = ctx.createPattern(src, "repeat");
  if (p) p.setTransform(new DOMMatrix().scale(tile / src.width));
  return p;
}

export class TableScene extends BaseScene {
  #t!: TableLayout;
  #seats: SeatView[] = [];
  #trick!: TrickView;
  #hand!: HandView;
  #side!: SideView;
  #announce: Phaser.GameObjects.Container | null = null;
  #announceId = 0;
  #animate = false;
  #last: GameView | null = null;

  constructor() {
    super("Table");
  }

  init(data: { animate?: boolean }): void {
    this.#animate = !!data?.animate;
  }

  create(): void {
    this.setup();
    const { W, H } = this;
    const f = fit();
    const ins = env.insets.get();
    const { clearL, clearR } = clearFor(ins.left / f.k, ins.right / f.k, env.notch.get());
    const t = (this.#t = tableLayout({ width: W, clearL, clearR, insetBottom: ins.bottom / f.k }));
    const smooth = f.k < 1;
    this.#seats = [];
    this.#last = null;
    this.#announce = null;
    this.#announceId = 0;

    // the wood around everything, darkened
    painted(this, `table-bg-${smooth}`, 0, 0, W, H, (ctx, w, h) => {
      ctx.imageSmoothingEnabled = smooth;
      ctx.fillStyle = pattern(this, ctx, "wood", 96) ?? CSS.oakDeep;
      ctx.fillRect(0, 0, w, h);
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, "rgba(42, 26, 15, 0.92)");
      g.addColorStop(1, "rgba(28, 17, 8, 0.97)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    });
    // the felt: the tile under a lamp-lit vignette, a dark rim and an inner shadow
    painted(this, `felt-${smooth}`, t.felt.x, t.felt.y, t.felt.w, t.felt.h, (ctx, w, h) => {
      ctx.imageSmoothingEnabled = smooth;
      roundRect(ctx, 0, 0, w, h, 8);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = CSS.felt;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = pattern(this, ctx, "felt", 32) ?? CSS.felt;
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
    // the trick under the badges: a play flies out from behind its portrait
    this.#trick = new TrickView(this, t, (seat) => (seat === HUMAN ? null : (this.#seats.find((s) => s.seat === seat)?.faceCentre() ?? null)));
    for (const seat of [1, 2, 3]) this.#seats.push(new SeatView(this, seat, t.badges[seat]));

    drawSaloon(this, t.handRow);
    this.#hand = new HandView(this, t.fan, game);
    this.#side = new SideView(this, t.side, t.sideClearR, game, () => sheet.set("settings"));

    this.watch(game, () => this.#render());
    this.watch(this.app.settings, () => this.#render(true));
    this.#render();
  }

  #render(force = false): void {
    const v = this.app.game.view;
    if (!v.game) return;
    if (v === this.#last && !force) return;
    const animate = this.#animate || this.#last !== null;
    this.#last = v;
    for (const s of this.#seats) s.update(v.game, v.barks);
    this.#trick.update(v, animate);
    this.#hand.update(v, animate);
    this.#side.update(v, this.app.settings.opts.hints);
    this.#updateAnnouncement(v);
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

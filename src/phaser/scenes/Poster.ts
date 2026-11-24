/**
 * The end-of-round WANTED poster (P:995-1028) and, when matchOver() says the match is done, the
 * FINAL TALLY poster in the same frame: the match winner instead of the round winner, "$N over M
 * rounds" instead of the reward, New match in place of Next round. Rows sorted by tally, highest
 * first (selectors.scoreRows). Shown over the table while game.phase === "scored".
 *
 * Wider than it is tall on a sideways phone: the heading across the top, the face, the winner and
 * the reward on the left, the table on the right, the buttons across the bottom.
 *
 * Motion (docs/MOBILE_UX_PLAN.md §6.3-6.4): the paper drops in on a spring, a little turned, and
 * settles square; the rows arrive one after another; then the round's numbers count up from 0
 * and the tallies from last round's, ticking. The buttons wake when the count is done — or at
 * once, with everything at its final value, on a tap anywhere. A button lifts the poster away
 * before it acts. The final poster has an amber rule and a few glints round the winner's frame.
 */
import type Phaser from "phaser";
import { COPY } from "../../game/copy";
import { newSeed } from "../../game/seeds";
import { HUMAN, matchOver, matchWinner, portraitFor, roundDeltas, roundWinner, scoreRows } from "../../game/selectors";
import { EASE, MOTION, POSTER } from "../../game/timing";
import { art } from "../art";
import { pop } from "../fx";
import { ms } from "../motion";
import { painted, roundRect, text } from "../paint";
import { C, CSS, FS_EM, FS_MIN, TAP, WESTERN } from "../theme";
import { target } from "../probe";
import { Button, blocker, cover } from "../widgets";
import { signed } from "../table/Seat";
import { BaseScene } from "./base";

const PAD = 16;
/** The paper comes in turned this far (degrees) and settles square. */
const DROP_TILT = -3;
/** A row slides in from this far right as it fades in. */
const ROW_SLIDE = 12;
/** The final poster's glints round the winner's frame: how many, how big. */
const GLINTS = 5;
const GLINT_R = 4;

/** A number on the poster that counts from `from` to `to`. */
interface Counter {
  t: Phaser.GameObjects.Text;
  from: number;
  to: number;
}

export class PosterScene extends BaseScene {
  #poster!: Phaser.GameObjects.Container;
  #buttons: Button[] = [];
  #counters: Counter[] = [];
  #counting = false;
  #leaving = false;

  constructor() {
    super("Poster");
  }

  create(): void {
    this.setup();
    const { W, H } = this;
    const { game, settings } = this.app;
    const g = game.game;
    const deltas = roundDeltas(g);
    const roundWin = roundWinner(g);
    const block = blocker(this, W, H);
    cover(this, W, H);
    this.#buttons = [];
    this.#counters = [];
    this.#counting = false;
    this.#leaving = false;
    if (!g || g.phase !== "scored" || !deltas || roundWin === null) return;

    const final = matchOver(g);
    const winner = final ? matchWinner(g) : roundWin;
    const title = final ? COPY.poster.finalTally : COPY.poster.wanted;
    const rows = scoreRows(g, deltas);
    const pw = Math.min(620, W - 32);
    const inner = pw - 2 * PAD;
    const leftW = Math.floor(((inner - 18) * 1) / 2.4);
    const rightW = inner - 18 - leftW;
    const layer = this.add.container(0, 0);
    const ink = CSS.paperInk;

    // heading, rule (amber on the final poster)
    let y = 2;
    const h2 = text(this, inner / 2, y, title, { size: final ? 30 : 38, font: WESTERN, color: ink, align: "center", letterSpacing: 2 }).setOrigin(0.5, 0);
    layer.add(h2);
    y += Math.round(h2.height) - 4 + 6;
    layer.add(this.add.rectangle(0, y, inner, 3, final ? C.amber : 0x2a1a0f).setOrigin(0, 0));
    y += 3 + 10;
    const top = y;

    // left: face, winner, reward
    let ly = top;
    const key = winner === HUMAN ? "wanted" : portraitFor(g.players[winner]);
    let face: { x: number; y: number; w: number; h: number } | null = null;
    if (key) {
      const [fw, fh] = key === "wanted" ? [122, 142] : [96, 104];
      face = { x: Math.floor((leftW - fw) / 2), y: ly + 2, w: fw, h: fh };
      layer.add(art(this, face.x, face.y, key, fw, fh));
      ly += fh + 2;
    }
    const name = text(this, leftW / 2, ly + 2, g.players[winner].name, { size: 20, font: WESTERN, color: ink, align: "center", wrap: leftW }).setOrigin(0.5, 0);
    layer.add(name);
    ly += Math.round(name.height) - 4 + 6;
    if (final) {
      const r = text(this, leftW / 2, ly, COPY.poster.overRounds(g.totals[winner], g.round), { size: FS_MIN, color: ink, align: "center", wrap: leftW }).setOrigin(0.5, 0);
      layer.add(r);
      ly += Math.round(r.height) - 4;
    } else {
      const amt = text(this, leftW / 2, ly, COPY.poster.reward(deltas[winner]), { size: 26, color: ink, bold: true, align: "center" }).setOrigin(0.5, 0);
      layer.add(amt);
      ly += Math.round(amt.height) - 6;
      const line = text(this, leftW / 2, ly, COPY.poster.rewardLine, { size: FS_MIN, color: ink, align: "center", wrap: leftW }).setOrigin(0.5, 0);
      layer.add(line);
      ly += Math.round(line.height) - 4;
    }

    // right: Player / Cards / Round / Tally; each row its own container, so it can arrive on its own
    const tx = leftW + 18;
    const cols = [0, rightW * 0.48, rightW * 0.7, rightW];
    const heads = [COPY.poster.player, COPY.poster.cards, COPY.poster.round, COPY.poster.tally];
    const rowH = 32;
    const tableH = 22 + rows.length * rowH;
    let ty = top + Math.max(0, Math.floor((ly - top - tableH) / 2));
    heads.forEach((hd, i) => layer.add(text(this, tx + cols[i], ty, hd, { size: FS_MIN, color: CSS.paperMuted, bold: true }).setOrigin(i === 0 ? 0 : 1, 0)));
    ty += 22;
    const rowViews: Phaser.GameObjects.Container[] = [];
    for (const r of rows) {
      const row = this.add.container(tx, ty);
      row.add(this.add.rectangle(0, 0, rightW, 1, 0x2a1a0f, 0.2).setOrigin(0, 0));
      const cells = [r.name, String(r.cards), signed(r.delta), signed(r.total)];
      cells.forEach((s, i) => {
        const color = i === 2 ? (r.delta >= 0 ? CSS.pos : CSS.neg) : ink;
        const cell = text(this, cols[i], 4, s, { size: FS_EM, color, bold: i === 2 && r.delta >= 0 }).setOrigin(i === 0 ? 0 : 1, 0);
        row.add(cell);
        if (i === 2) this.#counters.push({ t: cell, from: 0, to: r.delta });
        if (i === 3) this.#counters.push({ t: cell, from: r.total - r.delta, to: r.total });
      });
      layer.add(row);
      rowViews.push(row);
      ty += rowH;
    }

    // buttons across the bottom; asleep until the numbers are in, and they lift the poster off first
    const by = Math.max(ly, ty) + 16;
    const bw = Math.floor((inner - 8) / 2);
    const go = (a: () => void) => () => this.#leave(a);
    // a tap on a button that is still asleep finishes the count too (it does not act)
    const skip = () => this.#finish();
    const primary = final
      ? new Button(this, 0, by, bw, TAP, COPY.poster.newMatch, { kind: "primary", onClick: go(() => game.act({ type: "NEW_MATCH", seed: newSeed(1), rules: settings.rules })), onDisabledTap: skip })
      : new Button(this, 0, by, bw, TAP, COPY.poster.nextRound, { kind: "primary", onClick: go(() => game.act({ type: "NEXT_ROUND", seed: newSeed(g.round + 1) })), onDisabledTap: skip });
    const saddle = new Button(this, bw + 8, by, inner - bw - 8, TAP, COPY.poster.saddleUp, { kind: "ghostDark", onClick: go(() => game.act({ type: "QUIT" })), onDisabledTap: skip });
    this.#buttons = [primary, saddle];
    layer.add([primary, saddle]);
    target(this, "poster.next", primary, { w: bw, h: TAP }, () => primary.enabled);
    target(this, "poster.saddle", saddle, { w: inner - bw - 8, h: TAP }, () => saddle.enabled);
    const ph = by + TAP + 14 + PAD;

    // the paper: a colour under a dot grid and a gradient, two pins; centred, so it turns about its middle
    const scale = Math.min(1, (H - 20) / ph);
    const paper = painted(this, "poster", -pw / 2, -ph / 2, pw, ph, paintPaper, 60);
    layer.setPosition(PAD - pw / 2, PAD - ph / 2);
    const cx = Math.round(W / 2);
    const cy = Math.round(H / 2);
    this.#poster = this.add.container(cx, cy, [paper, layer]).setScale(scale);
    this.data.set("scale", scale);
    if (final && face) this.#glints(layer, face);

    // a tap anywhere while it is still arriving or counting finishes it
    block.on("pointerdown", () => this.#finish());
    this.#arrive(rowViews, cy, ph * scale);
  }

  /** Drop in on a spring, rows one after another, then count. Under reduced motion: all at once. */
  #arrive(rows: readonly Phaser.GameObjects.Container[], cy: number, h: number): void {
    const drop = ms(MOTION.emphasis);
    // a rebuild for a new viewport: the poster is already up and counted
    if (!drop || this.resumed) {
      this.#done();
      return;
    }
    for (const b of this.#buttons) b.setEnabled(false);
    this.#counting = true;
    for (const c of this.#counters) c.t.setText(signed(c.from));
    this.#poster.setY(-h).setAngle(DROP_TILT);
    this.tweens.add({ targets: this.#poster, y: cy, angle: 0, duration: drop, ease: EASE.spring });
    rows.forEach((r, i) => {
      r.setAlpha(0).setX(r.x + ROW_SLIDE);
      this.tweens.add({ targets: r, alpha: 1, x: r.x - ROW_SLIDE, delay: drop * 0.6 + i * POSTER.rowStaggerMs, duration: ms(MOTION.uiIn), ease: EASE.enter });
    });
    const countFrom = drop * 0.6 + rows.length * POSTER.rowStaggerMs + ms(MOTION.uiIn);
    const p = { t: 0 };
    let lastTick = -Infinity;
    this.tweens.add({
      targets: p,
      t: 1,
      delay: countFrom,
      duration: ms(POSTER.countMs),
      ease: EASE.settle,
      onUpdate: () => {
        let moved = false;
        for (const c of this.#counters) {
          const s = signed(Math.round(c.from + (c.to - c.from) * p.t));
          if (c.t.text !== s) {
            c.t.setText(s);
            moved = true;
          }
        }
        const now = this.time.now;
        if (moved && now - lastTick >= POSTER.tickMs) {
          lastTick = now;
          this.app.game.audio.play("deal");
        }
      },
      onComplete: () => this.#done(),
    });
  }

  /** Skip to the end: everything at rest, every number final, the buttons awake. */
  #finish(): void {
    if (!this.#counting || this.#leaving) return;
    for (const o of this.tweens.getTweens()) o.complete();
    this.#done();
  }

  #done(): void {
    this.#counting = false;
    this.#poster.setAngle(0);
    for (const c of this.#counters) c.t.setText(signed(c.to));
    for (const b of this.#buttons) b.setEnabled(true);
    this.#buttons[0]?.nudge();
  }

  /** A button was pressed: the poster lifts away, then it acts. Once only. */
  #leave(act: () => void): void {
    if (this.#leaving) return;
    this.#leaving = true;
    const d = ms(MOTION.uiOut);
    if (!d) {
      act();
      return;
    }
    this.tweens.add({ targets: this.#poster, y: this.#poster.y - LIFT, alpha: 0, duration: d, ease: EASE.exit, onComplete: act });
  }

  /** The final poster: a few amber glints round the winner's frame, twinkling once each, one after another. */
  #glints(layer: Phaser.GameObjects.Container, f: { x: number; y: number; w: number; h: number }): void {
    const d = ms(MOTION.emphasis);
    for (let i = 0; i < GLINTS; i++) {
      const a = (i / GLINTS) * Math.PI * 2 - Math.PI / 2;
      const x = f.x + f.w / 2 + Math.cos(a) * (f.w / 2 + 6);
      const y = f.y + f.h / 2 + Math.sin(a) * (f.h / 2 + 6);
      const star = this.add.star(x, y, 4, GLINT_R / 2.5, GLINT_R, C.amber).setAlpha(d ? 0 : 1);
      layer.add(star);
      if (d) {
        this.tweens.add({ targets: star, alpha: 1, delay: d + i * POSTER.rowStaggerMs * 2, duration: d / 2, yoyo: true, hold: d, ease: EASE.inOut, onComplete: () => star.setAlpha(0.8) });
        pop(this, star, 1.6, d);
      }
    }
  }
}

/** How far the poster rises as it leaves (logical px). */
const LIFT = 40;

function paintPaper(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 44;
  ctx.shadowOffsetY = 20;
  const lg = ctx.createLinearGradient(0, 0, 0, h);
  lg.addColorStop(0, "#efe2c2");
  lg.addColorStop(1, "#dcc9a0");
  ctx.fillStyle = lg;
  roundRect(ctx, 0, 0, w, h, 3);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "rgba(120, 90, 50, 0.16)";
  for (let dy = 2.5; dy < h; dy += 5) for (let dx = 2.5; dx < w; dx += 5) ctx.fillRect(dx - 0.5, dy - 0.5, 1, 1);
  for (const cx of [16, w - 16]) {
    ctx.fillStyle = "#8a6b45";
    ctx.beginPath();
    ctx.arc(cx, 12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.arc(cx, 13.5, 4, 0, Math.PI);
    ctx.fill();
  }
}

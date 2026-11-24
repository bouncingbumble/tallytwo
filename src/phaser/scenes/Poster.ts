/**
 * The end-of-round WANTED poster (P:995-1028) and, when matchOver() says the match is done, the
 * FINAL TALLY poster in the same frame: the match winner instead of the round winner, "$N over M
 * rounds" instead of the reward, New match in place of Next round. Rows sorted by tally, highest
 * first (selectors.scoreRows). Shown over the table while game.phase === "scored".
 *
 * Wider than it is tall on a sideways phone: the heading across the top, the face, the winner and
 * the reward on the left, the table on the right, the buttons across the bottom.
 */
import { COPY } from "../../game/copy";
import { newSeed } from "../../game/seeds";
import { HUMAN, matchOver, matchWinner, portraitFor, roundDeltas, roundWinner, scoreRows } from "../../game/selectors";
import { art } from "../art";
import { painted, roundRect, text } from "../paint";
import { CSS, FS_EM, FS_MIN, TAP, WESTERN } from "../theme";
import { target } from "../probe";
import { Button, blocker, cover } from "../widgets";
import { signed } from "../table/Seat";
import { BaseScene } from "./base";

const PAD = 16;

export class PosterScene extends BaseScene {
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
    blocker(this, W, H);
    cover(this, W, H);
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

    // heading, rule
    let y = 2;
    const h2 = text(this, inner / 2, y, title, { size: final ? 30 : 38, font: WESTERN, color: ink, align: "center", letterSpacing: 2 }).setOrigin(0.5, 0);
    layer.add(h2);
    y += Math.round(h2.height) - 4 + 6;
    layer.add(this.add.rectangle(0, y, inner, 3, 0x2a1a0f).setOrigin(0, 0));
    y += 3 + 10;
    const top = y;

    // left: face, winner, reward
    let ly = top;
    const key = winner === HUMAN ? "wanted" : portraitFor(g.players[winner]);
    if (key) {
      const [fw, fh] = key === "wanted" ? [122, 142] : [96, 104];
      layer.add(art(this, Math.floor((leftW - fw) / 2), ly + 2, key, fw, fh));
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

    // right: Player / Cards / Round / Tally
    const tx = leftW + 18;
    const cols = [0, rightW * 0.48, rightW * 0.7, rightW];
    const heads = [COPY.poster.player, COPY.poster.cards, COPY.poster.round, COPY.poster.tally];
    const rowH = 32;
    const tableH = 22 + rows.length * rowH;
    let ty = top + Math.max(0, Math.floor((ly - top - tableH) / 2));
    heads.forEach((hd, i) => layer.add(text(this, tx + cols[i], ty, hd, { size: FS_MIN, color: CSS.paperMuted, bold: true }).setOrigin(i === 0 ? 0 : 1, 0)));
    ty += 22;
    for (const r of rows) {
      layer.add(this.add.rectangle(tx, ty, rightW, 1, 0x2a1a0f, 0.2).setOrigin(0, 0));
      const cells = [r.name, String(r.cards), signed(r.delta), signed(r.total)];
      cells.forEach((s, i) => {
        const color = i === 2 ? (r.delta >= 0 ? CSS.pos : CSS.neg) : ink;
        layer.add(text(this, tx + cols[i], ty + 4, s, { size: FS_EM, color, bold: i === 2 && r.delta >= 0 }).setOrigin(i === 0 ? 0 : 1, 0));
      });
      ty += rowH;
    }

    // buttons across the bottom
    const by = Math.max(ly, ty) + 16;
    const bw = Math.floor((inner - 8) / 2);
    const primary = final
      ? new Button(this, 0, by, bw, TAP, COPY.poster.newMatch, { kind: "primary", onClick: () => game.act({ type: "NEW_MATCH", seed: newSeed(1), rules: settings.rules }) })
      : new Button(this, 0, by, bw, TAP, COPY.poster.nextRound, { kind: "primary", onClick: () => game.act({ type: "NEXT_ROUND", seed: newSeed(g.round + 1) }) });
    const saddle = new Button(this, bw + 8, by, inner - bw - 8, TAP, COPY.poster.saddleUp, { kind: "ghostDark", onClick: () => game.act({ type: "QUIT" }) });
    layer.add([primary, saddle]);
    target(this, "poster.next", primary, { w: bw, h: TAP });
    target(this, "poster.saddle", saddle, { w: inner - bw - 8, h: TAP });
    const ph = by + TAP + 14 + PAD;

    // the paper: a colour under a dot grid and a gradient, two pins
    const scale = Math.min(1, (H - 20) / ph);
    const px = Math.floor((W - pw * scale) / 2);
    const py = Math.floor((H - ph * scale) / 2);
    const paper = painted(
      this,
      "poster",
      0,
      0,
      pw,
      ph,
      (ctx, w, h) => {
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
      },
      60,
    );
    layer.setPosition(PAD, PAD);
    const poster = this.add.container(px, py, [paper, layer]).setScale(scale);
    this.data.set("scale", scale);
    poster.setAlpha(0);
    this.tweens.add({ targets: poster, alpha: 1, duration: 180 });
  }
}

/**
 * The side column: round and tally with the menu button, the sign (who played what, signFor), the
 * status line (statusFor's text and tone) and Play / Pass / Hint stacked at the bottom. Every
 * enablement rule is a store value; the only decision made here is which button was tapped. The
 * status is the one item that gives way (and clips) when a long sign and three buttons crowd it.
 */
import Phaser from "phaser";
import { COPY } from "../../game/copy";
import { HUMAN, hintFor, humanTurn } from "../../game/selectors";
import type { GameStore, GameView } from "../../game/store";
import type { Rect } from "../../render/tableLayout";
import { maxLines, painted, roundRect, setTextColor, text } from "../paint";
import { CSS, FS_BODY, FS_EM, FS_MIN, TAP } from "../theme";
import { target } from "../probe";
import { Button, IconButton } from "../widgets";

const GAP = 6;
const BTN_GAP = 6;

export class SideView {
  readonly scene: Phaser.Scene;
  readonly #r: Rect;
  readonly #clearR: number;
  #round: Phaser.GameObjects.Text;
  #roundN: Phaser.GameObjects.Text;
  #tally: Phaser.GameObjects.Text;
  #tallyN: Phaser.GameObjects.Text;
  #signBg: Phaser.GameObjects.Image | null = null;
  #signWho: Phaser.GameObjects.Text;
  #signText: Phaser.GameObjects.Text;
  #status: Phaser.GameObjects.Text;
  #play: Button;
  #pass: Button;
  #hint: Button;
  #hints = false;
  #signKey = "";
  #statusKey = "";

  constructor(scene: Phaser.Scene, r: Rect, clearR: number, store: GameStore, onMenu: () => void) {
    this.scene = scene;
    this.#r = r;
    this.#clearR = clearR;
    const x = r.x;
    const y = r.y + 2;
    this.#round = text(scene, x, y, COPY.topbar.round + " ", { size: FS_MIN, color: CSS.dust });
    this.#roundN = text(scene, x, y, "", { size: FS_MIN, color: CSS.bone, bold: true });
    this.#tally = text(scene, x, y + 22, COPY.topbar.tally + " ", { size: FS_MIN, color: CSS.dust });
    this.#tallyN = text(scene, x, y + 20, "", { size: FS_EM, color: CSS.amber, bold: true });
    // a TAP square to hit that only claims the two text lines' height in the column
    target(scene, "table.menu", new IconButton(scene, r.x + r.w - TAP + 6, y - 8, "menu", onMenu), { w: TAP, h: TAP });
    const textW = r.w - clearR - 12;
    this.#signWho = text(scene, 0, 0, "", { size: FS_MIN, color: CSS.dust, wrap: textW, lineHeight: 1.25 });
    this.#signText = text(scene, 0, 0, "", { size: FS_BODY, color: CSS.bone, wrap: textW, lineHeight: 1.25 });
    this.#status = text(scene, 0, 0, "", { size: FS_MIN, color: CSS.dust, align: "center", wrap: r.w - clearR - 4 }).setOrigin(0.5, 0);
    const { act } = store;
    this.#play = new Button(scene, x, 0, r.w, TAP, COPY.controls.play, {
      kind: "primary",
      onClick: () => {
        const e = store.view.exact;
        if (e) act({ type: "PLAY", player: HUMAN, cards: e.cards });
      },
    });
    this.#pass = new Button(scene, x, 0, r.w, TAP, COPY.controls.pass, { onClick: () => act({ type: "PASS", player: HUMAN }) });
    this.#hint = new Button(scene, x, 0, r.w, TAP, COPY.controls.hint, {
      onClick: () => {
        const v = store.view;
        const m = hintFor(v.game, v.legal, Math.random);
        if (m) store.setSelection(m.cards);
      },
    });
    target(scene, "table.play", this.#play, { w: r.w, h: TAP }, () => this.#play.enabled);
    target(scene, "table.pass", this.#pass, { w: r.w, h: TAP }, () => this.#pass.enabled);
    target(scene, "table.hint", this.#hint, { w: r.w, h: TAP }, () => this.#hint.enabled);
  }

  update(v: GameView, hints: boolean): void {
    const g = v.game;
    if (!g) return;
    const r = this.#r;
    this.#roundN.setText(String(g.round)).setX(r.x + Math.round(this.#round.width) - 2);
    const total = g.totals[HUMAN];
    this.#tallyN.setText((total > 0 ? "+" : "") + total).setX(r.x + Math.round(this.#tally.width) - 2);

    // the buttons, from the bottom up: Hint only with Settings › Hints on
    this.#hints = hints;
    const n = hints ? 3 : 2;
    let by = r.y + r.h - n * TAP - (n - 1) * BTN_GAP;
    const controlsTop = by;
    for (const b of hints ? [this.#play, this.#pass, this.#hint] : [this.#play, this.#pass]) {
      b.setY(by);
      by += TAP + BTN_GAP;
    }
    this.#hint.setVisible(this.#hints);
    this.#play.setEnabled(v.exact !== null);
    this.#pass.setEnabled(v.canPass);
    this.#hint.setEnabled(humanTurn(g) && v.legal.length > 0);

    // the sign: who, then what
    const signY = r.y + 2 + 44 + GAP;
    const signKey = v.sign.who + "\n" + v.sign.text + "\n" + controlsTop;
    if (signKey !== this.#signKey) {
      this.#signKey = signKey;
      this.#signWho.setText(v.sign.who).setPosition(r.x + 6, signY + 4);
      const whoH = Math.round(this.#signWho.height) - 4;
      this.#signText.setText(v.sign.text).setPosition(r.x + 6, signY + 4 + whoH + 1);
      maxLines(this.#signText, 3);
      const h = whoH + 1 + Math.round(this.#signText.height) - 4 + 8;
      this.#signBg?.destroy();
      this.#signBg = painted(this.scene, "sign", r.x, signY, r.w - this.#clearR, h, (ctx, w, bh) => {
        ctx.fillStyle = "rgba(18, 10, 4, 0.45)";
        roundRect(ctx, 0, 0, w, bh, 4);
        ctx.fill();
        ctx.strokeStyle = "rgba(201, 176, 138, 0.14)";
        ctx.lineWidth = 1;
        roundRect(ctx, 0.5, 0.5, w - 1, bh - 1, 3.5);
        ctx.stroke();
      });
      this.scene.children.moveBelow(this.#signBg as Phaser.GameObjects.GameObject, this.#signWho as Phaser.GameObjects.GameObject);
      this.#signBg.setData("bottom", signY + h);
    }

    // the status, clipped to what is left above the buttons
    const statusY = ((this.#signBg?.getData("bottom") as number) ?? signY) + GAP;
    const statusKey = v.status.text + v.status.tone + controlsTop;
    if (statusKey !== this.#statusKey) {
      this.#statusKey = statusKey;
      const color = v.status.tone === "bad" ? CSS.bad : v.status.tone === "good" ? CSS.good : CSS.dust;
      setTextColor(this.#status, v.status.text, color).setPosition(r.x + (r.w - this.#clearR) / 2, statusY);
      const lines = Math.max(0, Math.floor((controlsTop - GAP - statusY) / (FS_MIN * 1.3)));
      if (lines === 0) this.#status.setText("");
      else maxLines(this.#status, lines);
    }
  }
}

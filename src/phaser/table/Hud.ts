/**
 * Everything on the table that is not a card or a badge (render/tableLayout.ts): round and tally
 * in the felt's top-left corner, the menu in its top-right, and the band just above the hand —
 * the sign (who played what, signFor) and the status line (statusFor's text and tone) on the left,
 * the buttons on the right, side by side: Pass, Play when Settings › Flick to play is off (a flick
 * plays otherwise), Hint when Settings › Hints is on. Every enablement rule is a store value; the
 * only decision made here is which button was tapped. The status is the one item that gives way
 * (and clips) when a long sign crowds it.
 */
import Phaser from "phaser";
import { COPY } from "../../game/copy";
import { HUMAN, hintFor, humanTurn, primaryAction } from "../../game/selectors";
import type { GameStore, GameView } from "../../game/store";
import { CTRL_BTN_W, CTRL_GAP, type TableLayout } from "../../render/tableLayout";
import type { Opts } from "../../settings/settings";
import { maxLines, painted, roundRect, setTextColor, text } from "../paint";
import { CSS, FS_BODY, FS_EM, FS_MIN, TAP } from "../theme";
import { EASE, MOTION } from "../../game/timing";
import { pop } from "../fx";
import { ms } from "../motion";
import { target } from "../probe";
import { Button, IconButton } from "../widgets";

/** A changed sign or status eases up this far as it fades in. */
const TEXT_RISE = 4;
/** The info panel's inner padding. */
const PAD_X = 6;
const PAD_Y = 3;
/** One line of FS_MIN / FS_BODY text, as drawn (Text adds ~4 px of padding). */
const LINE_MIN = Math.round(FS_MIN * 1.25);
const LINE_BODY = Math.round(FS_BODY * 1.25);

/** Which buttons the band shows, left to right, for these settings. */
export function bandButtons(o: Pick<Opts, "flick" | "hints">): ("hint" | "pass" | "play")[] {
  return [...(o.hints ? (["hint"] as const) : []), "pass", ...(o.flick ? [] : (["play"] as const))];
}

export class HudView {
  readonly scene: Phaser.Scene;
  readonly #t: TableLayout;
  #roundN: Phaser.GameObjects.Text;
  #tallyN: Phaser.GameObjects.Text;
  #round: Phaser.GameObjects.Text;
  #you: Phaser.GameObjects.Text;
  #signWho: Phaser.GameObjects.Text;
  #signText: Phaser.GameObjects.Text;
  #status: Phaser.GameObjects.Text;
  #play: Button;
  #pass: Button;
  #hint: Button;
  #shown: ("hint" | "pass" | "play")[] = [];
  #signKey = "";
  #statusKey = "";
  /** Where the status starts, below the sign. */
  #statusY = 0;

  constructor(scene: Phaser.Scene, t: TableLayout, store: GameStore, onMenu: () => void) {
    this.scene = scene;
    this.#t = t;
    const c = t.corner;
    const x = c.x + 4;
    const y = c.y + 4;
    this.#round = text(scene, x, y, COPY.topbar.round + " ", { size: FS_MIN, color: CSS.dust });
    this.#roundN = text(scene, x, y, "", { size: FS_MIN, color: CSS.bone, bold: true });
    // "You +3" on the second line, the number in the same amber as the opponents' card counts
    this.#you = text(scene, x, y + 24, COPY.topbar.you + " ", { size: FS_MIN, color: CSS.dust });
    this.#tallyN = text(scene, x, y + 21, "", { size: FS_EM, color: CSS.amber, bold: true });
    const m = t.menu;
    target(scene, "table.menu", new IconButton(scene, m.x + m.w - TAP + 6, m.y - 4, "menu", onMenu), { w: TAP, h: TAP });

    // the band's info panel: a dark wash under the sign and the status
    const r = t.info;
    painted(scene, "sign", r.x, r.y, r.w, r.h, paintSign);
    const textW = r.w - 2 * PAD_X;
    this.#signWho = text(scene, r.x + PAD_X, r.y + PAD_Y, "", { size: FS_MIN, color: CSS.dust });
    this.#signText = text(scene, 0, 0, "", { size: FS_BODY, color: CSS.bone });
    this.#status = text(scene, r.x + PAD_X, 0, "", { size: FS_MIN, color: CSS.dust, wrap: textW, lineHeight: 1.2 });

    const { act } = store;
    // a tap on a switched-off control: it shakes "no" and the status line, which says why, pops
    const why = () => pop(scene, this.#status, 1.08);
    const by = t.controls.y;
    this.#play = new Button(scene, 0, by, CTRL_BTN_W, TAP, COPY.controls.play, {
      kind: "primary",
      onClick: () => {
        const e = store.view.exact;
        if (e) act({ type: "PLAY", player: HUMAN, cards: e.cards });
      },
      onDisabledTap: why,
    });
    // Pass turns primary when it is the only move there is (selectors.primaryAction)
    this.#pass = new Button(scene, 0, by, CTRL_BTN_W, TAP, COPY.controls.pass, { onClick: () => act({ type: "PASS", player: HUMAN }), onDisabledTap: why, alsoKinds: ["primary"] });
    this.#hint = new Button(scene, 0, by, CTRL_BTN_W, TAP, COPY.controls.hint, {
      onClick: () => {
        const v = store.view;
        const m = hintFor(v.game, v.legal, Math.random);
        if (m) store.setSelection(m.cards);
      },
    });
    target(scene, "table.play", this.#play, { w: CTRL_BTN_W, h: TAP }, () => this.#play.enabled);
    target(scene, "table.pass", this.#pass, { w: CTRL_BTN_W, h: TAP }, () => this.#pass.enabled);
    target(scene, "table.hint", this.#hint, { w: CTRL_BTN_W, h: TAP }, () => this.#hint.enabled);
  }

  update(v: GameView, opts: Pick<Opts, "flick" | "hints">): void {
    const g = v.game;
    if (!g) return;
    const c = this.#t.corner;
    this.#roundN.setText(String(g.round)).setX(c.x + 4 + Math.round(this.#round.width) - 2);
    const total = g.totals[HUMAN];
    this.#tallyN.setText((total > 0 ? "+" : "") + total).setX(c.x + 4 + Math.round(this.#you.width) - 2);

    // the buttons, right-aligned in the band, side by side
    this.#shown = bandButtons(opts);
    const ctl = this.#t.controls;
    let bx = ctl.x + ctl.w - this.#shown.length * CTRL_BTN_W - (this.#shown.length - 1) * CTRL_GAP;
    for (const [k, b] of [["hint", this.#hint], ["pass", this.#pass], ["play", this.#play]] as const) {
      const on = this.#shown.includes(k);
      b.setVisible(on);
      if (!on) continue;
      b.setX(bx);
      bx += CTRL_BTN_W + CTRL_GAP;
    }
    this.#play.setEnabled(v.exact !== null);
    this.#pass.setEnabled(v.canPass).setKind(primaryAction(v.exact, v.canPass, v.legal) === "pass" ? "primary" : "normal");
    this.#hint.setEnabled(humanTurn(g) && v.legal.length > 0);

    // the sign: who, then what — on one line when they fit, the what below otherwise
    const r = this.#t.info;
    const signKey = v.sign.who + "\n" + v.sign.text;
    if (signKey !== this.#signKey) {
      this.#signKey = signKey;
      // "Table" over a line like "Waiting on the opening play" says nothing: only a player is named
      this.#signWho.setText(v.sign.who === COPY.sign.table ? "" : v.sign.who).setPosition(r.x + PAD_X, r.y + PAD_Y);
      const whoW = this.#signWho.text ? Math.round(this.#signWho.width) + 6 : 0;
      const inner = r.w - 2 * PAD_X;
      if (!whoW || fitsOneLine(this.#signText, v.sign.text, inner - whoW)) {
        this.#signText.setPosition(r.x + PAD_X + whoW, r.y + PAD_Y - 1);
        this.#statusY = r.y + PAD_Y + LINE_BODY;
      } else {
        this.#signText.setPosition(r.x + PAD_X, r.y + PAD_Y + LINE_MIN - 1);
        this.#statusY = r.y + PAD_Y + LINE_MIN + LINE_BODY;
      }
      oneLine(this.#signText, v.sign.text, whoW && this.#signText.x > r.x + PAD_X ? inner - whoW : inner);
      this.#fadeIn(this.#signWho);
      this.#fadeIn(this.#signText);
      this.#statusKey = "";
    }

    // the status, clipped to what is left of the panel below the sign
    const statusKey = v.status.text + v.status.tone;
    if (statusKey !== this.#statusKey) {
      this.#statusKey = statusKey;
      const color = v.status.tone === "bad" ? CSS.bad : v.status.tone === "good" ? CSS.good : CSS.dust;
      setTextColor(this.#status, v.status.text, color).setY(this.#statusY);
      const lines = Math.max(0, Math.floor((r.y + r.h - this.#statusY) / Math.round(FS_MIN * 1.2)));
      if (lines === 0) this.#status.setText("");
      else maxLines(this.#status, lines);
      this.#fadeIn(this.#status);
    }
  }

  /** A text that just changed eases in from a few px lower instead of snapping (MOTION.micro). */
  #fadeIn(t: Phaser.GameObjects.Text): void {
    const d = ms(MOTION.micro);
    if (!d) return;
    const y = t.y;
    this.scene.tweens.killTweensOf(t);
    t.setAlpha(0).setY(y + TEXT_RISE);
    this.scene.tweens.add({ targets: t, alpha: 1, y, duration: d, ease: EASE.enter });
  }

  /**
   * The control the player is being asked for, nudged once: Play or Pass when one is primary and
   * showing (selectors.primaryAction), else Hint when it is on and has something to show. False
   * when nothing qualifies, so the table can point at the hand instead (a flick plays).
   */
  nudge(v: GameView): boolean {
    const primary = primaryAction(v.exact, v.canPass, v.legal);
    if (primary === "play" && this.#shown.includes("play")) this.#play.nudge();
    else if (primary === "pass") this.#pass.nudge();
    else if (this.#shown.includes("hint") && this.#hint.enabled) this.#hint.nudge();
    else return false;
    return true;
  }
}

/** Whether `s` fits on one line `maxW` wide in `t`'s style. */
function fitsOneLine(t: Phaser.GameObjects.Text, s: string, maxW: number): boolean {
  t.setText(s);
  return t.width <= maxW;
}

/** `s` on one line at most `maxW` wide: whole words, then "…". */
function oneLine(t: Phaser.GameObjects.Text, s: string, maxW: number): void {
  const words = s.split(" ");
  t.setText(s);
  while (t.width > maxW && words.length > 1) {
    words.pop();
    t.setText(words.join(" ").replace(/[\s,.;:—-]+$/, "") + "…");
  }
}

/** The info panel's box: a dark wash with a faint edge. */
function paintSign(ctx: CanvasRenderingContext2D, w: number, bh: number): void {
  ctx.fillStyle = "rgba(18, 10, 4, 0.45)";
  roundRect(ctx, 0, 0, w, bh, 4);
  ctx.fill();
  ctx.strokeStyle = "rgba(201, 176, 138, 0.14)";
  ctx.lineWidth = 1;
  roundRect(ctx, 0.5, 0.5, w - 1, bh - 1, 3.5);
  ctx.stroke();
}

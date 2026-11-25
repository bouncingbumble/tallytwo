/**
 * Everything on the table that is not a card or a chip (render/tableLayout.ts): round and tally
 * on a plaque in the top-left corner, the menu on one in the top-right, and the buttons just above
 * the hand on the right, side by side: Pass, Play (Settings › Play button, on by default, and
 * always while Flick to play is off), Hint when Settings › Hints is on. Every enablement rule is a store value; the
 * only decision made here is which button was tapped.
 */
import Phaser from "phaser";
import { COPY } from "../../game/copy";
import { HUMAN, hintFor, humanTurn, primaryAction } from "../../game/selectors";
import type { GameStore, GameView } from "../../game/store";
import { CTRL_BTN_W, CTRL_GAP, type TableLayout } from "../../render/tableLayout";
import type { Opts } from "../../settings/settings";
import { painted, roundRect, text } from "../paint";
import { CSS, FS_EM, FS_MIN, TAP } from "../theme";
import { target } from "../probe";
import { Button, IconButton } from "../widgets";

/** Which buttons the band shows, left to right, for these settings. */
export function bandButtons(o: Pick<Opts, "flick" | "hints" | "playButton">): ("hint" | "pass" | "play")[] {
  const play = o.playButton || !o.flick;
  return [...(o.hints ? (["hint"] as const) : []), "pass", ...(play ? (["play"] as const) : [])];
}

export class HudView {
  readonly scene: Phaser.Scene;
  readonly #t: TableLayout;
  #roundN: Phaser.GameObjects.Text;
  #tallyN: Phaser.GameObjects.Text;
  #round: Phaser.GameObjects.Text;
  #you: Phaser.GameObjects.Text;
  #play: Button;
  #pass: Button;
  #hint: Button;
  #shown: ("hint" | "pass" | "play")[] = [];

  constructor(scene: Phaser.Scene, t: TableLayout, store: GameStore, onMenu: () => void) {
    this.scene = scene;
    this.#t = t;
    // the score and the menu on brass-edged plaques in the wood's top corners
    const c = t.corner;
    painted(scene, "plaque", c.x, c.y, c.w, c.h, paintPlaque, PLAQUE_PAD);
    const y = c.y + 7;
    this.#round = text(scene, 0, y, COPY.topbar.round + " ", { size: FS_MIN, color: CSS.dust });
    this.#roundN = text(scene, 0, y, "", { size: FS_MIN, color: CSS.bone, bold: true });
    // "You +3" on the second line, the number in the same amber as the opponents' card counts
    this.#you = text(scene, 0, y + 25, COPY.topbar.you + " ", { size: FS_MIN, color: CSS.dust });
    this.#tallyN = text(scene, 0, y + 22, "", { size: FS_EM, color: CSS.amber, bold: true });
    const m = t.menu;
    painted(scene, "plaque", m.x, m.y, m.w, m.h, paintPlaque, PLAQUE_PAD);
    target(scene, "table.menu", new IconButton(scene, m.x + (m.w - TAP) / 2, m.y + (m.h - TAP) / 2, "menu", onMenu), { w: TAP, h: TAP });

    const { act } = store;
    // a tap on a switched-off control shakes it "no" (widgets.Button)
    const by = t.controls.y;
    this.#play = new Button(scene, 0, by, CTRL_BTN_W, TAP, COPY.controls.play, {
      kind: "primary",
      onClick: () => {
        const e = store.view.exact;
        if (e) act({ type: "PLAY", player: HUMAN, cards: e.cards });
      },
    });
    // Pass turns primary when it is the only move there is (selectors.primaryAction)
    this.#pass = new Button(scene, 0, by, CTRL_BTN_W, TAP, COPY.controls.pass, { onClick: () => act({ type: "PASS", player: HUMAN }), alsoKinds: ["primary"] });
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

  update(v: GameView, opts: Pick<Opts, "flick" | "hints" | "playButton">): void {
    const g = v.game;
    if (!g) return;
    // each line centred on the plaque
    const c = this.#t.corner;
    const centre = (label: Phaser.GameObjects.Text, n: Phaser.GameObjects.Text, s: string) => {
      n.setText(s);
      const lw = Math.round(label.width) - 2;
      const x = c.x + Math.round((c.w - lw - Math.round(n.width)) / 2);
      label.setX(x);
      n.setX(x + lw);
    };
    centre(this.#round, this.#roundN, String(g.round));
    const total = g.totals[HUMAN];
    centre(this.#you, this.#tallyN, (total > 0 ? "+" : "") + total);

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

/** Room round a plaque for its drop shadow. */
const PLAQUE_PAD = 8;

/** A plaque: dark polished wood with a brass edge and a drop shadow, raised off the boards. */
function paintPlaque(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 3;
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, "#4a2d17");
  g.addColorStop(1, "#24140a");
  ctx.fillStyle = g;
  roundRect(ctx, 0, 0, w, h, 7);
  ctx.fill();
  ctx.restore();
  // the brass edge, a dark line inside it, and a sheen across the top
  ctx.strokeStyle = "#b07a2c";
  ctx.lineWidth = 2;
  roundRect(ctx, 1, 1, w - 2, h - 2, 6);
  ctx.stroke();
  ctx.strokeStyle = "rgba(0, 0, 0, 0.6)";
  ctx.lineWidth = 1;
  roundRect(ctx, 2.5, 2.5, w - 5, h - 5, 4.5);
  ctx.stroke();
  ctx.fillStyle = "rgba(255, 220, 170, 0.07)";
  roundRect(ctx, 3, 3, w - 6, h / 2 - 3, 4);
  ctx.fill();
}

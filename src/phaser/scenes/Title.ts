/**
 * The title (P:222-229, P:1220-1229), a saloon front: the name over the SALOON sign, the batwing
 * doors and the props around them on the left; the painting and the three buttons on the right;
 * floorboards along the bottom; sconces and a chip pile in the corners of a wide canvas.
 *
 * Its buttons are the first user gesture, so all three call audio.init() fire-and-forget (Phaser
 * dispatches input inside the browser's own pointer event, which is what Safari's audio unlock
 * wants). Deal me in swings the doors and deals after DOORS_MS. The buttons appear only once
 * the settings have hydrated, so a deal never starts with the wrong rules.
 */
import { COPY } from "../../game/copy";
import { newSeed } from "../../game/seeds";
import { DOORS_MS } from "../../game/timing";
import { WIDE_W } from "../../platform/env";
import { art, standing } from "../art";
import { painted, text } from "../paint";
import { CSS, FS_BODY, TAP, WESTERN } from "../theme";
import { target } from "../probe";
import { Button } from "../widgets";
import { BaseScene } from "./base";
import { TableScene } from "./Table";

const SCENE_W = 340;
const SCENE_H = 226;
const FLOOR_H = 28;
/** The title has settled (its first frames drawn, nothing animating) by then. */
const PREWARM_AFTER_MS = 400;

export class TitleScene extends BaseScene {
  #dealing = false;

  constructor() {
    super("Title");
  }

  create(): void {
    this.setup();
    this.#dealing = false;
    const { W, H } = this;

    // the room: lamplight from above over dark boards
    painted(this, "title-bg", 0, 0, W, H, (ctx, w, h) => {
      const lin = ctx.createLinearGradient(0, 0, 0, h);
      lin.addColorStop(0, "#2e1b0c");
      lin.addColorStop(1, "#1a0f07");
      ctx.fillStyle = lin;
      ctx.fillRect(0, 0, w, h);
      const rx = w * 0.6;
      const ry = h * 0.35 * 2;
      ctx.save();
      ctx.translate(w / 2, h * 0.12);
      ctx.scale(1, ry / rx);
      const rad = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      rad.addColorStop(0, "rgba(232, 163, 61, 0.28)");
      rad.addColorStop(0.62, "rgba(232, 163, 61, 0)");
      ctx.fillStyle = rad;
      ctx.fillRect(-w, -h * 4, w * 2, h * 8);
      ctx.restore();
    });
    // the floorboards
    this.add
      .tileSprite(0, H - FLOOR_H, W, FLOOR_H, "wood")
      .setOrigin(0, 0)
      .setTileScale(1 / 3);
    painted(this, "title-floor", 0, H - FLOOR_H, W, FLOOR_H, (ctx, w, h) => {
      const g = ctx.createLinearGradient(0, 0, 0, 8);
      g.addColorStop(0, "rgba(0,0,0,0.65)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "rgba(232, 163, 61, 0.25)";
      ctx.fillRect(0, 0, w, 1);
    });

    if (W >= WIDE_W) {
      art(this, 28, 22, "sconce");
      art(this, W - 28 - 38, 22, "sconce_silver");
      art(this, W - 26 - 94, H - 18 - 48, "chips_pile");
    }

    // marquee and menu side by side, centred, standing on the line 36 px above the bottom
    const floor = H - 36;
    const titleSize = Math.round(Math.min(54, Math.max(34, W * 0.07)));
    const menuW = Math.floor(Math.min(260, W * 0.36));
    const gap = 40;
    const total = SCENE_W + gap + menuW;
    const left = Math.max(24, Math.floor((W - total) / 2));

    // the saloon front: the props stand on the scene's bottom edge
    const sx = left;
    const sy = floor - SCENE_H;
    const name = text(this, sx + SCENE_W / 2, sy - 12, COPY.title.name, {
      size: titleSize,
      font: WESTERN,
      color: CSS.amber,
      align: "center",
      shadow: { x: 0, y: 3, color: "#6b3f12" },
      letterSpacing: titleSize * 0.01,
    }).setOrigin(0.5, 1);
    name.setShadow(0, 3, "#6b3f12", 0, false, true);
    art(this, sx + 125, sy, "sign_saloon");
    const doorsX = sx + 77;
    const doorsY = sy + 68;
    const glow = painted(this, "doors-glow", doorsX + 14, doorsY + 16, 186 - 28, 158 - 20, (ctx, w, h) => {
      ctx.save();
      ctx.translate(w / 2, h * 0.55);
      ctx.scale(1, h / w);
      const r = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.6 * 0.7);
      r.addColorStop(0, "rgba(232, 163, 61, 0.85)");
      r.addColorStop(1, "rgba(232, 163, 61, 0)");
      ctx.fillStyle = r;
      ctx.fillRect(-w, -w, w * 2, w * 2);
      ctx.restore();
    }).setAlpha(0.35);
    const closed = art(this, doorsX, doorsY, "doors_closed");
    const ajar = art(this, doorsX, doorsY, "doors_ajar").setVisible(false);
    const open = art(this, doorsX, doorsY, "doors_open").setVisible(false);
    standing(this, sx + 10, floor, "barrel");
    standing(this, sx + 18, floor - 66, "lamp");
    standing(this, sx + 46, floor, "chips");
    standing(this, sx + 266, floor, "stool");
    standing(this, sx + 300, floor, "plant");

    // the menu: the painting over three buttons
    const mx = left + SCENE_W + gap;
    const btnH = 60;
    const menuH = 94 + 14 + 3 * btnH + 2 * 10;
    const my = floor - menuH;
    art(this, mx + Math.floor((menuW - 86) / 2), my, "painting");
    const by = my + 94 + 14;
    const menu = this.add.container(0, 0);
    const { game, settings, sheet } = this.app;

    const deal = () => {
      if (this.#dealing) return; // the doors are already swinging: a double tap deals once
      this.#dealing = true;
      void game.audio.init();
      this.tweens.add({ targets: glow, alpha: 0.95, duration: 500, ease: "Sine.InOut" });
      this.after(200, () => {
        closed.setVisible(false);
        ajar.setVisible(true);
      });
      this.after(420, () => {
        ajar.setVisible(false);
        open.setVisible(true);
      });
      this.after(DOORS_MS, () => game.act({ type: "NEW_MATCH", seed: this.app.seed ?? newSeed(1), rules: settings.rules }));
    };
    const openSheet = (s: "howto" | "settings") => {
      void game.audio.init();
      sheet.set(s);
    };
    const bDeal = new Button(this, mx, by, menuW, btnH, COPY.title.deal, { kind: "primary", onClick: deal });
    const bHow = new Button(this, mx, by + btnH + 10, menuW, btnH, COPY.title.howto, { kind: "ghost", onClick: () => openSheet("howto") });
    const bSet = new Button(this, mx, by + 2 * (btnH + 10), menuW, btnH, COPY.title.settings, { kind: "ghost", onClick: () => openSheet("settings") });
    menu.add([bDeal, bHow, bSet]);
    target(this, "title.deal", bDeal, { w: menuW, h: btnH });
    target(this, "title.howto", bHow, { w: menuW, h: btnH });
    target(this, "title.settings", bSet, { w: menuW, h: btnH });
    menu.setVisible(settings.loaded);
    this.watch(settings, () => menu.setVisible(settings.loaded));

    // the top line, one at a time: a waiting update (platform/offline.ts; offered here only, never
    // mid-match) wins over "add to Home Screen" (platform/install.ts), which on iOS turns into the steps
    const { update, install } = this.app;
    const lineW = Math.min(W - 32, 460);
    const box = this.add.container(Math.floor((W - lineW) / 2), 6);
    const line = text(this, lineW / 2, TAP / 2, "", { size: FS_BODY, color: CSS.amber, align: "center", wrap: lineW }).setOrigin(0.5, 0.5);
    const hit = this.add.zone(0, 0, lineW, TAP).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    box.add([line, hit]);
    let iosSteps = false;
    const show = (): void => {
      const m = install.mode.get();
      const s = update.ready.get() ? COPY.title.update : m === "none" ? "" : m === "ios" && iosSteps ? COPY.title.installIOS : COPY.title.install;
      line.setText(s);
      box.setVisible(s !== "");
    };
    hit.on("pointerup", () => {
      if (update.ready.get()) return update.apply();
      if (install.mode.get() === "prompt") return install.run();
      iosSteps = !iosSteps; // ios: the steps, and a second tap puts the offer back
      show();
    });
    target(this, "title.update", box, { w: lineW, h: TAP }, () => update.ready.get());
    target(this, "title.install", box, { w: lineW, h: TAP }, () => !update.ready.get() && install.mode.get() !== "none");
    show();
    this.watch(update.ready, show);
    this.watch(install.mode, show);

    // while nothing moves here, paint the table's textures so the first deal does not (TableScene.prewarm)
    this.after(PREWARM_AFTER_MS, () => {
      if (!this.#dealing) TableScene.prewarm(this);
    });
  }
}

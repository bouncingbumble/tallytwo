/**
 * The "turn your phone sideways" gate over everything while a phone is held upright; the game
 * pauses behind it (the director folds `upright` into the store's pause). A phone outline turns
 * from upright to sideways on a loop.
 */
import { ms } from "../motion";
import { text } from "../paint";
import { C, CSS, WESTERN } from "../theme";
import { blocker } from "../widgets";
import { BaseScene } from "./base";

export class RotateScene extends BaseScene {
  constructor() {
    super("Rotate");
  }

  create(): void {
    this.setup();
    const { W, H } = this;
    blocker(this, W, H);
    this.add.tileSprite(0, 0, W, H, "wood").setOrigin(0, 0).setTileScale(1 / 3);
    this.add.rectangle(0, 0, W, H, C.oakDeep, 0.6).setOrigin(0, 0);
    const cx = W / 2;
    const phone = this.add.container(cx, H / 2 - 70);
    const g = this.add.graphics();
    g.lineStyle(4, C.bone, 1);
    g.strokeRoundedRect(-28, -48, 56, 96, 10);
    g.fillStyle(C.felt, 1);
    g.fillRoundedRect(-20, -38, 40, 76, 3);
    phone.add(g);
    const d = ms(2400);
    if (d) {
      this.tweens.chain({
        targets: phone,
        loop: -1,
        tweens: [
          { angle: 0, duration: d * 0.2 },
          { angle: -90, duration: d * 0.3, ease: "Sine.InOut" },
          { angle: -90, duration: d * 0.3 },
          { angle: 0, duration: d * 0.2, ease: "Sine.InOut" },
        ],
      });
    } else phone.setAngle(-90);
    // the title wraps on a narrow upright phone, so stack each line under the real height of the one above
    const title = text(this, cx, 0, "Turn your phone sideways", { size: 26, font: WESTERN, color: CSS.amber, align: "center", wrap: W - 40 }).setOrigin(0.5, 0);
    const body = text(this, cx, 0, "Tally Two is played with your phone held horizontally.", { size: 16, color: CSS.dust, align: "center", wrap: Math.min(280, W - 40) }).setOrigin(0.5, 0);
    const phoneH = 120;
    const gap = 16;
    const layout = (): void => {
      const total = phoneH + gap + title.height + gap / 2 + body.height;
      const top = Math.max(20, (H - total) / 2);
      phone.setY(top + phoneH / 2);
      title.setY(top + phoneH + gap);
      body.setY(title.y + title.height + gap / 2);
    };
    layout();
    // the western face can land after this scene is built; measure again once it has
    void document.fonts?.ready.then(() => {
      if (!title.active) return;
      title.updateText();
      layout();
    });
  }
}

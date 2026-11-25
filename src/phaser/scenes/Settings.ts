/**
 * The settings sheet, labels verbatim from copy.ts. One sheet serves the title and
 * the table; only the footer differs: "Done" from the title; the seed line and Copy game log /
 * Quit game / Back to table in a game. Everything applies live, rules included (the store pushes
 * a rules change into the game in progress). No playback here: the audio director follows the
 * switches via the settings store.
 */
import type Phaser from "phaser";
import type { Difficulty } from "../../ai/choose";
import { serializeLog } from "../../game/appReducer";
import { COPY } from "../../game/copy";
import { gameLog } from "../../game/selectors";
import { COPIED_MS, type GameSpeed } from "../../game/timing";
import type { MotionPref, Volume } from "../../settings/settings";
import { text } from "../paint";
import { copyText } from "../services";
import { CSS, FS_BODY, FS_EM, FS_MIN, TAP, WESTERN } from "../theme";
import { target } from "../probe";
import { Button, Picker, Slider, Switch } from "../widgets";
import { SheetScene } from "./sheet";

const t = COPY.settings;
const DIFFICULTY: readonly { value: Difficulty; label: string }[] = [
  { value: "easy", label: t.easy },
  { value: "medium", label: t.medium },
  { value: "hard", label: t.hard },
];
const GAME_SPEED: readonly { value: GameSpeed; label: string }[] = [
  { value: "slow", label: t.slow },
  { value: "normal", label: t.normal },
  { value: "fast", label: t.fast },
];
const MOTION_PICK: readonly { value: MotionPref; label: string }[] = [
  { value: "auto", label: t.motionAuto },
  { value: "full", label: t.motionFull },
  { value: "reduced", label: t.motionReduced },
];
const PICKER_W = 176;
const SLIDER_W = 200;

export class SettingsScene extends SheetScene {
  constructor() {
    super("Settings");
  }

  protected build(): number {
    const { settings, game } = this.app;
    const c = this.content;
    const w = this.innerW;
    let y = this.top;
    const close = () => this.close();

    c.add(text(this, 0, y, t.title, { size: 26, font: WESTERN, color: CSS.amber }));
    y += 42;

    const heading = (s: string) => {
      y += 10;
      c.add(text(this, 0, y, s, { size: FS_BODY, color: CSS.dust, bold: true }));
      y += 24;
    };
    /** One labelled row, at least TAP tall; a tap on the label works the control too. */
    const row = (label: string, hint: string | undefined, controlW: number, control: (x: number, y: number) => Phaser.GameObjects.GameObject, onLabel?: () => void) => {
      const labelW = w - controlW - 12;
      const l = text(this, 0, 0, label, { size: FS_EM, wrap: labelW, lineHeight: 1.25 });
      const hl = hint ? text(this, 0, 0, hint, { size: FS_MIN, color: CSS.dust, wrap: labelW, lineHeight: 1.25 }) : null;
      const lh = Math.round(l.height) - 4 + (hl ? Math.round(hl.height) - 4 + 2 : 0);
      const h = Math.max(TAP, lh + 8);
      l.setPosition(0, y + Math.round((h - lh) / 2) - 2);
      hl?.setPosition(0, l.y + Math.round(l.height) - 4 + 2);
      c.add(l);
      if (hl) c.add(hl);
      c.add(control(w - controlW, y + Math.round((h - TAP) / 2)));
      if (onLabel) {
        const z = this.add.zone(0, y, labelW, h).setOrigin(0, 0).setInteractive();
        z.on("pointerup", (p: Phaser.Input.Pointer) => {
          if (p.getDistance() / this.cameras.main.zoom < 10) onLabel();
        });
        c.add(z);
      }
      y += h + 2;
      const rule = this.add.rectangle(0, y - 1, w, 1, 0xc9b08a, 0.14).setOrigin(0, 0);
      c.add(rule);
    };
    const switchRow = (label: string, hint: string | undefined, get: () => boolean, set: (v: boolean) => void) => {
      let sw: Switch | null = null;
      const flip = (v: boolean) => {
        set(v);
        sw?.set(v);
      };
      row(label, hint, Switch.W, (x, ry) => {
        sw = new Switch(this, x, ry, get(), flip);
        target(this, `settings.switch.${label}`, sw, { w: Switch.W, h: TAP });
        return sw;
      }, () => flip(!get()));
    };

    const rules = () => settings.rules;
    const opts = () => settings.opts;
    const setVolume = (patch: Partial<Volume>) => settings.setOpts({ volume: { ...opts().volume, ...patch } });

    heading(t.tableRules);
    switchRow(t.straightWrap, t.straightWrapHint, () => rules().straightWrap, (v) => settings.setRules({ straightWrap: v }));
    heading(t.tableFeel);
    row(t.difficulty, undefined, PICKER_W, (x, ry) => new Picker(this, x, ry, PICKER_W, DIFFICULTY, opts().difficulty, (v) => settings.setOpts({ difficulty: v })));
    row(t.gameSpeed, t.gameSpeedHint, PICKER_W, (x, ry) => new Picker(this, x, ry, PICKER_W, GAME_SPEED, opts().gameSpeed, (v) => settings.setOpts({ gameSpeed: v })));
    row(t.motion, t.motionHint, PICKER_W, (x, ry) => new Picker(this, x, ry, PICKER_W, MOTION_PICK, opts().motion, (v) => settings.setOpts({ motion: v })));
    switchRow(t.hints, t.hintsHint, () => opts().hints, (v) => settings.setOpts({ hints: v }));
    switchRow(t.swipe, t.swipeHint, () => opts().swipe, (v) => settings.setOpts({ swipe: v }));
    switchRow(t.flick, t.flickHint, () => opts().flick, (v) => settings.setOpts({ flick: v }));
    switchRow(t.sfx, undefined, () => opts().sfx, (v) => settings.setOpts({ sfx: v }));
    row(`${t.volume} · ${t.volumeMusic}`, undefined, SLIDER_W, (x, ry) => new Slider(this, x, ry, SLIDER_W, opts().volume.music, (v) => setVolume({ music: v })));
    row(`${t.volume} · ${t.volumeSfx}`, undefined, SLIDER_W, (x, ry) => new Slider(this, x, ry, SLIDER_W, opts().volume.sfx, (v) => setVolume({ sfx: v })));

    y += 14;
    const g = game.game;
    if (g === null) {
      const done = new Button(this, 0, y, w, TAP, t.done, { kind: "primary", onClick: close });
      c.add(done);
      target(this, "settings.done", done, { w, h: TAP });
      return y + TAP;
    }
    c.add(text(this, 0, y, t.seedLine(g.seed, g.round), { size: FS_MIN, color: CSS.dust }));
    y += 26;
    const bw = Math.floor((w - 16) / 3);
    const copy: Button = new Button(this, 0, y, bw, TAP, t.copyLog, {
      kind: "ghost",
      onClick: () => {
        const now = game.game;
        if (!now) return;
        void copyText(serializeLog(gameLog(now))).then((ok) => {
          if (!ok || !copy.active) return;
          copy.setLabel(t.copied);
          this.after(COPIED_MS, () => copy.setLabel(t.copyLog));
        });
      },
    });
    c.add(copy);
    c.add(
      new Button(this, bw + 8, y, bw, TAP, t.quit, {
        onClick: () => {
          game.act({ type: "QUIT" });
          close();
        },
      }),
    );
    const back = new Button(this, 2 * (bw + 8), y, w - 2 * (bw + 8), TAP, t.back, { kind: "primary", onClick: close });
    c.add(back);
    target(this, "settings.back", back, { w: w - 2 * (bw + 8), h: TAP });
    return y + TAP;
  }
}

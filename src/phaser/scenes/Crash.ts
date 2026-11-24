/**
 * An engine throw as a screen, not a console line. tryReduce() caught it and the store kept the
 * CrashReport; this shows the message, the action that threw and the replayable GameLog
 * (replayLog() in selectors.ts rebuilds the position from a paste of it), with Copy game log and
 * Saddle up — which QUITs to the title; settings live in their own store and survive.
 *
 * The same sheet is the last-resort net for a render-time error (a throw inside a scene, which
 * carries no report): the message and Saddle up, which resets the store to the title.
 */
import { serializeLog } from "../../game/appReducer";
import { COPY } from "../../game/copy";
import { COPIED_MS } from "../../game/timing";
import { text } from "../paint";
import { copyText } from "../services";
import { CSS, FS_MIN, MONO, TAP, WESTERN } from "../theme";
import { Button } from "../widgets";
import { SheetScene } from "./sheet";

export class CrashScene extends SheetScene {
  constructor() {
    super("Crash");
  }

  protected build(): number {
    const { game, fault } = this.app;
    const c = this.content;
    const w = this.innerW;
    let y = this.top;
    const report = game.view.crash;
    const err = fault.get();
    const add = (s: string, o: Parameters<typeof text>[4], gap = 8) => {
      const t = text(this, 0, y, s, { wrap: w, ...o });
      c.add(t);
      y += Math.round(t.height) - 4 + gap;
    };

    if (!report) {
      add(COPY.error.title, { size: 26, font: WESTERN, color: CSS.amber }, 12);
      add(err?.message ?? "", { size: FS_MIN, font: MONO, color: CSS.log }, 16);
      c.add(
        new Button(this, 0, y, w, TAP, COPY.error.saddleUp, {
          kind: "primary",
          onClick: () => {
            fault.set(null);
            game.reset();
          },
        }),
      );
      return y + TAP;
    }

    const log = serializeLog(report);
    add(COPY.crash.title, { size: 26, font: WESTERN, color: CSS.amber }, 12);
    add(COPY.crash.body, { size: 16 });
    add(`${report.error.message} · ${JSON.stringify(report.action)}`, { size: FS_MIN, color: CSS.dust }, 10);
    const bw = Math.floor((w - 8) / 2);
    const copy: Button = new Button(this, 0, y, bw, TAP, COPY.crash.copyLog, {
      onClick: () => {
        void copyText(log).then((ok) => {
          if (!ok || !copy.active) return;
          copy.setLabel(COPY.crash.copied);
          this.after(COPIED_MS, () => copy.setLabel(COPY.crash.copyLog));
        });
      },
    });
    c.add(copy);
    c.add(new Button(this, bw + 8, y, w - bw - 8, TAP, COPY.crash.saddleUp, { kind: "primary", onClick: () => game.act({ type: "QUIT" }) }));
    y += TAP + 14;
    const box = this.add.rectangle(0, y, w, 10, 0x120a04).setOrigin(0, 0);
    c.add(box);
    // a <pre>: indentation kept, long lines hard-wrapped by character (monospace, ~0.6 em a glyph)
    const cols = Math.max(20, Math.floor((w - 20) / (FS_MIN * 0.62)));
    const lines = log.split("\n").flatMap((l) => (l.length <= cols ? [l] : (l.match(new RegExp(`.{1,${cols}}`, "g")) ?? [l])));
    const pre = text(this, 10, y + 10, lines.join("\n"), { size: FS_MIN, font: MONO, color: CSS.log, lineHeight: 1.5 });
    c.add(pre);
    box.height = Math.round(pre.height) + 16;
    return y + box.height;
  }
}

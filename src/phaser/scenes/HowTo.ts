/**
 * How to play (P:284-302, P:1277-1283): the prototype's text from copy.ts, with the two example
 * rows as small cards. It starts no music of its own: the audio director derives the results loop
 * from sheet === "howto".
 */
import { COPY } from "../../game/copy";
import { PLAY_CARD_H, PLAY_CARD_W } from "../../render/scale";
import { CardView } from "../cards";
import { text } from "../paint";
import { CSS, FS_BODY, TAP, WESTERN } from "../theme";
import { target } from "../probe";
import { Button } from "../widgets";
import { SheetScene } from "./sheet";

/** 3♦ 3♠ 2♦ 2♠: the suit order inside the lowest rank, then the same inside the highest. */
const ORDER_EXAMPLE = [0, 3, 48, 51];
/** Four kings and a queen for a kicker. */
const FIVE_EXAMPLE = [40, 41, 42, 43, 36];

export class HowToScene extends SheetScene {
  constructor() {
    super("HowTo");
  }

  protected build(): number {
    const h = COPY.howto;
    const c = this.content;
    const w = this.innerW;
    let y = this.top;
    c.add(text(this, 0, y, h.title, { size: 26, font: WESTERN, color: CSS.amber }));
    y += 42;
    const para = (s: string) => {
      const t = text(this, 0, y + 4, s, { size: FS_BODY, wrap: w, lineHeight: 1.45 });
      c.add(t);
      y += Math.round(t.height) - 4 + 12;
    };
    const heading = (s: string) => {
      y += 8;
      c.add(text(this, 0, y, s, { size: FS_BODY, color: CSS.dust, bold: true }));
      y += 22;
    };
    const cards = (vs: readonly number[]) => {
      vs.forEach((v, i) => c.add(new CardView(this, i * (PLAY_CARD_W + 4) + PLAY_CARD_W / 2, y + 8 + PLAY_CARD_H / 2, v, PLAY_CARD_W, PLAY_CARD_H)));
      y += PLAY_CARD_H + 20;
    };
    para(h.intro);
    heading(h.orderTitle);
    para(h.order);
    cards(ORDER_EXAMPLE);
    heading(h.playTitle);
    para(h.play);
    heading(h.fiveTitle);
    para(h.five);
    cards(FIVE_EXAMPLE);
    heading(h.clearTitle);
    para(h.clear);
    heading(h.payTitle);
    para(h.pay);
    y += 4;
    const got = new Button(this, 0, y, w, TAP, h.gotIt, { kind: "primary", onClick: () => this.app.sheet.set("none") });
    c.add(got);
    target(this, "howto.gotIt", got, { w, h: TAP });
    return y + TAP;
  }
}

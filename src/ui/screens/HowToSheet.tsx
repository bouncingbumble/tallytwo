/**
 * How to play (P:284-302, P:1277-1283): the prototype's text from copy.ts, with the two example
 * rows as small, disabled cards. It starts no music of its own: useAudio derives the results
 * loop from sheet === "howto".
 */
import { COPY } from "../../game/copy";
import { Card } from "../Card";
import { Overlay } from "../Overlay";

/** 3♦ 3♠ 2♦ 2♠: the suit order inside the lowest rank, then the same inside the highest. */
const ORDER_EXAMPLE = [0, 3, 48, 51];
/** Four kings and a queen for a kicker. */
const FIVE_EXAMPLE = [40, 41, 42, 43, 36];

export function HowToSheet({ onClose }: { onClose: () => void }) {
  const t = COPY.howto;
  return (
    <Overlay label={t.title}>
      <div className="sheet howto">
        <h2 className="western">{t.title}</h2>
        <p>{t.intro}</p>
        <h3>{t.orderTitle}</h3>
        <p>{t.order}</p>
        <div className="ex">
          {ORDER_EXAMPLE.map((v) => (
            <Card key={v} value={v} small />
          ))}
        </div>
        <h3>{t.playTitle}</h3>
        <p>{t.play}</p>
        <h3>{t.fiveTitle}</h3>
        <p>{t.five}</p>
        <div className="ex">
          {FIVE_EXAMPLE.map((v) => (
            <Card key={v} value={v} small />
          ))}
        </div>
        <h3>{t.clearTitle}</h3>
        <p>{t.clear}</p>
        <h3>{t.payTitle}</h3>
        <p>{t.pay}</p>
        <div className="ovbtns">
          <button type="button" className="btn primary" onClick={onClose}>
            {t.gotIt}
          </button>
        </div>
      </div>
    </Overlay>
  );
}

/**
 * The last play on the felt, or what the empty felt says. Small cards (one scale step below
 * the hand) at integer x positions PILE_STEP apart, centred in the felt by whole pixels, resting
 * at rotate(0): the prototype's alternating tilt and 40-ms stagger (P:878-885) happen on the
 * way in only (styles/motion.css `slap`). The card group is keyed by the last play so the slap
 * replays on every fresh play and not on a pass (the prototype's `fresh`, P:943-951).
 */
import type { CSSProperties } from "react";
import type { GameState } from "../engine/state";
import { emptyFeltText } from "../game/selectors";
import { SLAP_STAGGER_MS } from "../game/timing";
import { useGame } from "../game/useGame";
import { useDevice } from "../platform/useDevice";
import { useElementWidth } from "../platform/useElementWidth";
import { PILE_STEP } from "../render/fanLayout";
import { smallCardScale } from "../render/scale";
import { Card } from "./Card";

/** The history length as of the last play: changes exactly when cards land on the felt. */
export function lastPlayAt(g: GameState): number {
  let k = g.history.length;
  while (k > 0 && g.history[k - 1].cards.length === 0) k--;
  return k;
}

export function Pile() {
  const { game, dealId } = useGame();
  const { dpr } = useDevice();
  const [ref, availW] = useElementWidth<HTMLDivElement>();
  if (!game) return null;
  const cards = game.lastPlay?.cards ?? [];
  const cardW = smallCardScale(dpr).pointW;
  const span = cards.length ? cardW + (cards.length - 1) * PILE_STEP : 0;
  const x0 = Math.max(0, Math.floor((availW - span) / 2));
  return (
    <div className="pile" ref={ref}>
      {cards.length === 0 ? (
        <div className="empty">{emptyFeltText(game)}</div>
      ) : (
        <div className="cards" key={dealId + "-" + lastPlayAt(game)}>
          {cards.map((v, i) => {
            const x = x0 + i * PILE_STEP;
            const style = {
              "--x": x + "px",
              "--rot": (i % 2 ? 1 : -1) * (1.5 + i * 0.6) + "deg",
              transform: `translate(${x}px, 0)`,
              zIndex: i,
              animationDelay: i * SLAP_STAGGER_MS + "ms",
            } as CSSProperties;
            return <Card small key={v} value={v} className="in" style={style} />;
          })}
        </div>
      )}
    </div>
  );
}

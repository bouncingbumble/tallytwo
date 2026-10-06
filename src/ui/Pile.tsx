/**
 * The trick on the felt: every seat's most recent play since the trick began, each in its own
 * slot (the opponents under their seats, the human's along the bottom), replaced when that seat
 * plays again and cleared when the trick clears (selectors.trickPlays). The latest play — the one
 * to beat — is highlighted; the others rest dimmed. Small cards (one scale step below the hand)
 * at integer x, centred in the slot by whole pixels, resting at rotate(0): the prototype's tilt
 * and 40-ms stagger (P:878-885) happen on the way in only (styles/motion.css `slap`). A seat's
 * card group is keyed by its play, so a new play slaps in and an older one stays still.
 */
import type { CSSProperties } from "react";
import type { GameState } from "../engine/state";
import { HUMAN, type TrickPlay, emptyFeltText, trickPlays } from "../game/selectors";
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

/** Opponents' slots sit under their seats (grid columns 1-3); the human's spans the bottom. */
const SLOTS = [1, 2, 3, HUMAN];
/** A five-card hand in a narrow slot overlaps more than PILE_STEP, but never below this. */
const MIN_STEP = 12;

function Slot({ seat, play, latest, dealId }: { seat: number; play: TrickPlay | undefined; latest: boolean; dealId: number }) {
  const { dpr } = useDevice();
  const [ref, availW] = useElementWidth<HTMLDivElement>();
  const cardW = smallCardScale(dpr).pointW;
  const n = play?.cards.length ?? 0;
  const step = n > 1 ? Math.max(MIN_STEP, Math.min(PILE_STEP, Math.floor((availW - cardW) / (n - 1)))) : 0;
  const span = n ? cardW + (n - 1) * step : 0;
  const x0 = Math.max(0, Math.floor((availW - span) / 2));
  return (
    <div className={`play seat-${seat}${latest ? " latest" : ""}`} ref={ref}>
      {play && (
        <div className="cards" key={`${dealId}-${play.at}`}>
          {play.cards.map((v, i) => {
            const x = x0 + i * step;
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

export function Pile() {
  const { game, dealId } = useGame();
  if (!game) return null;
  const plays = trickPlays(game);
  const bySeat = new Map(plays.map((p) => [p.seat, p]));
  return (
    <>
      {SLOTS.map((seat) => (
        <Slot key={seat} seat={seat} play={bySeat.get(seat)} latest={game.lastPlay !== null && game.lastBy === seat} dealId={dealId} />
      ))}
      {plays.length === 0 && <div className="felt-empty">{emptyFeltText(game)}</div>}
    </>
  );
}

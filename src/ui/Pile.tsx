/**
 * The trick on the felt: each seat's most recent play since the trick began
 * (selectors.trickPlays), replaced when that seat plays again and cleared when the trick
 * clears. The four plays are staggered in three rows under the badges so each can spread wider
 * than a third of the felt (styles/table.css .plays): Dusty's, from the middle seat, in the top
 * row centred under its badge; Marshal Cobb's and Lucky Pearl's in the middle row against the
 * left and right edges under theirs; the human's own play in the bottom row, centred. The rows
 * are anchored to the top, the middle and the bottom of the area from its measured height, so
 * they separate where the felt is tall and overlap where it is short, the latest play — the one
 * to beat — highlighted and on top, the others dimmed.
 *
 * Cards are three quarters of the hand's size (render/scale.ts PLAY_CARD_W, 72x96), at integer
 * x, placed in the slot by whole pixels, resting at rotate(0): the prototype's tilt and 40-ms
 * stagger (P:878-885) happen on the way in only (styles/motion.css `slap`). A seat's card group
 * is keyed by its play, so a new play slaps in and an older one stays still.
 */
import type { CSSProperties } from "react";
import { HUMAN, type TrickPlay, emptyFeltText, trickPlays } from "../game/selectors";
import { SLAP_STAGGER_MS } from "../game/timing";
import { useGame } from "../game/useGame";
import { useElementSize } from "../platform/useElementSize";
import { useElementWidth } from "../platform/useElementWidth";
import { PILE_STEP } from "../render/fanLayout";
import { PLAY_CARD_H, PLAY_CARD_W, PLAY_SLACK_PT } from "../render/scale";
import { Card } from "./Card";

/** Top row, middle row (left and right), bottom row. */
const SEATS = [2, 1, 3, HUMAN];
/** A five-card hand in a narrow slot overlaps more than PILE_STEP, but never below this. */
const MIN_STEP = 12;

/** Where a play sits in its slot: under its player's badge. */
type Align = "start" | "center" | "end";
const ALIGN: Record<number, Align> = { 1: "start", 2: "center", 3: "end", [HUMAN]: "center" };

export function TrickSlot({ seat, play, latest, dealId, top }: { seat: number; play: TrickPlay | undefined; latest: boolean; dealId: number; top?: number }) {
  const [ref, availW] = useElementWidth<HTMLDivElement>();
  const cardW = PLAY_CARD_W;
  const n = play?.cards.length ?? 0;
  const step = n > 1 ? Math.max(MIN_STEP, Math.min(PILE_STEP, Math.floor((availW - cardW) / (n - 1)))) : 0;
  const span = n ? cardW + (n - 1) * step : 0;
  const align = ALIGN[seat] ?? "center";
  const x0 = Math.max(0, align === "start" ? 0 : align === "end" ? availW - span : Math.floor((availW - span) / 2));
  return (
    <div className={`play seat-${seat}${latest ? " latest" : ""}`} ref={ref} style={top === undefined ? undefined : { top }}>
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

/** The trick's four plays in their three rows, and what the empty felt says. */
export function Pile() {
  const { game, dealId } = useGame();
  const [ref, { height }] = useElementSize<HTMLDivElement>();
  if (!game) return null;
  const plays = trickPlays(game);
  const bySeat = new Map(plays.map((p) => [p.seat, p]));
  // Row tops from the area's height (logical px, platform/useElementSize): the bottom row flush
  // with the bottom, the middle row halfway, every offset a whole px.
  const slotH = PLAY_CARD_H + PLAY_SLACK_PT;
  const bottom = Math.max(0, height - slotH);
  const middle = Math.floor(bottom / 2);
  const tops: Record<number, number> = { 2: 0, 1: middle, 3: middle, [HUMAN]: bottom };
  return (
    <div className="plays" ref={ref}>
      {SEATS.map((seat) => (
        <TrickSlot key={seat} seat={seat} play={bySeat.get(seat)} latest={game.lastPlay !== null && game.lastBy === seat} dealId={dealId} top={tops[seat]} />
      ))}
      {plays.length === 0 && <div className="felt-empty">{emptyFeltText(game)}</div>}
    </div>
  );
}

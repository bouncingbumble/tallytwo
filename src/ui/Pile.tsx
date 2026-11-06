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
 * x, placed in the slot by whole pixels, resting at rotate(0). A new play flies in
 * (styles/motion.css `fly`, timing.PLAY_FLY_MS): each card leaves from behind its player's
 * portrait — from behind the hand strip for the human — tumbling, the cards meet as a stack in
 * the middle of where the play will lie, then spread into place. The portraits sit above the
 * slots (table.css .opp z-index), so a card is hidden until it clears its portrait's frame. A
 * seat's card group is keyed by its play, so a new play flies in and an older one stays still.
 */
import { type CSSProperties, useLayoutEffect, useRef } from "react";
import { HUMAN, type TrickPlay, emptyFeltText, trickPlays } from "../game/selectors";
import { PLAY_FLY_MS, PLAY_FLY_STAGGER_MS } from "../game/timing";
import { useGame } from "../game/useGame";
import { useElementSize } from "../platform/useElementSize";
import { useScale } from "../platform/useFitScale";
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

/** The human's cards start this far below their slot's top, inside the hand strip (which sits above the felt). */
const HAND_DROP = PLAY_CARD_H + 70;
/**
 * Where a play's cards start, as a translate of a card in its slot, in logical px: centred on
 * the player's portrait, or low in the hand strip for the human. Read from the DOM once, before
 * the first paint of the play (useLayoutEffect), and written to the group as --ox / --oy.
 */
function originFor(slot: HTMLElement, seat: number, k: number): { ox: number; oy: number } {
  const s = slot.getBoundingClientRect();
  const face = seat === HUMAN ? null : slot.closest(".felt")?.querySelector<HTMLElement>(`.opp.seat-${seat} .face`);
  if (!face) return { ox: Math.round(s.width / k / 2 - PLAY_CARD_W / 2), oy: HAND_DROP };
  const f = face.getBoundingClientRect();
  return {
    ox: Math.round((f.left + f.width / 2 - s.left) / k - PLAY_CARD_W / 2),
    oy: Math.round((f.top + f.height / 2 - s.top) / k - PLAY_CARD_H / 2 - 1),
  };
}

export function TrickSlot({ seat, play, latest, dealId, top }: { seat: number; play: TrickPlay | undefined; latest: boolean; dealId: number; top?: number }) {
  const [ref, availW] = useElementWidth<HTMLDivElement>();
  const k = useScale();
  const group = useRef<HTMLDivElement>(null);
  const playKey = play ? `${dealId}-${play.at}` : null;
  // A new play: point its cards' flight at the portrait before the browser paints its first frame.
  useLayoutEffect(() => {
    const slot = ref.current;
    const g = group.current;
    if (!slot || !g || playKey === null) return;
    const { ox, oy } = originFor(slot, seat, k);
    g.style.setProperty("--ox", ox + "px");
    g.style.setProperty("--oy", oy + "px");
  }, [playKey, seat, k, ref]);
  const cardW = PLAY_CARD_W;
  const n = play?.cards.length ?? 0;
  const step = n > 1 ? Math.max(MIN_STEP, Math.min(PILE_STEP, Math.floor((availW - cardW) / (n - 1)))) : 0;
  const span = n ? cardW + (n - 1) * step : 0;
  const align = ALIGN[seat] ?? "center";
  const x0 = Math.max(0, align === "start" ? 0 : align === "end" ? availW - span : Math.floor((availW - span) / 2));
  // where the cards meet as a stack before they spread: the middle of the span
  const cx = x0 + Math.floor((span - cardW) / 2);
  return (
    <div className={`play seat-${seat}${latest ? " latest" : ""}`} ref={ref} style={top === undefined ? undefined : { top }}>
      {play && (
        <div className="cards" key={playKey} ref={group} style={{ "--cx": cx + "px" } as CSSProperties}>
          {play.cards.map((v, i) => {
            const x = x0 + i * step;
            const style = {
              "--x": x + "px",
              "--rot": (i % 2 ? 1 : -1) * (3 + i * 1.5) + "deg",
              transform: `translate(${x}px, 0)`,
              zIndex: i,
              animationDuration: PLAY_FLY_MS + "ms",
              animationDelay: i * PLAY_FLY_STAGGER_MS + "ms",
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

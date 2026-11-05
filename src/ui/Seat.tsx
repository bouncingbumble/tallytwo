/**
 * One opponent's badge on the felt: portrait, name, back chips and count, the running tally,
 * the "passed" badge and what they just said (P:846-867). A bark is spoken on the card itself,
 * a speech bubble over the info column pointing at the portrait — never a toast off the top. Active / low / out are classes on .opp; the portrait comes
 * from portraitFor() in selectors.ts, so this file never reaches into ai/. The seat's current
 * play sits in the slot directly beneath (ui/Pile.tsx).
 */
import { COPY } from "../game/copy";
import { portraitFor } from "../game/selectors";
import { useGame } from "../game/useGame";
import { Bark } from "./Bark";

/** "+3" / "0" / "-7", as the top bar and the poster show a tally. */
const signed = (n: number): string => (n > 0 ? `+${n}` : String(n));

/** At most this many back chips are drawn, whatever the count says (P:859). */
const MAX_CHIPS = 5;

export function Seat({ seat }: { seat: number }) {
  const { game, barks } = useGame();
  if (!game) return null;
  const p = game.players[seat];
  const n = p.hand.length;
  const cls = ["opp", `seat-${seat}`, game.turn === seat && game.phase === "playing" && "active", n <= 3 && "low", n === 0 && "out"].filter(Boolean).join(" ");
  const key = portraitFor(p);
  const said = barks.filter((b) => b.seat === seat).at(-1);
  return (
    <div className={cls}>
      {/* the portrait is a CSS class per key (styles/table.css): one 3x file drawn at the art size in CSS px (docs/ASSETS.md §7) */}
      <div className={"face" + (key ? " " + key : "")} />
      <div className="info">
        <div className="nm">{p.name}</div>
        <div className="cnt">
          <span className="backs">
            {Array.from({ length: Math.min(MAX_CHIPS, n) }, (_, i) => (
              <i key={i} />
            ))}
          </span>
          <b>{n}</b>
        </div>
        <div className="tl">
          {COPY.seat.tally} <b>{signed(game.totals[seat])}</b>
        </div>
      </div>
      {p.passed && game.lastPlay && <span className="badge">{COPY.seat.passed}</span>}
      {/* the latest line only: a new bark replaces the last one on the card */}
      {said && <Bark key={said.id} text={said.text} />}
    </div>
  );
}

/**
 * The felt: a 3x3 grid (styles/table.css) — the opponents' plays along the top under their
 * seats, the sign in the middle, the human's play along the bottom (ui/Pile.tsx) — with the
 * 170-ms dip when cards land (P:942, P:965). The dip is skipped under reduce motion and never
 * fires on a deal or a pass.
 */
import { useEffect, useState } from "react";
import { NUDGE_MS } from "../game/timing";
import { useGame } from "../game/useGame";
import { useSettings } from "../settings/useSettings";
import { Pile, lastPlayAt } from "./Pile";
import { Sign } from "./Sign";

export function Felt() {
  const { game, dealId } = useGame();
  const { opts } = useSettings();
  // Identifies the play on the table; null when the lead is open or there is no game.
  const landed = game && game.lastPlay ? dealId + "-" + lastPlayAt(game) : null;
  // The play the felt is dipping for: set the moment a new play lands (state keyed to a value,
  // the documented reset-on-change pattern) and cleared by the timer below.
  const [prev, setPrev] = useState(landed);
  const [dipping, setDipping] = useState<string | null>(null);
  if (landed !== prev) {
    setPrev(landed);
    if (landed !== null && !opts.reduceMotion) setDipping(landed);
  }
  useEffect(() => {
    if (dipping === null) return;
    const t = setTimeout(() => setDipping(null), NUDGE_MS);
    return () => clearTimeout(t);
  }, [dipping]);
  return (
    <div className={"felt" + (dipping !== null ? " nudge" : "")}>
      <Sign />
      <Pile />
    </div>
  );
}

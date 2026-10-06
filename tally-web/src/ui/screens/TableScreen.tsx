/**
 * The live round: topbar, three seats, felt, hand, status, controls (P:232-251). Owns the one
 * piece of UI-only state the table has: the "Sorted by rank." flash on the status line.
 */
import { useEffect, useState } from "react";
import { COPY } from "../../game/copy";
import { useGame } from "../../game/useGame";
import { Controls } from "../Controls";
import { Felt } from "../Felt";
import { Hand } from "../Hand";
import { Seat } from "../Seat";
import { StatusLine } from "../StatusLine";
import { TopBar } from "../TopBar";

const OPPONENTS = [1, 2, 3];
/** How long the Sort flash stays. (Belongs in game/timing.ts, which has no slot for it yet.) */
const SORT_FLASH_MS = 1200;

interface Flash {
  text: string;
  /** The status text at the time of the sort: a new status (a tap, an AI move) wins over the flash, P:837. */
  over: string;
}

export function TableScreen({ onMenu }: { onMenu: () => void }) {
  const { status } = useGame();
  const [flash, setFlash] = useState<Flash | null>(null);
  useEffect(() => {
    if (flash === null) return;
    const t = setTimeout(() => setFlash(null), SORT_FLASH_MS);
    return () => clearTimeout(t);
  }, [flash]);
  const shown = flash !== null && flash.over === status.text ? flash.text : null;
  return (
    <section className="screen table">
      <TopBar onMenu={onMenu} />
      <div className="opps">
        {OPPONENTS.map((seat) => (
          <Seat key={seat} seat={seat} />
        ))}
      </div>
      <Felt />
      <div className="handwrap">
        <Hand />
      </div>
      <StatusLine flash={shown} />
      <Controls onSort={(by) => setFlash({ text: COPY.status.sortedBy(by), over: status.text })} />
    </section>
  );
}

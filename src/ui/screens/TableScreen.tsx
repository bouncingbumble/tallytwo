/**
 * The live round, a phone held sideways (styles/table.css):
 *
 *     felt    side        felt: the opponents and the trick; side: round, tally, menu, the sign, the status, the buttons
 *     hand    side        the fan
 */
import { Controls } from "../Controls";
import { Felt } from "../Felt";
import { Hand } from "../Hand";
import { Sign } from "../Sign";
import { StatusLine } from "../StatusLine";
import { TopBar } from "../TopBar";

export function TableScreen({ onMenu }: { onMenu: () => void }) {
  return (
    <section className="screen table">
      <Felt />
      <aside className="side">
        <TopBar onMenu={onMenu} />
        <Sign />
        <StatusLine />
        <Controls />
      </aside>
      <div className="handwrap">
        <Hand />
      </div>
    </section>
  );
}

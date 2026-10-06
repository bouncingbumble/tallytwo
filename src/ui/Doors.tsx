/**
 * The batwing doors on the title (P:225, P:1223-1228): three sprite frames from the B-4 sheet —
 * closed, ajar, open — stacked, with a warm glow behind. `open` starts the swing: the CSS steps
 * through the frames (styles/base.css .doors.open, 200 and 420 ms) and the title waits
 * DOORS_MS before dealing.
 */
export function Doors({ open }: { open: boolean }) {
  return (
    <div className={"doors" + (open ? " open" : "")} aria-hidden="true">
      <div className="glow" />
      <i className="sp sp-doors leaf f-closed" />
      <i className="sp sp-doors leaf f-ajar" />
      <i className="sp sp-doors leaf f-open" />
    </div>
  );
}

/**
 * The saloon doors on the title (P:225, P:1223-1228). The swing itself is CSS (.doors.open in
 * styles/base.css); the title flips `open` and waits DOORS_MS before dealing.
 */
export function Doors({ open }: { open: boolean }) {
  return (
    <div className={"doors" + (open ? " open" : "")}>
      <div className="glow" />
    </div>
  );
}

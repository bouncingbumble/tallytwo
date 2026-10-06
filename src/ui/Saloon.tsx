/**
 * The saloon behind the hand: a 900-px room of sprites (styles/table.css .saloon) centred in
 * the hand strip and clipped to it, so the fan covers it at thirteen cards and reveals it from
 * both ends as the hand is played down. The room is placed by a whole px from the strip's
 * measured width, never by a percentage: a half-pixel offset would blur every sprite.
 */
import { useElementWidth } from "../platform/useElementWidth";

/** The room's width in CSS px (table.css .saloon .room). */
export const ROOM_W = 900;

export function Saloon() {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const left = Math.floor((width - ROOM_W) / 2);
  return (
    <div className="saloon" ref={ref} aria-hidden="true">
      <div className="room" style={{ left }}>
        <i className="sp sp-plant r-plant" />
        <i className="sp sp-stool_grey r-stool-grey" />
        <i className="sp sp-piano r-piano" />
        <i className="sp sp-sign_backdoor r-backdoor" />
        <i className="sp sp-chair r-chair" />
        <i className="sp sp-barrel r-barrel" />
        <i className="sp sp-chips r-chips" />
        <i className="sp sp-back_bar r-back-bar" />
        <i className="sp sp-stool r-stool-1" />
        <i className="sp sp-stool r-stool-2" />
        <i className="sp sp-sconce r-sconce" />
        <i className="sp sp-sign_hanging r-sign" />
        <i className="sp sp-poker_table r-table" />
        <i className="sp sp-fireplace r-fireplace" />
        <i className="sp sp-chair r-chair-2" />
      </div>
    </div>
  );
}

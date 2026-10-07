/**
 * The felt (styles/table.css): the three opponents' badges along its top edge, the trick's four
 * plays staggered in three rows beneath (ui/Pile.tsx). The sign, the score and the buttons live
 * in the side column (ui/screens/TableScreen.tsx). The felt itself stays still when cards land:
 * the prototype's dip (P:942) was dropped as a distraction.
 */
import { Pile } from "./Pile";
import { Seat } from "./Seat";

const OPPONENTS = [1, 2, 3];

export function Felt() {
  return (
    <div className="felt">
      {OPPONENTS.map((seat) => (
        <Seat key={seat} seat={seat} />
      ))}
      <Pile />
    </div>
  );
}

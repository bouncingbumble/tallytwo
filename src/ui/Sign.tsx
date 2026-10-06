/**
 * The wooden sign on the felt: who played, and what (P:240; words from signFor in selectors.ts).
 */
import { useGame } from "../game/useGame";

export function Sign() {
  const { sign } = useGame();
  return (
    <div className="sign">
      <span className="who">{sign.who}</span>
      <span>{sign.text}</span>
    </div>
  );
}

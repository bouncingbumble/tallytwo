/**
 * Round number, the human's running tally (with a + for a positive total, P:906) and the
 * menu button (P:233-237).
 */
import { COPY } from "../game/copy";
import { HUMAN } from "../game/selectors";
import { useGame } from "../game/useGame";

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { game } = useGame();
  if (!game) return null;
  const total = game.totals[HUMAN];
  return (
    <div className="topbar">
      <span className="rd">
        {COPY.topbar.round} <b>{game.round}</b>
      </span>
      <span className="tally">
        {COPY.topbar.tally} <b>{(total > 0 ? "+" : "") + total}</b>
      </span>
      <button type="button" className="iconbtn" aria-label={COPY.topbar.menu} onClick={onMenu}>
        ☰
      </button>
    </div>
  );
}

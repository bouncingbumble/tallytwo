/**
 * The banner that drops over the felt when the match's final round is dealt: "Final round,
 * Dusty Vane is wanted". The text and the timing are the provider's (selectors.finalRoundText,
 * timing.FINAL_ROUND_MS); this only draws it. Keyed by id so a fresh announcement replays the
 * keyframes (motion.css `announce`).
 */
import { useGame } from "../game/useGame";

export function Announcement() {
  const { announcement } = useGame();
  if (!announcement) return null;
  return (
    <div className="announce" key={announcement.id} role="status" aria-live="assertive">
      <div className="announce-plate western">{announcement.text}</div>
    </div>
  );
}

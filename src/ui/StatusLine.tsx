/**
 * The line under the hand (P:835-843): statusFor's text and tone, or a short override — the
 * Sort flash that TableScreen owns.
 */
import { useGame } from "../game/useGame";

export function StatusLine({ flash }: { flash?: string | null }) {
  const { status } = useGame();
  if (flash) return <div className="status">{flash}</div>;
  return <div className={"status" + (status.tone === "neutral" ? "" : " " + status.tone)}>{status.text}</div>;
}

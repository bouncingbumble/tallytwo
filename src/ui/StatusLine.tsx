/**
 * The line in the side column (P:835-843): statusFor's text and tone.
 */
import { useGame } from "../game/useGame";

export function StatusLine() {
  const { status } = useGame();
  return <div className={"status" + (status.tone === "neutral" ? "" : " " + status.tone)}>{status.text}</div>;
}

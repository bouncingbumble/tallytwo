/**
 * "Copy game log" as one button, shared by the crash screen and the in-game settings sheet:
 * writes the text through the clipboard, shows "Copied" for a moment, and swallows clipboard
 * failures (no permission, plain http on a LAN phone) — the log is on screen in a selectable
 * <pre> either way, so a failed copy is not an error, it just never says "Copied".
 */
import { useEffect, useRef, useState } from "react";

/** timing.ts holds every other ms number; it has no entry for this flash. */
const COPIED_MS = 1500;

/** Resolves false instead of throwing when the clipboard is missing or refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export interface CopyButtonProps {
  /** Called at click time, so a large log is only serialised when asked for. */
  text: () => string;
  label: string;
  copiedLabel: string;
  /** Replaces the clipboard write when given (a host with its own clipboard, or a test). */
  onCopy?: () => void;
  className?: string;
}

export function CopyButton({ text, label, copiedLabel, onCopy, className = "btn" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const click = async () => {
    let ok = true;
    if (onCopy) onCopy();
    else ok = await copyText(text());
    if (!ok) return;
    setCopied(true);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  return (
    <button type="button" className={className} onClick={() => void click()}>
      {copied ? copiedLabel : label}
    </button>
  );
}

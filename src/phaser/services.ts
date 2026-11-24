/**
 * What the scenes reach: the stores, the open sheet, the ?seed= and the clipboard. Set once by
 * main.ts before the Phaser game boots; scenes read it, never construct it.
 */
import type { Value } from "../game/observable";
import type { Sheet } from "../game/selectors";
import type { GameStore } from "../game/store";
import type { SettingsStore } from "../settings/store";

export interface Services {
  game: GameStore;
  settings: SettingsStore;
  sheet: Value<Sheet>;
  /** A fixed ?seed= replays the same deal every time; without one, each deal draws a fresh seed. */
  seed: number | undefined;
  /** A render-time error (not an engine throw: those are the store's crash report). */
  fault: Value<Error | null>;
}

let current: Services | null = null;

export function provide(s: Services): void {
  current = s;
}

export function services(): Services {
  if (!current) throw new Error("services() before provide()");
  return current;
}

/** Resolves false instead of throwing when the clipboard is missing or refuses (no permission, plain http on a LAN phone). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

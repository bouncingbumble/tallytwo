/** DEV-only hooks on window (dev/DevHook.tsx, audio/WebAudio.ts). */
import type { AppAction } from "../game/appReducer";
import type { GameState } from "../engine/state";

declare global {
  interface Window {
    __tally?: { act(a: AppAction): void; readonly game: GameState | null };
    __music?: { readonly gain: { bus: number; duck: number; track: string | null; playing: string[] } };
  }
}

export {};
